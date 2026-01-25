import { test, expect, describe } from 'bun:test';
import { Segmenter } from '../../src/segmenter/segmenter';
import { SegmentClassifier } from '../../src/segmenter/classifier';
import { LineScanner } from '../../src/scanner/line-scanner';

/**
 * Test suite for SegmentClassifier class.
 *
 * According to SPECIFICATION.md Section 4.1:
 * - Segmenter Classifier determines segment type (request/response) and subtype (http/curl).
 * - A segment is a response if its first non-empty line starts with "HTTP/".
 * - A segment is a cURL request if its first non-empty line starts with "curl".
 */

const scanner = new LineScanner();
const segmenter = new Segmenter();
const classifier = new SegmentClassifier();

describe('SegmentClassifier', () => {
  test('should classify a standard HTTP request', () => {
    const lines = scanner.scan('GET https://example.com HTTP/1.1');
    const segments = segmenter.segment(lines);
    const result = classifier.classify(segments);

    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('request');
    expect(result[0]!.subtype).toBe('http');
    expect(result[0]!.firstNonEmptyLine.text).toBe(
      'GET https://example.com HTTP/1.1'
    );
  });

  test('should classify a response', () => {
    const lines = scanner.scan('HTTP/1.1 200 OK');
    const segments = segmenter.segment(lines);
    const result = classifier.classify(segments);

    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('response');
    expect(result[0]!.subtype).toBe('http');
    expect(result[0]!.firstNonEmptyLine.text).toBe('HTTP/1.1 200 OK');
  });

  test('should classify a cURL request', () => {
    const lines = scanner.scan('curl -X POST https://example.com');
    const segments = segmenter.segment(lines);
    const result = classifier.classify(segments);

    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('request');
    expect(result[0]!.subtype).toBe('curl');
  });

  test('should classify a GraphQL request if the X-REQUEST-TYPE header is present', () => {
    const input = `
POST https://example.com/graphql
Content-Type: application/json
X-REQUEST-TYPE: GraphQL

query {
  user(id: 1) {
    name
  }
}
`.trim();
    const lines = scanner.scan(input);
    const segments = segmenter.segment(lines);
    const result = classifier.classify(segments);

    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('request');
    expect(result[0]!.subtype).toBe('graphql');
  });

  test('should find the first non-empty line ignoring whitespace-only lines', () => {
    const lines = scanner.scan('\n  \nGET /api');
    const segments = segmenter.segment(lines);
    const result = classifier.classify(segments);

    expect(result).toHaveLength(1);
    expect(result[0]!.firstNonEmptyLine.lineNumber).toBe(3);
    expect(result[0]!.firstNonEmptyLine.text).toBe('GET /api');
  });

  test('should handle case-insensitivity for HTTP/ and curl', () => {
    const lines = scanner.scan(
      'http/1.1 201 Created\n###\nCURL https://example.com'
    );
    const segments = segmenter.segment(lines);
    const result = classifier.classify(segments);

    expect(result).toHaveLength(2);
    expect(result[0]!.type).toBe('response');
    expect(result[1]!.subtype).toBe('curl');
  });

  test('should classify segments correctly when multiple types are present', () => {
    const input = `
POST /api
###
HTTP/1.1 200 OK
###
curl https://example.com
`.trim();
    const lines = scanner.scan(input);
    const segments = segmenter.segment(lines);
    const result = classifier.classify(segments);

    expect(result).toHaveLength(3);
    expect(result[0]!.type).toBe('request');
    expect(result[0]!.subtype).toBe('http');
    expect(result[1]!.type).toBe('response');
    expect(result[2]!.subtype).toBe('curl');
  });

  test('should match the segmenter classifier output example from SPECIFICATION.md Section 4.1', () => {
    const input = `
POST https://example.com/comments HTTP/1.1
content-type: application/json

{
  "title": "Hello"
}

###

GET https://example.com/posts?id=1
`.trim();
    const lines = scanner.scan(input);
    const segments = segmenter.segment(lines);
    const result = classifier.classify(segments);

    expect(result).toHaveLength(2);

    // First segment (POST)
    expect(result[0]!).toMatchObject({
      segmentId: 0,
      type: 'request',
      subtype: 'http',
      firstNonEmptyLine: {
        lineNumber: 1,
        text: 'POST https://example.com/comments HTTP/1.1',
      },
    });

    // Second segment (GET)
    expect(result[1]!).toMatchObject({
      segmentId: 1,
      type: 'request',
      subtype: 'http',
      firstNonEmptyLine: {
        lineNumber: 10,
        text: 'GET https://example.com/posts?id=1',
      },
    });
  });
});
