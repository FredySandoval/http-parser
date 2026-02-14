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
  describe('file variables', () => {
    test('should ignore malformed file variables (spaces in key)', () => {
      const text = `@base url = https://api.example.com`;
      const lines = scanner.scan(text);
      const segments = segmenter.segment(lines);
      const result = variableScanner.scan(segments);

      expect(result.fileVariables).toHaveLength(0);
    });

    test('should extract variables from segments', () => {
      const text = `@baseUrl = https://api.example.com
@contentType = application/json

###
GET /users
Content-Type: application/json`;
      const lines = scanner.scan(text);
      const segments = segmenter.segment(lines);
      const result = variableScanner.scan(segments);

      expect(result.fileVariables).toHaveLength(2);
      expect(result.fileVariables[0].key).toBe('baseUrl');
      expect(result.fileVariables[0].value).toBe('https://api.example.com');
      expect(result.fileVariables[1].key).toBe('contentType');
      expect(result.fileVariables[1].value).toBe('application/json');
    });

    test('should extract variables with extra whitespace', () => {
      const text = `@baseUrl  =  https://api.example.com  `;
      const lines = scanner.scan(text);
      const segments = segmenter.segment(lines);
      const result = variableScanner.scan(segments);

      expect(result.fileVariables).toHaveLength(1);
      expect(result.fileVariables[0].key).toBe('baseUrl');
      expect(result.fileVariables[0].value).toBe('https://api.example.com');
    });

    test('should extract empty value variables', () => {
      const text = `@emptyVar =`;
      const lines = scanner.scan(text);
      const segments = segmenter.segment(lines);
      const result = variableScanner.scan(segments);

      expect(result.fileVariables).toHaveLength(1);
      expect(result.fileVariables[0].key).toBe('emptyVar');
      expect(result.fileVariables[0].value).toBe('');
    });
  });

  describe('comments', () => {
    test('should extract comments from segments', () => {
      const text = `# This is a comment
@baseUrl = https://api.example.com

###
# Another comment
GET /users`;
      const lines = scanner.scan(text);
      const segments = segmenter.segment(lines);
      const result = variableScanner.scan(segments);

      expect(result.fileComments).toHaveLength(2);
      expect(result.fileComments[0].text).toBe('This is a comment');
      expect(result.fileComments[1].text).toBe('Another comment');
    });

    test('should ignore empty comment lines', () => {
      const text = `@baseUrl = https://api.example.com
#
# Valid comment
GET /users`;
      const lines = scanner.scan(text);
      const segments = segmenter.segment(lines);
      const result = variableScanner.scan(segments);

      expect(result.fileComments).toHaveLength(1);
      expect(result.fileComments[0].text).toBe('Valid comment');
    });

    test('should handle comments with extra whitespace', () => {
      const text = `#   Comment with spaces   `;
      const lines = scanner.scan(text);
      const segments = segmenter.segment(lines);
      const result = variableScanner.scan(segments);

      expect(result.fileComments).toHaveLength(1);
      expect(result.fileComments[0].text).toBe('Comment with spaces');
    });
  });

  describe('segment tracking', () => {
    test('should capture correct segmentId for each variable', () => {
      const text = `@baseUrl = https://api.example.com

###
@token = abc123

###
@localUrl = http://localhost:3000`;
      const lines = scanner.scan(text);
      const segments = segmenter.segment(lines);
      const result = variableScanner.scan(segments);

      expect(result.fileVariables).toHaveLength(3);
      expect(result.fileVariables[0].segmentId).toBe(0);
      expect(result.fileVariables[1].segmentId).toBe(1);
      expect(result.fileVariables[2].segmentId).toBe(2);
    });

    test('should capture correct line numbers', () => {
      const text = `@baseUrl = https://api.example.com
@contentType = application/json

###
# Comment on line 5
GET /users`;
      const lines = scanner.scan(text);
      const segments = segmenter.segment(lines);
      const result = variableScanner.scan(segments);

      expect(result.fileVariables[0].lineNumber).toBe(1);
      expect(result.fileVariables[1].lineNumber).toBe(2);
      expect(result.fileComments[0].lineNumber).toBe(5);
    });

    test('should handle multiple segments correctly', () => {
      const text = `@global = value1

###
@local1 = value2

###
@local2 = value3
@local3 = value4`;
      const lines = scanner.scan(text);
      const segments = segmenter.segment(lines);
      const result = variableScanner.scan(segments);

      expect(result.fileVariables).toHaveLength(4);
      expect(segments).toHaveLength(3);
    });
  });
});

