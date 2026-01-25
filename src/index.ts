/**
 * REST Client Parser - Main Public API
 *
 * Parses one or more HTTP requests from various input sources.
 * This is an NPM package for transforming plain text HTTP-like documents
 * into structured, machine-readable representations.
 *
 * @example
 * import { parseHttp } from './index'
 * const result = parseHttp("POST /foo HTTP/1.1\nContent-Type: application/json\n\n{}")
 *
 * @example
 * import { HttpRequestParser } from './index'
 * const parser = new HttpRequestParser({ encoding: 'UTF-8' })
 * const result = parser.parseText("GET /api/users HTTP/1.1")
 */

import {
  HttpRequestParser,
  type ParserOptions,
  type ParseResult,
} from './parser';

/**
 * Default parser options used by the parseHttp convenience function.
 */
const defaultOptions: ParserOptions = {
  encoding: 'UTF-8',
  strict: false,
};

/**
 * Parses HTTP requests from a string.
 * This is the main convenience function for quick parsing.
 *
 * @param input - The raw text content containing HTTP request(s)
 * @param options - Optional parser configuration
 * @returns ParseResult containing text, metadata, and parsed structures
 *
 * @example
 * const result = parseHttp("GET https://example.com HTTP/1.1");
 * console.log(result.segments); // Array of parsed segments
 */
export function parseHttp(input: string, options?: ParserOptions): ParseResult {
  const parser = new HttpRequestParser({ ...defaultOptions, ...options });
  return parser.parseText(input);
}

/**
 * Parses HTTP requests from a stream asynchronously.
 * Convenience function for stream-based parsing.
 *
 * @param stream - A ReadableStream or async iterable to parse
 * @param options - Optional parser configuration
 * @returns Promise resolving to ParseResult
 *
 * @example
 * const result = await parseHttpStream(readableStream);
 */
export async function parseHttpStream(
  stream: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>,
  options?: ParserOptions
): Promise<ParseResult> {
  const parser = new HttpRequestParser({ ...defaultOptions, ...options });
  return parser.parseStream(stream);
}

// ============================================================================
// Public Exports for NPM Package
// ============================================================================

// Core parser class
export { HttpRequestParser } from './parser';

// Types
export type {
  ParserOptions,
  ParseResult,
  ParsedInput,
  ParseMetadata,
  SourceMetadata,
  ParserPlugin,
} from './parser';

// AST Types - Main output of the parser
export type { HttpRequestAST, Request, ExpectedResponse } from './ast';

// Parser Component Types
export type { QueryParam } from './parsers/query-parser';
export type { Header } from './parsers/header-parser';
export type { BodyObject } from './parsers/body-parser';

// Variable Types
export type {
  FileVariable,
  PromptVariable,
  RequestSetting,
} from './scanner/variable-scanner';
export type { VariableReference } from './scanner/system-variable-scanner';

// Scanner exports
export { LineScanner } from './scanner/line-scanner';
export type { LineContext } from './scanner/line-scanner';

// Segmenter exports
export { Segmenter } from './segmenter/segmenter';
export type { Segment } from './segmenter/segmenter';
export { SegmentClassifier } from './segmenter/classifier';
export type {
  ClassifiedSegment,
  SegmentType,
  SegmentSubtype,
} from './segmenter/classifier';
