import type { LineContext, Header } from '../types/types';
import type {
  HttpBodyResult,
  HttpBody,
  HttpBodyContent,
  JsonContent,
  TextContent,
  FormContent,
  MultipartContent,
  FormPart,
} from '../types/body-parser-types';

/**
 * BodyParser handles parsing of HTTP request/response bodies.
 *
 * Responsibilities:
 * - Extract body lines following the headers section (after first empty line)
 * - Parse body content based on Content-Type header
 * - Support JSON, form data, multipart, and text formats
 * - Return structured body result with parsing status
 */
export class BodyParser {
  /**
   * Parses HTTP body from an array of lines.
   *
   * @param lines Array of LineContext objects representing the body content
   * @param headers Array of parsed headers to determine content type
   * @returns HttpBodyResult containing parsed content or error information
   *
   * @example
   * Input: lines = [{ text: '{"name": "John"}' }], headers = [{ name: 'Content-Type', value: 'application/json' }]
   * Output: { status: 'parsed', content: { protocol: 'http', body: { kind: 'json', data: { name: 'John' } } }, raw: '{"name": "John"}', contentType: 'application/json', size: 16 }
   */
  parse(lines: LineContext[], headers: Header[]): HttpBodyResult {
    if (lines.length === 0) {
      return this.createSuccessResult(null, '', null);
    }

    const rawBody = lines.map((line) => line.text).join('\n');
    const contentType = this.extractContentType(headers);
    const size = this.calculateSize(rawBody);

    if (rawBody.trim() === '') {
      // Return appropriate empty content based on content type
      const normalizedType = (contentType || '').toLowerCase().trim();
      if (normalizedType.includes('application/x-www-form-urlencoded')) {
        return this.createSuccessResult(
          { kind: 'form', fields: {} },
          rawBody,
          contentType,
          size
        );
      }
      return this.createSuccessResult(null, rawBody, contentType, size);
    }

    try {
      const content = this.parseByContentType(rawBody, contentType);
      return this.createSuccessResult(content, rawBody, contentType, size);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown parse error';
      return this.createErrorResult(errorMessage, rawBody, contentType, size);
    }
  }

  /**
   * Extracts the Content-Type value from headers.
   *
   * @param headers Array of Header objects
   * @returns The content type string or null if not found
   *
   * @example
   * Input: [{ name: 'Content-Type', value: 'application/json' }]
   * Output: 'application/json'
   *
   * Input: [{ name: 'content-type', value: 'text/html' }]
   * Output: 'text/html'
   */
  private extractContentType(headers: Header[]): string | null {
    const contentTypeHeader = headers.find(
      (h) => h.name.toLowerCase() === 'content-type'
    );
    return contentTypeHeader ? contentTypeHeader.value : null;
  }

  /**
   * Parses body content based on detected content type.
   *
   * @param rawBody The raw body text
   * @param contentType The detected content type
   * @returns Parsed HttpBodyContent
   *
   * @example
   * Input: rawBody = '{"key": "value"}', contentType = 'application/json'
   * Output: { kind: 'json', data: { key: 'value' } }
   */
  private parseByContentType(
    rawBody: string,
    contentType: string | null
  ): HttpBodyContent {
    const normalizedType = (contentType || '').toLowerCase().trim();

    if (
      normalizedType.includes('application/json') ||
      normalizedType.includes('text/json')
    ) {
      return this.parseJson(rawBody);
    }

    if (normalizedType.includes('application/x-www-form-urlencoded')) {
      return this.parseFormData(rawBody);
    }

    if (normalizedType.includes('multipart/form-data')) {
      return this.parseMultipart(rawBody, contentType);
    }

    return this.parseText(rawBody);
  }

