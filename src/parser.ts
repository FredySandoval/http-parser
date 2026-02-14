import type {
  ParseResult,
  ParseMetadata,
  ParserOptions,
  LineContext,
  Segment,
  HttpRequestAST,
  Request,
  ExpectedResponse,
  ClassifiedSegment,
  ScanResult,
  SourceMetadata,
} from './types/types';
import { LineScanner } from './scanner/line-scanner';
import { Segmenter } from './segmenter/segmenter';
import { VariableScanner, VariableRegistry } from './scanner/variable-scanner';
import { SegmentClassifier } from './segmenter/classifier';
import { SegmentParser } from './parsers/segment-parser';

/**
 * HttpRequestParser - Main Orchestrator
 *
 * Coordinates the entire parsing pipeline from raw text to structured AST.
 * Manages all sub-components and assembles the final ParseResult.
 *
 * Responsibilities:
 * - Coordinate line scanning, segmentation, classification, and parsing
 * - Manage variable scanning and registry population
 * - Link responses to their preceding requests
 * - Assemble final ParseResult with all metadata
 *
 * Parsing Pipeline:
 * 1. Line Scanning - split text into lines with metadata
 * 2. Segmentation - group lines into segments by ### delimiters
 * 3. Variable Scanning - extract file-level and block-level variables
 * 4. Classification - determine if segment is request or response
 * 5. Segment Parsing - parse each segment into AST nodes
 * 6. Response Linking - associate responses with preceding requests
 * 7. Result Assembly - build final ParseResult
 *
 * @example
 * const parser = new HttpRequestParser();
 * const result = parser.parseText(rawHttpFile);
 */
export class HttpRequestParser {
  private lineScanner: LineScanner;
  private segmenter: Segmenter;
  private variableScanner: VariableScanner;
  private segmentClassifier: SegmentClassifier;
  private segmentParser: SegmentParser;
  private options: ParserOptions;

  /**
   * Creates a new HttpRequestParser with optional configuration.
   *
   * @param options - Parser configuration options
   */
  constructor(options?: ParserOptions) {
    this.options = options ?? {};
    this.lineScanner = new LineScanner();
    this.segmenter = new Segmenter();
    this.variableScanner = new VariableScanner();
    this.segmentClassifier = new SegmentClassifier();
    this.segmentParser = new SegmentParser();
  }

  /**
   * Main entry point for parsing HTTP files.
   * Executes the full parsing pipeline and returns structured result.
   *
   * @param text - Raw HTTP file content to parse
   * @returns Complete ParseResult with AST and metadata
   *
   * @example
   * Input: "GET https://api.example.com/users\n###\nPOST /create"
   * Output: {
   *   text: "GET https://api.example.com/users\n###\nPOST /create",
   *   metadata: { length: 46, lines: 3, encoding: 'utf-8', source: { type: 'string' } },
   *   lineContexts: [...],
   *   segments: [...],
   *   ast: {
   *     requests: [...],
   *     fileScopedVariables: { fileVariables: [...] },
   *     globalVariables: { fileVariables: [...] }
   *   }
   * }
   */
  parseText(text: string): ParseResult {
    // Step 1: Line Scanning
    const lineContexts = this.lineScanner.scan(text);

    // Step 2: Segmentation
    const segments = this.createSegments(lineContexts);

    // Step 3: Variable Scanning
    const scanResult = this.scanVariables(segments);

    // Create variable registry and populate with file-level variables
    const registry = new VariableRegistry();
    for (const variable of scanResult.fileVariables) {
      // File-level variables (segmentId === null) go to global registry
      if (variable.segmentId === null) {
        registry.set(variable.key, variable.value);
      } else {
        // Segment-level variables go to segment-specific registry
        registry.setForSegment(
          variable.segmentId,
          variable.key,
          variable.value
        );
      }
    }

    // Step 4: Classification
    const classifiedSegments = this.classifySegments(segments);

    // Step 5: Segment Parsing
    const parsedNodes = this.parseSegments(classifiedSegments, registry);

    // Step 6: Response Linking
    const requests = this.linkResponses(parsedNodes);

    // Step 7: Result Assembly
    const result = this.buildResult(
      text,
      lineContexts,
      segments,
      scanResult,
      requests
    );

    return result;
  }

  /**
   * Delegates to Segmenter to split lines into segments.
   *
   * @param lines - Array of LineContext objects from LineScanner
   * @returns Array of Segment objects grouped by ### delimiters
   */
  private createSegments(lines: LineContext[]): Segment[] {
    return this.segmenter.segment(lines);
  }

  /**
   * Delegates to VariableScanner to extract all variables and comments.
   *
   * @param segments - Array of Segment objects
   * @returns ScanResult containing fileVariables and fileComments
   */
  private scanVariables(segments: Segment[]): ScanResult {
    return this.variableScanner.scan(segments);
  }

  /**
   * Delegates to SegmentClassifier to classify each segment.
   *
   * @param segments - Array of Segment objects
   * @returns Array of ClassifiedSegment objects
   */
  private classifySegments(segments: Segment[]): ClassifiedSegment[] {
    return this.segmentClassifier.classify(segments);
  }

