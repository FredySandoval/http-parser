import { test, expect, describe } from 'bun:test';
import { ResponseLineParser } from '../../src/parsers/response-line';
import { LineScanner } from '../../src/scanner/line-scanner';

describe('ResponseLineParser', () => {
  describe('standard response lines', () => {
    test('should parse full RFC style response line', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('HTTP/1.1 200 OK');
      const parser = new ResponseLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        httpVersion: 'HTTP/1.1',
        statusCode: 200,
        statusText: 'OK',
      });
    });

    test('should parse response line without version', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('404 Not Found');
      const parser = new ResponseLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        httpVersion: null,
        statusCode: 404,
        statusText: 'Not Found',
      });
    });

    test('should parse http2 response', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('HTTP/2 500 Internal Server Error');
      const parser = new ResponseLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        httpVersion: 'HTTP/2',
        statusCode: 500,
        statusText: 'Internal Server Error',
      });
    });
  });

  describe('partial response lines', () => {
    test('should parse status code only', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('200');
      const parser = new ResponseLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        httpVersion: null,
        statusCode: 200,
        statusText: null,
      });
    });

    test('should parse status message only', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('OK');
      const parser = new ResponseLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        httpVersion: null,
        statusCode: null,
        statusText: 'OK',
      });
    });

    test('should parse version and code only', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('HTTP/1.1 200');
      const parser = new ResponseLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        httpVersion: 'HTTP/1.1',
        statusCode: 200,
        statusText: null,
      });
    });
  });

  describe('edge cases', () => {
    test('should handle extra whitespace', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('  HTTP/1.1   200   OK  ');
      const parser = new ResponseLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        httpVersion: 'HTTP/1.1',
        statusCode: 200,
        statusText: 'OK',
      });
    });

    test('should return empty object if input is empty', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('');
      const parser = new ResponseLineParser();

      const result = parser.parse(lines[0]!.text);

      expect(result).toEqual({
        httpVersion: null,
        statusCode: null,
        statusText: null,
      });
    });
  });
});
