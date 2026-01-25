import type { LineContext } from '../scanner/line-scanner';

/**
 * FileReference represents a file inclusion in the body.
 */
export interface FileReference {
  path: string;
  encoding?: string;
  processVariables: boolean;
}

/**
 * GraphQLBody represents the query and optional variables of a GraphQL request.
 */
export interface GraphQLBody {
  query: string;
  variables?: string;
}

/**
 * FormParam represents a key-value pair in a form-urlencoded body.
 */
export interface FormParam {
  key: string;
  value: string;
}

/**
 * BodyObject represents the structured content of a request or response body.
 */
export interface BodyObject {
  type: 'raw' | 'file-ref' | 'form-urlencoded' | 'graphql';
  raw?: string;
  fileRef?: FileReference;
  graphql?: GraphQLBody;
  formParams?: FormParam[];
}

/**
 * Input for the BodyParser.
 */
export interface BodyParserInput {
  lines: LineContext[];
  contentType?: string;
  isGraphQL: boolean;
}

/**
 * BodyParser handles parsing of request and response bodies.
 * Supports:
 * - GraphQL (query and variables)
 * - x-www-form-urlencoded
 * - File references (< path, <@ path, <@encoding path)
 * - Raw inline body (JSON, XML, etc.)
 */
export class BodyParser {
  /**
   * Parses the body from an array of lines based on context.
   *
   * @param input Input containing lines and metadata (contentType, isGraphQL)
   * @returns Structured BodyObject
   */
  parse(input: BodyParserInput): BodyObject {
    const { lines, contentType, isGraphQL } = input;

    if (lines.length === 0) {
      return { type: 'raw', raw: '' };
    }

    if (isGraphQL) {
      return this.parseGraphQL(lines);
    }

    if (contentType === 'application/x-www-form-urlencoded') {
      return this.parseFormUrlEncoded(lines);
    }

    // Check the first line for a file reference
    // Note: Spec says "Body lines starting with < indicate a file reference."
    // Usually if the first line starts with <, the whole body is a file reference
    // UNLESS it's multipart, but the pseudo code implies a choice here.
    const firstLineTrimmed = lines[0]!.text.trim();
    if (firstLineTrimmed.startsWith('<')) {
      return this.parseFileReference(lines[0]!.text);
    }

    // Default to raw body
    return {
      type: 'raw',
      raw: lines.map((l) => l.text).join('\n'),
    };
  }

  /**
   * Parses GraphQL body, splitting query and variables at the first blank line.
   */
  private parseGraphQL(lines: LineContext[]): BodyObject {
    let blankLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.text.trim() === '') {
        blankLineIndex = i;
        break;
      }
    }

    if (blankLineIndex !== -1) {
      const queryLines = lines.slice(0, blankLineIndex);
      const variableLines = lines.slice(blankLineIndex + 1);

      return {
        type: 'graphql',
        graphql: {
          query: queryLines.map((l) => l.text).join('\n'),
          variables:
            variableLines
              .map((l) => l.text)
              .join('\n')
              .trim() || undefined,
        },
      };
    }

    return {
      type: 'graphql',
      graphql: {
        query: lines.map((l) => l.text).join('\n'),
      },
    };
  }

  /**
   * Parses x-www-form-urlencoded body.
   */
  private parseFormUrlEncoded(lines: LineContext[]): BodyObject {
    const formParams: FormParam[] = [];

    for (const line of lines) {
      let text = line.text.trim();
      if (text === '') continue;

      // Handle continuations (lines starting with &)
      if (text.startsWith('&')) {
        text = text.slice(1).trim();
      }

      if (!text) continue;

      const eqIndex = text.indexOf('=');
      if (eqIndex !== -1) {
        formParams.push({
          key: text.slice(0, eqIndex).trim(),
          value: text.slice(eqIndex + 1).trim(),
        });
      } else {
        formParams.push({ key: text, value: '' });
      }
    }

    return {
      type: 'form-urlencoded',
      formParams,
    };
  }

  /**
   * Parses file reference syntax: < path, <@ path, <@encoding path
   */
  private parseFileReference(lineText: string): BodyObject {
    const trimmed = lineText.trim();
    let path = '';
    let encoding: string | undefined;
    let processVariables = false;

    if (trimmed.startsWith('<@')) {
      processVariables = true;
      // <@encoding path or <@ path
      const afterAt = trimmed.slice(2).trim();
      const spaceIndex = afterAt.indexOf(' ');

      if (spaceIndex !== -1) {
        // Potential encoding
        const potentialEncoding = afterAt.slice(0, spaceIndex).trim();
        // Check if it's a known encoding or just part of the path?
        // Spec says "<@encoding path".
        encoding = potentialEncoding;
        path = afterAt.slice(spaceIndex + 1).trim();
      } else {
        // Just path: <@ path
        path = afterAt;
      }
    } else if (trimmed.startsWith('<')) {
      // < path
      path = trimmed.slice(1).trim();
    }

    return {
      type: 'file-ref',
      fileRef: {
        path,
        encoding,
        processVariables,
      },
    };
  }
}
