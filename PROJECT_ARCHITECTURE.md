# @fredy-dev/http-parser - Design Architecture

## Data Flow

```
Raw HTTP File Text
↓
parseHttp (src/index.ts)
↓
HttpRequestParser.parseText (src/parser.ts)
↓
Line Scanning
↓
Segmentation
↓
Variable Extraction
↓
Segment Classification
↓
Segment Parsing
↓
AST Assembly
↓
Final ParseResult

```

## File Structure

```
[x] src/index.ts
[x] src/parser.ts
[x] src/parsers/body-parser.ts
[x] src/parsers/header-parser.ts
[x] src/parsers/query-parser.ts
[x] src/parsers/request-line.ts
[x] src/parsers/response-line.ts
[x] src/parsers/segment-parser.ts
[x] src/types/types.ts (centralized Key Types)
[x] src/scanner/line-scanner.ts
[x] src/scanner/variable-scanner.ts
[x] src/segmenter/classifier.ts
[x] src/segmenter/segmenter.ts
```

## Build order

```
1. scanner/line-scanner.ts
2. segmenter/segmenter.ts
3. scanner/variable-scanner.ts
4. segmenter/classifier.ts
5. parsers/request-line.ts
6. src/parsers/response-line.ts
7. parsers/header-parser.ts
8. parsers/body-parser.ts
9. parsers/segment-parser.ts
10. parser.ts (orchestrator)
11. index.ts (public API)
```

## Pseudo-code

### src/scanner/line-scanner.ts

```ts
/**
 * LineScanner Class
 * Lightweight component to split text into lines with metadata.
 * No semantics, no tokens. Just lines and offsets.
 *
 * Responsibilities:
 * - Split text into lines
 * - Track line numbers and offsets
 * - Preserve raw text (empty lines, whitespace, indentation)
 * - `endOffset` is exclusive (points to position after last character of line)
 * - Line breaks are not included in the text field
 *
 * @example
 * const scanner = new LineScanner();
 * const lines = scanner.scan("POST /foo HTTP/1.1\nContent-Type: application/json");
 */
export class LineScanner {
  /**
   * Scans the input text and returns an array of LineContext objects.
   *
   * @param text - The raw input text to scan
   * @returns Array of LineContext objects, one per line
   *
   * @example
   * Input: "POST https://example.com HTTP/1.1\ncontent-type: application/json"
   * Output: [
   *   { lineNumber: 1, startOffset: 0, endOffset: 33, text: "POST https://example.com HTTP/1.1" },
   *   { lineNumber: 2, startOffset: 34, endOffset: 64, text: "content-type: application/json" }
   * ]
   */
  scan(text: string): LineContext[] {}
}
```

### src/segmenter/segmenter.ts

```ts
/**
 * Segment represents a group of lines between ### delimiters.
 * Each segment may contain a request or response.
 */

/**
 * Segmenter Class
 * Groups lines into segments based on ### delimiters.
 * Does not parse content; only structures the document.
 *
 * According to the specification:
 * - Requests are separated by a delimiter of three or more consecutive `#` characters
 * - The delimiter must be on a line by itself
 * - Empty segments are ignored
 * - The delimiter itself is NOT part of any segment
 *
 * @example
 * const segmenter = new Segmenter();
 * const segments = segmenter.segment(lines);
 */
export class Segmenter {
  /**
   * Segments an array of lines into separate segments based on ### delimiters.
   *
   * @param lines - Array of LineContext objects from LineScanner
   * @returns Array of Segment objects
   *
   * @example
   * Input: Lines containing two requests separated by ###
   * Output: [
   *   { segmentId: 0, startLine: 1, endLine: 7, lines: [...] },
   *   { segmentId: 1, startLine: 9, endLine: 10, lines: [...] }
   * ]
   */
  segment(lines: LineContext[]): Segment[] {}

  isDelimiter(text: string): boolean {}

  private createSegment(segmentId: number, lines: LineContext[]): Segment {}

  private hasNonEmptyLines(segment: Segment): boolean {}
}
```

### src/scanner/variable-scanner.ts

```ts
/**
 * input: Segment[]
 * output: ScanResult (fileVariables and fileComments)
 */
