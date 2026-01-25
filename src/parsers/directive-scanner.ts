import type { LineContext } from '../scanner/line-scanner';

/**
 * Result of the DirectiveScanner.
 */
export interface DirectiveScannerResult {
  /** Lines that provide metadata (# @name, # @prompt, @var = value) */
  directives: LineContext[];
  /** Regular comment lines (# comment, // comment) */
  comments: LineContext[];
  /** Actual request/response content lines */
  content: LineContext[];
}

/**
 * DirectiveScanner separates lines into three categories: directives, comments, and content.
 *
 * According to specification:
 * - Directives: # @name, # @prompt, # @setting, // @name, or @var = value.
 * - Comments: # or // (that are not directives).
 * - Content: Request lines, headers, body, etc.
 */
export class DirectiveScanner {
  /**
   * Regular expression to match file variable definitions: @varName = value
   */
  private static readonly FILE_VAR_PATTERN = /^\s*@[^=\s]+\s*=/;

  /**
   * Scans an array of lines and categorizes them.
   */
  scan(lines: LineContext[]): DirectiveScannerResult {
    const result: DirectiveScannerResult = {
      directives: [],
      comments: [],
      content: [],
    };

    for (const line of lines) {
      const text = line.text;
      const trimmed = text.trim();

      if (trimmed.startsWith('# @') || trimmed.startsWith('// @')) {
        // Functional comment (directive)
        result.directives.push(line);
      } else if (DirectiveScanner.FILE_VAR_PATTERN.test(text)) {
        // File variable definition (@var = value)
        result.directives.push(line);
      } else if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
        // Regular comment
        result.comments.push(line);
      } else {
        // Actual content
        result.content.push(line);
      }
    }

    return result;
  }
}
