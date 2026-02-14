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

import type {
  ParseResult,
  ParseMetadata,
  ParserOptions,
  LineContext,
  Segment,
  HttpRequestAST,
  Request,
  QueryParam,
  Header,
  ExpectedResponse,
  FileVariable,
  ScanResult,
  FileComment,
  SegmentType,
  MessageType,
  ClassifiedSegment,
  ParsedHTTPRequestLine,
  HeaderParserResult,
  QueryParserResult,
} from './types/types';

import type {
  HttpBodyResult,
  HttpBodyContent,
  JsonContent,
  FormContent,
  MultipartContent,
  TextContent,
  FormPart,
} from './types/body-parser-types';

import type { SegmentParseResult, ParseError } from './parsers/segment-parser';

import { HttpRequestParser } from './parser';
import { LineScanner } from './scanner/line-scanner';
import { Segmenter } from './segmenter/segmenter';
import { VariableScanner, VariableRegistry } from './scanner/variable-scanner';
import { SegmentClassifier } from './segmenter/classifier';
import { SegmentParser } from './parsers/segment-parser';
import { HTTPRequestLineParser } from './parsers/request-line';
import { ResponseLineParser } from './parsers/response-line';
import { HeaderParser } from './parsers/header-parser';
import { BodyParser } from './parsers/body-parser';
import { QueryParser } from './parsers/query-parser';

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
};

// AST Types
export type { Request, QueryParam, Header, ExpectedResponse, FileVariable };

// Scanner Types
export type { ScanResult, FileComment };

// Segmenter Types
export type { SegmentType, MessageType, ClassifiedSegment };

// Parser Types
export type { ParsedHTTPRequestLine, HeaderParserResult, QueryParserResult };

// Body Parser Types
export type {
  HttpBodyResult,
  HttpBodyContent,
  JsonContent,
  FormContent,
  MultipartContent,
  TextContent,
  FormPart,
};

// Segment Parser Types
export type { SegmentParseResult, ParseError };

// --- Class Exports (for advanced usage) ---

export { HttpRequestParser };
export { LineScanner };
export { Segmenter };
export { VariableScanner, VariableRegistry };
export { SegmentClassifier };
export { SegmentParser };
export { HTTPRequestLineParser };
export { ResponseLineParser };
export { HeaderParser };
export { BodyParser };
export { QueryParser };

// --- Constants ---

/** Library version */
export const VERSION = '1.0.0';

/** Default parser options */
export const DEFAULT_OPTIONS: Required<ParserOptions> = {
  encoding: 'utf-8',
  strict: false,
};
