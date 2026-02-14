import { test, expect, describe } from 'bun:test';
import {
  parseHttp,
  VERSION,
  DEFAULT_OPTIONS,
  HttpRequestParser,
  LineScanner,
  Segmenter,
  VariableScanner,
  VariableRegistry,
  SegmentClassifier,
  SegmentParser,
  HTTPRequestLineParser,
  ResponseLineParser,
  HeaderParser,
  BodyParser,
  QueryParser,
} from '../src/index';

describe('index.ts - Public API', () => {
  describe('parseHttp function', () => {
    test('should be exported and callable', () => {
      expect(typeof parseHttp).toBe('function');
    });

    test('should parse a simple GET request', () => {
      const input = 'GET https://api.example.com/users';
      const result = parseHttp(input);

      expect(result).toBeDefined();
      expect(result.text).toBe(input);
      expect(result.ast.requests).toHaveLength(1);
      expect(result.ast.fileScopedVariables.fileVariables).toHaveLength(0);
      expect(result.ast.requests[0]!.method).toBe('GET');
      expect(result.ast.requests[0]!.url).toBe('https://api.example.com/users');
    });

    test('should parse request with options', () => {
      const input = 'GET https://api.example.com/users';
      const result = parseHttp(input, {
        encoding: 'utf-16',
        strict: true,
      });

      expect(result).toBeDefined();
      expect(result.metadata.encoding).toBe('utf-16');
    });

    test('should return ParseResult structure', () => {
      const input = 'GET /test';
      const result = parseHttp(input);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('lineContexts');
      expect(result).toHaveProperty('segments');
      expect(result).toHaveProperty('ast');
      expect(result.ast).toHaveProperty('fileScopedVariables');
    });
  });

  describe('Constants', () => {
    test('should export VERSION', () => {
      expect(typeof VERSION).toBe('string');
      expect(VERSION).toBe('1.0.0');
    });

    test('should export DEFAULT_OPTIONS', () => {
      expect(typeof DEFAULT_OPTIONS).toBe('object');
      expect(DEFAULT_OPTIONS.encoding).toBe('utf-8');
      expect(DEFAULT_OPTIONS.strict).toBe(false);
    });
  });

  describe('Class exports', () => {
    test('should export HttpRequestParser', () => {
      expect(typeof HttpRequestParser).toBe('function');
      const parser = new HttpRequestParser();
      expect(parser).toBeInstanceOf(HttpRequestParser);
    });

    test('should export LineScanner', () => {
      expect(typeof LineScanner).toBe('function');
      const scanner = new LineScanner();
      expect(scanner).toBeInstanceOf(LineScanner);
    });

    test('should export Segmenter', () => {
      expect(typeof Segmenter).toBe('function');
      const segmenter = new Segmenter();
      expect(segmenter).toBeInstanceOf(Segmenter);
    });

    test('should export VariableScanner', () => {
      expect(typeof VariableScanner).toBe('function');
      const variableScanner = new VariableScanner();
      expect(variableScanner).toBeInstanceOf(VariableScanner);
    });

    test('should export VariableRegistry', () => {
      expect(typeof VariableRegistry).toBe('function');
      const registry = new VariableRegistry();
      expect(registry).toBeInstanceOf(VariableRegistry);
    });

    test('should export SegmentClassifier', () => {
      expect(typeof SegmentClassifier).toBe('function');
      const classifier = new SegmentClassifier();
      expect(classifier).toBeInstanceOf(SegmentClassifier);
    });

    test('should export SegmentParser', () => {
      expect(typeof SegmentParser).toBe('function');
      const segmentParser = new SegmentParser();
      expect(segmentParser).toBeInstanceOf(SegmentParser);
    });

    test('should export HTTPRequestLineParser', () => {
      expect(typeof HTTPRequestLineParser).toBe('function');
      const requestLineParser = new HTTPRequestLineParser();
      expect(requestLineParser).toBeInstanceOf(HTTPRequestLineParser);
    });

    test('should export ResponseLineParser', () => {
      expect(typeof ResponseLineParser).toBe('function');
      const responseLineParser = new ResponseLineParser();
      expect(responseLineParser).toBeInstanceOf(ResponseLineParser);
    });

    test('should export HeaderParser', () => {
      expect(typeof HeaderParser).toBe('function');
      const headerParser = new HeaderParser();
      expect(headerParser).toBeInstanceOf(HeaderParser);
    });

    test('should export BodyParser', () => {
      expect(typeof BodyParser).toBe('function');
      const bodyParser = new BodyParser();
      expect(bodyParser).toBeInstanceOf(BodyParser);
    });

    test('should export QueryParser', () => {
      expect(typeof QueryParser).toBe('function');
      const queryParser = new QueryParser();
      expect(queryParser).toBeInstanceOf(QueryParser);
    });
  });

  describe('Type exports (compile-time verification)', () => {
    test('parseHttp should accept ParserOptions', () => {
      // This test verifies that the types are correctly exported
      const result = parseHttp('GET /test', {
        encoding: 'utf-8',
        strict: false,
      });
      expect(result).toBeDefined();
    });

    test('should handle complex HTTP file with all features', () => {
      const input = `###
@baseUrl = https://api.example.com
# Get all users
@name GetUsers
GET {{baseUrl}}/users
Accept: application/json

###
POST {{baseUrl}}/users HTTP/1.1
Content-Type: application/json

{"name": "John"}

###
HTTP/1.1 201 Created
Content-Type: application/json`;

      const result = parseHttp(input);

      expect(result.ast.requests).toHaveLength(2);
      expect(result.ast.fileScopedVariables.fileVariables).toHaveLength(0);
      expect(result.ast.globalVariables.fileVariables).toHaveLength(1);
      expect(result.ast.requests[1]!.expectedResponse).not.toBeNull();
    });
  });

  describe('Integration with exported classes', () => {
    test('LineScanner should work when used directly', () => {
      const scanner = new LineScanner();
      const lines = scanner.scan('GET /test\nPOST /data');

      expect(lines).toHaveLength(2);
      expect(lines[0]!.text).toBe('GET /test');
      expect(lines[1]!.text).toBe('POST /data');
    });

    test('Segmenter should work when used directly', () => {
      const scanner = new LineScanner();
      const segmenter = new Segmenter();
      const lines = scanner.scan('GET /test\n###\nPOST /data');
      const segments = segmenter.segment(lines);

      expect(segments).toHaveLength(2);
    });

    test('HTTPRequestLineParser should work when used directly', () => {
      const parser = new HTTPRequestLineParser();
      const result = parser.parse('GET https://api.example.com/users HTTP/1.1');

      expect(result.method).toBe('GET');
      expect(result.url).toBe('https://api.example.com/users');
      expect(result.httpVersion).toBe('HTTP/1.1');
    });

    test('ResponseLineParser should work when used directly', () => {
      const parser = new ResponseLineParser();
      const result = parser.parse('HTTP/1.1 200 OK');

      expect(result.httpVersion).toBe('HTTP/1.1');
      expect(result.statusCode).toBe(200);
      expect(result.statusText).toBe('OK');
    });

    test('HeaderParser should work when used directly', () => {
      const parser = new HeaderParser();
      const lines = [
        {
          lineNumber: 1,
          startOffset: 0,
          endOffset: 24,
          text: 'Content-Type: application/json',
        },
        {
          lineNumber: 2,
          startOffset: 25,
          endOffset: 48,
          text: 'Authorization: Bearer token',
        },
        { lineNumber: 3, startOffset: 49, endOffset: 49, text: '' },
      ];
      const result = parser.parse(lines);

      expect(result.headers).toHaveLength(2);
      expect(result.headers[0]).toEqual({
        name: 'Content-Type',
        value: 'application/json',
      });
    });

    test('BodyParser should work when used directly', () => {
      const parser = new BodyParser();
      const lines = [
        {
          lineNumber: 1,
          startOffset: 0,
          endOffset: 16,
          text: '{"name": "John"}',
        },
      ];
      const headers = [{ name: 'Content-Type', value: 'application/json' }];
      const result = parser.parse(lines, headers);

      expect(result).not.toBeNull();
      expect(result.status).toBe('parsed');
    });

    test('QueryParser should work when used directly', () => {
      const parser = new QueryParser();
      const lines = [
        { lineNumber: 1, startOffset: 0, endOffset: 8, text: '?page=1' },
        { lineNumber: 2, startOffset: 9, endOffset: 18, text: '&limit=10' },
      ];
      const result = parser.parse(lines);

      expect(result.queryParams).toHaveLength(2);
      expect(result.queryParams[0]).toEqual({ key: 'page', value: '1' });
    });

    test('VariableRegistry should work when used directly', () => {
      const registry = new VariableRegistry();
      registry.set('baseUrl', 'https://api.example.com');

      expect(registry.get('baseUrl')).toBe('https://api.example.com');
      expect(registry.getAll()).toEqual({ baseUrl: 'https://api.example.com' });
    });
  });
});
