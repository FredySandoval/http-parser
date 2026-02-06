import { LineScanner, type LineContext } from './scanner/line-scanner';
import { Segmenter, type Segment } from './segmenter/segmenter';
import { SegmentClassifier } from './segmenter/classifier';
import { SegmentParser } from './parsers/segment-parser';
import {
  type HttpRequestAST,
  type Request,
  type ExpectedResponse,
} from './ast';
import { type FileVariable } from './scanner/variable-scanner';

/**
 * Source metadata describing the origin of the parsed text.
 */
export interface SourceMetadata {
  /** Type of input source */
  type: 'string' | 'stream';
  /** Name of the source (raw, filename, or stream_input) */
  name?: string;
}

/**
 * Metadata about the parsed input.
 */
export interface ParseMetadata {
  /** Total character length of the input */
  length: number;
  /** Total number of lines in the input */
  lines: number;
  /** Character encoding of the input */
  encoding: string;
  /** Source information */
  source: SourceMetadata;
}

/**
 * Result of the input parsing phase.
 * Contains the raw text and metadata about the source.
 */
export interface ParsedInput {
  /** The raw text content */
  text: string;
  /** Metadata about the input */
  metadata: ParseMetadata;
}

/**
 * Extended parsing result that includes processed data.
 */
export interface ParseResult extends ParsedInput {
  /** Array of LineContext objects from the line scanner */
  lineContexts: LineContext[];
  /** Array of Segment objects from the segmenter */
  segments: Segment[];
  /** The final AST representation */
  ast: HttpRequestAST;
}

/**
 * Configuration options for the HttpRequestParser.
 */
export interface ParserOptions {
  /** Character encoding to use (default: UTF-8) */
  encoding?: string;
  /** Enable strict mode for validation (default: false) */
  strict?: boolean;
}

/**
 * Plugin interface for extending parser functionality.
 */
export interface ParserPlugin {
  /** Unique name of the plugin */
  name: string;
  /** Called before parsing begins */
  onBeforeParse?: (input: string) => string | void;
  /** Called after parsing completes */
  onAfterParse?: (result: ParseResult) => ParseResult | void;
}

/**
 * Internal state for incremental parsing.
 */
interface IncrementalState {
  /** Accumulated text from chunks */
  buffer: string;
  /** Whether parsing has been finalized */
  finalized: boolean;
}

/**
 * Default parser options.
 */
const DEFAULT_OPTIONS: Required<ParserOptions> = {
  encoding: 'UTF-8',
  strict: false,
};

/**
 * HttpRequestParser Class
 * Main entry point for parsing HTTP requests from various sources.
 *
 * Supports:
 * - Synchronous parsing from string (parseText)
 * - Asynchronous parsing from stream (parseStream)
 * - Incremental parsing (parseChunk)
 * - Plugin system for extensibility (usePlugin)
 *
 * @example
 * const parser = new HttpRequestParser();
 * const result = parser.parseText("GET https://example.com HTTP/1.1");
 */
export class HttpRequestParser {
  private readonly options: Required<ParserOptions>;
  private readonly plugins: ParserPlugin[];
  private readonly lineScanner: LineScanner;
  private readonly segmenter: Segmenter;
  private readonly segmentClassifier: SegmentClassifier;
  private readonly segmentParser: SegmentParser;
  private incrementalState: IncrementalState;

  /**
   * Creates a new HttpRequestParser instance.
   *
   * @param options - Configuration options for the parser
   */
  constructor(options: ParserOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.plugins = [];
    this.lineScanner = new LineScanner();
    this.segmenter = new Segmenter();
    this.segmentClassifier = new SegmentClassifier();
    this.segmentParser = new SegmentParser();
    this.incrementalState = {
      buffer: '',
      finalized: false,
    };
  }

  /**
   * Parses HTTP requests from a string synchronously.
   *
   * @param text - The raw text content to parse
   * @returns ParseResult containing text, metadata, and parsed structures
   * @throws Error if input is not a string
   *
   * @example
   * const result = parser.parseText("POST /foo HTTP/1.1\nContent-Type: application/json");
   */
  parseText(text: string): ParseResult {
    // Validate input
    if (typeof text !== 'string') {
      throw new Error('Input must be a string');
    }

    // Apply pre-parse plugins
    let processedText = text;
    for (const plugin of this.plugins) {
      if (plugin.onBeforeParse) {
        const result = plugin.onBeforeParse(processedText);
        if (typeof result === 'string') {
          processedText = result;
        }
      }
    }

    // Scan lines
    const lineContexts = this.lineScanner.scan(processedText);

    // Segment the lines
    const segments = this.segmenter.segment(lineContexts);

    // Classify segments
    const classifiedSegments = this.segmentClassifier.classify(segments);

    // Parse individual segments
    const parsedObjects = classifiedSegments.map((seg) =>
      this.segmentParser.parse(seg)
    );

    // Assemble AST
    const metadata: ParseMetadata = {
      length: processedText.length,
      lines: lineContexts.length,
      encoding: this.options.encoding,
      source: {
        type: 'string',
        name: 'raw',
      },
    };

    const ast = this.assembleAST(parsedObjects, metadata);

    // Build result
    let result: ParseResult = {
      text: processedText,
      metadata,
      lineContexts,
      segments,
      ast,
    };

    // Apply post-parse plugins
    for (const plugin of this.plugins) {
      if (plugin.onAfterParse) {
        const pluginResult = plugin.onAfterParse(result);
        if (pluginResult) {
          result = pluginResult;
        }
      }
    }

    return result;
  }

