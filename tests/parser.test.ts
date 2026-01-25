import { test, expect, describe } from 'bun:test';
import { HttpRequestParser, LineScanner, Segmenter } from '../src/index';
import { readFile } from 'fs/promises';

// ============================================================================
// Common test data
// ============================================================================
const TEST_CONTENT = 'https://example.com/comments/1';
const fixturePath = './tests/fixtures/http/req_00.http';

/**
 * Test suite for different input sources.
 *
 * According to SPECIFICATION.md Section 2.1 & 4.1, the parser supports:
 * - string (via parseText)
 * - stream (via parseStream)
 *
 * Each source produces an object containing:
 * - text: the text content
 * - metadata:
 *   - length: number of characters
 *   - lines: number of lines
 *   - encoding: "UTF-8" (or from options)
 *   - source: { type, name }
 */

// ============================================================================
// Test: parseText (string source)
// ============================================================================
describe('parseText - string source', () => {
  test('should parse text and produce correct metadata', () => {
    const parser = new HttpRequestParser();
    const result = parser.parseText(TEST_CONTENT);

    expect(result).toMatchObject({
      text: TEST_CONTENT,
      metadata: {
        length: 30,
        lines: 1,
        encoding: 'UTF-8',
        source: {
          type: 'string',
          name: 'raw',
        },
      },
      lineContexts: expect.any(Array),
      segments: expect.any(Array),
    });
  });

  test('should handle multi-line text', () => {
    const parser = new HttpRequestParser();
    const multiLineContent =
      'GET https://example.com HTTP/1.1\nContent-Type: application/json\n\n{}';
    const result = parser.parseText(multiLineContent);

    expect(result.metadata.lines).toBe(4);
    expect(result.metadata.source).toEqual({
      type: 'string',
      name: 'raw',
    });
  });

  test('should handle empty string', () => {
    const parser = new HttpRequestParser();
    const result = parser.parseText('');

    // Note: Empty string still produces 1 line (the empty line itself)
    expect(result).toMatchObject({
      text: '',
      metadata: {
        length: 0,
        lines: 1,
        encoding: 'UTF-8',
        source: {
          type: 'string',
          name: 'raw',
        },
      },
    });
  });

  test('should throw error for non-string input', () => {
    const parser = new HttpRequestParser();
    // @ts-expect-error - Testing invalid input
    expect(() => parser.parseText(123)).toThrow('Input must be a string');
  });

  test('should respect custom encoding option', () => {
    const parser = new HttpRequestParser({ encoding: 'ISO-8859-1' });
    const result = parser.parseText(TEST_CONTENT);

    expect(result.metadata.encoding).toBe('ISO-8859-1');
  });
});

// ============================================================================
// Test: parseStream (stream source)
// ============================================================================
describe('parseStream - stream source', () => {
  /**
   * Helper to create a ReadableStream from a string
   */
  function createReadableStream(content: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);

    return new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
  }

  /**
   * Helper to create an async iterable from a string
   */
  async function* createAsyncIterable(
    content: string
  ): AsyncIterable<Uint8Array> {
    const encoder = new TextEncoder();
    yield encoder.encode(content);
  }

  test('should parse ReadableStream and produce correct metadata', async () => {
    const parser = new HttpRequestParser();
    const stream = createReadableStream(TEST_CONTENT);
    const result = await parser.parseStream(stream);

    expect(result).toMatchObject({
      text: TEST_CONTENT,
      metadata: {
        length: 30,
        lines: 1,
        encoding: 'UTF-8',
        source: {
          type: 'stream',
          name: 'stream_input',
        },
      },
      lineContexts: expect.any(Array),
      segments: expect.any(Array),
    });
  });

  test('should parse async iterable and produce correct metadata', async () => {
    const parser = new HttpRequestParser();
    const iterable = createAsyncIterable(TEST_CONTENT);
    const result = await parser.parseStream(iterable);

    expect(result).toMatchObject({
      text: TEST_CONTENT,
      metadata: {
        length: 30,
        lines: 1,
        encoding: 'UTF-8',
        source: {
          type: 'stream',
          name: 'stream_input',
        },
      },
      lineContexts: expect.any(Array),
      segments: expect.any(Array),
    });
  });

  test('should handle chunked stream data', async () => {
    const parser = new HttpRequestParser();
    const encoder = new TextEncoder();

    // Create a stream that sends data in multiple chunks
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('GET https://'));
        controller.enqueue(encoder.encode('example.com'));
        controller.enqueue(encoder.encode(' HTTP/1.1'));
        controller.close();
      },
    });

    const result = await parser.parseStream(stream);

    expect(result.text).toBe('GET https://example.com HTTP/1.1');
    expect(result.metadata.source).toEqual({
      type: 'stream',
      name: 'stream_input',
    });
  });

  test('should handle empty stream', async () => {
    const parser = new HttpRequestParser();
    const stream = createReadableStream('');
    const result = await parser.parseStream(stream);

    // Note: Empty stream still produces 1 line (the empty line itself)
    expect(result).toMatchObject({
      text: '',
      metadata: {
        length: 0,
        lines: 1,
        source: {
          type: 'stream',
          name: 'stream_input',
        },
      },
    });
  });

  test('should throw error for invalid stream input', async () => {
    const parser = new HttpRequestParser();
    // @ts-expect-error - Testing invalid input
    expect(parser.parseStream(null)).rejects.toThrow(
      'Stream must be a ReadableStream or async iterable'
    );
  });

  test('should handle file read as stream', async () => {
    const parser = new HttpRequestParser();

    // Read file and create stream from it
    const fileContent = await readFile(fixturePath, { encoding: 'utf-8' });
    const stream = createReadableStream(fileContent);
    const result = await parser.parseStream(stream);

    // Should have stream metadata, not file metadata
    expect(result.text).toBe(TEST_CONTENT);
    expect(result.metadata.source).toEqual({
      type: 'stream',
      name: 'stream_input',
    });
  });
});

// ============================================================================
// Test: Consistency across all sources
// ============================================================================
describe('Source consistency', () => {
  test('all sources should produce the same parsed content for identical input', async () => {
    const parser = new HttpRequestParser();

    // Parse from text
    const textResult = parser.parseText(TEST_CONTENT);

    // Parse from stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(TEST_CONTENT));
        controller.close();
      },
    });
    const streamResult = await parser.parseStream(stream);

    // Text content should be identical
    expect(textResult.text).toBe(streamResult.text);

    // Core metadata should match (except source)
    expect(textResult.metadata.length).toBe(streamResult.metadata.length);

    expect(textResult.metadata.lines).toBe(streamResult.metadata.lines);

    expect(textResult.metadata.encoding).toBe(streamResult.metadata.encoding);

    // Source types should differ
    expect(textResult.metadata.source.type).toBe('string');
    expect(streamResult.metadata.source.type).toBe('stream');

    // Line contexts and segments should match
    expect(textResult.lineContexts.length).toBe(
      streamResult.lineContexts.length
    );

    expect(textResult.segments.length).toBe(streamResult.segments.length);
  });
});