describe('VariableRegistry', () => {
  test('should store and retrieve global variables', () => {
    const registry = new VariableRegistry();
    registry.set('baseUrl', 'https://api.example.com');

    expect(registry.get('baseUrl')).toBe('https://api.example.com');
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  test('should store and retrieve segment-specific variables', () => {
    const registry = new VariableRegistry();
    registry.setForSegment(0, 'token', 'abc123');
    registry.setForSegment(1, 'token', 'xyz789');

    expect(registry.getAllBySegmentId(0)['token']).toBe('abc123');
    expect(registry.getAllBySegmentId(1)['token']).toBe('xyz789');
  });

  test('should get all variables for a segment', () => {
    const registry = new VariableRegistry();
    registry.setForSegment(0, 'var1', 'value1');
    registry.setForSegment(0, 'var2', 'value2');
    registry.setForSegment(0, 'var3', 'value3');

    const segmentVars = registry.getAllBySegmentId(0);
    expect(Object.keys(segmentVars)).toHaveLength(3);
    expect(segmentVars['var1']).toBe('value1');
    expect(segmentVars['var2']).toBe('value2');
    expect(segmentVars['var3']).toBe('value3');
  });

  test('should return empty object for non-existent segment', () => {
    const registry = new VariableRegistry();
    expect(registry.getAllBySegmentId(999)).toEqual({});
  });

  test('should fallback to global when segment variable not found', () => {
    const registry = new VariableRegistry();
    registry.set('globalVar', 'globalValue');
    registry.setForSegment(0, 'segmentVar', 'segmentValue');

    expect(registry.getWithSegment(0, 'globalVar')).toBe('globalValue');
    expect(registry.getWithSegment(0, 'segmentVar')).toBe('segmentValue');
    expect(registry.getWithSegment(0, 'nonexistent')).toBeUndefined();
  });

  test('should get all global variables', () => {
    const registry = new VariableRegistry();
    registry.set('var1', 'value1');
    registry.set('var2', 'value2');

    const allVars = registry.getAll();
    expect(Object.keys(allVars)).toHaveLength(2);
    expect(allVars['var1']).toBe('value1');
    expect(allVars['var2']).toBe('value2');
  });

  describe('overwrite behavior', () => {
    test('should overwrite existing variables', () => {
      const registry = new VariableRegistry();
      registry.set('baseUrl', 'https://api.example.com');
      registry.set('baseUrl', 'https://new.example.com');

      expect(registry.get('baseUrl')).toBe('https://new.example.com');
    });

    test('should overwrite segment-specific variables', () => {
      const registry = new VariableRegistry();
      registry.setForSegment(0, 'token', 'old-token');
      registry.setForSegment(0, 'token', 'new-token');

      expect(registry.getAllBySegmentId(0)['token']).toBe('new-token');
    });

    test('should allow different values in different segments', () => {
      const registry = new VariableRegistry();
      registry.setForSegment(0, 'var', 'value1');
      registry.setForSegment(1, 'var', 'value2');

      expect(registry.getAllBySegmentId(0)['var']).toBe('value1');
      expect(registry.getAllBySegmentId(1)['var']).toBe('value2');
    });

    test('segment variable should shadow global for getWithSegment', () => {
      const registry = new VariableRegistry();
      registry.set('shared', 'global-value');
      registry.setForSegment(0, 'shared', 'segment-value');

      expect(registry.getWithSegment(0, 'shared')).toBe('segment-value');
      expect(registry.getWithSegment(1, 'shared')).toBe('global-value');
    });
  });
});
