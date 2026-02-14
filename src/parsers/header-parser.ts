import type { LineContext, Header, HeaderParserResult } from '../types/types';
/**
 * HeaderParser handles parsing of HTTP headers.
 * Specification:
 * - Header lines begin immediately after the request line (or query section).
 * - Parsing stops at the first empty line.
 * - Format: Header-Name: Header Value
 * - Header name is case-insensitive, but original casing is preserved for output.
 */
export class HeaderParser {
  /**
   * Parses HTTP headers from an array of lines.
   *
   * @param lines Array of LineContext objects following the request/query section.
   * @returns Headers and the count of lines consumed.
   */
  parse(lines: LineContext[]): HeaderParserResult {
    const headers: Header[] = [];
    let consumedLinesCount = 0;

    for (const line of lines) {
      const text = line.text;

      // Parsing stops at the first empty line
      if (text.trim() === '') {
        break;
      }

      const colonIndex = text.indexOf(':');
      if (colonIndex !== -1) {
        const name = text.slice(0, colonIndex).trim();
        const value = text.slice(colonIndex + 1).trim();

        if (name) {
          headers.push({ name, value });
        }
        consumedLinesCount++;
      } else {
        // If it doesn't match the Header-Name: Value format,
        // it's either an invalid header or the start of something else.
        // Spec says parsing stops at the first empty line.
        // However, if we encounter a line without a colon before an empty line,
        // what should we do? The pseudo code says "break".
        break;
      }
    }

    return {
      headers,
      consumedLinesCount,
    };
  }
}