  /**
   * Parses JSON body content.
   *
   * @param rawBody The raw body text
   * @returns JsonContent with parsed data
   *
   * @example
   * Input: '{"name": "John", "age": 30}'
   * Output: { kind: 'json', data: { name: 'John', age: 30 } }
   */
  private parseJson(rawBody: string): JsonContent {
    const trimmed = rawBody.trim();
    if (trimmed === '') {
      return { kind: 'json', data: null };
    }

    try {
      const data = JSON.parse(trimmed);
      return { kind: 'json', data };
    } catch (error) {
      throw new Error(
        `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parses URL-encoded form data.
   *
   * @param rawBody The raw body text
   * @returns FormContent with parsed fields
   *
   * @example
   * Input: 'name=John+Doe&age=30&hobbies=reading&hobbies=gaming'
   * Output: { kind: 'form', fields: { name: 'John Doe', age: '30', hobbies: ['reading', 'gaming'] } }
   */
  private parseFormData(rawBody: string): FormContent {
    const fields: Record<string, string | string[]> = {};

    if (rawBody.trim() === '') {
      return { kind: 'form', fields };
    }

    const pairs = rawBody.split('&');

    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        const decodedKey = decodeURIComponent(key.trim());
        const decodedValue =
          value !== undefined
            ? decodeURIComponent(value.replace(/\+/g, ' ')).trim()
            : '';

        if (fields[decodedKey] !== undefined) {
          // Handle duplicate keys as arrays
          if (Array.isArray(fields[decodedKey])) {
            (fields[decodedKey] as string[]).push(decodedValue);
          } else {
            fields[decodedKey] = [fields[decodedKey] as string, decodedValue];
          }
        } else {
          fields[decodedKey] = decodedValue;
        }
      }
    }

    return { kind: 'form', fields };
  }

  /**
   * Parses multipart/form-data content.
   *
   * @param rawBody The raw body text
   * @param contentType The content type header value (contains boundary)
   * @returns MultipartContent with parsed parts
   *
   * @example
   * Input: rawBody with boundary '----WebKitFormBoundary', contentType = 'multipart/form-data; boundary=----WebKitFormBoundary'
   * Output: { kind: 'multipart', boundary: '----WebKitFormBoundary', parts: [...] }
   */
  private parseMultipart(
    rawBody: string,
    contentType: string | null
  ): MultipartContent {
    if (!contentType) {
      throw new Error(
        'Missing Content-Type header with boundary for multipart'
      );
    }

    const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
    if (!boundaryMatch || !boundaryMatch[1]) {
      throw new Error('Missing boundary in Content-Type header');
    }

    const boundary = boundaryMatch[1].trim().replace(/^["']|["']$/g, '');
    const parts: FormPart[] = [];

    // Split by boundary
    const delimiter = `--${boundary}`;
    const sections = rawBody.split(delimiter);

    for (const section of sections) {
      const trimmed = section.trim();
      if (trimmed === '' || trimmed === '--') {
        continue;
      }

      const part = this.parseMultipartPart(trimmed);
      if (part) {
        parts.push(part);
      }
    }

    return { kind: 'multipart', boundary, parts };
  }

  /**
   * Parses a single multipart part section.
   *
   * @param section The raw part section
   * @returns FormPart object or null if invalid
   */
  private parseMultipartPart(section: string): FormPart | null {
    const lines = section.split('\n');
    const headers: Record<string, string> = {};
    let contentDisposition: string | null = null;
    let headerEndIndex = 0;

    // Parse headers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.trim() === '') {
        headerEndIndex = i + 1;
        break;
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const name = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        headers[name.toLowerCase()] = value;

        if (name.toLowerCase() === 'content-disposition') {
          contentDisposition = value;
        }
      }
    }

    if (!contentDisposition) {
      return null;
    }

    // Extract name and filename from Content-Disposition
    const nameMatch = contentDisposition.match(/name="([^"]+)"/);
    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);

    if (!nameMatch || !nameMatch[1]) {
      return null;
    }

    const name = nameMatch[1];
    const filename =
      filenameMatch && filenameMatch[1] ? filenameMatch[1] : undefined;
    const partContentType = headers['content-type'];

    // Extract value (everything after headers)
    const valueLines = lines.slice(headerEndIndex);
    const value = valueLines.join('\n').trim();

    return {
      name,
      value,
      filename,
      contentType: partContentType,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    };
  }

  /**
   * Parses body as plain text.
   *
   * @param rawBody The raw body text
   * @returns TextContent
   */
  private parseText(rawBody: string): TextContent {
    return { kind: 'text', text: rawBody };
  }

  /**
   * Calculates body size in bytes.
   *
   * @param rawBody The raw body text
   * @returns Size in bytes
   */
  private calculateSize(rawBody: string): number {
    return new TextEncoder().encode(rawBody).length;
  }

  /**
   * Creates a successful parse result.
   *
   * @param content The parsed body content
   * @param raw The raw body text
   * @param contentType The content type
   * @param size Size in bytes (optional, calculated if not provided)
   * @returns HttpBodyResult with status 'parsed'
   */
  private createSuccessResult(
    content: HttpBodyContent | null,
    raw: string,
    contentType: string | null,
    size?: number
  ): HttpBodyResult {
    const bodySize = size ?? this.calculateSize(raw);

    if (content === null) {
      return {
        status: 'parsed',
        content: { protocol: 'http', body: { kind: 'text', text: '' } },
        raw,
        contentType,
        size: bodySize,
      };
    }

    const httpBody: HttpBody = {
      protocol: 'http',
      body: content,
    };

    return {
      status: 'parsed',
      content: httpBody,
      raw,
      contentType,
      size: bodySize,
    };
  }

  /**
   * Creates an error parse result.
   *
   * @param message Error message
   * @param raw The raw body text
   * @param contentType The content type
   * @param size Size in bytes (optional, calculated if not provided)
   * @param lineNumber Optional line number where error occurred
   * @returns HttpBodyResult with status 'error'
   */
  private createErrorResult(
    message: string,
    raw: string,
    contentType: string | null,
    size?: number,
    lineNumber?: number
  ): HttpBodyResult {
    const bodySize = size ?? this.calculateSize(raw);

    return {
      status: 'error',
      error: {
        message,
        ...(lineNumber !== undefined && { lineNumber }),
      },
      raw,
      contentType,
      size: bodySize,
    };
  }
}
