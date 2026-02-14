import { test, expect, describe } from 'bun:test';
import {
    parseHttp,
} from '../src/index';

describe('Found bugs', () => {
    test('should only return 1 block', () => {
        
        const inlineHttp = `@contentType = application/json
@baseUrl = http://localhost:8080
###
GET {{baseUrl}}/users HTTP/1.1
Accept: {{contentType}}`;

        const result = parseHttp(inlineHttp);
        // since the input has only one request, we expect the AST to contain exactly one request block
        expect(result.ast.requests.length).toBe(1);
    });
});