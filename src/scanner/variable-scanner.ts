import type { LineContext } from './line-scanner';

/**
 * Represents a file-scoped variable definition.
 * Example: @baseUrl = https://api.com
 */
export interface FileVariable {
  key: string;
  value: string;
  lineNumber: number;
}

/**
 * Represents a prompt variable definition.
 * Example: # @prompt otp Enter code
 */
export interface PromptVariable {
  name: string;
  description: string | null;
  lineNumber: number;
}

/**
 * Represents a request setting.
 * Example: # @no-redirect
 */
export interface RequestSetting {
  name: string;
  value: string | null;
  lineNumber: number;
}

/**
 * Result of scanning a segment for variables and metadata.
 */
export interface VariableScanResult {
  requestName: string | null;
  requestNameLine: number | null;
  fileVariables: FileVariable[];
  prompts: PromptVariable[];
  settings: RequestSetting[];
}

/**
 * VariableScanner
 * Scans lines for variable definitions, request names, prompts, and settings.
 */
export class VariableScanner {
  /**
   * Helper to unescape string values (e.g. \n -> newline)
   */
  private unescape(value: string): string {
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Scans the lines of a segment to extract variables and metadata.
   *
   * @param lines - Array of LineContext objects to scan
   * @returns VariableScanResult containing extracted data
   */
  scan(lines: LineContext[]): VariableScanResult {
    const result: VariableScanResult = {
      requestName: null,
      requestNameLine: null,
      fileVariables: [],
      prompts: [],
      settings: [],
    };

    for (const line of lines) {
      const text = line.text.trim();
      if (!text) continue;

      // 1. File Variables: @variableName = value
      if (text.startsWith('@') && text.includes('=')) {
        const equalIndex = text.indexOf('=');
        const key = text.substring(1, equalIndex).trim();
        // Variable name cannot contain spaces
        if (!key.includes(' ')) {
          let value = text.substring(equalIndex + 1).trim();
          value = this.unescape(value);
          result.fileVariables.push({
            key,
            value,
            lineNumber: line.lineNumber,
          });
          continue;
        }
      }

      // 2. Comments/Directives: # ... or // ...
      if (text.startsWith('#') || text.startsWith('//')) {
        const cleanText = text.replace(/^(#|\/\/)\s*/, '').trim();

        // 2a. Request Name: @name requestName
        if (cleanText.startsWith('@name ')) {
          result.requestName = cleanText.substring(6).trim();
          result.requestNameLine = line.lineNumber;
          continue;
        }

        // 2b. Prompt: @prompt varName [description]
        if (cleanText.startsWith('@prompt ')) {
          const parts = cleanText.substring(8).trim().split(/\s+/);
          if (parts.length > 0) {
            const name = parts[0];
            if (name) {
              const description = parts.slice(1).join(' ') || null;
              result.prompts.push({
                name,
                description,
                lineNumber: line.lineNumber,
              });
            }
          }
          continue;
        }

        // 2c. Settings: @settingName [value]
        // Known settings: @note, @no-redirect, @no-cookie-jar
        // But generally anything starting with @ that is NOT name or prompt in a comment block
        if (cleanText.startsWith('@')) {
          const parts = cleanText.split(/\s+/);
          const settingNamePart = parts[0];

          if (settingNamePart) {
            const settingName = settingNamePart.substring(1); // remove @

            // Filter out @name and @prompt if they somehow got here (already handled above)
            if (settingName === 'name' || settingName === 'prompt') continue;

            const settingValue = parts.slice(1).join(' ') || null;
            result.settings.push({
              name: settingName,
              value: settingValue,
              lineNumber: line.lineNumber,
            });
          }
          continue;
        }
      }
    }

    return result;
  }
}

/**
 * VariableRegistry
 * Stores and manages variable values.
 */
export class VariableRegistry {
  private variables = new Map<string, string>();

  /**
   * Retrieves the value of a stored variable.
   * @param name - The name of the variable
   */
  get(name: string): string | undefined {
    return this.variables.get(name);
  }

  /**
   * Stores or updates a variable value.
   * @param name - The name of the variable
   * @param value - The value to store
   */
  set(name: string, value: string): void {
    this.variables.set(name, value);
  }

  /**
   * Returns all currently stored variables.
   */
  getAll(): Record<string, string> {
    return Object.fromEntries(this.variables);
  }
}
