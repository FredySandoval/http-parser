import type {
  ClassifiedSegment,
  LineContext,
  MessageType,
  Segment,
  SegmentType,
} from '../types/types';

/**
 * SegmentClassifier Class
 * Differentiates between HTTP requests and expected responses.
 * Also identifies if a request is a standard HTTP request, cURL command, or GraphQL.
 *
 * According to the specification:
 * - A segment is a response if its first non-empty line starts with "HTTP/"
 * - A segment is a cURL request if its first non-empty line starts with "curl"
 * - A segment is a GraphQL request if the X-REQUEST-TYPE: GraphQL header is present
 */
export class SegmentClassifier {
  /**
   * input: Segment[]
   * output: ClassifiedSegment[]
   *
   * Processes each segment and classifies it
   */
  classify(segments: Segment[]): ClassifiedSegment[] {
    return segments.map((segment) => this.classifySegment(segment));
  }

  /**
   * input: single Segment
   * output: ClassifiedSegment
   *
   * Finds the first significant (non-empty) line
   * Detects the type (request vs response)
   * Detects the subtype (http | curl | graphql)
   * Returns classified segment with metadata
   */
  classifySegment(segment: Segment): ClassifiedSegment {
    const significantLine = this.findSignificantLine(segment.lines);

    // fallback!
    // If for some reason we have a segment with no significant lines
    // (though Segmenter should have filtered these out), default to request/http
    if (!significantLine) {
      return {
        ...segment,
        messageType: 'request',
        segmentType: 'http',
        firstNonEmptyLine: {
          lineNumber: segment.startLine,
          text: '',
        },
      };
    }

    const type = this.detectMessageType(significantLine.text);
    const significantLineIndex = segment.lines.findIndex(
      (line) => line.lineNumber === significantLine.lineNumber
    );
    const subtype = this.detectSegmentType(segment.lines, significantLineIndex);

    return {
      ...segment,
      messageType: type,
      segmentType: subtype,
      firstNonEmptyLine: {
        lineNumber: significantLine.lineNumber,
        text: significantLine.text,
      },
    };
  }

  /**
   * Finds first significant line in a segment
   * Scans lines to find first with non-whitespace content that is not a comment or directive
   */
  private findSignificantLine(lines: LineContext[]): LineContext | null {
    for (const line of lines) {
      const trimmed = line.text.trim();
      // Skip empty lines, comments (starting with #), and directives (starting with @)
      if (
        trimmed.length > 0 &&
        !trimmed.startsWith('#') &&
        !trimmed.startsWith('@')
      ) {
        return line;
      }
    }
    return null;
  }

  /**
   * Detects if a line represents a request or response
   *
   * input: "HTTP/1.1 200 OK"
   * output: "response"
   *
   * input: "POST /api/users HTTP/1.1"
   * output: "request"
   */
  private detectMessageType(text: string): MessageType {
    const normalized = text.trimStart().toUpperCase();
    if (normalized.startsWith('HTTP/')) {
      return 'response';
    }
    return 'request';
  }

  /**
   * Detects the subtype of a request
   *
   * input: lines, first line index
   * output: "http" | "curl" | "graphql"
   */
  private detectSegmentType(
    lines: LineContext[],
    significantLineIndex: number
  ): SegmentType {
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
