import type { LineContext } from './line-scanner';

/**
 * VariableKind represents the category of the variable reference.
 */
export enum VariableKind {
  /** System variables like {{$guid}} */
  System = 'system',
  /** Request variables like {{login.response.body.$.id}} */
  Request = 'request',
  /** Custom variables like {{host}} */
  Custom = 'custom',
}

/**
 * VariableReference stores metadata about a {{...}} reference found in a line.
 */
export interface VariableReference {
  /** The kind of variable */
  kind: VariableKind;
  /** The trimmed text inside the curly braces (e.g., "$guid", "host", or the full request var path) */
  name: string;
  /** The original {{...}} text from the source */
  raw: string;
  /** 0-indexed start offset within the line's text */
  offset: number;
  /** Length of the raw reference string */
  length: number;

  /** Name of the system function (e.g., "$guid") */
  systemName?: string;
  /** Parameters for the system function */
  params?: string;

  /** The name of the request being referenced */
  requestName?: string;
  /** Whether it references the request or response */
  source?: 'request' | 'response';
  /** Which part of the request/response is referenced */
  part?: 'body' | 'headers';
  /** JSONPath, XPath, or Header name */
  path?: string;
}

/**
 * LineWithVariables extends LineContext to include the detected variable references.
 */
export interface LineWithVariables extends LineContext {
  /** List of variable references found in this line */
  variables: VariableReference[];
}

/**
 * SystemVariableScanner
 *
 * First pass of the per-segment parser.
 * Identifies all {{...}} references in all lines of a segment and classifies them.
 * This happens before any other parsing to ensure variables are recognized everywhere
 * (URL, Headers, Body, etc.).
 */
export class SystemVariableScanner {
  /** Pattern to match {{...}} tags */
  private static readonly VAR_PATTERN = /\{\{([\s\S]*?)\}\}/g;

  /** Pattern for request variables: {{requestName.(request|response).(body|headers).path}} */
  private static readonly REQUEST_VAR_PATTERN =
    /^([^.]+)\.(request|response)\.(body|headers)\.(.+)$/;

  /**
   * Scans a list of lines for variable references.
   *
   * @param lines - The lines from a classified segment
   * @returns Array of lines enriched with variable metadata
   */
  scan(lines: LineContext[]): LineWithVariables[] {
    return lines.map((line) => {
      const variables: VariableReference[] = [];
      let match: RegExpExecArray | null;

      // Reset regex state because of 'g' flag
      SystemVariableScanner.VAR_PATTERN.lastIndex = 0;

      while (
        (match = SystemVariableScanner.VAR_PATTERN.exec(line.text)) !== null
      ) {
        const raw = match[0];
        const inner = (match[1] || '').trim();
        const offset = match.index;
        const length = raw.length;

        const ref = this.parseVariable(inner, raw, offset, length);
        variables.push(ref);
      }

      return {
        ...line,
        variables,
      };
    });
  }

  /**
   * Determines the kind of variable and extracts its components.
   *
   * @param inner - The trimmed text inside {{ }}
   * @param raw - The full {{ }} string
   * @param offset - Start position in line
   * @param length - Total length of {{ }}
   */
  private parseVariable(
    inner: string,
    raw: string,
    offset: number,
    length: number
  ): VariableReference {
    // 1. System Variable: starts with $
    if (inner.startsWith('$')) {
      const spaceIndex = inner.indexOf(' ');
      const systemName =
        spaceIndex === -1 ? inner : inner.substring(0, spaceIndex);
      const params =
        spaceIndex === -1 ? '' : inner.substring(spaceIndex + 1).trim();

      return {
        kind: VariableKind.System,
        name: inner,
        raw,
        offset,
        length,
        systemName,
        params: params || undefined,
      };
    }

    // 2. Request Variable: contains dots and matches the pattern
    const requestMatch = inner.match(SystemVariableScanner.REQUEST_VAR_PATTERN);
    if (requestMatch) {
      return {
        kind: VariableKind.Request,
        name: inner,
        raw,
        offset,
        length,
        requestName: requestMatch[1],
        source: requestMatch[2] as 'request' | 'response',
        part: requestMatch[3] as 'body' | 'headers',
        path: requestMatch[4],
      };
    }

    // 3. Custom Variable: everything else
    return {
      kind: VariableKind.Custom,
      name: inner,
      raw,
      offset,
      length,
    };
  }
}

/**
 * SystemVariableRegistry
 *
 * Manages known system functions and their parameter rules.
 * Currently serves as a reference for supported system variables.
 */
export class SystemVariableRegistry {
  private static readonly SUPPORTED_SYSTEM_VARS = new Set([
    '$guid',
    '$randomInt',
    '$timestamp',
    '$datetime',
    '$localDatetime',
    '$processEnv',
    '$dotenv',
    '$aadToken',
  ]);

  /**
   * Checks if a system variable name is supported.
   *
   * @param name - The system variable name (including $)
   */
  static isSupported(name: string): boolean {
    return this.SUPPORTED_SYSTEM_VARS.has(name);
  }

  /**
   * Gets the list of all supported system variable names.
   */
  static getSupportedVariables(): string[] {
    return Array.from(this.SUPPORTED_SYSTEM_VARS);
  }
}
