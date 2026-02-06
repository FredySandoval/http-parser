# HTTP Parser

A standalone parser for REST client HTTP files, that transforms plain text HTTP requests into structured, machine-readable objects. Perfect for building API tools, clients, and integrations.

## Features

- **Parse HTTP Requests**: Supports standard HTTP request syntax with all common features
- **Multiple Input Sources**: Parse from strings, streams, or async iterables
- **Advanced Features**:
  - GraphQL request parsing
  - cURL command parsing
  - Variable support (file, prompt, request, system variables)
  - File reference bodies
  - Form data and URL-encoded bodies
  - Multi-part requests
  - Request settings and annotations

## Installation

```bash
npm install @fredy/http-parser
```

## Usage

### Quick Start

```typescript
import { parseHttp } from '@fredy/http-parser';

const result: ParseResult = parseHttp(`GET https://api.example.com/users
Authorization: Bearer token123
Content-Type: application/json

{
  "name": "John Doe"
}`);

console.dir(result, { depth: null });
```

## Output Structure

The parser produces a structured AST with the following format:

```ts
interface ParseResult {
  text: string;
  metadata: ParseMetadata;
  lineContexts: LineContext[];
  segments: Segment[];
  ast: HttpRequestAST;
}

interface ParseMetadata {
  length: number;
  lines: number;
  encoding: string;
  source: SourceMetadata;
}

interface SourceMetadata {
  type: 'string' | 'stream';
  name?: string;
}

interface LineContext {
  lineNumber: number;
  startOffset: number;
  endOffset: number;
  text: string;
}

interface HttpRequestAST {
  requests: Request[];
}

interface Request {
  name: string | null;
  method: string;
  url: string;
  httpVersion: string | null;
  queryParams: QueryParam[];
  headers: Header[];
  body: BodyObject | null;
  variables: {
    fileVariables: FileVariable[];
  };
  comments: string[];
  rawTextRange: { startLine, endLine };
  expectedResponse: ExpectedResponse | null;
}

interface ExpectedResponse {
  statusCode: number;
  statusText: string | null;
  httpVersion: string | null;
  headers: Header[];
  body: string | object | null;
  variables: {
    fileVariables: FileVariable[];
  };
  rawTextRange: {
    startLine: number;
    endLine: number;
  };
}

interface FileVariable {
  key: string;
  value: string;
  lineNumber: number;
}

interface BodyObject {
  type: 'raw' | 'file-ref' | 'form-urlencoded' | 'graphql';
  raw?: string;
  fileRef?: FileReference;
  graphql?: GraphQLBody;
  formParams?: FormParam[];
}

interface FileReference {
  path: string;
  encoding?: string;
  processVariables: boolean;
}
interface GraphQLBody {
  query: string;
  variables?: string;
}
interface FormParam {
  key: string;
  value: string;
}
```

## Supported Syntax

### HTTP Request Examples

#### Basic Request

```http
GET https://api.example.com/users HTTP/1.1
Authorization: Bearer token123
Content-Type: application/json

{
  "name": "John Doe"
}
```

### File Variables

```http
@baseUrl = https://api.example.com
@token = abc123

GET {{baseUrl}}/users
Authorization: Bearer {{token}}
```

## Development

### Building

```bash
bun run build
```

### Testing

```bash
bun test
```

### Linting

```bash
npm run format
```

## Contributing

Contributions are welcome! Please read the [contributing guidelines](CONTRIBUTING.md) for more information.

## License

MIT License - see [LICENSE](LICENSE) file for details.
