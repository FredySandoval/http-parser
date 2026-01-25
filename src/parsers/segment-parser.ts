import type { ClassifiedSegment } from '../segmenter/classifier';
import type { Request, ExpectedResponse } from '../ast';
import { SystemVariableScanner } from '../scanner/system-variable-scanner';
import { DirectiveScanner } from './directive-scanner';
import { VariableScanner } from '../scanner/variable-scanner';
import { CurlParser } from './curl-parser';
import { RequestLineParser } from './request-line';
import { ResponseLineParser } from './response-line';
import { QueryParser } from './query-parser';
import { HeaderParser, type Header } from './header-parser';
import { BodyParser } from './body-parser';
import { VariableKind } from '../scanner/system-variable-scanner';

/**
 * SegmentParser Class
 * Orchestrates the sub-parsers to transform a ClassifiedSegment into an AST object.
 */
export class SegmentParser {
  constructor(
    private systemVariableScanner = new SystemVariableScanner(),
    private directiveScanner = new DirectiveScanner(),
    private variableScanner = new VariableScanner(),
    private curlParser = new CurlParser(),
    private requestLineParser = new RequestLineParser(),
    private responseLineParser = new ResponseLineParser(),
    private queryParser = new QueryParser(),
    private headerParser = new HeaderParser(),
    private bodyParser = new BodyParser()
  ) {}

  /**
   * Parses a classified segment into a Request or ExpectedResponse object.
   *
   * @param segment - The classified segment to parse
   * @returns Request or ExpectedResponse object
   */
  parse(segment: ClassifiedSegment): Request | ExpectedResponse {
    // 1. System Variable Scanning (identifies {{...}} everywhere)
    const enrichedLines = this.systemVariableScanner.scan(segment.lines);

    // 2. Directive Scanning (categorizes lines)
    const directivesResult = this.directiveScanner.scan(enrichedLines);

    // 3. Variable Scanning (extracts definitions and settings)
    const variablesResult = this.variableScanner.scan(enrichedLines);

    if (segment.type === 'request') {
      let request: Request;

      if (segment.subtype === 'curl') {
        // 4. cURL Sub-Parser
        const curlResult = this.curlParser.parse(enrichedLines);
        if (!curlResult) {
          throw new Error('Failed to parse cURL segment');
        }

        request = {
          name: variablesResult.requestName ?? null,
          method: curlResult.method,
          url: curlResult.url,
          httpVersion: null,
          queryParams: [], // cURL parser usually includes query in URL
          headers: curlResult.headers,
          body: curlResult.body
            ? { type: 'raw', raw: curlResult.body.raw }
            : null,
          variables: {
            file: variablesResult.fileVariables,
            prompt: variablesResult.prompts,
            request: enrichedLines
              .flatMap((l) => l.variables)
              .filter((v) => v.kind === VariableKind.Request),
          },
          settings: variablesResult.settings,
          comments: directivesResult.comments.map((c) => c.text),
          rawTextRange: {
            startLine: segment.startLine,
            endLine: segment.endLine,
          },
          expectedResponse: null,
        };
      } else {
        // 5. Standard HTTP Request Parsing
        const contentLines = directivesResult.content;

        // Request Line
        // The first non-empty line of the content is the request line
        let requestLineIndex = -1;
        for (let i = 0; i < contentLines.length; i++) {
          if (contentLines[i]!.text.trim().length > 0) {
            requestLineIndex = i;
            break;
          }
        }

        const requestLineText =
          requestLineIndex !== -1 ? contentLines[requestLineIndex]!.text : '';
        const requestLine = this.requestLineParser.parse(requestLineText);
        let remainingLines =
          requestLineIndex !== -1
            ? contentLines.slice(requestLineIndex + 1)
            : contentLines;

        // Query Parameters
        const queryResult = this.queryParser.parse(remainingLines);
        remainingLines = remainingLines.slice(queryResult.consumedLinesCount);

        // Headers
        const headerResult = this.headerParser.parse(remainingLines);
        remainingLines = remainingLines.slice(headerResult.consumedLinesCount);

        // If there's an empty line between headers and body, skip it
        if (remainingLines[0] && remainingLines[0].text.trim() === '') {
          remainingLines = remainingLines.slice(1);
        }

        // Body
        const contentType = headerResult.headers.find(
          (h) => h.name.toLowerCase() === 'content-type'
        )?.value;
        const body = this.bodyParser.parse({
          lines: remainingLines,
          contentType,
          isGraphQL: segment.subtype === 'graphql',
        });

        request = {
          name: variablesResult.requestName ?? null,
          method: requestLine.method,
          url: requestLine.url,
          httpVersion: requestLine.httpVersion ?? null,
          queryParams: queryResult.queryParams,
          headers: headerResult.headers,
          body: body.type === 'raw' && body.raw === '' ? null : body,
          variables: {
            file: variablesResult.fileVariables,
            prompt: variablesResult.prompts,
            request: enrichedLines
              .flatMap((l) => l.variables)
              .filter((v) => v.kind === VariableKind.Request),
          },
          settings: variablesResult.settings,
          comments: directivesResult.comments.map((c) => c.text),
          rawTextRange: {
            startLine: segment.startLine,
            endLine: segment.endLine,
          },
          expectedResponse: null,
        };
      }

      return request;
    } else {
      // 6. Response Parsing
      const contentLines = directivesResult.content;

      // Response Line
      // The first non-empty line of the content is the response line
      let responseLineIndex = -1;
      for (let i = 0; i < contentLines.length; i++) {
        if (contentLines[i]!.text.trim().length > 0) {
          responseLineIndex = i;
          break;
        }
      }

      const responseLineText =
        responseLineIndex !== -1 ? contentLines[responseLineIndex]!.text : '';
      const responseLine = this.responseLineParser.parse(responseLineText);
      let remainingLines =
        responseLineIndex !== -1
          ? contentLines.slice(responseLineIndex + 1)
          : contentLines;

      // Headers
      const headerResult = this.headerParser.parse(remainingLines);
      remainingLines = remainingLines.slice(headerResult.consumedLinesCount);

      // If there's an empty line between headers and body, skip it
      if (remainingLines[0] && remainingLines[0]!.text.trim() === '') {
        remainingLines = remainingLines.slice(1);
      }

      // Body
      const contentType = headerResult.headers.find(
        (h) => h.name.toLowerCase() === 'content-type'
      )?.value;
      const body = this.bodyParser.parse({
        lines: remainingLines,
        contentType,
        isGraphQL: false,
      });

      const response: ExpectedResponse = {
        statusCode: responseLine.statusCode ?? 200, // Default to 200 if missing? Spec says "is required" but gives default null if omitted.
        statusText: responseLine.statusText ?? null,
        httpVersion: responseLine.httpVersion ?? null,
        headers: headerResult.headers,
        body:
          body.type === 'raw'
            ? body.raw === '' || body.raw === undefined
              ? null
              : body.raw
            : null, // Spec says string | object, non-raw bodies return null
        variables: {
          file: variablesResult.fileVariables,
        },
        rawTextRange: {
          startLine: segment.startLine,
          endLine: segment.endLine,
        },
      };

      return response;
    }
  }
}
