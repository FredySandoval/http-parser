import { type LineContext } from '../types/types';
/**
 * LineScanner Class
 * Lightweight component to split text into lines with metadata.
 * No semantics, no tokens. Just lines and offsets.
 *
 * Responsibilities:
 * - Split text into lines
 * - Track line numbers and offsets
 * - Preserve raw text (empty lines, whitespace, indentation)
 * - `endOffset` is exclusive (points to position after last character of line)
 * - Line breaks are not included in the text field
 *
 * @example
 * const scanner = new LineScanner();
 * const lines = scanner.scan("POST /foo HTTP/1.1\nContent-Type: application/json");
 */
export class LineScanner {
  /**
   * Scans the input text and returns an array of LineContext objects.
   *
   * @param text - The raw input text to scan
   * @returns Array of LineContext objects, one per line
   *
   * @example
   * Input: "POST https://example.com HTTP/1.1\ncontent-type: application/json"
   * Output: [
   *   { lineNumber: 1, startOffset: 0, endOffset: 33, text: "POST https://example.com HTTP/1.1" },
   *   { lineNumber: 2, startOffset: 34, endOffset: 64, text: "content-type: application/json" }
   * ]
   */
  scan(text: string): LineContext[] {
    const lines: LineContext[] = [];

    if (text.length === 0) {
      // Handle empty input - return single empty line
      lines.push({
        lineNumber: 1,
        startOffset: 0,
        endOffset: 0,
        text: '',
      });
      return lines;
    }

    let lineNumber = 1;
    let startOffset = 0;
    let i = 0;

    while (i <= text.length) {
      // Find the end of the current line
      let lineEnd = i;
      while (
        lineEnd < text.length &&
        text[lineEnd] !== '\n' &&
        text[lineEnd] !== '\r'
      ) {
        lineEnd++;
      }

      // Extract the line text (without line break)
      const lineText = text.slice(startOffset, lineEnd);

      // endOffset is exclusive - points to position after last character of line content
      const endOffset = lineEnd;

      lines.push({
        lineNumber,
        startOffset,
        endOffset,
        text: lineText,
      });

      // Move past the line break
      if (lineEnd < text.length) {
        // Handle CRLF (\r\n) as a single line break
        if (
          text[lineEnd] === '\r' &&
          lineEnd + 1 < text.length &&
          text[lineEnd + 1] === '\n'
        ) {
          i = lineEnd + 2;
        } else {
          // Handle LF (\n) or CR (\r) alone
          i = lineEnd + 1;
        }
        startOffset = i;
        lineNumber++;
      } else {
        // End of text reached
        break;
      }
    }

    return lines;
  }
}
