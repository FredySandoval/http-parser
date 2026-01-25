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

const result = parseHttp(`GET https://api.example.com/users
Authorization: Bearer token123
Content-Type: application/json

{
  "name": "John Doe"
}`);

console.dir(result, { depth: null });
```

### Using the Parser Class

```typescript
import { HttpRequestParser } from '@fredy/http-parser';

const parser = new HttpRequestParser({ 
  encoding: 'UTF-8', 
  strict: false 
});

// Parse from string
const textResult = parser.parseText('GET https://example.com');

// Parse from stream
const streamResult = await parser.parseStream(readableStream);
```

### Stream Parsing

```typescript
import { parseHttpStream } from '@fredy/http-parser';
import fs from 'fs';

const stream = fs.createReadStream('requests.http');
const result = await parseHttpStream(stream);

console.log(result.ast.requests.length);
```

## Output Structure

The parser produces a structured AST with the following format:

```typescript
interface ParseResult {
  text: string;
  metadata: ParseMetadata;
  lineContexts: LineContext[];
  segments: Segment[];
  ast: HttpRequestAST;
}

interface HttpRequestAST {
  metadata: ParseMetadata;
  requests: Request[];
  fileVariables: FileVariable[];
}

interface Request {
  name: string | null;
  method: string;
  url: string;
  httpVersion: string | null;
  queryParams: QueryParam[];
  headers: Header[];
  body: Body | null;
  variables: {
    file: FileVariable[];
    prompt: PromptVariable[];
    request: RequestVariable[];
  };
  settings: RequestSetting[];
  comments: string[];
  rawTextRange: { startLine, endLine };
  expectedResponse: ExpectedResponse | null;
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

#### GraphQL Request

```http
POST https://api.example.com/graphql
X-REQUEST-TYPE: GraphQL
Content-Type: application/json

query GetUser($id: ID!) {
  user(id: $id) {
    name
    email
  }
}

{
  "id": "123"
}
```

#### cURL Request

```http
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Doe"}'
```

#### File Reference Body

```http
POST https://api.example.com/upload
Content-Type: application/json

<@ ./data.json
```

## Variable System

The parser supports various types of variables:

### File Variables

```http
@baseUrl = https://api.example.com
@token = abc123

GET {{baseUrl}}/users
Authorization: Bearer {{token}}
```

### Prompt Variables

```http
# @prompt username Your username
# @prompt password Your password (will be masked)

POST https://api.example.com/login
Content-Type: application/json

{
  "username": "{{username}}",
  "password": "{{password}}"
}
```

### Request Variables

```http
# @name login
POST https://api.example.com/login
Content-Type: application/json

{
  "username": "test",
  "password": "test"
}

###

@authToken = {{login.response.headers.X-Auth-Token}}

GET https://api.example.com/users
Authorization: Bearer {{authToken}}
```

### System Variables

```http
GET https://api.example.com/users/{{$guid}}
X-Timestamp: {{$timestamp}}
X-Date: {{$datetime iso8601}}
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
