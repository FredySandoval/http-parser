import { test, expect, describe } from 'bun:test';
import { RequestLineParser } from '../../src/parsers/request-line';
import { LineScanner } from '../../src/scanner/line-scanner';

describe('RequestLineParser', () => {
  describe('standard requests', () => {
    test('should parse full RFC style request line', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('POST https://example.com/comments HTTP/1.1');
      const parser = new RequestLineParser();

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
      const parser = new RequestLineParser();

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
      const parser = new RequestLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        method: 'GET',
        url: 'https://example.com/comments',
        httpVersion: null,
      });
    });

    test('should handle relative paths as URL only', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('/api/users');
      const parser = new RequestLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        method: 'GET',
        url: '/api/users',
        httpVersion: null,
      });
    });
  });

  describe('custom methods', () => {
    test('should parse custom method', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('PURGE /cache');
      const parser = new RequestLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        method: 'PURGE',
        url: '/cache',
        httpVersion: null,
      });
    });
  });

  describe('edge cases', () => {
    test('should handle extra whitespace', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('  POST   /api/data   HTTP/1.1  ');
      const parser = new RequestLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        method: 'POST',
        url: '/api/data',
        httpVersion: 'HTTP/1.1',
      });
    });

    test('should return empty URL if input is empty', () => {
      // LineScanner returns empty line for empty input
      const scanner = new LineScanner();
      const lines = scanner.scan('');
      const parser = new RequestLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        method: 'GET',
        url: '',
        httpVersion: null,
      });
    });
  });
});
