import { test, expect, describe } from 'bun:test';
import { HttpRequestParser } from '../src/parser';

describe('AST Integration', () => {
  test('should parse multiple requests and associate responses', () => {
    const parser = new HttpRequestParser();
    const input = `
@baseUrl = https://api.com

# @name login
POST {{baseUrl}}/login
Content-Type: application/json

{ "user": "admin" }

###

HTTP/1.1 200 OK
Content-Type: application/json

{ "token": "abc" }

###

# @name getProfile
GET {{baseUrl}}/profile
Authorization: Bearer {{login.response.body.$.token}}
`;

    const result = parser.parseText(input);
    const ast = result.ast;

    // Verify requests count
    expect(ast.requests).toHaveLength(2);

    // Verify first request
    const loginReq = ast.requests[0];
    expect(loginReq?.name).toBe('login');
    expect(loginReq?.method).toBe('POST');
    expect(loginReq?.url).toBe('{{baseUrl}}/login');
    expect(loginReq?.headers).toContainEqual({
      name: 'Content-Type',
      value: 'application/json',
    });
    expect(loginReq?.body?.raw?.trim()).toBe('{ "user": "admin" }');

    // Verify response association
    expect(loginReq?.expectedResponse).toBeDefined();
    expect(loginReq?.expectedResponse?.statusCode).toBe(200);
    expect(loginReq?.expectedResponse?.headers).toContainEqual({
      name: 'Content-Type',
      value: 'application/json',
    });

    // Verify second request
    const profileReq = ast.requests[1];
    expect(profileReq?.name).toBe('getProfile');
    expect(profileReq?.method).toBe('GET');
    expect(profileReq?.variables.request).toHaveLength(1);
    expect(profileReq?.variables.request[0]).toMatchObject({
      kind: 'request',
      requestName: 'login',
      source: 'response',
      part: 'body',
      path: '$.token',
    });

    // Verify file variables collection
    expect(ast.fileVariables).toHaveLength(1);
    expect(ast.fileVariables[0]).toMatchObject({
      key: 'baseUrl',
      value: 'https://api.com',
    });
  });

  test('should handle cURL and GraphQL correctly in the pipeline', () => {
    const parser = new HttpRequestParser();
    const input = `
curl -X POST https://api.com/curl -H "Content-Type: application/json" -d '{"foo":"bar"}'

###

POST https://api.com/graphql
X-REQUEST-TYPE: GraphQL

query { user { id } }

{ "id": 1 }
`;

    const result = parser.parseText(input);
    const ast = result.ast;

    expect(ast.requests).toHaveLength(2);

    // Curl
    expect(ast.requests[0]?.method).toBe('POST');
    expect(ast.requests[0]?.url).toBe('https://api.com/curl');
    expect(ast.requests[0]?.body?.type).toBe('raw');

    // GraphQL
    expect(ast.requests[1]?.url).toBe('https://api.com/graphql');
    expect(ast.requests[1]?.body?.type).toBe('graphql');
    expect(ast.requests[1]?.body?.graphql).toMatchObject({
      query: 'query { user { id } }',
      variables: '{ "id": 1 }',
    });
  });
});
