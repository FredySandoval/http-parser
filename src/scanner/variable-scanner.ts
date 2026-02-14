import type {
  FileComment,
  FileVariable,
  ScanResult,
  Segment,
} from '../types/types';

/**
 * input: [
 *   { segmentId: 0, startLine: 1, endLine: 3, lines: [...] },
 *   { segmentId: 1, startLine: 5, endLine: 7, lines: [...] }
 * ]
 * output: {
 *   fileVariables: [
 *     { key: 'baseUrl', value: 'https://api.example.com', lineNumber: 1, segmentId: null },
 *     { key: 'contentType', value: 'application/json', lineNumber: 2, segmentId: null },
 *     { key: 'baseUrl', value: 'http://localhost:3000', lineNumber: 6, segmentId: 1 }
 *   ],
 *   fileComments: [
 *     { text: 'Use the created user ID', lineNumber: 4, segmentId: null }
 *   ]
 * }
 */
export class VariableScanner {
  /**
   * Pattern to match variable definitions: @name = value
   * Matches @ at start of line, followed by name, optional whitespace, =, optional whitespace, value
   * Value can be empty (.* matches zero or more characters)
   */
  private static readonly VARIABLE_PATTERN = /^\s*@(\w+)\s*=\s*(.*)$/;

  /**
   * Pattern to match comment lines: # comment text
   * Must start with # and have content after optional whitespace
   */
  private static readonly COMMENT_PATTERN = /^\s*#\s*(.+)$/;

  scan(segments: Segment[]): ScanResult {
    const result: ScanResult = {
      fileVariables: this.scanFileVariables(segments),
      fileComments: this.scanFileComments(segments),
    };
    return result;
  }

  private scanFileVariables(segments: Segment[]): FileVariable[] {
    const variables: FileVariable[] = [];

    for (const segment of segments) {
      for (const line of segment.lines) {
        const match = line.text.match(VariableScanner.VARIABLE_PATTERN);
        if (match && match[1]) {
          variables.push({
            key: match[1],
            value: match[2]?.trim() ?? '',
            lineNumber: line.lineNumber,
            segmentId: segment.segmentId,
          });
        }
      }
    }

    return variables;
  }

  private scanFileComments(segments: Segment[]): FileComment[] {
    const comments: FileComment[] = [];

    for (const segment of segments) {
      for (const line of segment.lines) {
        const match = line.text.match(VariableScanner.COMMENT_PATTERN);
        if (match && match[1]) {
          comments.push({
            text: match[1].trim(),
            lineNumber: line.lineNumber,
            segmentId: segment.segmentId,
          });
        }
      }
    }

    return comments;
  }
}

/**
 * manages variable storage and retrieval
 */
export class VariableRegistry {
  private variables: Map<string, string> = new Map();
  private segmentVariables: Map<number, Map<string, string>> = new Map();

  get(name: string): string | undefined {
    return this.variables.get(name);
  }

  set(name: string, value: string): void {
    this.variables.set(name, value);
  }

  getAllBySegmentId(id: number): Record<string, string> {
    const segmentMap = this.segmentVariables.get(id);
    if (!segmentMap) {
      return {};
    }
    return Object.fromEntries(segmentMap);
  }

  getAll(): Record<string, string> {
    return Object.fromEntries(this.variables);
  }

  /**
   * Sets a variable for a specific segment
   */
  setForSegment(segmentId: number, name: string, value: string): void {
    if (!this.segmentVariables.has(segmentId)) {
      this.segmentVariables.set(segmentId, new Map());
    }
    this.segmentVariables.get(segmentId)!.set(name, value);
  }

  /**
   * Gets a variable, checking segment-specific first, then global
   */
  getWithSegment(segmentId: number, name: string): string | undefined {
    const segmentMap = this.segmentVariables.get(segmentId);
    if (segmentMap?.has(name)) {
      return segmentMap.get(name);
    }
    return this.variables.get(name);
  }
}