export class VariableScanner {
  scan(segments: Segment[]): ScanResult {
    const result: ScanResult = {
      fileVariables: this.scanFileVariables(segments),
      fileComments: this.scanFileComments(segments),
    };
    return result;
  }

  private scanFileVariables(segments: Segment[]): FileVariable[] {}

  private scanFileComments(segments: Segment[]): FileComment[] {}
}

/**
 * manages variable storage and retrieval
 */
export class VariableRegistry {
  private variables: Map<string, string> = new Map();
  private segmentVariables: Map<number, Map<string, string>> = new Map();

  get(name: string): string | undefined {}

  set(name: string, value: string): void {}

  getAllBySegmentId(id: number): Record<string, string> {}

  getAll(): Record<string, string> {}
}
```

### src/segmenter/classifier.ts

```ts
/**
 * SegmentClassifier Class
 * Differentiates between HTTP requests and expected responses.
 * Also identifies if a request is a standard HTTP request, cURL command, or GraphQL.
 *
 * According to the specification:
 * - A segment is a response if its first non-empty line starts with "HTTP/"
 * - A segment is a cURL request if its first non-empty line starts with "curl"
 * - A segment is a GraphQL request if the X-REQUEST-TYPE: GraphQL header is present
 */
export class SegmentClassifier {
  /**
   * input: Segment[]
   * output: ClassifiedSegment[]
   *
   * Processes each segment and classifies it
   */
  classify(segments: Segment[]): ClassifiedSegment[] {}

  classifySegment(segment: Segment): ClassifiedSegment {}

  private findSignificantLine(lines: LineContext[]): LineContext | null {}

  private detectMessageType(text: string): MessageType {}

  private detectSegmentType(
    lines: LineContext[],
    significantLineIndex: number
  ): SegmentType {}
}
```

### src/parsers/request-line.ts

```ts
/**
 * Result of parsing a request line
 */
/**
 * HTTPRequestLineParser
 *
 * Valid formats:
 * 1. METHOD URL/PATH PROTOCOL-VERSION
 *    Example: POST https://example.com/api HTTP/1.1
 *
 * 2. METHOD URL/PATH
 *    Example: GET https://example.com/api
 *
 * 3. URL only
 *    Example: https://example.com/api
 *    (Default method: GET)
 * Parses the HTTP request line (first line of an HTTP request).
 * Format: METHOD URL [HTTP/VERSION]
 *
 * @example
 * Input: "GET /api/users HTTP/1.1"
 * Output: { method: "GET", url: "/api/users", httpVersion: "HTTP/1.1" }
 */
export class HTTPRequestLineParser {
  /**
   * input: "POST https://example.com/api HTTP/1.1"
   * output: { method: "POST", url: "https://example.com/api", httpVersion: "HTTP/1.1" }
   *
   * input: "GET /simple/path"
   * output: { method: "GET", url: "/simple/path", httpVersion: null }
   */
  parse(line: string): ParsedHTTPRequestLine {}

  extractMethod(parts: string[]): string {}

  extractUrl(parts: string[]): string {}

  extractHttpVersion(parts: string[]): string | null {}

  validate(line: string): boolean {}
}
```

### src/parsers/body-parser.ts

```ts
/**
 * BodyParser handles parsing of HTTP request/response bodies.
 *
 * Responsibilities:
 * - Extract body lines following the headers section (after first empty line)
 * - Parse body content based on Content-Type header
 * - Support JSON, form data, multipart, and text formats
 * - Return structured body result with parsing status
 */
export class BodyParser {
  /**
   * Parses HTTP body from an array of lines.
   *
   * @param lines Array of LineContext objects representing the body content
   * @param headers Array of parsed headers to determine content type
   * @returns HttpBodyResult containing parsed content or error information
   *
   * @example
   * Input: lines = [{ text: '{"name": "John"}' }], headers = [{ name: 'Content-Type', value: 'application/json' }]
   * Output: { status: 'parsed', content: { protocol: 'http', body: { kind: 'json', data: { name: 'John' } } }, raw: '{"name": "John"}', contentType: 'application/json', size: 16 }
   */
  parse(lines: LineContext[], headers: Header[]): HttpBodyResult {}

  private extractContentType(headers: Header[]): string | null {}

