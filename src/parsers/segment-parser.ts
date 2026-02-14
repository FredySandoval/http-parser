import type {
  ClassifiedSegment,
  LineContext,
  Request,
  ExpectedResponse,
  FileVariable,
  Header,
  QueryParam,
} from '../types/types';
import { VariableRegistry } from '../scanner/variable-scanner';
import { HTTPRequestLineParser } from './request-line';
import { ResponseLineParser } from './response-line';
import { HeaderParser } from './header-parser';
import { BodyParser } from './body-parser';
import { QueryParser } from './query-parser';

/**
 * SegmentParser orchestrates the parsing of individual segments into AST nodes.
 *
 * Responsibilities:
 * - Route segments to appropriate specialized parsers based on classification
 * - Coordinate request-line, header, query, and body parsing
 * - Build complete Request or ExpectedResponse objects
 * - Handle variable substitution context per segment
 *
 * @example
 * Input: ClassifiedSegment (HTTP request type)
 * Output: Request AST node with all parsed components
 */
export class SegmentParser {
  private requestLineParser: HTTPRequestLineParser;
  private responseLineParser: ResponseLineParser;
  private headerParser: HeaderParser;
  private bodyParser: BodyParser;
  private queryParser: QueryParser;

  constructor() {
    this.requestLineParser = new HTTPRequestLineParser();
    this.responseLineParser = new ResponseLineParser();
    this.headerParser = new HeaderParser();
    this.bodyParser = new BodyParser();
    this.queryParser = new QueryParser();
  }

  /**
   * input: ClassifiedSegment, VariableRegistry
   * output: Request | ExpectedResponse | null (for empty/comment-only segments)
   *
   * Parses a classified segment into its AST representation.
   * Routes to request or response parsing based on messageType.
   */
  parseSegment(
    segment: ClassifiedSegment,
    registry: VariableRegistry
  ): Request | ExpectedResponse | null {
    if (segment.messageType === 'response') {
      return this.parseResponseSegment(segment, registry);
    } else {
      return this.parseRequestSegment(segment, registry);
    }
  }

  /**
   * input: ClassifiedSegment (messageType: 'request'), VariableRegistry
   * output: Request AST node
   *
   * Parses an HTTP or cURL request segment.
   * Steps:
   * 1. Find and parse request line (method, URL, version)
   * 2. Extract query parameters from URL
   * 3. Parse headers section
   * 4. Parse body if present
   * 5. Collect block-level variables and comments
   * 6. Extract request name from @name directive if present
   */
  private parseRequestSegment(
    segment: ClassifiedSegment,
    registry: VariableRegistry
  ): Request | null {
    const lines = segment.lines;
    const significantLineIndex = this.findSignificantLineIndex(lines);

    if (significantLineIndex === -1) {
      // No executable request line (e.g. only comments/directives) -> skip segment.
      return null;
    }

    const requestLine = lines[significantLineIndex]!.text;
    const parsedRequestLine = this.requestLineParser.parse(requestLine);

    // Parse query parameters from lines following the request line
    const remainingLines = lines.slice(significantLineIndex + 1);
    const queryResult = this.queryParser.parse(remainingLines);
    const queryParams: QueryParam[] = queryResult.queryParams;

    // Headers start after query parameters
    const headersStartIndex =
      significantLineIndex + 1 + queryResult.consumedLinesCount;
    const headerLines = lines.slice(headersStartIndex);
    const headerResult = this.headerParser.parse(headerLines);
    const headers: Header[] = headerResult.headers;

    // Body starts after headers and the empty line separator
    const bodyStartLineIndex =
      headersStartIndex + headerResult.consumedLinesCount;
    const bodyStartIndex = this.findBodyStartIndex(lines, bodyStartLineIndex);
    const bodyLines =
      bodyStartIndex < lines.length ? lines.slice(bodyStartIndex) : [];
    // Only parse body if there are actual body lines with content
    const hasBodyContent = bodyLines.some(
      (line) => line.text.trim().length > 0
    );
    const body = hasBodyContent
      ? this.bodyParser.parse(bodyLines, headers)
      : null;

    // Extract metadata
    const name = this.extractRequestName(lines);
    const blockVariables = this.extractBlockVariables(lines);
    const comments = this.extractComments(lines);

    return {
      name,
      method: parsedRequestLine.method,
      url: parsedRequestLine.url,
      httpVersion: parsedRequestLine.httpVersion,
      queryParams,
      headers,
      body,
      blockVariables: { fileVariables: blockVariables },
      comments,
      rawTextRange: {
        startLine: segment.startLine,
        endLine: segment.endLine,
      },
      expectedResponse: null,
    };
  }

