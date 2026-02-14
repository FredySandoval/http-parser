import type { ParsedHTTPRequestLine } from '../types/types';

/**
 * Result of parsing a request line
 */

/**
 * HTTPRequestLineParser
 *
 * Valid formats:
 * 1. METHOD URL/PATH PROTOCOL-VERSION
 *    Example: POST https://example.com/api HTTP/1.1
 *
 * 2. METHOD URL/PATH
 *    Example: GET https://example.com/api
 *
 * 3. URL only
 *    Example: https://example.com/api
 *    (Default method: GET)
 * Parses the HTTP request line (first line of an HTTP request).
 * Format: METHOD URL [HTTP/VERSION]
 *
 * @example
 * Input: "GET /api/users HTTP/1.1"
 * Output: { method: "GET", url: "/api/users", httpVersion: "HTTP/1.1" }
 */
export class HTTPRequestLineParser {

  // RFC9110
  // http://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods
  private static readonly VALID_HTTP_METHODS = [
    'GET',
    'HEAD',
    'OPTIONS',
    'TRACE',
    'PUT',
    'DELETE',
    'POST',
    'PATCH',
    'CONNECT',
  ];

  /**
   * input: "POST https://example.com/api HTTP/1.1"
   * output: { method: "POST", url: "https://example.com/api", httpVersion: "HTTP/1.1" }
   *
   * input: "GET /simple/path"
   * output: { method: "GET", url: "/simple/path", httpVersion: null }
   *
   * input: "https://example.com/api"
   * output: { method: "GET", url: "https://example.com/api", httpVersion: null }
   */
  parse(line: string): ParsedHTTPRequestLine {
    if (!this.validate(line)) {
      throw new Error(`Invalid request line: ${line}`);
    }

    const trimmedLine = line.trim();
    const parts = trimmedLine.split(/\s+/);

    // Check if first part looks like a URL (starts with http://, https://, or doesn't look like an HTTP method)
    const firstPart = parts[0]!;
    const looksLikeUrl =
      firstPart.startsWith('http://') ||
      firstPart.startsWith('https://') ||
      !this.isValidHttpMethod(firstPart);

    if (looksLikeUrl && parts.length === 1) {
      // URL only format - default to GET
      return {
        method: null,
        url: firstPart,
        httpVersion: null,
      };
    }

    const method = this.extractMethod(parts);
    const url = this.extractUrl(parts);
    const httpVersion = this.extractHttpVersion(parts);

    return {
      method,
      url,
      httpVersion,
    };
  }

  /**
   * Extracts the HTTP method (GET, POST, PUT, DELETE, PATCH, etc.)
   *
   * input: "DELETE /resource/123 HTTP/1.1"
   * output: "DELETE"
   */
  extractMethod(parts: string[]): string {
    if (parts.length === 0) {
      throw new Error('Cannot extract method from empty parts array');
    }

    const method = parts[0]!.toUpperCase();

    if (!this.isValidHttpMethod(method)) {
      throw new Error(`Invalid HTTP method: ${method}`);
    }

    return method;
  }

  /**
   * Extracts the URL or path
   *
   * input: parts = ["POST", "https://api.example.com/v1/users", "HTTP/1.1"]
   * output: "https://api.example.com/v1/users"
   *
   * handles relative paths like "/api/users"
   * handles absolute URLs with protocol
   */
  extractUrl(parts: string[]): string {
    if (parts.length < 2) {
      throw new Error('URL not found in request line');
    }

    const url = parts[1]!;

    if (url.length === 0) {
      throw new Error('URL is empty');
    }

    return url;
  }

  /**
   * Extracts the HTTP version if specified
   *
   * input: parts = ["GET", "/path", "HTTP/1.1"]
   * output: "HTTP/1.1"
   *
   * input: parts = ["GET", "/path"]
   * output: null
   */
  extractHttpVersion(parts: string[]): string | null {
    if (parts.length < 3) {
      return null;
    }

    const version = parts[2]!;

    if (!version.startsWith('HTTP/')) {
      return null;
    }

    return version;
  }

  /**
   * Validates the request line has minimum required components
   *
   * input: "GET /path HTTP/1.1"
   * output: true
   *
   * input: "INVALID"
   * output: false
   *
   * input: ""
   * output: false
   */
  validate(line: string): boolean {
    if (!line || line.trim().length === 0) {
      return false;
    }

    const trimmedLine = line.trim();
    const parts = trimmedLine.split(/\s+/);

    // URL only format is valid (defaults to GET)
    if (parts.length === 1) {
      return true;
    }

    // Must have at least method and URL
    if (parts.length < 2) {
      return false;
    }

    // Validate method
    const method = parts[0]!.toUpperCase();
    if (!this.isValidHttpMethod(method)) {
      return false;
    }

    return true;
  }

  /**
   * Checks if a string is a valid HTTP method
   */
  private isValidHttpMethod(method: string): boolean {
    return HTTPRequestLineParser.VALID_HTTP_METHODS.includes(
      method.toUpperCase()
    );
  }
}
