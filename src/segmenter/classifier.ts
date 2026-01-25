import type { LineContext } from '../scanner/line-scanner';
import type { Segment } from './segmenter';

/**
 * Valid types for a segment.
 */
export type SegmentType = 'request' | 'response';

/**
 * Valid subtypes for a segment.
 */
export type SegmentSubtype = 'http' | 'curl' | 'graphql';

/**
 * Represents a segment that has been classified with type and subtype.
 */
export interface ClassifiedSegment extends Segment {
  /** Whether this is a request or a response */
  type: SegmentType;
  /** Specific flavor of request (e.g., standard HTTP or cURL) */
  subtype: SegmentSubtype;
  /** Metadata about the first line that contains actual content */
  firstNonEmptyLine: {
    lineNumber: number;
    text: string;
  };
}

/**
 * SegmentClassifier Class
 * Differentiates between HTTP requests and expected responses.
 * Also identifies if a request is a standard HTTP request or a cURL command.
 *
 * According to the specification:
 * - A segment is a response if its first non-empty line starts with "HTTP/"
 * - A segment is a cURL request if its first non-empty line starts with "curl"
 */
export class SegmentClassifier {
  /**
   * Classifies a collection of raw segments.
   *
   * @param segments - Array of raw Segment objects from Segmenter
   * @returns Array of ClassifiedSegment objects
   */
  classify(segments: Segment[]): ClassifiedSegment[] {
    return segments.map((segment) => this.classifySegment(segment));
  }

  /**
   * Classifies a single segment to determine its type and subtype.
   *
   * @param segment - A single Segment object
   * @returns A ClassifiedSegment object
   */
  classifySegment(segment: Segment): ClassifiedSegment {
    const significantLine = this.findSignificantLine(segment.lines);

    // If for some reason we have a segment with no significant lines
    // (though Segmenter should have filtered these out), default to request/http
    if (!significantLine) {
      return {
        ...segment,
        type: 'request',
        subtype: 'http',
        firstNonEmptyLine: {
          lineNumber: segment.startLine,
          text: '',
        },
      };
    }

    const type = this.detectType(significantLine.text);

    // Find the index of the significant line to start scanning for headers if needed
    const significantLineIndex = segment.lines.indexOf(significantLine);
    const subtype = this.detectSubtype(segment.lines, significantLineIndex);

    return {
      ...segment,
      type,
      subtype,
      firstNonEmptyLine: {
        lineNumber: significantLine.lineNumber,
        text: significantLine.text,
      },
    };
  }

  /**
   * Scans through lines to find the first one that isn't just whitespace.
   *
   * @param lines - Array of LineContext objects
   * @returns The first non-empty LineContext found, or null if none exist
   */
  private findSignificantLine(lines: LineContext[]): LineContext | null {
    for (const line of lines) {
      if (line.text.trim().length > 0) {
        return line;
      }
    }
    return null;
  }

  /**
   * Detects if a line of text represents a request or a response.
   *
   * @param text - The text content of a line
   * @returns "request" or "response"
   */
  private detectType(text: string): SegmentType {
    const normalized = text.trimStart().toUpperCase();
    if (normalized.startsWith('HTTP/')) {
      return 'response';
    }
    return 'request';
  }

  /**
   * Detects the subtype of a request (standard HTTP, cURL, or GraphQL).
   *
   * @param lines - All lines in the segment
   * @param significantLineIndex - The index of the first non-empty line
   * @returns "http", "curl", or "graphql"
   */
  private detectSubtype(
    lines: LineContext[],
    significantLineIndex: number
  ): SegmentSubtype {
    const significantLine = lines[significantLineIndex];
    if (!significantLine) {
      return 'http';
    }

    const firstLineText = significantLine.text.trimStart().toLowerCase();

    // 1. Check for cURL (based on first line)
    if (firstLineText.startsWith('curl')) {
      return 'curl';
    }

    // 2. Check for GraphQL (based on X-REQUEST-TYPE header)
    // Headers begin immediately after the request line (significantLine)
    // and stop at the first empty line.
    for (let i = significantLineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const lineText = line.text.trim();

      // Parsing stops at the first empty line
      if (lineText.length === 0) {
        break;
      }

      // Check for X-REQUEST-TYPE: GraphQL (case-insensitive)
      if (/^x-request-type:\s*graphql\s*$/i.test(lineText)) {
        return 'graphql';
      }
    }

    // 3. Default to HTTP
    return 'http';
  }
}
