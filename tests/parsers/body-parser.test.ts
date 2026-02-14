import { test, expect, describe } from 'bun:test';
import { BodyParser } from '../../src/parsers/body-parser';
import { LineScanner } from '../../src/scanner/line-scanner';
import type { Header } from '../../src/types/types';

describe('BodyParser', () => {
  test('should return empty body when no lines provided', () => {
    const parser = new BodyParser();
    const headers: Header[] = [];

    const result = parser.parse([], headers);

    expect(result.status).toBe('parsed');
    expect(result.raw).toBe('');
    expect(result.contentType).toBeNull();
    expect(result.size).toBe(0);
    if (result.status === 'parsed') {
      expect(result.content.body.kind).toBe('text');
      expect((result.content.body as { kind: 'text'; text: string }).text).toBe(
        ''
      );
    }
  });

  test('should return empty body when only whitespace provided', () => {
    const scanner = new LineScanner();
    const parser = new BodyParser();
    const headers: Header[] = [];

    const lines = scanner.scan('   \n\n  ');
    const result = parser.parse(lines, headers);

    expect(result.status).toBe('parsed');
    expect(result.raw).toBe('   \n\n  ');
    if (result.status === 'parsed') {
      expect(result.content.body.kind).toBe('text');
      expect((result.content.body as { kind: 'text'; text: string }).text).toBe(
        ''
      );
    }
  });

  describe('JSON parsing', () => {
    test('should parse valid JSON body', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        { name: 'Content-Type', value: 'application/json' },
      ];

      const input = '{"name": "John", "age": 30}';
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      expect(result.raw).toBe(input);
      expect(result.contentType).toBe('application/json');
      if (result.status === 'parsed') {
        expect(result.content.body.kind).toBe('json');
        expect(
          (result.content.body as { kind: 'json'; data: unknown }).data
        ).toEqual({
          name: 'John',
          age: 30,
        });
      }
    });

    test('should parse nested JSON body', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        { name: 'Content-Type', value: 'application/json' },
      ];

      const input = `{
  "key": "value",
  "nested": {
    "id": 1
  }
}`;
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      if (result.status === 'parsed') {
        expect(result.content.body.kind).toBe('json');
        const data = (
          result.content.body as {
            kind: 'json';
            data: { key: string; nested: { id: number } };
          }
        ).data;
        expect(data.key).toBe('value');
        expect(data.nested.id).toBe(1);
      }
    });

    test('should parse JSON array', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        { name: 'Content-Type', value: 'application/json' },
      ];

      const input = '[1, 2, 3, "test"]';
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      if (result.status === 'parsed') {
        expect(result.content.body.kind).toBe('json');
        expect(
          (result.content.body as { kind: 'json'; data: unknown }).data
        ).toEqual([1, 2, 3, 'test']);
      }
    });

    test('should return error for invalid JSON', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        { name: 'Content-Type', value: 'application/json' },
      ];

      const input = '{invalid json}';
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('Invalid JSON');
      }
    });

    test('should detect JSON with case-insensitive header', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        { name: 'content-type', value: 'APPLICATION/JSON' },
      ];

      const input = '{"test": true}';
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      if (result.status === 'parsed') {
        expect(result.content.body.kind).toBe('json');
      }
    });

    test('should handle text/json content type', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [{ name: 'Content-Type', value: 'text/json' }];

      const input = '{"test": true}';
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      if (result.status === 'parsed') {
        expect(result.content.body.kind).toBe('json');
      }
    });
  });

  describe('Form data parsing', () => {
    test('should parse simple form data', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
      ];

      const input = 'name=John&age=30';
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      if (result.status === 'parsed') {
        expect(result.content.body.kind).toBe('form');
        const fields = (
          result.content.body as {
            kind: 'form';
            fields: Record<string, string>;
          }
        ).fields;
        expect(fields.name).toBe('John');
        expect(fields.age).toBe('30');
      }
    });

    test('should decode URL-encoded values', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
      ];

      const input = 'name=John%20Doe&city=New%20York';
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      if (result.status === 'parsed') {
        const fields = (
          result.content.body as {
            kind: 'form';
            fields: Record<string, string>;
          }
        ).fields;
        expect(fields.name).toBe('John Doe');
        expect(fields.city).toBe('New York');
      }
    });

    test('should convert + to spaces', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
      ];

      const input = 'query=hello+world+test';
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      if (result.status === 'parsed') {
        const fields = (
          result.content.body as {
            kind: 'form';
            fields: Record<string, string>;
          }
        ).fields;
        expect(fields.query).toBe('hello world test');
      }
    });

    test('should handle duplicate keys as arrays', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
      ];

      const input = 'tag=red&tag=blue&tag=green';
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      if (result.status === 'parsed') {
        const fields = (
          result.content.body as {
            kind: 'form';
            fields: Record<string, string | string[]>;
          }
        ).fields;
        expect(Array.isArray(fields.tag)).toBe(true);
        expect(fields.tag).toEqual(['red', 'blue', 'green']);
      }
    });

    test('should handle form data with line continuations', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
      ];

      const input = `name=foo
&password=bar
&extra=baz`;
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      if (result.status === 'parsed') {
        expect(result.content.body.kind).toBe('form');
        const fields = (
          result.content.body as {
            kind: 'form';
            fields: Record<string, string>;
          }
        ).fields;
        expect(fields.name).toBe('foo');
        expect(fields.password).toBe('bar');
        expect(fields.extra).toBe('baz');
      }
    });

    test('should return empty fields for empty form body', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
      ];

      const lines = scanner.scan('');
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      if (result.status === 'parsed') {
        expect(result.content.body.kind).toBe('form');
        const fields = (
          result.content.body as {
            kind: 'form';
            fields: Record<string, unknown>;
          }
        ).fields;
        expect(Object.keys(fields)).toHaveLength(0);
      }
    });
  });

  describe('Multipart parsing', () => {
    test('should parse simple multipart form', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        {
          name: 'Content-Type',
          value: 'multipart/form-data; boundary=----WebKitFormBoundary',
        },
      ];

      const input = `------WebKitFormBoundary
Content-Disposition: form-data; name="field1"

value1
------WebKitFormBoundary
Content-Disposition: form-data; name="field2"

value2
------WebKitFormBoundary--`;

      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      if (result.status === 'parsed') {
        expect(result.content.body.kind).toBe('multipart');
        const body = result.content.body as {
          kind: 'multipart';
          boundary: string;
          parts: Array<{ name: string; value: string }>;
        };
        expect(body.boundary).toBe('----WebKitFormBoundary');
        expect(body.parts).toHaveLength(2);
        expect(body.parts[0]!.name).toBe('field1');
        expect(body.parts[0]!.value).toBe('value1');
        expect(body.parts[1]!.name).toBe('field2');
        expect(body.parts[1]!.value).toBe('value2');
      }
    });

    test('should parse multipart with file upload', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        {
          name: 'Content-Type',
          value: 'multipart/form-data; boundary=----Boundary',
        },
      ];

      const input = `------Boundary
Content-Disposition: form-data; name="file"; filename="test.txt"
Content-Type: text/plain

file content here
------Boundary--`;

      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      if (result.status === 'parsed') {
        const body = result.content.body as {
          kind: 'multipart';
          parts: Array<{
            name: string;
            filename?: string;
            contentType?: string;
            value: string;
          }>;
        };
        expect(body.parts).toHaveLength(1);
        expect(body.parts[0]!.name).toBe('file');
        expect(body.parts[0]!.filename).toBe('test.txt');
        expect(body.parts[0]!.contentType).toBe('text/plain');
        expect(body.parts[0]!.value).toBe('file content here');
      }
    });

    test('should return error for missing boundary', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        { name: 'Content-Type', value: 'multipart/form-data' },
      ];

      const input = 'some content';
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('Missing boundary');
      }
    });

    test('should handle boundary with quotes', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        {
          name: 'Content-Type',
          value: 'multipart/form-data; boundary="----TestBoundary"',
        },
      ];

      const input = `------TestBoundary
Content-Disposition: form-data; name="test"

value
------TestBoundary--`;

      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      if (result.status === 'parsed') {
        const body = result.content.body as {
          kind: 'multipart';
          boundary: string;
        };
        expect(body.boundary).toBe('----TestBoundary');
      }
    });
  });

  describe('Text parsing (default)', () => {
    test('should parse as text when no content type', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [];

      const input = 'Plain text body content';
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      expect(result.contentType).toBeNull();
      if (result.status === 'parsed') {
        expect(result.content.body.kind).toBe('text');
        expect(
          (result.content.body as { kind: 'text'; text: string }).text
        ).toBe(input);
      }
    });

    test('should parse as text for unknown content type', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [{ name: 'Content-Type', value: 'text/html' }];

      const input = '<html><body>Hello</body></html>';
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      if (result.status === 'parsed') {
        expect(result.content.body.kind).toBe('text');
        expect(
          (result.content.body as { kind: 'text'; text: string }).text
        ).toBe(input);
      }
    });

    test('should preserve multiline text', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [{ name: 'Content-Type', value: 'text/plain' }];

      const input = `Line 1
Line 2
Line 3`;
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.status).toBe('parsed');
      if (result.status === 'parsed') {
        expect(
          (result.content.body as { kind: 'text'; text: string }).text
        ).toBe(input);
      }
    });
  });

  describe('Size calculation', () => {
    test('should calculate size correctly for ASCII text', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [];

      const input = 'Hello World'; // 11 bytes
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.size).toBe(11);
    });

    test('should calculate size correctly for multiline text', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [];

      const input = 'Line1\nLine2'; // 5 + 1 + 5 = 11 bytes
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.size).toBe(11);
    });

    test('should calculate size correctly for unicode', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [];

      const input = 'Hello 世界'; // 6 bytes for "Hello " + 6 bytes for "世界"
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.size).toBe(12);
    });
  });

  describe('Content-Type extraction', () => {
    test('should extract Content-Type case-insensitively', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        { name: 'content-type', value: 'application/json' },
        { name: 'Other-Header', value: 'value' },
      ];

      const input = '{}';
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.contentType).toBe('application/json');
    });

    test('should return null when no Content-Type header', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        { name: 'Authorization', value: 'Bearer token' },
      ];

      const input = 'body';
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.contentType).toBeNull();
    });

    test('should preserve original content type value', () => {
      const scanner = new LineScanner();
      const parser = new BodyParser();
      const headers: Header[] = [
        { name: 'Content-Type', value: 'application/json; charset=utf-8' },
      ];

      const input = '{}';
      const lines = scanner.scan(input);
      const result = parser.parse(lines, headers);

      expect(result.contentType).toBe('application/json; charset=utf-8');
    });
  });
});
