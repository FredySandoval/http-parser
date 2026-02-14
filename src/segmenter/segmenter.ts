import type { LineContext, Segment} from '../types/types';

/**
 * Segment represents a group of lines between ### delimiters.
 * Each segment may contain a request or response.
 */

/**
 * Segmenter Class
 * Groups lines into segments based on ### delimiters.
 * Does not parse content; only structures the document.
 *
 * According to the specification:
 * - Requests are separated by a delimiter of three or more consecutive `#` characters
 * - The delimiter must be on a line by itself
 * - Empty segments are ignored
 * - The delimiter itself is NOT part of any segment
 *
 * @example
 * const segmenter = new Segmenter();
 * const segments = segmenter.segment(lines);
 */
export class Segmenter {
  /**
   * Regular expression to match delimiter lines.
   * Matches 3 or more # characters, optionally surrounded by whitespace.
   */
  private static readonly DELIMITER_PATTERN = /^\s*#{3,}\s*$/;

  /**
   * Segments an array of lines into separate segments based on ### delimiters.
   *
   * @param lines - Array of LineContext objects from LineScanner
   * @returns Array of Segment objects
   *
   * @example
   * Input: Lines containing two requests separated by ###
   * Output: [
   *   { segmentId: 0, startLine: 1, endLine: 7, lines: [...] },
   *   { segmentId: 1, startLine: 9, endLine: 10, lines: [...] }
   * ]
   */
  segment(lines: LineContext[]): Segment[] {
    const segments: Segment[] = [];
    let currentSegmentLines: LineContext[] = [];
    let segmentId = 0;

    for (const line of lines) {
      if (this.isDelimiter(line.text)) {
        // When we hit a delimiter, finalize the current segment if it has content
        if (currentSegmentLines.length > 0) {
          segments.push(this.createSegment(segmentId, currentSegmentLines));
          segmentId++;
        }
        // Reset for next segment (delimiter is consumed/ignored as a separator)
        currentSegmentLines = [];
      } else {
        // Add line to current segment
        currentSegmentLines.push(line);
      }
    }

    // Don't forget the last segment after the final delimiter (or if no delimiters exist)
    if (currentSegmentLines.length > 0) {
      segments.push(this.createSegment(segmentId, currentSegmentLines));
    }

    // Filter out empty segments (segments with only empty/whitespace lines)
    return segments.filter((segment) => this.hasNonEmptyLines(segment));
  }

  /**
   * Checks if a line of text is a segment delimiter.
   * A delimiter is 3 or more # characters on a line by themselves.
   *
   * @param text - The text content of the line
   * @returns true if the line is a delimiter, false otherwise
   *
   * @example
   * isDelimiter("###")       // true
   * isDelimiter("####")      // true
   * isDelimiter("  ###  ")   // true
   * isDelimiter("## ")       // false (only 2 #)
   * isDelimiter("### text")  // false (has content after)
   */
  isDelimiter(text: string): boolean {
    return Segmenter.DELIMITER_PATTERN.test(text);
  }

  /**
   * Creates a Segment object from an array of lines.
   *
   * @param segmentId - The unique identifier for this segment
   * @param lines - The lines belonging to this segment
   * @returns A Segment object
   */
  private createSegment(segmentId: number, lines: LineContext[]): Segment {
    const firstLine = lines[0];
    const lastLine = lines[lines.length - 1];

    return {
      segmentId,
      startLine: firstLine?.lineNumber ?? 0,
      endLine: lastLine?.lineNumber ?? 0,
      lines: [...lines], // Create a copy to avoid mutation
    };
  }

  /**
   * Checks if a segment has any non-empty lines.
   * Used to filter out empty segments.
   *
   * @param segment - The segment to check
   * @returns true if the segment has at least one non-empty line
   */
  private hasNonEmptyLines(segment: Segment): boolean {
    return segment.lines.some((line) => line.text.trim().length > 0);
  }
}
