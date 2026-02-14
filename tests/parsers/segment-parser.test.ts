import { test, expect, describe } from 'bun:test';
import { SegmentParser } from '../../src/parsers/segment-parser';
import { SegmentClassifier } from '../../src/segmenter/classifier';
import { Segmenter } from '../../src/segmenter/segmenter';
import { LineScanner } from '../../src/scanner/line-scanner';
import { VariableRegistry } from '../../src/scanner/variable-scanner';
import type { ClassifiedSegment } from '../../src/types/types';

const scanner = new LineScanner();
const segmenter = new Segmenter();
const classifier = new SegmentClassifier();
const parser = new SegmentParser();

describe('SegmentParser', () => {
  describe('HTTP Request parsing', () => {
    test('should parse a simple GET request with URL only', () => {
      const lines = scanner.scan('https://example.com/comments/1');
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result).not.toBeNull();
      expect(result!.method).toBeNull();
      expect(result!.url).toBe('https://example.com/comments/1');
      expect(result!.httpVersion).toBeNull();
      expect(result!.headers).toEqual([]);
      expect(result!.body).toBeNull();
      expect(result!.queryParams).toEqual([]);
    });

    test('should parse a POST request with HTTP version', () => {
      const lines = scanner.scan('POST https://api.example.com/users HTTP/1.1');
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result!.method).toBe('POST');
      expect(result!.url).toBe('https://api.example.com/users');
      expect(result!.httpVersion).toBe('HTTP/1.1');
    });

    test('should parse request with headers', () => {
      const input = `GET https://api.example.com/users
Content-Type: application/json
Authorization: Bearer token123`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result!.headers).toHaveLength(2);
      expect(result!.headers[0]).toEqual({
        name: 'Content-Type',
        value: 'application/json',
      });
      expect(result!.headers[1]).toEqual({
        name: 'Authorization',
        value: 'Bearer token123',
      });
    });

    test('should parse request with JSON body', () => {
      const input = `POST https://api.example.com/users
Content-Type: application/json

{"name": "John", "email": "john@example.com"}`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result!.body).not.toBeNull();
      expect(result!.body!.status).toBe('parsed');
      if (result!.body!.status === 'parsed') {
        expect(result!.body!.content.body.kind).toBe('json');
      }
    });

    test('should parse request with text body', () => {
      const input = `POST https://api.example.com/data
Content-Type: text/plain

Hello World`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result!.body).not.toBeNull();
      expect(result!.body!.status).toBe('parsed');
      if (result!.body!.status === 'parsed') {
        expect(result!.body!.content.body.kind).toBe('text');
      }
    });

    test('should parse request with query parameters', () => {
      const input = `GET https://api.example.com/search
?page=1
&limit=10
&sort=asc`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result!.queryParams).toHaveLength(3);
      expect(result!.queryParams[0]).toEqual({ key: 'page', value: '1' });
      expect(result!.queryParams[1]).toEqual({ key: 'limit', value: '10' });
      expect(result!.queryParams[2]).toEqual({ key: 'sort', value: 'asc' });
    });

    test('should parse request with @name directive', () => {
      const input = `@name GetUser
GET https://api.example.com/users/1`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result!.name).toBe('GetUser');
    });

    test('should parse request with block variables', () => {
      const input = `@baseUrl = https://api.example.com
GET {{baseUrl}}/users`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result!.blockVariables.fileVariables).toHaveLength(1);
      expect(result!.blockVariables.fileVariables[0]).toMatchObject({
        key: 'baseUrl',
        value: 'https://api.example.com',
      });
    });

    test('should parse request with comments', () => {
      const input = `# This is a comment
GET https://api.example.com/users`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result!.comments).toHaveLength(1);
      expect(result!.comments[0]).toBe('This is a comment');
    });
  });

  describe('HTTP Response parsing', () => {
    test('should parse a simple response', () => {
      const input = `HTTP/1.1 200 OK
Content-Type: application/json

{"status": "success"}`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe(200);
      expect(result!.statusText).toBe('OK');
      expect(result!.httpVersion).toBe('HTTP/1.1');
    });

    test('should parse response with headers only', () => {
      const input = `HTTP/1.1 404 Not Found
Content-Type: text/plain`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result!.statusCode).toBe(404);
      expect(result!.statusText).toBe('Not Found');
      expect(result!.headers).toHaveLength(1);
      expect(result!.body).toBeNull();
    });

    test('should parse response body as raw text', () => {
      const input = `HTTP/1.1 200 OK
Content-Type: application/json

{"data": "value"}`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result!.body).toBe('{"data": "value"}');
    });

    test('should parse response with block variables', () => {
      const input = `@token = abc123
HTTP/1.1 200 OK
Authorization: Bearer {{token}}`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result!.variables.fileVariables).toHaveLength(1);
      expect(result!.variables.fileVariables[0]).toMatchObject({
        key: 'token',
        value: 'abc123',
      });
    });
  });

  describe('Edge cases', () => {
    test('should handle empty segment', () => {
      const lines = scanner.scan('');
      const segments = segmenter.segment(lines);

      // Empty segments are filtered out by segmenter
      expect(segments).toHaveLength(0);
    });

    test('should handle segment with only whitespace', () => {
      const lines = scanner.scan('   \n   \n   ');
      const segments = segmenter.segment(lines);

      // Whitespace-only segments are filtered out
      expect(segments).toHaveLength(0);
    });

    test('should handle request with only comments', () => {
      const input = `# This is just a comment
# Another comment`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      // Comment-only segments should be ignored
      expect(result).toBeNull();
    });

    test('should correctly set rawTextRange', () => {
      const input = `GET https://api.example.com/users
Content-Type: application/json`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result!.rawTextRange).toEqual({
        startLine: 1,
        endLine: 2,
      });
    });

    test('should skip @name when extracting block variables', () => {
      const input = `@name MyRequest
@token = abc123
GET https://api.example.com`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result!.name).toBe('MyRequest');
      // @name should not appear in blockVariables
      const hasNameVar = result!.blockVariables.fileVariables.some(
        (v) => v.key === 'name'
      );
      expect(hasNameVar).toBe(false);
      expect(result!.blockVariables.fileVariables).toHaveLength(1);
      expect(result!.blockVariables.fileVariables[0].key).toBe('token');
    });

    test('should not include delimiter lines in comments', () => {
      const input = `# Comment 1
GET https://api.example.com
###
# Comment 2
POST https://api.example.com/data`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result1 = parser.parseSegment(classified[0]!, registry);
      const result2 = parser.parseSegment(classified[1]!, registry);

      expect(result1!.comments).toHaveLength(1);
      expect(result1!.comments[0]).toBe('Comment 1');
      expect(result2!.comments).toHaveLength(1);
      expect(result2!.comments[0]).toBe('Comment 2');
    });
  });

  describe('Multiple segments', () => {
    test('should parse multiple requests separated by delimiters', () => {
      const input = `GET https://api.example.com/users
###
POST https://api.example.com/users
Content-Type: application/json

{"name": "John"}
###
DELETE https://api.example.com/users/1`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      expect(classified).toHaveLength(3);

      const result1 = parser.parseSegment(classified[0]!, registry);
      const result2 = parser.parseSegment(classified[1]!, registry);
      const result3 = parser.parseSegment(classified[2]!, registry);

      expect(result1!.method).toBe('GET');
      expect(result2!.method).toBe('POST');
      expect(result3!.method).toBe('DELETE');
    });

    test('should parse request followed by expected response', () => {
      const input = `POST https://api.example.com/users
Content-Type: application/json

{"name": "John"}
###
HTTP/1.1 201 Created
Content-Type: application/json
Location: /users/123`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      expect(classified).toHaveLength(2);
      expect(classified[0]!.messageType).toBe('request');
      expect(classified[1]!.messageType).toBe('response');

      const request = parser.parseSegment(classified[0]!, registry);
      const response = parser.parseSegment(classified[1]!, registry);

      expect(request!.method).toBe('POST');
      expect(response!.statusCode).toBe(201);
    });
  });

  describe('Form data body parsing', () => {
    test('should parse request with form data body', () => {
      const input = `POST https://api.example.com/form
Content-Type: application/x-www-form-urlencoded

name=John&email=john@example.com`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result!.body).not.toBeNull();
      expect(result!.body!.status).toBe('parsed');
      if (result!.body!.status === 'parsed') {
        expect(result!.body!.content.body.kind).toBe('form');
      }
    });
  });

  describe('Multipart body parsing', () => {
    test('should parse request with multipart body', () => {
      const input = `POST https://api.example.com/upload
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="test.txt"

file content
------WebKitFormBoundary--`;
      const lines = scanner.scan(input);
      const segments = segmenter.segment(lines);
      const classified = classifier.classify(segments);
      const registry = new VariableRegistry();

      const result = parser.parseSegment(classified[0]!, registry);

      expect(result!.body).not.toBeNull();
      expect(result!.body!.status).toBe('parsed');
      if (result!.body!.status === 'parsed') {
        expect(result!.body!.content.body.kind).toBe('multipart');
      }
    });
  });
});
