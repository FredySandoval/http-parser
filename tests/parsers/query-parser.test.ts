import { test, expect, describe } from 'bun:test';
import { QueryParser } from '../../src/parsers/query-parser';
import { LineScanner } from '../../src/scanner/line-scanner';
import { Segmenter } from '../../src/segmenter/segmenter';

describe('QueryParser', () => {
  test('should parse multiline query continuations', () => {
    const scanner = new LineScanner();
    const segmenter = new Segmenter();
    const parser = new QueryParser();

    const input = `GET https://example.com
  ?page=2
  &pageSize=10
Content-Type: application/json`;

    const lines = scanner.scan(input);
    const segments = segmenter.segment(lines);

    // lines[0] is GET ...
    // We pass lines starting from index 1 to the query parser
    const remainingLines = segments[0]!.lines.slice(1);
    const result = parser.parse(remainingLines);

    expect(result.queryParams).toHaveLength(2);
    expect(result.queryParams[0]).toEqual({ key: 'page', value: '2' });
    expect(result.queryParams[1]).toEqual({ key: 'pageSize', value: '10' });
    expect(result.consumedLinesCount).toBe(2);
  });

  test('should ignore whitespace before ? or &', () => {
    const scanner = new LineScanner();
    const parser = new QueryParser();

    const input = `    ?a=1
\t&b=2`;
    const lines = scanner.scan(input);
    const result = parser.parse(lines);

    expect(result.queryParams).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
    expect(result.consumedLinesCount).toBe(2);
  });

  test("should stop at first line that doesn't start with ? or &", () => {
    const scanner = new LineScanner();
    const parser = new QueryParser();

    const input = `?a=1
Content-Type: text/plain
&b=2`;
    const lines = scanner.scan(input);
    const result = parser.parse(lines);

    expect(result.queryParams).toHaveLength(1);
    expect(result.queryParams[0]!.key).toBe('a');
    expect(result.consumedLinesCount).toBe(1);
  });

  test('should handle parameters without values', () => {
    const scanner = new LineScanner();
    const parser = new QueryParser();

    const input = `?flag
&debug=true`;
    const lines = scanner.scan(input);
    const result = parser.parse(lines);

    expect(result.queryParams).toEqual([
      { key: 'flag', value: '' },
      { key: 'debug', value: 'true' },
    ]);
  });
});