  /**
   * input: ClassifiedSegment (messageType: 'response'), VariableRegistry
   * output: ExpectedResponse AST node
   *
   * Parses an expected HTTP response segment.
   * Steps:
   * 1. Parse response line (HTTP version, status code, status text)
   * 2. Parse headers section
   * 3. Parse body as raw text (expected responses don't need complex body parsing)
   * 4. Collect block-level variables
   */
  private parseResponseSegment(
    segment: ClassifiedSegment,
    registry: VariableRegistry
  ): ExpectedResponse {
    const lines = segment.lines;
    const significantLineIndex = this.findSignificantLineIndex(lines);

    if (significantLineIndex === -1) {
      // Empty segment - return minimal response
      return {
        statusCode: 0,
        statusText: null,
        httpVersion: null,
        headers: [],
        body: null,
        variables: { fileVariables: [] },
        rawTextRange: {
          startLine: segment.startLine,
          endLine: segment.endLine,
        },
      };
    }

    const responseLine = lines[significantLineIndex]!.text;
    const parsedResponseLine = this.responseLineParser.parse(responseLine);

    // Headers start after the response line
    const headersStartIndex = significantLineIndex + 1;
    const headerLines = lines.slice(headersStartIndex);
    const headerResult = this.headerParser.parse(headerLines);
    const headers: Header[] = headerResult.headers;

    // Body starts after headers and the empty line separator
    const bodyStartLineIndex =
      headersStartIndex + headerResult.consumedLinesCount;
    const bodyStartIndex = this.findBodyStartIndex(lines, bodyStartLineIndex);
    const bodyLines =
      bodyStartIndex < lines.length ? lines.slice(bodyStartIndex) : [];

    // For expected responses, body is kept as raw text
    const rawBody = bodyLines.map((line) => line.text).join('\n');
    const body = rawBody.trim() || null;

    // Extract block-level variables
    const blockVariables = this.extractBlockVariables(lines);

    return {
      statusCode: parsedResponseLine.statusCode ?? 0,
      statusText: parsedResponseLine.statusText,
      httpVersion: parsedResponseLine.httpVersion,
      headers,
      body,
      variables: { fileVariables: blockVariables },
      rawTextRange: {
        startLine: segment.startLine,
        endLine: segment.endLine,
      },
    };
  }

  /**
   * Finds the index of the first significant line in a segment.
   * Skips empty lines, comments (starting with #), and directives (starting with @).
   */
  private findSignificantLineIndex(lines: LineContext[]): number {
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i]!.text.trim();
      // Skip empty lines, comments, and directives
      if (
        trimmed.length > 0 &&
        !trimmed.startsWith('#') &&
        !trimmed.startsWith('@')
      ) {
        return i;
      }
    }
    return -1;
  }

  /**
   * input: LineContext[], startIndex
   * output: number (index of first empty line, or lines.length if none)
   *
   * Finds the index of the first empty line after headers.
   * Used to separate headers from body content.
   */
  private findBodyStartIndex(lines: LineContext[], startIndex: number): number {
    for (let i = startIndex; i < lines.length; i++) {
      if (lines[i]!.text.trim() === '') {
        return i + 1; // Return index after the empty line
      }
    }
    return lines.length;
  }

  /**
   * input: LineContext[]
   * output: string | null
   *
   * Extracts @name directive value if present in segment comments.
   * Example: "@name CreateUser" -> "CreateUser"
   */
  private extractRequestName(lines: LineContext[]): string | null {
    const namePattern = /^\s*@name\s+(.+)$/i;

    for (const line of lines) {
      const match = line.text.match(namePattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * input: LineContext[], VariableRegistry
   * output: FileVariable[]
   *
   * Collects all @variable definitions within a segment.
   * These are block-scoped variables that override file-level variables.
   * Excludes the @name directive which is handled separately.
   */
  private extractBlockVariables(lines: LineContext[]): FileVariable[] {
    const variables: FileVariable[] = [];
    const variablePattern = /^\s*@(\w+)\s*=\s*(.*)$/;

    for (const line of lines) {
      const match = line.text.match(variablePattern);
      if (match && match[1]) {
        const key = match[1];
        // Skip @name directive
        if (key.toLowerCase() === 'name') {
          continue;
        }
        const value = match[2]?.trim() ?? '';
        variables.push({
          key,
          value,
          lineNumber: line.lineNumber,
          segmentId: null, // Block variables don't have segmentId in this context
        });
      }
    }

    return variables;
  }

  /**
   * input: LineContext[]
   * output: string[]
   *
   * Collects all comment lines (lines starting with #) in the segment.
   * Excludes delimiter lines (###) and directive lines (@name, @variable).
   */
  private extractComments(lines: LineContext[]): string[] {
    const comments: string[] = [];
    const commentPattern = /^\s*#\s*(.+)$/;
    const directivePattern = /^\s*@/;
    const delimiterPattern = /^\s*#{3,}\s*$/;

    for (const line of lines) {
      const trimmed = line.text.trim();

      // Skip delimiter lines
      if (delimiterPattern.test(trimmed)) {
        continue;
      }

      // Skip directive lines (starting with @)
      if (directivePattern.test(trimmed)) {
        continue;
      }

      // Extract comment text
      const match = line.text.match(commentPattern);
      if (match && match[1]) {
        comments.push(match[1].trim());
      }
    }

    return comments;
  }
}

/**
 * Result of segment parsing operation.
 */
export interface SegmentParseResult {
  /** The parsed AST node (Request or ExpectedResponse) */
  node: Request | ExpectedResponse;
  /** Any errors encountered during parsing */
  errors: ParseError[];
}

/**
 * Error information for segment parsing failures.
 */
export interface ParseError {
  /** Error message describing what went wrong */
  message: string;
  /** Line number where the error occurred */
  lineNumber: number;
  /** Type of error for categorization */
  type: 'syntax' | 'validation' | 'semantic';
}
