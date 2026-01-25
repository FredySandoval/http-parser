import { test, expect, describe } from 'bun:test';
import { HeaderParser } from '../../src/parsers/header-parser';
import { LineScanner } from '../../src/scanner/line-scanner';

describe('HeaderParser', () => {
  test('should parse basic header', () => {
    const scanner = new LineScanner();
    const parser = new HeaderParser();

    const lines = scanner.scan('Content-Type: application/json');
    const result = parser.parse(lines);

    expect(result.headers).toHaveLength(1);
    expect(result.headers[0]).toEqual({
      name: 'Content-Type',
      value: 'application/json',
    });
    expect(result.consumedLinesCount).toBe(1);
  });

  test('should handle multiple headers', () => {
    const scanner = new LineScanner();
    const parser = new HeaderParser();

    const input = `Authorization: Bearer token123
User-Agent: rest-client
Accept: */*`;
    const lines = scanner.scan(input);
    const result = parser.parse(lines);

    expect(result.headers).toHaveLength(3);
    expect(result.headers[1]!.name).toBe('User-Agent');
    expect(result.headers[1]!.value).toBe('rest-client');
    expect(result.consumedLinesCount).toBe(3);
  });

  test('should stop at first empty line', () => {
    const scanner = new LineScanner();
    const parser = new HeaderParser();

    const input = `Content-Type: text/plain

This is body content`;
    const lines = scanner.scan(input);
    const result = parser.parse(lines);

    expect(result.headers).toHaveLength(1);
    expect(result.headers[0]!.name).toBe('Content-Type');
    expect(result.consumedLinesCount).toBe(1);
  });

  test('should preserve casing of header names', () => {
    const scanner = new LineScanner();
    const parser = new HeaderParser();

    const lines = scanner.scan('x-custom-HEADER: some-value');
    const result = parser.parse(lines);

    expect(result.headers[0]!.name).toBe('x-custom-HEADER');
  });

  test('should handle headers with spaces in values', () => {
    const scanner = new LineScanner();
    const parser = new HeaderParser();

    const lines = scanner.scan(
      'Cache-Control: no-cache, no-store, must-revalidate'
    );
    const result = parser.parse(lines);

    expect(result.headers[0]!.value).toBe(
      'no-cache, no-store, must-revalidate'
    );
  });
});
