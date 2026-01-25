import { test, expect, describe } from 'bun:test';
import { Segmenter, type Segment } from '../../src/segmenter/segmenter';
import { LineScanner, type LineContext } from '../../src/scanner/line-scanner';

/**
 * Test suite for Segmenter class.
 *
 * According to SPECIFICATION.md Section 2.2 (Request Segmentation):
 * - Requests are separated by a delimiter of three or more consecutive `#` characters
 * - The delimiter must be on a line by itself
 * - Empty segments are ignored
 * - Each segment produces at most one request or represents one response
 *
 * According to Section 4.1 (Segmenter):
 * - The delimiter itself is NOT part of any segment
 * - Segments contain lines with segmentId, startLine, endLine, and lines array
 *
 * These tests use the actual LineScanner to generate LineContext objects,
 * keeping the tests aligned with the real architecture and enabling early
 * detection of integration issues between LineScanner and Segmenter.
 */

/** Shared LineScanner instance for generating LineContext arrays */
const scanner = new LineScanner();

describe('Segmenter', () => {
  // ============================================================================
  // Basic Segmentation
  // ============================================================================
  describe('basic segmentation', () => {
    test('should return a single segment when no delimiter is present', () => {
      const segmenter = new Segmenter();
      const lines = scanner.scan(
        'GET https://example.com\n' + 'Content-Type: application/json'
      );

      const result = segmenter.segment(lines);

      expect(result).toHaveLength(1);
      expect(result[0]?.segmentId).toBe(0);
      expect(result[0]?.startLine).toBe(1);
      expect(result[0]?.endLine).toBe(2);
      expect(result[0]?.lines).toHaveLength(2);
    });

    test('should split into two segments when ### delimiter is present', () => {
      const segmenter = new Segmenter();
      const lines = scanner.scan(
        'GET https://example.com/first\n' +
          '###\n' +
          'GET https://example.com/second'
      );

      const result = segmenter.segment(lines);

      expect(result).toHaveLength(2);

      // First segment
      expect(result[0]?.segmentId).toBe(0);
      expect(result[0]?.startLine).toBe(1);
      expect(result[0]?.endLine).toBe(1);
      expect(result[0]?.lines[0]?.text).toBe('GET https://example.com/first');

      // Second segment
      expect(result[1]?.segmentId).toBe(1);
      expect(result[1]?.startLine).toBe(3);
      expect(result[1]?.endLine).toBe(3);
      expect(result[1]?.lines[0]?.text).toBe('GET https://example.com/second');
    });

    test('should handle multiple segments separated by delimiters', () => {
      const segmenter = new Segmenter();
      const lines = scanner.scan(
        'GET /first\n' + '###\n' + 'GET /second\n' + '###\n' + 'GET /third'
      );

      const result = segmenter.segment(lines);

      expect(result).toHaveLength(3);
      expect(result[0]?.lines[0]?.text).toBe('GET /first');
      expect(result[1]?.lines[0]?.text).toBe('GET /second');
      expect(result[2]?.lines[0]?.text).toBe('GET /third');
    });
  });

  // ============================================================================
  // Delimiter Recognition
  // ============================================================================
  describe('delimiter recognition', () => {
    test('should recognize ### as a valid delimiter', () => {
      const segmenter = new Segmenter();
      expect(segmenter.isDelimiter('###')).toBe(true);
    });

    test('should recognize #### (4+ hashes) as a valid delimiter', () => {
      const segmenter = new Segmenter();
      expect(segmenter.isDelimiter('####')).toBe(true);
      expect(segmenter.isDelimiter('#####')).toBe(true);
      expect(segmenter.isDelimiter('##########')).toBe(true);
    });

    test('should recognize delimiter with leading/trailing whitespace', () => {
      const segmenter = new Segmenter();
      expect(segmenter.isDelimiter('  ###')).toBe(true);
      expect(segmenter.isDelimiter('###  ')).toBe(true);
      expect(segmenter.isDelimiter('  ###  ')).toBe(true);
      expect(segmenter.isDelimiter('\t###\t')).toBe(true);
    });

    test('should NOT recognize ## (only 2 hashes) as a delimiter', () => {
      const segmenter = new Segmenter();
      expect(segmenter.isDelimiter('##')).toBe(false);
      expect(segmenter.isDelimiter('#')).toBe(false);
    });

    test('should NOT recognize delimiter with text after hashes', () => {
      const segmenter = new Segmenter();
      expect(segmenter.isDelimiter('### comment')).toBe(false);
      expect(segmenter.isDelimiter('### Request 1')).toBe(false);
    });

    test('should NOT recognize delimiter with text before hashes', () => {
      const segmenter = new Segmenter();
      expect(segmenter.isDelimiter('text ###')).toBe(false);
    });
  });

  // ============================================================================
  // Empty Segment Handling
  // ============================================================================
  describe('empty segment handling', () => {
    test('should ignore empty segments (only empty lines)', () => {
      const segmenter = new Segmenter();
      const lines = scanner.scan(
        '###\n' + '\n' + '\n' + '###\n' + 'GET https://example.com'
      );

      const result = segmenter.segment(lines);

      // Only the segment with actual content should be returned
      expect(result).toHaveLength(1);
      expect(result[0]?.lines[0]?.text).toBe('GET https://example.com');
    });

    test('should ignore segments with only whitespace lines', () => {
      const segmenter = new Segmenter();
      const lines = scanner.scan(
        'GET /first\n' + '###\n' + '   \n' + '\t\n' + '###\n' + 'GET /second'
      );

      const result = segmenter.segment(lines);

      expect(result).toHaveLength(2);
      expect(result[0]?.lines[0]?.text).toBe('GET /first');
      expect(result[1]?.lines[0]?.text).toBe('GET /second');
    });

    test('should return empty array when input has only delimiters', () => {
      const segmenter = new Segmenter();
      const lines = scanner.scan('###\n' + '###\n' + '###');

      const result = segmenter.segment(lines);

      expect(result).toHaveLength(0);
    });

    test('should return empty array for empty input', () => {
      const segmenter = new Segmenter();
      const result = segmenter.segment([]);

      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // Segment Structure
  // ============================================================================
  describe('segment structure', () => {
    test('should correctly assign segmentId incrementally', () => {
      const segmenter = new Segmenter();
      const lines = scanner.scan(
        'Request 1\n' + '###\n' + 'Request 2\n' + '###\n' + 'Request 3'
      );

      const result = segmenter.segment(lines);

      expect(result[0]?.segmentId).toBe(0);
      expect(result[1]?.segmentId).toBe(1);
      expect(result[2]?.segmentId).toBe(2);
    });

    test('should correctly track startLine and endLine for multi-line segments', () => {
      const segmenter = new Segmenter();
      const lines = scanner.scan(
        'POST https://example.com/comments HTTP/1.1\n' + // Line 1
          'content-type: application/json\n' + // Line 2
          '\n' + // Line 3
          '{\n' + // Line 4
          '  "title": "Hello"\n' + // Line 5
          '}\n' + // Line 6
          '\n' + // Line 7
          '###\n' + // Line 8
          '\n' + // Line 9
          'GET https://example.com/posts?id=1' // Line 10
      );

      const result = segmenter.segment(lines);

      expect(result).toHaveLength(2);

      // First segment: lines 1-7
      expect(result[0]?.startLine).toBe(1);
      expect(result[0]?.endLine).toBe(7);
      expect(result[0]?.lines).toHaveLength(7);

      // Second segment: lines 9-10
      expect(result[1]?.startLine).toBe(9);
      expect(result[1]?.endLine).toBe(10);
      expect(result[1]?.lines).toHaveLength(2);
    });

    test('should exclude delimiter line from segments', () => {
      const segmenter = new Segmenter();
      const lines = scanner.scan('GET /first\n' + '###\n' + 'GET /second');

      const result = segmenter.segment(lines);

      // Delimiter should not appear in any segment's lines
      result.forEach((segment) => {
        segment.lines.forEach((line) => {
          expect(segmenter.isDelimiter(line.text)).toBe(false);
        });
      });
    });

    test('should preserve LineContext objects in segment lines', () => {
      const segmenter = new Segmenter();
      const lines = scanner.scan(
        'GET https://example.com\n' + 'Authorization: Bearer token'
      );

      const result = segmenter.segment(lines);

      expect(result[0]?.lines[0]).toEqual({
        lineNumber: 1,
        startOffset: 0,
        endOffset: 23,
        text: 'GET https://example.com',
      });
      expect(result[0]?.lines[1]).toEqual({
        lineNumber: 2,
        startOffset: 24,
        endOffset: 51,
        text: 'Authorization: Bearer token',
      });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('edge cases', () => {
    test('should handle delimiter at the beginning of input', () => {
      const segmenter = new Segmenter();
      const lines = scanner.scan('###\n' + 'GET https://example.com');

      const result = segmenter.segment(lines);

      expect(result).toHaveLength(1);
      expect(result[0]?.segmentId).toBe(0);
      expect(result[0]?.lines[0]?.text).toBe('GET https://example.com');
    });

    test('should handle delimiter at the end of input', () => {
      const segmenter = new Segmenter();
      const lines = scanner.scan('GET https://example.com\n' + '###');

      const result = segmenter.segment(lines);

      expect(result).toHaveLength(1);
      expect(result[0]?.lines[0]?.text).toBe('GET https://example.com');
    });

    test('should handle consecutive delimiters', () => {
      const segmenter = new Segmenter();
      const lines = scanner.scan(
        'GET /first\n' + '###\n' + '###\n' + '###\n' + 'GET /second'
      );

      const result = segmenter.segment(lines);

      expect(result).toHaveLength(2);
      expect(result[0]?.lines[0]?.text).toBe('GET /first');
      expect(result[1]?.lines[0]?.text).toBe('GET /second');
    });

    test('should preserve empty lines within content segments', () => {
      const segmenter = new Segmenter();
      const lines = scanner.scan(
        'POST /api\n' +
          'Content-Type: application/json\n' +
          '\n' + // Empty line separating headers from body
          '{"data": "value"}'
      );

      const result = segmenter.segment(lines);

      expect(result).toHaveLength(1);
      expect(result[0]?.lines).toHaveLength(4);
      expect(result[0]?.lines[2]?.text).toBe('');
    });

    test('should create copy of lines array to avoid mutation', () => {
      const segmenter = new Segmenter();
      const originalLines = scanner.scan('GET https://example.com');
      const originalLinesCopy = [...originalLines];

      const result = segmenter.segment(originalLines);

      // Mutate the result
      const mutatedLine: LineContext = {
        lineNumber: 99,
        startOffset: 0,
        endOffset: 7,
        text: 'mutated',
      };
      result[0]?.lines.push(mutatedLine);

      // Original should be unchanged
      expect(originalLines).toEqual(originalLinesCopy);
    });
  });

  // ============================================================================
  // Specification Examples
  // ============================================================================
  describe('specification examples', () => {
    test('should match the segmenter output example from SPECIFICATION.md Section 4.1', () => {
      // Using LineScanner to generate lines matching the specification example
      const segmenter = new Segmenter();
      const lines = scanner.scan(
        'POST https://example.com/comments HTTP/1.1\n' +
          'content-type: application/json\n' +
          '\n' +
          '{\n' +
          '  "title": "Hello"\n' +
          '}\n' +
          '\n' +
          '###\n' +
          '\n' +
          'GET https://example.com/posts?id=1'
      );

      const result = segmenter.segment(lines);

      expect(result).toHaveLength(2);

      // First segment - lines 1-7
      expect(result[0]).toMatchObject({
        segmentId: 0,
        startLine: 1,
        endLine: 7,
      });
      expect(result[0]?.lines).toHaveLength(7);

      // Second segment - lines 9-10
      expect(result[1]).toMatchObject({
        segmentId: 1,
        startLine: 9,
        endLine: 10,
      });
      expect(result[1]?.lines).toHaveLength(2);
    });

    test('should correctly segment a request and its subsequent response (Section 2.18)', () => {
      const segmenter = new Segmenter();
      const input =
        'POST https://example.com/api\n' +
        'Content-Type: application/json\n' +
        '\n' +
        '{"id": 1}\n' +
        '###\n' +
        'HTTP/1.1 201 Created\n' +
        'Content-Type: application/json\n' +
        '\n' +
        '{"status": "success"}';

      const lines = scanner.scan(input);
      const result = segmenter.segment(lines);

      expect(result).toHaveLength(2);

      // Request segment
      expect(result[0]?.lines[0]?.text).toBe('POST https://example.com/api');
      expect(result[0]?.startLine).toBe(1);
      expect(result[0]?.endLine).toBe(4);

      // Response segment
      expect(result[1]?.lines[0]?.text).toBe('HTTP/1.1 201 Created');
      expect(result[1]?.startLine).toBe(6);
      expect(result[1]?.endLine).toBe(9);
    });
  });
});