  /**
   * Parses each classified segment into its AST representation.
   * Delegates to SegmentParser for individual segment parsing.
   *
   * @param classifiedSegments - Array of ClassifiedSegment objects
   * @param registry - VariableRegistry for variable substitution
   * @returns Array of parsed Request, ExpectedResponse, or null nodes
   */
  private parseSegments(
    classifiedSegments: ClassifiedSegment[],
    registry: VariableRegistry
  ): Array<Request | ExpectedResponse | null> {
    return classifiedSegments.map((segment) =>
      this.segmentParser.parseSegment(segment, registry)
    );
  }

  /**
   * Links ExpectedResponse nodes to their preceding Request nodes.
   * According to HTTP file format, a response segment immediately follows
   * the request it describes.
   *
   * Rules:
   * - A response segment is associated with the most recent request segment
   * - Multiple responses can follow a single request (overloaded responses)
   * - Responses without a preceding request are ignored (or error in strict mode)
   *
   * @param nodes - Array of parsed Request, ExpectedResponse, or null nodes
   * @returns Array of Request objects with expectedResponse populated
   */
  private linkResponses(
    nodes: Array<Request | ExpectedResponse | null>
  ): Request[] {
    const requests: Request[] = [];
    let lastRequest: Request | null = null;

    for (const node of nodes) {
      if (node === null) {
        continue;
      }

      // Check if this is a Request or ExpectedResponse
      if (this.isRequest(node)) {
        // It's a request - add to list and track as last request
        requests.push(node);
        lastRequest = node;
      } else if (this.isExpectedResponse(node)) {
        // It's a response - associate with last request
        if (lastRequest) {
          // If there's already an expected response, we might want to handle multiple responses
          // For now, we'll just set it (overwriting any previous value)
          lastRequest.expectedResponse = node;
        } else {
          // Response without a preceding request
          if (this.options.strict) {
            // In strict mode, this could be an error
            // For now, we'll just skip it
            console.warn(
              `Warning: Expected response found without preceding request at line ${node.rawTextRange.startLine}`
            );
          }
          // In non-strict mode, we simply ignore orphaned responses
        }
      }
    }

    return requests;
  }

  /**
   * Type guard to check if a node is a Request
   */
  private isRequest(node: Request | ExpectedResponse): node is Request {
    return 'method' in node && 'url' in node;
  }

  /**
   * Type guard to check if a node is an ExpectedResponse
   */
  private isExpectedResponse(
    node: Request | ExpectedResponse
  ): node is ExpectedResponse {
    return 'statusCode' in node;
  }

  /**
   * Assembles all parsed components into the final ParseResult structure.
   *
   * @param text - Original raw HTTP file text
   * @param lineContexts - Array of LineContext objects
   * @param segments - Array of Segment objects
   * @param scanResult - ScanResult containing variables and comments
   * @param requests - Array of Request objects with linked responses
   * @returns Complete ParseResult
   */
  private buildResult(
    text: string,
    lineContexts: LineContext[],
    segments: Segment[],
    scanResult: ScanResult,
    requests: Request[]
  ): ParseResult {
    const metadata = this.createMetadata(text);

    const ast: HttpRequestAST = {
      requests,
      fileScopedVariables: {
        fileVariables: this.getFileScopedVariables(
          lineContexts,
          scanResult.fileVariables
        ),
      },
      globalVariables: {
        fileVariables: scanResult.fileVariables,
      },
    };

    return {
      text,
      metadata,
      lineContexts,
      segments,
      ast,
    };
  }

  /**
   * Calculates metadata about the source text.
   *
   * @param text - The raw input text
   * @returns ParseMetadata with length, line count, encoding, and source info
   */
  private createMetadata(text: string): ParseMetadata {
    const lines = text.split(/\r?\n/);
    // Handle trailing newline
    const lineCount = lines.length === 1 && lines[0] === '' ? 1 : lines.length;

    const source: SourceMetadata = {
      type: 'string',
    };

    return {
      length: text.length,
      lines: lineCount,
      encoding: this.options.encoding ?? 'utf-8',
      source,
    };
  }

  /**
   * Returns only variables declared before the first segment delimiter (###).
   */
  private getFileScopedVariables(
    lineContexts: LineContext[],
    fileVariables: ScanResult['fileVariables']
  ): ScanResult['fileVariables'] {
    const firstDelimiterLine = lineContexts.find(
      (line) => line.text.trim() === '###'
    )?.lineNumber;

    if (firstDelimiterLine === undefined) {
      return fileVariables;
    }

    return fileVariables.filter(
      (variable) => variable.lineNumber < firstDelimiterLine
    );
  }
}

/**
 * Configuration options for HttpRequestParser.
 */
export interface ExtendedParserOptions {
  /** Character encoding (default: 'utf-8') */
  encoding?: string;
  /** Enable strict validation mode (default: false) */
  strict?: boolean;
  /** Maximum number of segments to parse (default: unlimited) */
  maxSegments?: number;
  /** Maximum body size in bytes (default: unlimited) */
  maxBodySize?: number;
}
