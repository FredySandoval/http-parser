import { test, expect, describe } from 'bun:test';
import { LineScanner } from '../../src/scanner/line-scanner';

/**
 * Test suite for LineScanner class.
 *
 * According to SPECIFICATION.md Section 4.1 (Line Scanner):
 * Responsibilities:
 * - Split text into lines
 * - Track line numbers and offsets
 * - Preserve raw text (empty lines, whitespace, indentation)
 * - `endOffset` is exclusive (points to position after last character of line)
 * - Line breaks are not included in the text field
 * No tokens. No semantics.
 */

describe('LineScanner', () => {
  // ============================================================================
  // Basic Functionality
  // ============================================================================
  describe('basic functionality', () => {
    test('should scan a single line without line break', () => {
      const scanner = new LineScanner();
      const result = scanner.scan('GET https://example.com');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        lineNumber: 1,
        startOffset: 0,
        endOffset: 23,
        text: 'GET https://example.com',
      });
    });

    test('should scan multiple lines separated by LF (\\n)', () => {
      const scanner = new LineScanner();
      const input =
        'POST https://example.com/comments HTTP/1.1\ncontent-type: application/json';
      const result = scanner.scan(input);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        lineNumber: 1,
        startOffset: 0,
        endOffset: 42,
        text: 'POST https://example.com/comments HTTP/1.1',
      });
      expect(result[1]).toEqual({
        lineNumber: 2,
        startOffset: 43,
        endOffset: 73,
        text: 'content-type: application/json',
      });
    });

    test('should handle CRLF (\\r\\n) as a single line break', () => {
      const scanner = new LineScanner();
      const input = 'Line 1\r\nLine 2\r\nLine 3';
      const result = scanner.scan(input);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        lineNumber: 1,
        startOffset: 0,
        endOffset: 6,
        text: 'Line 1',
      });
      expect(result[1]).toEqual({
        lineNumber: 2,
        startOffset: 8,
        endOffset: 14,
        text: 'Line 2',
      });
      expect(result[2]).toEqual({
        lineNumber: 3,
        startOffset: 16,
        endOffset: 22,
        text: 'Line 3',
      });
    });

    test('should handle CR (\\r) alone as a line break', () => {
      const scanner = new LineScanner();
      const input = 'Line 1\rLine 2';
      const result = scanner.scan(input);

      expect(result).toHaveLength(2);
      expect(result[0]?.text).toBe('Line 1');
      expect(result[1]?.text).toBe('Line 2');
    });
  });

  // ============================================================================
  // Empty Input Handling
  // ============================================================================
  describe('empty input handling', () => {
    test('should return single empty line for empty input', () => {
      const scanner = new LineScanner();
      const result = scanner.scan('');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        lineNumber: 1,
        startOffset: 0,
        endOffset: 0,
        text: '',
      });
    });
  });

  // ============================================================================
  // Empty Lines Preservation
  // ============================================================================
  describe('empty lines preservation', () => {
    test('should preserve empty lines in the middle of content', () => {
      const scanner = new LineScanner();
      const input = 'Header line\n\nBody line';
      const result = scanner.scan(input);

      expect(result).toHaveLength(3);
      expect(result[0]?.text).toBe('Header line');
      expect(result[1]?.text).toBe('');
      expect(result[2]?.text).toBe('Body line');
    });

    test('should preserve multiple consecutive empty lines', () => {
      const scanner = new LineScanner();
      const input = 'Line 1\n\n\n\nLine 2';
      const result = scanner.scan(input);

      expect(result).toHaveLength(5);
      expect(result[0]?.text).toBe('Line 1');
      expect(result[1]?.text).toBe('');
      expect(result[2]?.text).toBe('');
      expect(result[3]?.text).toBe('');
      expect(result[4]?.text).toBe('Line 2');
    });
  });

  // ============================================================================
  // Whitespace Preservation
  // ============================================================================
  describe('whitespace preservation', () => {
    test('should preserve leading whitespace/indentation', () => {
      const scanner = new LineScanner();
      const input = '{\n  "title": "Hello"\n}';
      const result = scanner.scan(input);

      expect(result).toHaveLength(3);
      expect(result[0]?.text).toBe('{');
      expect(result[1]?.text).toBe('  "title": "Hello"');
      expect(result[2]?.text).toBe('}');
    });

    test('should preserve trailing whitespace', () => {
      const scanner = new LineScanner();
      const input = 'Line with trailing spaces   \nNext line';
      const result = scanner.scan(input);

      expect(result[0]?.text).toBe('Line with trailing spaces   ');
      expect(result[1]?.text).toBe('Next line');
    });

    test('should handle lines with only whitespace', () => {
      const scanner = new LineScanner();
      const input = 'Line 1\n   \nLine 2';
      const result = scanner.scan(input);

      expect(result).toHaveLength(3);
      expect(result[1]?.text).toBe('   ');
    });
  });

  // ============================================================================
  // Offset Tracking
  // ============================================================================
  describe('offset tracking', () => {
    test('should track correct offsets for each line', () => {
      const scanner = new LineScanner();
      // Example from SPECIFICATION.md Section 4.1
      const input =
        'POST https://example.com/comments HTTP/1.1\n' +
        'content-type: application/json\n' +
        '\n' +
        '{\n' +
        '  "title": "Hello"\n' +
        '}\n' +
        '\n' +
        '###\n' +
        '\n' +
        'GET https://example.com/posts?id=1';
      const result = scanner.scan(input);

      expect(result).toHaveLength(10);

      // Verify first line
      expect(result[0]?.lineNumber).toBe(1);
      expect(result[0]?.startOffset).toBe(0);
      expect(result[0]?.text).toBe(
        'POST https://example.com/comments HTTP/1.1'
      );

      // Verify that endOffset is exclusive
      // Line 1: "POST https://example.com/comments HTTP/1.1" = 42 characters
      // endOffset should be 42 (0+42)
      expect(result[0]?.endOffset).toBe(42);
    });

    test('should have endOffset exclusive (pointing after last character)', () => {
      const scanner = new LineScanner();
      const input = 'abc';
      const result = scanner.scan(input);

      expect(result[0]?.startOffset).toBe(0);
      expect(result[0]?.endOffset).toBe(3);
      expect(input.slice(result[0]?.startOffset, result[0]?.endOffset)).toBe(
        'abc'
      );
    });
  });

  // ============================================================================
  // Line Number Tracking
  // ============================================================================
  describe('line number tracking', () => {
    test('should use 1-indexed line numbers', () => {
      const scanner = new LineScanner();
      const input = 'Line 1\nLine 2\nLine 3';
      const result = scanner.scan(input);

      expect(result[0]?.lineNumber).toBe(1);
      expect(result[1]?.lineNumber).toBe(2);
      expect(result[2]?.lineNumber).toBe(3);
    });
  });

  // ============================================================================
  // HTTP Request Examples (from SPECIFICATION.md)
  // ============================================================================
  describe('HTTP request examples from specification', () => {
    test('should correctly scan a typical HTTP request', () => {
      const scanner = new LineScanner();
      const input = `GET https://example.com
  ?page=2
  &pageSize=10`;
      const result = scanner.scan(input);

      expect(result).toHaveLength(3);
      expect(result[0]?.text).toBe('GET https://example.com');
      expect(result[1]?.text).toBe('  ?page=2');
      expect(result[2]?.text).toBe('  &pageSize=10');
    });

    test('should correctly scan request with headers and body', () => {
      const scanner = new LineScanner();
      const input = `POST https://example.com/api HTTP/1.1
Content-Type: application/json
Authorization: Bearer token123

{
    "data": "value"
}`;
      const result = scanner.scan(input);

      expect(result).toHaveLength(7);
      expect(result[0]?.text).toBe('POST https://example.com/api HTTP/1.1');
      expect(result[1]?.text).toBe('Content-Type: application/json');
      expect(result[2]?.text).toBe('Authorization: Bearer token123');
      expect(result[3]?.text).toBe('');
      expect(result[4]?.text).toBe('{');
      expect(result[5]?.text).toBe('    "data": "value"');
      expect(result[6]?.text).toBe('}');
    });

    test('should correctly scan request delimiter (###)', () => {
      const scanner = new LineScanner();
      const input = 'GET /first\n###\nGET /second';
      const result = scanner.scan(input);

      expect(result).toHaveLength(3);
      expect(result[0]?.text).toBe('GET /first');
      expect(result[1]?.text).toBe('###');
      expect(result[2]?.text).toBe('GET /second');
    });
  });
});