  private parseByContentType(
    rawBody: string,
    contentType: string | null
  ): HttpBodyContent {}

  private parseJson(rawBody: string): JsonContent {}

  private parseFormData(rawBody: string): FormContent {}

  private parseMultipart(
    rawBody: string,
    contentType: string | null
  ): MultipartContent {}

  private parseMultipartPart(section: string): FormPart | null {}

  private parseText(rawBody: string): TextContent {}

  private calculateSize(rawBody: string): number {}

  private createSuccessResult(
    content: HttpBodyContent | null,
    raw: string,
    contentType: string | null,
    size?: number
  ): HttpBodyResult {}

  private createErrorResult(
    message: string,
    raw: string,
    contentType: string | null,
    size?: number,
    lineNumber?: number
  ): HttpBodyResult {}
}
```

### src/parsers/segment-parser.ts

```ts
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
  private responseLineParser: HTTPResponseLineParser;
  private headerParser: HeaderParser;
  private bodyParser: BodyParser;
  private queryParser: QueryParser;

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
  ): Request | ExpectedResponse | null {}

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
  ): Request {}

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
  ): ExpectedResponse {}

  /**
   * input: LineContext[], startIndex
   * output: number (index of first empty line, or lines.length if none)
   *
   * Finds the index of the first empty line after headers.
   * Used to separate headers from body content.
   */
  private findBodyStartIndex(
    lines: LineContext[],
    startIndex: number
  ): number {}

  /**
   * input: LineContext[]
   * output: string | null
   *
   * Extracts @name directive value if present in segment comments.
   * Example: "@name CreateUser" -> "CreateUser"
   */
  private extractRequestName(lines: LineContext[]): string | null {}

  /**
   * input: LineContext[], VariableRegistry
   * output: FileVariable[]
   *
   * Collects all @variable definitions within a segment.
   * These are block-scoped variables that override file-level variables.
   */
  private extractBlockVariables(
    lines: LineContext[],
    registry: VariableRegistry
  ): FileVariable[] {}

  /**
   * input: LineContext[]
   * output: string[]
   *
   * Collects all comment lines (lines starting with #) in the segment.
   * Excludes delimiter lines (###) and directive lines (@name, @variable).
   */
  private extractComments(lines: LineContext[]): string[] {}
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
```

### src/parser.ts

```ts
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
  constructor(options?: ParserOptions) {}

  /**
   * input: Raw HTTP file text, optional ParserOptions
   * output: Complete ParseResult with AST and metadata
   *
   * Main entry point for parsing HTTP files.
   * Executes the full parsing pipeline and returns structured result.
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
  parseText(text: string): ParseResult {}

  /**
   * input: LineContext[] (from LineScanner)
   * output: Segment[] (grouped by ### delimiters)
   *
   * Delegates to Segmenter to split lines into segments.
   */
  private createSegments(lines: LineContext[]): Segment[] {}

  /**
   * input: Segment[]
   * output: ScanResult (fileVariables and fileComments)
   *
   * Delegates to VariableScanner to extract all variables and comments.
   */
  private scanVariables(segments: Segment[]): ScanResult {}

  /**
   * input: Segment[]
   * output: ClassifiedSegment[]
   *
   * Delegates to SegmentClassifier to classify each segment.
   */
  private classifySegments(segments: Segment[]): ClassifiedSegment[] {}

  /**
   * input: ClassifiedSegment[], VariableRegistry
   * output: Array of Request | ExpectedResponse
   *
   * Parses each classified segment into its AST representation.
   * Delegates to SegmentParser for individual segment parsing.
   */
  private parseSegments(
    classifiedSegments: ClassifiedSegment[],
    registry: VariableRegistry
  ): Array<Request | ExpectedResponse | null> {}

  /**
   * input: Array of Request | ExpectedResponse | null
   * output: Request[] (with expectedResponse populated)
   *
   * Links ExpectedResponse nodes to their preceding Request nodes.
   * According to HTTP file format, a response segment immediately follows
   * the request it describes.
   *
   * Rules:
   * - A response segment is associated with the most recent request segment
   * - Multiple responses can follow a single request (overloaded responses)
   * - Responses without a preceding request are ignored (or error in strict mode)
   */
  private linkResponses(
    nodes: Array<Request | ExpectedResponse | null>
  ): Request[] {}

  /**
   * input: original text, LineContext[], Segment[], ScanResult, Request[]
   * output: ParseResult
   *
   * Assembles all parsed components into the final ParseResult structure.
   */
  private buildResult(
    text: string,
    lineContexts: LineContext[],
    segments: Segment[],
    scanResult: ScanResult,
    requests: Request[]
  ): ParseResult {}

  /**
   * input: text string
   * output: ParseMetadata
   *
   * Calculates metadata about the source text.
   */
  private createMetadata(text: string): ParseMetadata {}
}

