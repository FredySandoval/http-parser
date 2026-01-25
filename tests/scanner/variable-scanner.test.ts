import { test, expect, describe } from 'bun:test';
import {
  VariableScanner,
  VariableRegistry,
} from '../../src/scanner/variable-scanner';
import { LineScanner } from '../../src/scanner/line-scanner';
import { Segmenter } from '../../src/segmenter/segmenter';

const scanner = new LineScanner();
const segmenter = new Segmenter();
const variableScanner = new VariableScanner();

describe('VariableScanner', () => {
  test('should extract request name from # @name comment', () => {
    const input = `
# @name login
POST https://api.com/login
`.trim();
    const lines = scanner.scan(input);
    const segmentLines = segmenter.segment(lines)[0]!.lines;
    const result = variableScanner.scan(segmentLines);

    expect(result.requestName).toBe('login');
    expect(result.requestNameLine).toBeDefined();
  });

  test('should extract request name from // @name comment', () => {
    const input = `
// @name getItem
GET https://api.com/items/1
`.trim();
    const lines = scanner.scan(input);
    const segmentLines = segmenter.segment(lines)[0]!.lines;
    const result = variableScanner.scan(segmentLines);

    expect(result.requestName).toBe('getItem');
  });

  test('should extract propmt variables', () => {
    const input = `
# @prompt otp Enter code
# @prompt username
POST https://api.com/verify
`.trim();
    const lines = scanner.scan(input);
    const segmentLines = segmenter.segment(lines)[0]!.lines;
    const result = variableScanner.scan(segmentLines);

    expect(result.prompts).toHaveLength(2);
    expect(result.prompts[0]).toMatchObject({
      name: 'otp',
      description: 'Enter code',
    });
    expect(result.prompts[1]).toMatchObject({
      name: 'username',
      description: null,
    });
  });

  test('should extract file variables', () => {
    const input = `
@baseUrl = https://api.com
@timeout = 5000
GET {{baseUrl}}/users
`.trim();
    const lines = scanner.scan(input);
    const segmentLines = segmenter.segment(lines)[0]!.lines;
    const result = variableScanner.scan(segmentLines);

    expect(result.fileVariables).toHaveLength(2);
    expect(result.fileVariables[0]).toMatchObject({
      key: 'baseUrl',
      value: 'https://api.com',
    });
    expect(result.fileVariables[1]).toMatchObject({
      key: 'timeout',
      value: '5000',
    });
  });

  test('should extract request settings', () => {
    const input = `
# @no-redirect
# @note This is important
GET https://api.com/redirect
`.trim();
    const lines = scanner.scan(input);
    const segmentLines = segmenter.segment(lines)[0]!.lines;
    const result = variableScanner.scan(segmentLines);

    expect(result.settings).toHaveLength(2);
    // @no-redirect
    const noRedirect = result.settings.find((s) => s.name === 'no-redirect');
    expect(noRedirect).toBeDefined();

    // @note This is important
    const note = result.settings.find((s) => s.name === 'note');
    expect(note).toBeDefined();
    expect(note!.value).toBe('This is important');
  });

  test('should ignore malformed file variables (spaces in key)', () => {
    const input = `
@bad key = value
GET /foo
`.trim();
    const lines = scanner.scan(input);
    const segmentLines = segmenter.segment(lines)[0]!.lines;
    const result = variableScanner.scan(segmentLines);

    expect(result.fileVariables).toHaveLength(0);
  });
});

describe('VariableRegistry', () => {
  test('should store and retrieve variables', () => {
    const registry = new VariableRegistry();
    registry.set('baseUrl', 'https://example.com');

    expect(registry.get('baseUrl')).toBe('https://example.com');
    expect(registry.get('unknown')).toBeUndefined();
  });

  test('should return all variables', () => {
    const registry = new VariableRegistry();
    registry.set('a', '1');
    registry.set('b', '2');

    const all = registry.getAll();
    expect(all).toEqual({ a: '1', b: '2' });
  });

  test('should overwrite existing variables', () => {
    const registry = new VariableRegistry();
    registry.set('a', '1');
    registry.set('a', '2');

    expect(registry.get('a')).toBe('2');
  });
});
