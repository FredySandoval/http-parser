// ============================================================
// BASE BODY INTERFACE 
// ============================================================
interface BodyBase {
  raw: string;
  contentType: string | null;
  size: number;
}

// Success 
export interface ParsedBody<T> extends BodyBase {
  status: "parsed";
  content: T;
}
// Failure
export interface UnparsedBody extends BodyBase {
  status: "error";
  error: {
    message: string;
    lineNumber?: number;
  };
}

export interface HttpBody {
  protocol: 'http';
  body: HttpBodyContent; // This can be further refined to specific content types (JSON, form, etc.) in the future if needed.
}

export type BodyResult<T> = 
  ParsedBody<T> | 
  UnparsedBody;

export type HttpBodyResult = 
  BodyResult<HttpBody>;
// representation:
// type HttpBodyResult = {
//     status: "error";
//     error: {
//         message: string;
//         lineNumber?: number | undefined;
//     };
//     raw: string;
//     contentType: string | null;
//     size: number;
// } | {
//     status: "parsed";
//     content: HttpBody;
//     raw: string;
//     contentType: string | null;
//     size: number;
// }

// ============================================================
// CONTENT TYPES FOR EACH BODY TYPE
// ============================================================
/** HTTP/cURL body content types */
export type HttpBodyContent =
  | JsonContent
  | TextContent
  | FormContent
  | MultipartContent
  | BinaryContent;
// ============================================================
// SHARED CONTENT TYPE DEFINITIONS
// ============================================================
export interface JsonContent<T = unknown> {
  kind: 'json';
  data: T;
}

export interface TextContent {
  kind: 'text';
  text: string;
}

export interface FormContent {
  kind: 'form';
  fields: Record<string, string | string[]>;
}

export interface MultipartContent {
  kind: 'multipart';
  boundary?: string;
  parts: FormPart[];
}

export interface BinaryContent {
  kind: 'binary';
  encoding?: 'base64' | 'hex';
  data: string | Uint8Array;
}

export interface FormPart {
  name: string;
  value: string | Uint8Array;
  filename?: string;
  contentType?: string;
  headers?: Record<string, string>;
}

export interface FileReference {
  kind: 'file-ref';
  id?: string;
  path?: string;
  url?: string;
}
