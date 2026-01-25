import { test, expect, describe } from 'bun:test';
import {
  SystemVariableScanner,
  VariableKind,
} from '../../src/scanner/system-variable-scanner';
import { LineScanner } from '../../src/scanner/line-scanner';
import { Segmenter } from '../../src/segmenter/segmenter';

/**
 * Test suite for SystemVariableScanner class.
 * Ensures that variable detection works using the actual system pipeline (LineScanner -> Segmenter).
 */

const scanner = new LineScanner();
const segmenter = new Segmenter();
const variableScanner = new SystemVariableScanner();

describe('SystemVariableScanner', () => {
  test('should find simple custom variables in a scanned segment', () => {
    const input = 'GET {{host}}';
    const lines = scanner.scan(input);
    const segments = segmenter.segment(lines);
    const segmentLines = segments[0]!.lines;

    const result = variableScanner.scan(segmentLines);

    expect(result[0]!.variables).toHaveLength(1);
    expect(result[0]!.variables[0]).toMatchObject({
      kind: VariableKind.Custom,
      name: 'host',
      raw: '{{host}}',
      offset: 4,
      length: 8,
    });
  });

  test('should find multiple variables on one line in a scanned segment', () => {
    const input = 'GET {{host}}/api/{{version}}';
    const lines = scanner.scan(input);
    const segments = segmenter.segment(lines);
    const segmentLines = segments[0]!.lines;

    const result = variableScanner.scan(segmentLines);

    expect(result[0]!.variables).toHaveLength(2);
    expect(result[0]!.variables[0]!.name).toBe('host');
    expect(result[0]!.variables[1]!.name).toBe('version');
    expect(result[0]!.variables[1]!.offset).toBe(17);
  });

  test('should identify system variables in scanned lines', () => {
    const input = 'ID: {{$guid}}\nRand: {{$randomInt 1 100}}';
    const lines = scanner.scan(input);
    const segments = segmenter.segment(lines);
    const segmentLines = segments[0]!.lines;

    const result = variableScanner.scan(segmentLines);

    expect(result[0]!.variables[0]).toMatchObject({
      kind: VariableKind.System,
      systemName: '$guid',
      params: undefined,
    });

    expect(result[1]!.variables[0]).toMatchObject({
      kind: VariableKind.System,
      systemName: '$randomInt',
      params: '1 100',
    });
  });

  test('should identify request variables in scanned lines', () => {
    const input = 'Auth: {{login.response.headers.X-Token}}';
    const lines = scanner.scan(input);
    const segments = segmenter.segment(lines);
    const segmentLines = segments[0]!.lines;

    const result = variableScanner.scan(segmentLines);

    expect(result[0]!.variables[0]).toMatchObject({
      kind: VariableKind.Request,
      requestName: 'login',
      source: 'response',
      part: 'headers',
      path: 'X-Token',
    });
  });

  test('should handle body with variables correctly using LineScanner', () => {
    const input = `
{
  "id": "{{$guid}}",
  "user": "{{user}}"
}
`.trim();
    const lines = scanner.scan(input);
    const segments = segmenter.segment(lines);
    const segmentLines = segments[0]!.lines;

    const result = variableScanner.scan(segmentLines);

    // Line 2: "id": "{{$guid}}", (1-indexed line numbers from scanner)
    expect(result[1]!.variables).toHaveLength(1);
    expect(result[1]!.variables[0]!.kind).toBe(VariableKind.System);

    // Line 3: "user": "{{user}}"
    expect(result[2]!.variables).toHaveLength(1);
    expect(result[2]!.variables[0]!.kind).toBe(VariableKind.Custom);
  });

  test('should handle mixed usage and multiple variables accurately in scanned request', () => {
    const input = 'GET {{url}}?key={{key}}&ts={{$timestamp}}';
    const lines = scanner.scan(input);
    const segments = segmenter.segment(lines);
    const segmentLines = segments[0]!.lines;

    const result = variableScanner.scan(segmentLines);

    expect(result[0]!.variables).toHaveLength(3);
    expect(result[0]!.variables[0]!.name).toBe('url');
    expect(result[0]!.variables[1]!.name).toBe('key');
    expect(result[0]!.variables[2]!.kind).toBe(VariableKind.System);
    expect(result[0]!.variables[2]!.systemName).toBe('$timestamp');
  });

  test('should not modify the original text of the LineContext provided by LineScanner', () => {
    const input = 'GET {{host}}';
    const lines = scanner.scan(input);
    const segmentLines = segmenter.segment(lines)[0]!.lines;

    const result = variableScanner.scan(segmentLines);

    expect(result[0]!.text).toBe(input);
  });

  test('should handle variables with spaces inside {{ }} after LineScanner processing', () => {
    const input = 'GET {{ host }}';
    const lines = scanner.scan(input);
    const segmentLines = segmenter.segment(lines)[0]!.lines;

    const result = variableScanner.scan(segmentLines);

    expect(result[0]!.variables[0]!.name).toBe('host');
  });
});
