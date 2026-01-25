/**
 * RequestLine represents the parsed components of an HTTP request line.
 */
export interface RequestLine {
  method: string;
  url: string;
  httpVersion: string | null;
}

/**
 * RequestLineParser responsible for parsing text into structured RequestLine object.
 *
 * Valid formats:
 * 1. METHOD URL/PATH PROTOCOL-VERSION
 *    Example: POST https://example.com/api HTTP/1.1
 *
 * 2. METHOD URL/PATH
 *    Example: GET https://example.com/api
 *
 * 3. URL only
 *    Example: https://example.com/api
 *    (Default method: GET)
 */
export class RequestLineParser {
  /**
   * Parses a raw request line string into structured components.
   *
   * @param text The raw text of the request line
   * @returns RequestLine object containing method, url, and optional httpVersion
   */
  parse(text: string): RequestLine {
    // 1. Normalize input (trim whitespace)
    const trimmed = text.trim();

    if (!trimmed) {
      // Should not happen for a valid request line in theory,
      // but return defaults or throw might be appropriate.
      // Given "first non-empty line" rule, this might be empty string?
      // Let's assume input is non-empty or just return default GET & empty URL?
      // Spec doesn't strictly say, but let's be safe.
      return {
        method: 'GET',
        url: '',
        httpVersion: null,
      };
    }

    const parts = trimmed.split(/\s+/);

    // We need to identify parts.
    // Possible patterns (parts length):
    // 1: URL (e.g. "https://example.com") -> method=GET
    // 2: METHOD URL or URL VERSION?
    //    Wait, "URL VERSION" isn't standard.
    //    RFC: Method SP Request-URI SP HTTP-Version CRLF
    //    Or: Method SP Request-URI CRLF
    //    Or: (Custom) URL

    // Let's analyze from the end for HTTP version.
    let httpVersion: string | null = null;
    let lastPartIndex = parts.length - 1;

    if (parts[lastPartIndex]?.toUpperCase().startsWith('HTTP/')) {
      httpVersion = parts[lastPartIndex]!.toUpperCase();
      lastPartIndex--;
    }

    // Re-evaluate parts after removing version
    // remaining parts: [0 ... lastPartIndex]

    // If 0 parts left (was just HTTP/1.1?), that's invalid but let's handle gracefully
    if (lastPartIndex < 0) {
      return { method: 'GET', url: '', httpVersion };
    }

    // If 1 part left:
    //   Could be URL (implied GET)
    //   Could be METHOD (if URL is empty? Unlikely)
    //   Let's assume it is URL if it's the only thing.
    //   UNLESS it looks like a method and we are missing URL?
    //   Spec says: "3. URL only: URL".

    // If > 1 parts left:
    //   First part is METHOD
    //   Second part is URL
    //   (Are there more parts? maybe spaces in URL? No, split by whitespace)

    // Wait, what if the URL contains spaces?
    // Spec 2.6.2 says header values may include spaces, but URLs usually don't.
    // However, usually URLs are encoded.

    let method = 'GET';
    let url = '';

    if (lastPartIndex === 0) {
      // Check if this single part is a known method or URL.
      // If it's a known HTTP method, maybe missing URL?
      // But spec "URL only" implies if 1 token, it is URL.
      // However, typical methods: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
      // If someone types "POST", is it a URL "POST" or method "POST"?
      // Usually we assume URL if it's "URL only".
      // But if text is "POST https://..." it is method.
      // If text is "https://..." it is URL.

      // Let's assume if it is a valid Method string, and followed by nothing, it logic suggests it's a URL named 'POST'?
      // No, logically "URL only" implies the whole line is the URL.
      url = parts[0] ?? '';
    } else {
      // >= 2 parts (excluding version)
      // First is Method, everything else is URL?
      // Actually, if we have Method and URL, we expect 2 parts.
      // If we have more, maybe URL has spaces?
      // "splits component parts by whitespace"

      // Let's assume first token is method if it looks like one, or we enforce "METHOD URL".
      // Spec says: "1. Full RFC style: METHOD URL/PATH PROTOCOL-VERSION"
      // "2. Without HTTP version: METHOD URL/PATH"
      // "3. URL only: URL"

      // So if > 1 part, first is Method, second is URL.
      // If there are extra parts in middle, it's ambiguous.
      // Standard parsing usually assumes Method is first token.

      method = parts[0] ?? '';
      // Valid method?
      // If the user typed "https://example.com/foo bar", split gives ["https://...", "bar"].
      // "https://..." is not a method.
      // So we might need to check if the first part looks like a method.
      // Common methods: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, TRACE, CONNECT, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK.
      // Also custom methods are allowed ("PURGE /cache").

      // Heuristic: If first part is a URL (starts with http, /), then it is "URL only" case?
      // But "URL only" usually means the *whole line* is the URL.
      // If we have "https://example.com/foo bar", is "https://..." the method? No.
      // So "URL only" really applies when the line doesn't start with a Method.

      // But how do we distinguish "CustomMethod URL" from "URL"?
      // "PURGE /cache" -> PURGE is method.
      // "/cache" -> /cache is URL (default GET).

      // If we assume standard RFC structure: Method SP Request-URI
      // Then any 2 tokens are Method + URL.
      // If 1 token, it is URL.

      // What if "https://example.com" (1 token) -> URL.
      // What if "/api/users" (1 token) -> URL.
      // What if "POST" (1 token) -> URL="POST"?

      // Let's check if the first token looks like a URL?
      // If it starts with `http://` or `https://` or `/`, it is likely a URL.
      // But "PURGE /cache" -> PURGE doesn't start with /.

      // Let's blindly follow the split counts for now, but be careful.
      // If we have "METHOD URL", we take first as method.
      // If we have "URL", we take it as URL.

      // Actually, "URL only" implies the line *is* the URL.
      // If we have 2 parts, and the first part is NOT a known method?
      // Spec says "Handles parsing of custom methods if present".
      // So we can't restrict to known methods.

      // Maybe the logic is:
      // If 1 part: URL.
      // If >= 2 parts: Method + URL.

      // Example: "https://google.com" -> 1 part -> URL="https://google.com", Method="GET".
      // Example: "POST /api" -> 2 parts -> Method="POST", URL="/api".
      // Example: "POST /api HTTP/1.1" -> 3 parts -> (Version extracted), 2 parts left -> Method="POST", URL="/api".

      // What about "https://example.com/foo bar"? (URL with space?)
      // If we treat it as Method="https://example.com/foo", URL="bar"... that seems wrong.
      // But spaces in URL must be encoded usually.
      // If user writes "GET /path with space HTTP/1.1", that's invalid formatting usually.

      method = parts[0] ?? '';
      url = parts.slice(1, lastPartIndex + 1).join(' '); // Join remainder as URL?
    }

    return {
      method,
      url,
      httpVersion,
    };
  }
}