/**
 * Configuration options for HttpRequestParser.
 */
export interface ParserOptions {
  /** Character encoding (default: 'utf-8') */
  encoding?: string;
  /** Enable strict validation mode (default: false) */
  strict?: boolean;
  /** Maximum number of segments to parse (default: unlimited) */
  maxSegments?: number;
  /** Maximum body size in bytes (default: unlimited) */
  maxBodySize?: number;
}
```

### src/index.ts

````ts
/**
 * @fredy/http-parser - Public API
 *
 * Main entry point for the HTTP Parser library.
 * Provides a simple, clean interface for parsing HTTP files.
 *
 * @example
 * ```typescript
 * import { parseHttp, ParseResult } from '@fredy/http-parser';
 *
 * const result: ParseResult = parseHttp(`
 *   GET https://api.example.com/users
 *   Authorization: Bearer token123
 * `);
 *
 * console.log(result.ast.requests[0].method); // "GET"
 * ```
 */

// --- Core Parser Function ---

/**
 * Parses raw HTTP file text into a structured AST.
 *
 * This is the primary function for consuming the library.
 * It handles the complete parsing pipeline and returns a structured result.
 *
 * @param text - Raw HTTP file content to parse
 * @param options - Optional parser configuration
 * @returns ParseResult containing the parsed AST and metadata
 *
 * @example
 * Input: "GET https://api.example.com/users HTTP/1.1\nAccept: application/json"
 * Output: ParseResult with parsed requests, headers, and metadata
 */
export function parseHttp(text: string, options?: ParserOptions): ParseResult {
  const parser = new HttpRequestParser(options);
  return parser.parseText(text);
}

// --- Type Exports ---

// ParseResult and core types
export type {
  ParseResult,
  ParseMetadata,
  ParserOptions,
  LineContext,
  Segment,
  HttpRequestAST,
} from './types/types';

// AST Types
export type {
  Request,
  QueryParam,
  Header,
  ExpectedResponse,
  FileVariable,
} from './types/types';

// Scanner Types
export type { ScanResult, FileComment } from './types/types';

// Segmenter Types
export type {
  SegmentType,
  MessageType,
  ClassifiedSegment,
} from './types/types';

// Parser Types
export type {
  ParsedHTTPRequestLine,
  HeaderParserResult,
  QueryParserResult,
} from './types/types';

// Body Parser Types
export type {
  HttpBodyResult,
  HttpBodyContent,
  JsonContent,
  FormContent,
  MultipartContent,
  TextContent,
  FormPart,
} from './types/body-parser-types';

// Segment Parser Types
export type { SegmentParseResult, ParseError } from './parsers/segment-parser';

// --- Class Exports (for advanced usage) ---

export { HttpRequestParser } from './parser';
export { LineScanner } from './scanner/line-scanner';
export { Segmenter } from './segmenter/segmenter';
export { VariableScanner, VariableRegistry } from './scanner/variable-scanner';
export { SegmentClassifier } from './segmenter/classifier';
export { SegmentParser } from './parsers/segment-parser';
export { HTTPRequestLineParser } from './parsers/request-line';
export { HTTPResponseLineParser } from './parsers/response-line';
export { HeaderParser } from './parsers/header-parser';
export { BodyParser } from './parsers/body-parser';
export { QueryParser } from './parsers/query-parser';

// --- Constants ---

/** Library version */
export const VERSION = '1.0.0';

/** Default parser options */
export const DEFAULT_OPTIONS: Required<ParserOptions> = {
  encoding: 'utf-8',
  strict: false,
  maxSegments: Infinity,
  maxBodySize: Infinity,
};
````