  /**
   * Parses HTTP requests from a readable stream asynchronously.
   *
   * @param stream - A ReadableStream or async iterable to parse
   * @returns Promise resolving to ParseResult
   * @throws Error if stream is not readable
   *
   * @example
   * const result = await parser.parseStream(readableStream);
   */
  async parseStream(
    stream: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>
  ): Promise<ParseResult> {
    // Validate stream
    if (!stream || typeof stream !== 'object') {
      throw new Error('Stream must be a ReadableStream or async iterable');
    }

    const decoder = new TextDecoder();
    let content = '';

    // Handle ReadableStream
    if ('getReader' in stream && typeof stream.getReader === 'function') {
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          content += decoder.decode(value, { stream: true });
        }
        content += decoder.decode(); // Flush remaining bytes
      } finally {
        reader.releaseLock();
      }
    }
    // Handle async iterable
    else if (Symbol.asyncIterator in stream) {
      for await (const chunk of stream as AsyncIterable<Uint8Array>) {
        content += decoder.decode(chunk, { stream: true });
      }
      content += decoder.decode(); // Flush remaining bytes
    } else {
      throw new Error('Stream must be a ReadableStream or async iterable');
    }

    // Parse the content
    const result = this.parseText(content);

    // Update source metadata
    result.metadata.source = {
      type: 'stream',
      name: 'stream_input',
    };

    return result;
  }

  /**
   * Parses a chunk of text incrementally.
   * Call multiple times with chunks, then call parseText("") with accumulated buffer.
   *
   * @param chunk - A chunk of text to add to the buffer
   * @throws Error if chunk is not a string or parsing is already finalized
   *
   * @example
   * parser.parseChunk("GET /foo");
   * parser.parseChunk(" HTTP/1.1\n");
   * const result = parser.finalizeChunks();
   */
  parseChunk(chunk: string): void {
    // Validate chunk
    if (typeof chunk !== 'string') {
      throw new Error('Chunk must be a string');
    }

    if (this.incrementalState.finalized) {
      throw new Error('Cannot add chunks after parsing has been finalized');
    }

    // Add to buffer
    this.incrementalState.buffer += chunk;
  }

  /**
   * Finalizes incremental parsing and returns the result.
   *
   * @returns ParseResult from accumulated chunks
   */
  finalizeChunks(): ParseResult {
    this.incrementalState.finalized = true;
    return this.parseText(this.incrementalState.buffer);
  }

  /**
   * Resets the incremental parsing state.
   */
  resetChunks(): void {
    this.incrementalState = {
      buffer: '',
      finalized: false,
    };
  }

  /**
   * Registers a plugin for the parsing lifecycle.
   *
   * @param plugin - The plugin to register
   * @throws Error if plugin is invalid
   *
   * @example
   * parser.usePlugin({
   *   name: 'my-plugin',
   *   onBeforeParse: (input) => input.trim(),
   *   onAfterParse: (result) => { console.log(result); }
   * });
   */
  usePlugin(plugin: ParserPlugin): this {
    // Validate plugin shape
    if (!plugin || typeof plugin !== 'object') {
      throw new Error('Plugin must be an object');
    }

    if (typeof plugin.name !== 'string' || plugin.name.trim().length === 0) {
      throw new Error('Plugin must have a non-empty name');
    }

    if (
      plugin.onBeforeParse !== undefined &&
      typeof plugin.onBeforeParse !== 'function'
    ) {
      throw new Error('Plugin onBeforeParse must be a function');
    }

    if (
      plugin.onAfterParse !== undefined &&
      typeof plugin.onAfterParse !== 'function'
    ) {
      throw new Error('Plugin onAfterParse must be a function');
    }

    // Register plugin
    this.plugins.push(plugin);

    return this;
  }

  /**
   * Assembles the final AST from individual parsed objects.
   * Handles association between Requests and ExpectedResponses.
   */
  private assembleAST(
    parsedObjects: (Request | ExpectedResponse)[],
    metadata: ParseMetadata
  ): HttpRequestAST {
    const requests: Request[] = [];
    const fileVariables: FileVariable[] = [];

    let lastRequest: Request | null = null;

    for (const obj of parsedObjects) {
      // Collect all file variables from all segments
      if (obj.variables) {
        fileVariables.push(...obj.variables.fileVariables);
      }

      if (this.isRequest(obj)) {
        requests.push(obj);
        lastRequest = obj;
      } else if (this.isExpectedResponse(obj)) {
        if (lastRequest) {
          // Only associate if it's the first response for this request
          if (!lastRequest.expectedResponse) {
            lastRequest.expectedResponse = obj;
          }
          // Multiple responses for same request are invalid/ignored per spec 2.18.4
        }
        // Response blocks without preceding requests are ignored per spec 2.18.4
      }
    }

    return {
      metadata,
      requests,
      fileVariables,
    };
  }

  private isRequest(obj: Request | ExpectedResponse): obj is Request {
    return 'method' in obj;
  }

  private isExpectedResponse(
    obj: Request | ExpectedResponse
  ): obj is ExpectedResponse {
    return 'statusCode' in obj;
  }
}
