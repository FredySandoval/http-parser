/**
 * ResponseLine represents the parsed components of an HTTP response line.
 */
export interface ResponseLine {
  httpVersion: string | null;
  statusCode: number | null;
  statusText: string | null;
}

/**
 * ResponseLineParser responsible for parsing text into structured ResponseLine object.
 *
 * Valid formats:
 * 1. PROTOCOL-VERSION STATUS-CODE STATUS-MESSAGE
 *    Example: HTTP/1.1 200 OK
 *
 * 2. STATUS-CODE STATUS-MESSAGE
 *    Example: 404 Not Found
 *
 * 3. STATUS-CODE or STATUS-MESSAGE only
 *    Example: 200
 *    Example: OK
 */
export class ResponseLineParser {
  /**
   * Parses a raw response line string into structured components.
   *
   * @param text The raw text of the response line
   * @returns ResponseLine object containing httpVersion, statusCode, and statusText
   */
  parse(text: string): ResponseLine {
    const trimmed = text.trim();
    if (!trimmed) {
      return {
        httpVersion: null,
        statusCode: null,
        statusText: null,
      };
    }

    const parts = trimmed.split(/\s+/);
    let currentIndex = 0;
    let httpVersion: string | null = null;
    let statusCode: number | null = null;
    let statusText: string | null = null;

    // 1. Check for Protocol Version
    if (parts[0]?.toUpperCase().startsWith('HTTP/')) {
      httpVersion = parts[0].toUpperCase();
      currentIndex++;
    }

    // If no more parts, return what we have
    if (currentIndex >= parts.length) {
      return { httpVersion, statusCode, statusText };
    }

    // 2. Check for Status Code
    // Attempt to parse the next part as a number
    const partToParse = parts[currentIndex] ?? '';
    const potentialCode = parseInt(partToParse, 10);

    if (!isNaN(potentialCode) && String(potentialCode) === partToParse) {
      // It is a valid number and matches the string (handles "200" vs "200abc" strictly?
      // parseInt("200abc") is 200. We want exact match?
      // "200 OK". parts[currentIndex] is "200".
      // "Internal". parseInt("Internal") is NaN.
      statusCode = potentialCode;
      currentIndex++;
    }

    // 3. Extract Status Text
    // Everything remaining is status text
    if (currentIndex < parts.length) {
      // We need to rejoin the original text parts to preserve spacing?
      // Or just join with single space?
      // "Not Found" -> ["Not", "Found"] -> "Not Found".
      // If the original had multiple spaces "Not   Found", split destroyed them.
      // But we usually normalize status text.
      statusText = parts.slice(currentIndex).join(' ');
    }

    return {
      httpVersion,
      statusCode,
      statusText,
    };
  }
}
