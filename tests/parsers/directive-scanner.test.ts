import { test, expect, describe } from 'bun:test';
import { DirectiveScanner } from '../../src/parsers/directive-scanner';
import { LineScanner } from '../../src/scanner/line-scanner';

describe('DirectiveScanner', () => {
  test('should separate directives, comments, and content', () => {
    const scanner = new LineScanner();
    const directiveScanner = new DirectiveScanner();

    const input = `@baseUrl = https://example.com
# @name login
# This is a comment
POST {{baseUrl}}/login
Content-Type: application/json

// another comment
# @note encryption required
{ "user": "test" }`;

    const lines = scanner.scan(input);
    const result = directiveScanner.scan(lines);

    // Directives: @baseUrl, # @name, # @note
    expect(result.directives).toHaveLength(3);
    expect(result.directives[0]!.text).toContain('@baseUrl');
    expect(result.directives[1]!.text).toContain('# @name');
    expect(result.directives[2]!.text).toContain('# @note');

    // Comments: # This is a comment, // another comment
    expect(result.comments).toHaveLength(2);
    expect(result.comments[0]!.text).toContain('This is a comment');
    expect(result.comments[1]!.text).toContain('another comment');

    // Content: POST, Content-Type, blank, JSON
    expect(result.content).toHaveLength(4);
    expect(result.content[0]!.text).toContain('POST');
    expect(result.content[3]!.text).toContain('{ "user"');
  });

  test('should identify file variables accurately', () => {
    const scanner = new LineScanner();
    const directiveScanner = new DirectiveScanner();

    const input = `@var1=val1
  @var2 = val2
notVar = val3`;
    const lines = scanner.scan(input);
    const result = directiveScanner.scan(lines);

    expect(result.directives).toHaveLength(2);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.text).toBe('notVar = val3');
  });
});
