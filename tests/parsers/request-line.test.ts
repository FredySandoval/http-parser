import { test, expect, describe } from 'bun:test';
import { HTTPRequestLineParser } from '../../src/parsers/request-line';
import { LineScanner } from '../../src/scanner/line-scanner';

describe('RequestLineParser', () => {
  describe('standard requests', () => {
    test('should parse full RFC style request line', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('POST https://example.com/comments HTTP/1.1');
      const parser = new HTTPRequestLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        method: 'POST',
        url: 'https://example.com/comments',
        httpVersion: 'HTTP/1.1',
      });
    });

    test('should parse request line without HTTP version', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('GET https://example.com/comments');
      const parser = new HTTPRequestLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        method: 'GET',
        url: 'https://example.com/comments',
        httpVersion: null,
      });
    });
  });

  describe('URL only requests', () => {
    test('should default to GET for URL-only line', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('https://example.com/comments');
      const parser = new HTTPRequestLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        method: null,
        url: 'https://example.com/comments',
        httpVersion: null,
      });
    });

    test('should handle relative paths as URL only', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('/api/users');
      const parser = new HTTPRequestLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        method: null,
        url: '/api/users',
        httpVersion: null,
      });
    });
  });

  describe('custom methods', () => {
    test('should not parse custom method', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('PURGE /cache');
      const parser = new HTTPRequestLineParser();

      expect(() => parser.parse(lines[0]!.text)).toThrow('Invalid request line: PURGE /cache');
    });
  });


  describe('edge cases', () => {
    test('should handle extra whitespace', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('  POST   /api/data   HTTP/1.1  ');
      const parser = new HTTPRequestLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        method: 'POST',
        url: '/api/data',
        httpVersion: 'HTTP/1.1',
      });
    });

    test('should return error on empty URL', () => {
      // LineScanner returns empty line for empty input
      const scanner = new LineScanner();
      const lines = scanner.scan('');
      const parser = new HTTPRequestLineParser();

      expect(() => parser.parse(lines[0]!.text)).toThrow('Invalid request line: ');
    });
  });
});
