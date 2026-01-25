import { test, expect, describe } from 'bun:test';
import { CurlParser } from '../../src/parsers/curl-parser';
import { LineScanner } from '../../src/scanner/line-scanner';
import { Segmenter } from '../../src/segmenter/segmenter';
import { SystemVariableScanner } from '../../src/scanner/system-variable-scanner';

/**
 * Test suite for CurlParser class.
 * Ensures that curl commands are correctly detected and parsed within the system pipeline.
 */
describe('CurlParser', () => {
  const scanner = new LineScanner();
  const segmenter = new Segmenter();
  const variableScanner = new SystemVariableScanner();
  const parser = new CurlParser();

  test('should detect curl command', () => {
    const input = 'curl http://example.com';
    const lines = scanner.scan(input);
    const segments = segmenter.segment(lines);
    const segmentLines = segments[0]!.lines;

    // System pipeline step (variable scanning)
    variableScanner.scan(segmentLines);

    const result = parser.parse(segmentLines);

    expect(result).not.toBeNull();
    expect(result?.url).toBe('http://example.com');
    expect(result?.consumedLinesCount).toBe(1);
  });

  test('should return null for non-curl line', () => {
    const input = 'GET http://example.com';
    const lines = scanner.scan(input);
    const segments = segmenter.segment(lines);
    const segmentLines = segments[0]!.lines;

    const result = parser.parse(segmentLines);

    expect(result).toBeNull();
  });

  test('should parse complex curl command', () => {
    const input = `curl -X POST https://api.example.com/login \\
  -H "Content-Type: application/json" \\
  -H 'Authorization: Bearer token' \\
  -d '{"username": "test", "password": "123"}'`;

    const lines = scanner.scan(input);
    const segments = segmenter.segment(lines);
    const segmentLines = segments[0]!.lines;

    const result = parser.parse(segmentLines);

    expect(result).not.toBeNull();
    expect(result?.headers).toHaveLength(2);
    expect((result?.headers)![0]).toEqual({
      name: 'Content-Type',
      value: 'application/json',
    });
    expect(result?.body?.raw).toBe('{"username": "test", "password": "123"}');
    expect(result?.consumedLinesCount).toBe(4);
  });

  test('should handle single quotes inside double quotes', () => {
    const input = 'curl -H "X-Title: It\'s a test" http://localhost';
    const lines = scanner.scan(input);
    const segments = segmenter.segment(lines);
    const segmentLines = segments[0]!.lines;

    const result = parser.parse(segmentLines);

    expect(result?.headers![0]?.value).toBe("It's a test");
  });

  test('should handle leading blank lines', () => {
    const input = '\n\ncurl http://example.com';
    const lines = scanner.scan(input);
    const segments = segmenter.segment(lines);
    const segmentLines = segments[0]!.lines;

    const result = parser.parse(segmentLines);

    expect(result).not.toBeNull();
    expect(result?.url).toBe('http://example.com');
    expect(result?.consumedLinesCount).toBe(3);
  });

  test('should handle multiline curl with leading blanks', () => {
    const input = `

curl -X PUT \\
     http://localhost/api`;
    const lines = scanner.scan(input);
    const segments = segmenter.segment(lines);
    const segmentLines = segments[0]!.lines;

    const result = parser.parse(segmentLines);

    expect(result).not.toBeNull();
    expect(result?.method).toBe('PUT');
    expect(result?.url).toBe('http://localhost/api');
    expect(result?.consumedLinesCount).toBe(4);
  });

  test('should default to POST if data is present', () => {
    const input = "curl http://example.com -d 'foo'";
    const lines = scanner.scan(input);
    const segmentLines = segmenter.segment(lines)[0]!.lines;

    const result = parser.parse(segmentLines);

    expect(result?.method).toBe('POST');
    expect(result?.body?.raw).toBe('foo');
  });
});
