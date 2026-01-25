import { test, expect, describe } from 'bun:test';
import { BodyParser } from '../../src/parsers/body-parser';
import { LineScanner } from '../../src/scanner/line-scanner';

describe('BodyParser', () => {
  test('should handle raw JSON body', () => {
    const scanner = new LineScanner();
    const parser = new BodyParser();

    const input = `{
  "key": "value",
  "nested": {
    "id": 1
  }
}`;
    const lines = scanner.scan(input);
    const result = parser.parse({ lines, isGraphQL: false });

    expect(result.type).toBe('raw');
    expect(result.raw).toBe(input);
  });

  test('should handle file reference < path', () => {
    const scanner = new LineScanner();
    const parser = new BodyParser();

    const lines = scanner.scan('< ./data.json');
    const result = parser.parse({ lines, isGraphQL: false });

    expect(result.type).toBe('file-ref');
    expect(result.fileRef).toEqual({
      path: './data.json',
      encoding: undefined,
      processVariables: false,
    });
  });

  test('should handle file reference with variable processing <@ path', () => {
    const scanner = new LineScanner();
    const parser = new BodyParser();

    const lines = scanner.scan('<@ ./template.http');
    const result = parser.parse({ lines, isGraphQL: false });

    expect(result.type).toBe('file-ref');
    expect(result.fileRef).toEqual({
      path: './template.http',
      encoding: undefined,
      processVariables: true,
    });
  });

  test('should handle file reference with encoding <@utf-8 ./file.txt', () => {
    const scanner = new LineScanner();
    const parser = new BodyParser();

    const lines = scanner.scan('<@utf-8 ./file.txt');
    const result = parser.parse({ lines, isGraphQL: false });

    expect(result.type).toBe('file-ref');
    expect(result.fileRef).toEqual({
      path: './file.txt',
      encoding: 'utf-8',
      processVariables: true,
    });
  });

  test('should split GraphQL query and variables', () => {
    const scanner = new LineScanner();
    const parser = new BodyParser();

    const input = `query GetUser($id: ID!) {
  user(id: $id) {
    name
  }
}

{
  "id": "123"
}`;
    const lines = scanner.scan(input);
    const result = parser.parse({ lines, isGraphQL: true });

    expect(result.type).toBe('graphql');
    expect(result.graphql?.query).toContain('query GetUser');
    expect(result.graphql?.variables).toBe('{\n  "id": "123"\n}');
  });

  test('should parse form-urlencoded body with continuations', () => {
    const scanner = new LineScanner();
    const parser = new BodyParser();

    const input = `name=foo
&password=bar
&extra=baz`;
    const lines = scanner.scan(input);
    const result = parser.parse({
      lines,
      isGraphQL: false,
      contentType: 'application/x-www-form-urlencoded',
    });

    expect(result.type).toBe('form-urlencoded');
    expect(result.formParams).toEqual([
      { key: 'name', value: 'foo' },
      { key: 'password', value: 'bar' },
      { key: 'extra', value: 'baz' },
    ]);
  });
});
