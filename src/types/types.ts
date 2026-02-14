import type { HttpBodyResult } from './body-parser-types';

export interface ParseResult {
  text: string;
  metadata: ParseMetadata;
  lineContexts: LineContext[];
  segments: Segment[];
  ast: HttpRequestAST;
}

export interface ParserOptions {
  /** Character encoding to use (default: UTF-8) */
  encoding?: string;
  /** Enable strict mode for validation (default: false) */
  strict?: boolean;
}

// -- ParseResult Types ---

export interface ParseMetadata {
  length: number;
  lines: number;
  encoding: string;
  source: SourceMetadata;
}

export interface LineContext {
  lineNumber: number;
  startOffset: number;
  endOffset: number;
  text: string;
}

export interface Segment {
  segmentId: number;
  startLine: number;
  endLine: number;
  lines: LineContext[];
}

export interface HttpRequestAST {
  requests: Request[];
  fileScopedVariables: {
    fileVariables: FileVariable[];
  };
  globalVariables: {
    fileVariables: FileVariable[];
  };
}

// -- ParseResult.ParseMetadata Types --

export interface SourceMetadata {
  type: 'string' | 'stream';
  name?: string;
}

// -- ParseResult.HttpRequestAST Types --

export interface Request {
  name: string | null; /** Identifies the request (from @name directive) */
  method: string | null;
  url: string;
  httpVersion: string | null;
  queryParams: QueryParam[];
  headers: Header[];
  body: HttpBodyResult | null;
  blockVariables: {
    fileVariables: FileVariable[];
  };
  comments: string[];
  rawTextRange: {
    startLine: number;
    endLine: number;
  };
  expectedResponse: ExpectedResponse | null;
}

// -- ParseResult.HttpRequestAST.Request Types --

export interface QueryParam {
  key: string;
  value: string;
}

export interface Header {
  name: string;
  value: string;
}

export interface ExpectedResponse {
  statusCode: number;
  statusText: string | null;
  httpVersion: string | null;
  headers: Header[];
  body: string | object | null;
  variables: {
    fileVariables: FileVariable[];
  };
  rawTextRange: {
    startLine: number;
    endLine: number;
  };
}

// -- ParseResult.HttpRequestAST.Request.ExpectedResponse Types --

export interface FileVariable {
  key: string;
  value: string;
  lineNumber: number;
  segmentId: number | null; // optional, may be null for comments outside of any segment
}

// -- variable scanning types

/**
 * Result of scanning a segment for variables and metadata.
 */
export interface ScanResult {
  fileVariables: FileVariable[];
  fileComments: FileComment[];
}

export interface FileComment {
  text: string;
  lineNumber: number;
  segmentId: number | null; // optional, may be null for comments outside of any segment
}

// -- request line parser
export interface ParsedHTTPRequestLine {
  /** HTTP method (GET, POST, PUT, DELETE, etc.) */
  method: string | null;
  /** Request URL or path */
  url: string;
  /** HTTP version (e.g., "HTTP/1.1") or null if not specified */
  httpVersion: string | null;
}

// -- segmenter types --

/**
 * Valid subtypes for a segment.
 */
export type SegmentType = 'http' | 'curl' | 'graphql';

/**
 * Valid types for a segment.
 */
export type MessageType = 'request' | 'response';

export interface ClassifiedSegment extends Segment {
  messageType: MessageType;
  segmentType: SegmentType;
  firstNonEmptyLine: {
    lineNumber: number;
    text: string;
  };
}

export interface HeaderParserResult {
  headers: Header[];
  consumedLinesCount: number;
}

// -- src/parsers/query-parser.ts --
/**
 * QueryParam represents a single query parameter key-value pair.
 */
export interface QueryParam {
  key: string;
  value: string;
}

/**
 * Result of the query continuation parsing.
 */
export interface QueryParserResult {
  queryParams: QueryParam[];
  consumedLinesCount: number;
}
