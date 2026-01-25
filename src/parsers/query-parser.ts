import type { LineContext } from '../scanner/line-scanner';

/**
 * QueryParam represents a single query parameter key-value pair.
 */
export interface QueryParam {
  key: string;
  value: string;
}

/**
 * Result of the query continuation parsing.
 */
export interface QueryParserResult {
  queryParams: QueryParam[];
  consumedLinesCount: number;
}

/**
 * QueryParser handles parsing of multiline query continuations.
 * According to specification:
 * - Lines immediately following the request line starting with ? or & are query continuations.
 * - Whitespace before ? or & is ignored.
 * - Stops at first line that doesn't start with these characters.
 */
export class QueryParser {
  /**
   * Parses multiline query parameters from an array of lines.
   *
   * @param lines Array of LineContext objects following the request line.
   * @returns QueryParams and the count of lines consumed.
   */
  parse(lines: LineContext[]): QueryParserResult {
    const queryParams: QueryParam[] = [];
    let consumedLinesCount = 0;

    for (const line of lines) {
      const trimmedText = line.text.trim();

      // Check if the line starts with ? or &
      if (trimmedText.startsWith('?') || trimmedText.startsWith('&')) {
        // Remove the prefix (? or &)
        const content = trimmedText.slice(1).trim();

        if (content) {
          // Split key and value (e.g., "key=value")
          const eqIndex = content.indexOf('=');
          if (eqIndex !== -1) {
            const key = content.slice(0, eqIndex).trim();
            const value = content.slice(eqIndex + 1).trim();
            queryParams.push({ key, value });
          } else {
            // Handle key with no value (e.g., "?key")
            queryParams.push({ key: content.trim(), value: '' });
          }
        }

        consumedLinesCount++;
      } else {
        // Stop at the first line that doesn't match
        break;
      }
    }

    return {
      queryParams,
      consumedLinesCount,
    };
  }
}
