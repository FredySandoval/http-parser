import type { Header } from './parsers/header-parser';
import type { QueryParam } from './parsers/query-parser';
import type {
  FileVariable,
  PromptVariable,
  RequestSetting,
} from './scanner/variable-scanner';
import type { VariableReference } from './scanner/system-variable-scanner';
import type { BodyObject } from './parsers/body-parser';
import type { ParseMetadata } from './parser';

/**
 * ExpectedResponse Object (AST)
 * Represents a parsed response block associated with a request.
 */
export interface ExpectedResponse {
  /** HTTP Status Code (e.g., 200, 201) */
  statusCode: number;
  /** Status Text (e.g., OK, Created) */
  statusText: string | null;
  /** HTTP Protocol Version (e.g., HTTP/1.1) */
  httpVersion: string | null;
  /** Response Headers */
  headers: Header[];
  /** Response Body (Raw string or parsed Object if JSON) */
  body: string | object | null;
  /** Variable definitions and references found within this response scope */
  variables: {
    /** Local file variable definitions found in this segment (@var = val) */
    file: FileVariable[];
  };
  /** Range in the original text */
  rawTextRange: {
    startLine: number;
    endLine: number;
  };
}

/**
 * Request Object (AST)
 * Represents a single parsed HTTP request block.
 */
export interface Request {
  /** Identifies the request (from @name directive) */
  name: string | null;
  /** HTTP Method (e.g., GET, POST) */
  method: string;
  /** Target URL */
  url: string;
  /** HTTP Protocol Version (e.g., HTTP/1.1) */
  httpVersion: string | null;
  /** Query parameters (inline and multiline continuations) */
  queryParams: QueryParam[];
  /** HTTP Headers */
  headers: Header[];
  /** Request Body (Structured) */
  body: BodyObject | null;
  /** Variable definitions and references found within this request scope */
  variables: {
    /** Local file variable definitions (@var = val) */
    file: FileVariable[];
    /** Prompt variable definitions (# @prompt var) */
    prompt: PromptVariable[];
    /** References to other requests found in this request ({{req.resp.body...}}) */
    request: VariableReference[];
  };
  /** Per-request settings (from @setting directives) */
  settings: RequestSetting[];
  /** Regular comments found within the request block */
  comments: string[];
  /** Range in the original text */
  rawTextRange: {
    startLine: number;
    endLine: number;
  };
  /** Associated expected response block (if any) */
  expectedResponse: ExpectedResponse | null;
}

/**
 * Overall HttpRequestAST
 * The final product of the parsing pipeline.
 */
export interface HttpRequestAST {
  /** Metadata about the input source */
  metadata: ParseMetadata;
  /** List of all requests found in the input */
  requests: Request[];
  /** All file-scoped variable definitions found across the entire input */
  fileVariables: FileVariable[];
}
