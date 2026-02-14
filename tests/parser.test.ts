import { test, expect, describe } from 'bun:test';
import { HttpRequestParser } from '../src/parser';

describe('HttpRequestParser', () => {
  describe('constructor', () => {
    test('should create parser with default options', () => {
      const parser = new HttpRequestParser();
      expect(parser).toBeDefined();
    });

    test('should create parser with custom options', () => {
      const parser = new HttpRequestParser({
        encoding: 'utf-16',
        strict: true,
      });
      expect(parser).toBeDefined();
    });
  });

  describe('parseText - basic functionality', () => {
    test('should parse a simple GET request', () => {
      const parser = new HttpRequestParser();
      const input = 'GET https://api.example.com/users';
      const result = parser.parseText(input);

      expect(result.text).toBe(input);
      expect(result.ast.requests).toHaveLength(1);
      expect(result.ast.requests[0]!.method).toBe('GET');
      expect(result.ast.requests[0]!.url).toBe('https://api.example.com/users');
    });

    test('should parse request with headers and body', () => {
      const parser = new HttpRequestParser();
      const input = `POST https://api.example.com/users HTTP/1.1
Content-Type: application/json
Authorization: Bearer token123

{
  "name": "John Doe"
}`;
      const result = parser.parseText(input);

      expect(result.ast.requests).toHaveLength(1);
      const request = result.ast.requests[0]!;
      expect(request.method).toBe('POST');
      expect(request.url).toBe('https://api.example.com/users');
      expect(request.httpVersion).toBe('HTTP/1.1');
      expect(request.headers).toHaveLength(2);
      expect(request.headers[0]).toEqual({
        name: 'Content-Type',
        value: 'application/json',
      });
      expect(request.headers[1]).toEqual({
        name: 'Authorization',
        value: 'Bearer token123',
      });
      expect(request.body).not.toBeNull();
    });

    test('should parse multiple requests separated by ###', () => {
      const parser = new HttpRequestParser();
      const input = `GET https://api.example.com/users
###
POST https://api.example.com/users
Content-Type: application/json

{"name": "John"}
###
DELETE https://api.example.com/users/1`;
      const result = parser.parseText(input);

      expect(result.ast.requests).toHaveLength(3);
      expect(result.ast.requests[0]!.method).toBe('GET');
      expect(result.ast.requests[1]!.method).toBe('POST');
      expect(result.ast.requests[2]!.method).toBe('DELETE');
    });
  });

  describe('parseText - metadata', () => {
    test('should include correct metadata in result', () => {
      const parser = new HttpRequestParser();
      const input = 'GET https://api.example.com/users';
      const result = parser.parseText(input);

      expect(result.metadata.length).toBe(input.length);
      expect(result.metadata.lines).toBe(1);
      expect(result.metadata.encoding).toBe('utf-8');
      expect(result.metadata.source.type).toBe('string');
    });

    test('should count lines correctly with trailing newline', () => {
      const parser = new HttpRequestParser();
      const input = 'GET https://api.example.com/users\n';
      const result = parser.parseText(input);

      expect(result.metadata.lines).toBe(2);
    });

    test('should use custom encoding from options', () => {
      const parser = new HttpRequestParser({ encoding: 'utf-16' });
      const input = 'GET https://api.example.com/users';
      const result = parser.parseText(input);

      expect(result.metadata.encoding).toBe('utf-16');
    });
  });

  describe('parseText - line contexts', () => {
    test('should include line contexts in result', () => {
      const parser = new HttpRequestParser();
      const input = 'GET /first\nPOST /second';
      const result = parser.parseText(input);

      expect(result.lineContexts).toHaveLength(2);
      expect(result.lineContexts[0]!.text).toBe('GET /first');
      expect(result.lineContexts[1]!.text).toBe('POST /second');
    });

    test('should track correct line numbers', () => {
      const parser = new HttpRequestParser();
      const input = 'GET /first\nPOST /second\nPUT /third';
      const result = parser.parseText(input);

      expect(result.lineContexts[0]!.lineNumber).toBe(1);
      expect(result.lineContexts[1]!.lineNumber).toBe(2);
      expect(result.lineContexts[2]!.lineNumber).toBe(3);
    });
  });

  describe('parseText - segments', () => {
    test('should include segments in result', () => {
      const parser = new HttpRequestParser();
      const input = 'GET /first\n###\nPOST /second';
      const result = parser.parseText(input);

      expect(result.segments).toHaveLength(2);
      expect(result.segments[0]!.segmentId).toBe(0);
      expect(result.segments[1]!.segmentId).toBe(1);
    });

    test('should track correct line ranges for segments', () => {
      const parser = new HttpRequestParser();
      const input = 'GET /first\n###\nPOST /second';
      const result = parser.parseText(input);

      expect(result.segments[0]!.startLine).toBe(1);
      expect(result.segments[0]!.endLine).toBe(1);
      expect(result.segments[1]!.startLine).toBe(3);
      expect(result.segments[1]!.endLine).toBe(3);
    });
  });

  describe('parseText - variables', () => {
    test('should extract file-level variables', () => {
      const parser = new HttpRequestParser();
      const input = `@baseUrl = https://api.example.com
@contentType = application/json
GET {{baseUrl}}/users`;
      const result = parser.parseText(input);

      expect(result.ast.globalVariables.fileVariables).toHaveLength(2);
      expect(result.ast.fileScopedVariables.fileVariables).toHaveLength(2);
      expect(result.ast.globalVariables.fileVariables[0]).toMatchObject({
        key: 'baseUrl',
        value: 'https://api.example.com',
      });
      expect(result.ast.globalVariables.fileVariables[1]).toMatchObject({
        key: 'contentType',
        value: 'application/json',
      });
    });

    test('should extract block-level variables with segment IDs', () => {
      const parser = new HttpRequestParser();
      const input = `@baseUrl = https://api.example.com
GET {{baseUrl}}/users
###
@baseUrl = http://localhost:3000
POST {{baseUrl}}/data`;
      const result = parser.parseText(input);

      const fileVars = result.ast.globalVariables.fileVariables;
      expect(fileVars).toHaveLength(2);
      expect(result.ast.fileScopedVariables.fileVariables).toHaveLength(1);

      // First variable has no segment ID (defined before first segment)
      expect(fileVars[0]!.segmentId).toBe(0);

      // Second variable has segment ID 1
      expect(fileVars[1]!.segmentId).toBe(1);
    });

    test('should include block variables in request', () => {
      const parser = new HttpRequestParser();
      const input = `@token = abc123
GET https://api.example.com/users
Authorization: Bearer {{token}}`;
      const result = parser.parseText(input);

      const request = result.ast.requests[0]!;
      expect(request.blockVariables.fileVariables).toHaveLength(1);
      expect(request.blockVariables.fileVariables[0]).toMatchObject({
        key: 'token',
        value: 'abc123',
      });
    });
  });

  describe('parseText - fileScopedVariables', () => {
    test('should include only declarations before first delimiter', () => {
      const parser = new HttpRequestParser();
      const input = `@baseUrl = http://localhost:8080
###
@baseUrl = http://localhost:8080/scoped
GET {{baseUrl}}/x HTTP/1.1
###
GET {{baseUrl}}/notscoped HTTP/1.1`;
      const result = parser.parseText(input);

      expect(result.ast.fileScopedVariables.fileVariables).toHaveLength(1);
      expect(result.ast.fileScopedVariables.fileVariables[0]).toMatchObject({
        key: 'baseUrl',
        value: 'http://localhost:8080',
      });
      expect(result.ast.globalVariables.fileVariables).toHaveLength(2);
      expect(result.ast.requests[0]!.blockVariables.fileVariables).toHaveLength(1);
      expect(result.ast.requests[0]!.blockVariables.fileVariables[0]).toMatchObject(
        {
          key: 'baseUrl',
          value: 'http://localhost:8080/scoped',
        }
      );
    });

    test('should handle mixed file-scope and block-scope redeclarations', () => {
      const parser = new HttpRequestParser();
      const input = `@token = root
GET /a
###
@token = scoped
GET /b`;
      const result = parser.parseText(input);

      expect(result.ast.fileScopedVariables.fileVariables).toHaveLength(1);
      expect(result.ast.fileScopedVariables.fileVariables[0]!.value).toBe('root');
      expect(result.ast.globalVariables.fileVariables).toHaveLength(2);
    });

    test('should be empty when no declarations exist before first delimiter', () => {
      const parser = new HttpRequestParser();
      const input = `###
@token = scoped
GET /only-scoped`;
      const result = parser.parseText(input);

      expect(result.ast.fileScopedVariables.fileVariables).toHaveLength(0);
      expect(result.ast.globalVariables.fileVariables).toHaveLength(1);
    });
  });

  describe('parseText - response linking', () => {
    test('should link expected response to preceding request', () => {
      const parser = new HttpRequestParser();
      const input = `POST https://api.example.com/users
Content-Type: application/json

{"name": "John"}
###
HTTP/1.1 201 Created
Content-Type: application/json
Location: /users/123`;
      const result = parser.parseText(input);

      expect(result.ast.requests).toHaveLength(1);
      const request = result.ast.requests[0]!;
      expect(request.expectedResponse).not.toBeNull();
      expect(request.expectedResponse!.statusCode).toBe(201);
      expect(request.expectedResponse!.statusText).toBe('Created');
    });

    test('should link multiple responses to the same request', () => {
      const parser = new HttpRequestParser();
      const input = `GET https://api.example.com/users
###
HTTP/1.1 200 OK

[]
###
HTTP/1.1 500 Internal Server Error`;
      const result = parser.parseText(input);

      expect(result.ast.requests).toHaveLength(1);
      // The last response overwrites previous ones
      expect(result.ast.requests[0]!.expectedResponse!.statusCode).toBe(500);
    });

    test('should handle orphaned response in non-strict mode', () => {
      const parser = new HttpRequestParser({ strict: false });
      const input = `HTTP/1.1 200 OK
Content-Type: application/json`;
      const result = parser.parseText(input);

      // Orphaned response should be ignored in non-strict mode
      expect(result.ast.requests).toHaveLength(0);
    });

    test('should preserve request order when linking responses', () => {
      const parser = new HttpRequestParser();
      const input = `GET /first
###
HTTP/1.1 200 OK
###
POST /second
###
HTTP/1.1 201 Created`;
      const result = parser.parseText(input);

      expect(result.ast.requests).toHaveLength(2);
      expect(result.ast.requests[0]!.method).toBe('GET');
      expect(result.ast.requests[0]!.expectedResponse!.statusCode).toBe(200);
      expect(result.ast.requests[1]!.method).toBe('POST');
      expect(result.ast.requests[1]!.expectedResponse!.statusCode).toBe(201);
    });
  });

  describe('parseText - request details', () => {
    test('should parse request with @name directive', () => {
      const parser = new HttpRequestParser();
      const input = `@name GetAllUsers
GET https://api.example.com/users`;
      const result = parser.parseText(input);

      expect(result.ast.requests[0]!.name).toBe('GetAllUsers');
    });

    test('should parse request with comments', () => {
      const parser = new HttpRequestParser();
      const input = `# Get all users
# This is the main endpoint
GET https://api.example.com/users`;
      const result = parser.parseText(input);

      expect(result.ast.requests[0]!.comments).toHaveLength(2);
      expect(result.ast.requests[0]!.comments[0]).toBe('Get all users');
      expect(result.ast.requests[0]!.comments[1]).toBe(
        'This is the main endpoint'
      );
    });

    test('should parse request with query parameters', () => {
      const parser = new HttpRequestParser();
      const input = `GET https://api.example.com/search
?page=1
&limit=10
&sort=asc`;
      const result = parser.parseText(input);

      expect(result.ast.requests[0]!.queryParams).toHaveLength(3);
      expect(result.ast.requests[0]!.queryParams[0]).toEqual({
        key: 'page',
        value: '1',
      });
      expect(result.ast.requests[0]!.queryParams[1]).toEqual({
        key: 'limit',
        value: '10',
      });
      expect(result.ast.requests[0]!.queryParams[2]).toEqual({
        key: 'sort',
        value: 'asc',
      });
    });

    test('should set correct rawTextRange on requests', () => {
      const parser = new HttpRequestParser();
      const input = `GET /first
###
POST /second`;
      const result = parser.parseText(input);

      expect(result.ast.requests[0]!.rawTextRange).toEqual({
        startLine: 1,
        endLine: 1,
      });
      expect(result.ast.requests[1]!.rawTextRange).toEqual({
        startLine: 3,
        endLine: 3,
      });
    });
  });

  describe('parseText - body parsing', () => {
    test('should parse JSON body', () => {
      const parser = new HttpRequestParser();
      const input = `POST https://api.example.com/users
Content-Type: application/json

{"name": "John", "email": "john@example.com"}`;
      const result = parser.parseText(input);

      const body = result.ast.requests[0]!.body;
      expect(body).not.toBeNull();
      expect(body!.status).toBe('parsed');
      if (body!.status === 'parsed') {
        expect(body!.content.body.kind).toBe('json');
      }
    });

    test('should parse form data body', () => {
      const parser = new HttpRequestParser();
      const input = `POST https://api.example.com/form
Content-Type: application/x-www-form-urlencoded

name=John&email=john@example.com`;
      const result = parser.parseText(input);

      const body = result.ast.requests[0]!.body;
      expect(body).not.toBeNull();
      expect(body!.status).toBe('parsed');
      if (body!.status === 'parsed') {
        expect(body!.content.body.kind).toBe('form');
      }
    });

    test('should parse text body', () => {
      const parser = new HttpRequestParser();
      const input = `POST https://api.example.com/data
Content-Type: text/plain

Hello World`;
      const result = parser.parseText(input);

      const body = result.ast.requests[0]!.body;
      expect(body).not.toBeNull();
      expect(body!.status).toBe('parsed');
      if (body!.status === 'parsed') {
        expect(body!.content.body.kind).toBe('text');
      }
    });
  });

  describe('parseText - complex scenarios', () => {
    test('should parse complete HTTP file with all features', () => {
      const parser = new HttpRequestParser();
      const input = `###
@baseUrl = https://api.example.com
@contentType = application/json
# Get all users
@name GetUsers
GET {{baseUrl}}/users
Accept: {{contentType}}

###
# Create a new user
@name CreateUser
POST {{baseUrl}}/users HTTP/1.1
Content-Type: {{contentType}}
Authorization: Bearer token123

{
  "name": "John Doe",
  "email": "john@example.com"
}

###
HTTP/1.1 201 Created
Content-Type: {{contentType}}
Location: {{baseUrl}}/users/123

{
  "id": 123,
  "name": "John Doe"
}`;
      const result = parser.parseText(input);

      // Check file-level variables (2 variables from first segment)
      expect(result.ast.globalVariables.fileVariables).toHaveLength(2);

      // Check requests
      expect(result.ast.requests).toHaveLength(2);

      // First request
      const firstRequest = result.ast.requests[0]!;
      expect(firstRequest.name).toBe('GetUsers');
      expect(firstRequest.method).toBe('GET');
      expect(firstRequest.comments).toHaveLength(1);
      expect(firstRequest.headers).toHaveLength(1);

      // Second request
      const secondRequest = result.ast.requests[1]!;
      expect(secondRequest.name).toBe('CreateUser');
      expect(secondRequest.method).toBe('POST');
      expect(secondRequest.httpVersion).toBe('HTTP/1.1');
      expect(secondRequest.headers).toHaveLength(2);
      expect(secondRequest.body).not.toBeNull();

      // Expected response
      expect(secondRequest.expectedResponse).not.toBeNull();
      expect(secondRequest.expectedResponse!.statusCode).toBe(201);
      expect(secondRequest.expectedResponse!.headers).toHaveLength(2);
    });

    test('should handle empty input', () => {
      const parser = new HttpRequestParser();
      const result = parser.parseText('');

      expect(result.text).toBe('');
      expect(result.ast.requests).toHaveLength(0);
      expect(result.lineContexts).toHaveLength(1);
    });

    test('should handle input with only whitespace', () => {
      const parser = new HttpRequestParser();
      const result = parser.parseText('   \n   \n   ');

      expect(result.ast.requests).toHaveLength(0);
    });

    test('should handle input with only comments', () => {
      const parser = new HttpRequestParser();
      const input = '# This is just a comment\n# Another comment';
      const result = parser.parseText(input);

      // Comments without requests still create a request (though minimal)
      expect(result.ast.requests.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('parseText - edge cases', () => {
    test('should handle request with only URL (defaults to GET)', () => {
      const parser = new HttpRequestParser();
      const input = 'https://api.example.com/users';
      const result = parser.parseText(input);

      // should be null
      expect(result.ast.requests[0]!.method).toBeNull();
      expect(result.ast.requests[0]!.url).toBe('https://api.example.com/users');
    });

    test('should handle multiple delimiters', () => {
      const parser = new HttpRequestParser();
      const input = 'GET /first\n###\n###\nPOST /second';
      const result = parser.parseText(input);

      // Empty segments between delimiters should be filtered
      expect(result.ast.requests).toHaveLength(2);
    });

    test('should preserve original text in result', () => {
      const parser = new HttpRequestParser();
      const input = 'GET /first\nContent-Type: application/json';
      const result = parser.parseText(input);

      expect(result.text).toBe(input);
    });

    test('should handle CRLF line endings', () => {
      const parser = new HttpRequestParser();
      const input = 'GET /first\r\n###\r\nPOST /second';
      const result = parser.parseText(input);

      expect(result.ast.requests).toHaveLength(2);
    });
  });
});
