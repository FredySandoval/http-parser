import yargsParser from 'yargs-parser';
import type { LineContext } from '../scanner/line-scanner';
import type { Header } from './header-parser';

/**
 * Result of the curl command parsing.
 */
export interface CurlParserResult {
  method: string;
  url: string;
  headers: Header[];
  body?: {
    raw: string;
  };
  consumedLinesCount: number;
}

/**
 * CurlParser handles parsing of cURL commands.
 * According to specification:
 * - Detects if the first non-empty line starts with "curl ".
 * - Merges multiline commands (lines ending with "\").
 * - Extracts method, URL, headers, and body.
 */
export class CurlParser {
  /**
   * Parses a cURL command from an array of lines.
   *
   * @param lines Array of LineContext objects.
   * @returns Parsed request details or null if not a curl command.
   */
  parse(lines: LineContext[]): CurlParserResult | null {
    if (lines.length === 0) return null;

    // 1. Find the first non-empty line
    let firstLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.text.trim() !== '') {
        firstLineIndex = i;
        break;
      }
    }

    if (firstLineIndex === -1) return null;

    const firstLineText = lines[firstLineIndex]!.text.trim();
    if (!firstLineText.startsWith('curl ')) {
      return null;
    }

    // 2. Merge multiline curl commands (lines ending with "\")
    let fullCommand = '';
    let consumedLinesCount = firstLineIndex;

    for (let i = firstLineIndex; i < lines.length; i++) {
      const rawLine = lines[i]!.text;
      const trimmedLine = rawLine.trim();
      consumedLinesCount++;

      if (trimmedLine.endsWith('\\')) {
        // Remove the backslash and add space
        fullCommand += trimmedLine.slice(0, -1) + ' ';
        // continue to next line
      } else {
        fullCommand += trimmedLine;
        break; // end of curl command
      }
    }

    // 3. Remove "curl" prefix
    // We use a regex to ensure we only remove "curl" at the start with space
    const curlArgs = fullCommand.replace(/^curl\s+/, '');

    // 4. Parse using yargs-parser
    const argv = yargsParser(curlArgs, {
      configuration: {
        'short-option-groups': true,
        'camel-case-expansion': true,
        'boolean-negation': false,
        'duplicate-arguments-array': true,
      },
    });

    // 5. Extract components

    // Headers
    const headers: Header[] = [];
    const rawHeaders = argv.H || argv.header;
    if (rawHeaders) {
      const headerArray = Array.isArray(rawHeaders) ? rawHeaders : [rawHeaders];
      for (const h of headerArray) {
        if (!h) continue;
        const parts = String(h).split(':');
        if (parts.length >= 2) {
          headers.push({
            name: parts[0]!.trim(),
            value: parts.slice(1).join(':').trim(),
          });
        }
      }
    }

    // Body
    let bodyRaw: string | undefined;
    // Search for data flags in order of priority or just the first one found
    const bodyKeys = ['d', 'data', 'data-raw', 'data-binary', 'data-urlencode'];
    for (const key of bodyKeys) {
      if (argv[key] !== undefined) {
        const val = argv[key];
        // If it's an array, take the last one (curl behavior usually)
        bodyRaw = Array.isArray(val)
          ? String(val[val.length - 1])
          : String(val);
        break;
      }
    }

    // Method
    let methodAttr = argv.X || argv.request;
    let method: string;
    if (Array.isArray(methodAttr)) {
      method = String(methodAttr[methodAttr.length - 1]);
    } else if (methodAttr) {
      method = String(methodAttr);
    } else {
      method = bodyRaw !== undefined ? 'POST' : 'GET';
    }
    method = method.toUpperCase();

    // URL
    // yargs-parser puts non-flag arguments in argv._
    let url = '';
    if (argv._ && argv._.length > 0) {
      url = String(argv._[0]);
    }

    return {
      method,
      url,
      headers,
      ...(bodyRaw !== undefined ? { body: { raw: bodyRaw } } : {}),
      consumedLinesCount,
    };
  }
}
