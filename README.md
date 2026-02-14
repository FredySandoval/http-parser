# HTTP Parser

A standalone parser for REST client HTTP files, that transforms plain text HTTP requests into structured, machine-readable objects. Perfect for building API tools, clients, and integrations.

## Features

- **Parse HTTP Requests**: Supports standard HTTP request syntax with all common features
- **Advanced Features**:
  - Variable support

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

## Supported Syntax

### File Variables

Define variables at block and file level:

```http
@baseUrl = https://api.example.com
@contentType = application/json

###
GET {{baseUrl}}/users HTTP/1.1
Content-Type: {{contentType}}

###
# Use the created user's ID in next request
GET https://api.example.com/users/123 HTTP/1.1
Accept: application/json

###
@baseUrl = http://localhost:3000
POST {{baseUrl}}/users HTTP/1.1
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}

###
HTTP/1.1 201 Created
Content-Type: application/json
Location: {{baseUrl}}/users/123
```

### Variable Scopes In AST

- `ast.globalVariables.fileVariables`: all variable declarations found across all segments.
- `ast.fileScopedVariables.fileVariables`: only declarations that appear before the first `###` delimiter (true file scope).
- `request.blockVariables.fileVariables`: declarations inside that request's segment only.
