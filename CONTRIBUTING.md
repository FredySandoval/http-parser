# REST Client Parser — Requirements & Specifications
this is a NPM package

## 1. Project Overview

The parser is responsible for transforming **plain text HTTP-like documents** into a **structured, machine-readable representation** of one or more HTTP requests.

Its core responsibilities are:

* Identify and split multiple requests in a single document
* Parse each request into structured components:

  * Request metadata
  * Method, URL, query parameters
  * Headers
  * Body (inline, file reference, multipart, form, GraphQL, etc.)
  * Variable definitions and references
  * Per-request settings and annotations
* Resolve *syntax*, not execution:

  * No HTTP sending
  * No authentication logic
  * No environment switching UI
  * No history, preview, or response handling

The parser produces **objects**, not side effects.

---

## 2. Functional Requirements

### 2.1 Input Scope

The parser must accept:

* UTF-8 text by default

Supported sources:

* string
* stream

---

### 2.2 Request Segmentation

#### 2.2.1 Request Delimiter

* Requests are separated by a delimiter of **three or more consecutive `#` characters** on a line by themselves:

  ```
  ###
  ####
  ```

#### 2.2.2 Parsing Scope

* The entire input is parsed
* Each segment produces **at most one request** or represents **one response**
* Empty segments are ignored

---

### 2.3 Request Object Model (Logical)

Each parsed request must produce an object with at least:

```ts
Request {
  name: string | null
  method: string
  url: string
  httpVersion: string | null
  queryParams: QueryParam[]
  headers: Header[]
  body: Body | null
  variables: {
    file: FileVariable[]
    prompt: PromptVariable[]
    request: RequestVariable[]
  }
  settings: RequestSetting[]
  comments: string[]
  rawTextRange: { startLine, endLine }
  expectedResponse: ExpectedResponse | null
}
```

---

### 2.4 Request Line Parsing

#### 2.4.1 Request Line Definition

* The **first non-empty line** of a request block is the *request line*

Valid formats:

1. Full RFC style:

   ```
   METHOD URL/PATH PROTOCOL-VERSION
   ```
2. Without HTTP version:

   ```
   METHOD URL/PATH
   ```
3. URL only:

   ```
   URL
   ```

#### 2.4.2 Defaults

* If method is omitted → default to `GET`
* If HTTP version is omitted → leave undefined (do not infer)


---

### 2.5 Query String Parsing

#### 2.5.1 Inline Queries

* Query parameters in the URL must be preserved and parsed

Example:

```
GET https://example.com?a=1&b=2
```

#### 2.5.2 Multiline Queries

* Lines immediately following the request line starting with `?` or `&` are query continuations

Example:

```
GET https://example.com
  ?page=2
  &pageSize=10
```

Rules:

* Preserve order
* Combine with existing query string
* Whitespace before `?` or `&` is ignored

---

### 2.6 Header Parsing

#### 2.6.1 Header Section

* Header lines begin immediately after the request line
* Parsing stops at the **first empty line**

#### 2.6.2 Header Syntax

```
Header-Name: Header Value
```

Rules:

* One header per line
* Header name is case-insensitive
* Preserve original casing for output
* Header value may include spaces

---

### 2.7 Body Parsing

The request body begins **after the first empty line following headers**.

#### 2.7.1 Inline Body

* All remaining lines belong to the body
* Preserve formatting and indentation

---

#### 2.7.2 File Reference Body

Body lines starting with `<` indicate a file reference.

| Syntax            | Meaning                               |
| ----------------- | ------------------------------------- |
| `< path`          | Raw file include                      |
| `<@ path`         | File include with variable processing |
| `<@encoding path` | File include with encoding override   |

Rules:

* Leading whitespace after `<` is preserved
* Path may be absolute or relative
* Default encoding: UTF-8

---

#### 2.7.3 Multipart Form Body

* Multipart content is treated as raw text
* `< path` inside multipart must be recognized as file includes
* Boundary handling is not interpreted (parser-only)

---

#### 2.7.4 x-www-form-urlencoded Body

Rules:

* Body may span multiple lines
* Lines starting with `&` are continuations
* Each line is a `key=value` pair
* Preserve order and raw values

---

### 2.8 GraphQL Request Parsing

A request is considered **GraphQL** if header exists:

```
X-REQUEST-TYPE: GraphQL
```

Rules:

* Body consists of:

  * GraphQL query
  * Optional variables JSON
* Query and variables are separated by a **blank line**
* Both parts must be preserved distinctly

---

### 2.9 cURL Request Parsing

If the request text starts with:

```
curl ...
```

Parser must:

* Identify it as a cURL request
* Extract:

  * Method (`-X`)
  * URL
  * Headers (`-H`)
  * Body (`-d`, variants)
* Ignore unsupported flags
* Do not execute or validate semantics

---

### 2.10 Variable System (Parsing Only)

The parser **does not evaluate variables**, but must:

* Detect
* Classify
* Store references
* Preserve resolution precedence metadata

---

#### 2.10.1 Variable Reference Syntax

| Type   | Syntax             |
| ------ | ------------------ |
| Custom | `{{varName}}`      |
| System | `{{$varName ...}}` |

---

### 2.11 File Variables

#### Definition Syntax

```
@variableName = value
```

Rules:

* Must occupy the full line
* Variable name cannot contain spaces
* Value is trimmed
* Supports escape sequences (`\n`)
* Can reference other variables

Scope:

* File-wide
* May appear anywhere

---

### 2.12 Prompt Variables

#### Definition Syntax
With prompt variables, user can input the variables to be used when sending a request. This gives a flexibility to change most dynamic variables without having to change the http file. User can specify more than one prompt variables. The definition syntax of prompt variables is like a single-line comment by adding the syntax before the desired request url with the following syntax // @prompt {var1} or # @prompt {var1}. A variable description is also assignable using // @prompt {var1} {description} or # @prompt {var1} {description} which will prompt an input popup with a desired description message.

The reference syntax is the same as others, follows {{var}}. The prompt variable will override any preceding assigned variable and will never be stored to be used in other requests.

```
@hostname = api.example.com
@port = 8080
@host = {{hostname}}:{{port}}
@contentType = application/json

###
# @prompt username
# @prompt refCode Your reference code display on webpage
# @prompt otp Your one-time password in your mailbox
POST https://{{host}}/verify-otp/{{refCode}} HTTP/1.1
Content-Type: {{contentType}}

{
    "username": "{{username}}",
    "otp": "{{otp}}"
}

```

Rules:

* Must appear before request URL
* Are request-scoped
* May override file or environment variables
* Parser must mark sensitive prompts based on variable name

---

### 2.13 Request Variables (Named Requests)
Request variables are similar to file variables in some aspects like scope and definition location. However, they have some obvious differences. The definition syntax of request variables is just like a single-line comment, and follows // @name requestName or # @name requestName just before the desired request url. You can think of request variable as attaching a name metadata to the underlying request, and this kind of requests can be called with Named Request, while normal requests can be called with Anonymous Request. Other requests can use requestName as an identifier to reference the expected part of the named request or its latest response. Notice that if you want to refer the response of a named request, you need to manually trigger the named request to retrieve its response first, otherwise the plain text of variable reference like {{requestName.response.body.$.id}} will be sent instead.

The reference syntax of a request variable is a bit more complex than other kinds of custom variables. The request variable reference syntax follows {{requestName.(response|request).(body|headers).(*|JSONPath|XPath|Header Name)}}. You have two reference part choices of the response or request: body and headers. For body part, you can use * to reference the full response body, and for JSON and XML responses, you can use JSONPath and XPath to extract specific property or attribute. For example, if a JSON response returns body {"id": "mock"}, you can set the JSONPath part to $.id to reference the id. For headers part, you can specify the header name to extract the header value. Additionally, the header name is case-insensitive.

> If the JSONPath or XPath of body, or Header Name of headers can't be resolved, the plain text of variable reference will be sent instead. And in this case, diagnostic information will be displayed to help you to inspect this. And you can also hover over the request variables to view the actual resolved value.

Below is a sample of request variable definitions and references in an http file.

#### Definition Syntax

```
@baseUrl = https://example.com/api

# @name login
POST {{baseUrl}}/api/login HTTP/1.1
Content-Type: application/x-www-form-urlencoded

name=foo&password=bar

###

@authToken = {{login.response.headers.X-AuthToken}}

# @name createComment
POST {{baseUrl}}/comments HTTP/1.1
Authorization: {{authToken}}
Content-Type: application/json

{
    "content": "fake content"
}

###

@commentId = {{createComment.response.body.$.id}}

# @name getCreatedComment
GET {{baseUrl}}/comments/{{commentId}} HTTP/1.1
Authorization: {{authToken}}

###

# @name getReplies
GET {{baseUrl}}/comments/{{commentId}}/replies HTTP/1.1
Accept: application/xml

###

# @name getFirstReply
GET {{baseUrl}}/comments/{{commentId}}/replies/{{getReplies.response.body.//reply[1]/@id}}
```

Rules:

* Must appear immediately before request line
* Attaches metadata to the request
* Enables request reference syntax

---

#### Request Variable Reference Syntax

```
{{requestName.response.body.$.id}}
{{requestName.response.headers.Header-Name}}
```

Parser responsibilities:

* Parse the reference structure
* Do not resolve values
* Preserve JSONPath / XPath strings
* Header names are case-insensitive

---

### 2.14 System Variables
  * Environments and custom/system variables support
  * Use variables in any place of request(URL, Headers, Body)
  * Support environment, file, request and response custom variables
  * Provide system dynamic variables
    * `{{$guid}}`
    * `{{$randomInt min max}}`
    * `{{$timestamp [offset option]}}`
    * `{{$datetime rfc1123|iso8601 [offset option]}}`
    * `{{$localDatetime rfc1123|iso8601 [offset option]}}`
    * `{{$processEnv [%]envVarName}}`
    * `{{$dotenv [%]variableName}}`
    * `{{$aadToken [new] [public|cn|de|us|ppe] [<domain|tenantId>] [aud:<domain|tenantId>]}}`
  * Easily create/update/delete environments and environment variables in setting file
  * File variables can reference both custom and system variables
  * Support shared environment to provide variables that available in all environments

---

### 2.15 Per-request Settings
REST Client Extension also supports request-level settings for each independent request. The syntax is similar with the request name definition, `# @settingName [settingValue]`, a required setting name as well as the optional setting value. Available settings are listed as following:
#### Syntax

```
# @settingName [value]
```

Supported settings:

Name	Syntax	Description
note	# @note	Use for request confirmation, especially for critical request
no-redirect	# @no-redirect	Don't follow the 3XX response as redirects
no-cookie-jar	# @no-cookie-jar	Don't save cookies in the cookie jar

Rules:

* Settings apply only to the next request
* Multiple settings allowed
* All the above leading # can be replaced with //

---

### 2.16 Comments

Supported comment styles:

* `# comment`
* `// comment`

Rules:

* Comments are identified and stored in the request/response object
* Functional comments (directives) define:
  * Variables
  * Request names
  * Settings
  * Prompts
* Regular comments (non-directives) are preserved for documentation purposes

---

### 2.17 Response Line Parsing
all previous features that apply to request may apply to response parsing like comments.

#### 2.17.1 Response Line Definition

* The **first non-empty line** of a response block is the *response line*

Valid formats:

1. Full RFC style:

   ```
   PROTOCOL-VERSION STATUS-CODE STATUS-MESSAGE

   ```
2. Without HTTP version:

   ```
   STATUS-CODE STATUS-MESSAGE
   ```
3. STATUS-CODE or STATUS-MESSAGE only:

   ```
   STATUS-CODE || STATUS-MESSAGE
   ```

#### 2.17.2 Defaults

* If response is omitted → default to `null`
* If HTTP version is omitted → leave undefined (do not infer)

--- 

### 2.18 Expected Response Parsing
#### 2.18.1 Response Recognition
When an HTTP response block immediately follows a request block (separated by ### delimiter), it should be parsed as the expected response for the preceding request.

#### 2.18.2 Response Object Model
Each expected response produces an object with:
```ts
ExpectedResponse {
  statusCode: number
  statusText?: string
  httpVersion?: string
  headers: Header[]
  body?: string | object
  rawTextRange: { startLine, endLine }
}
```

---

#### 2.18.3 Response Parsing Rules

**Response Line Format:**
```
HTTP/1.1 201 Created
```

* First non-empty line after delimiter must start with `HTTP/`
* Parse version, status code, and status text
* Status code is required, status text is optional

**Headers Section:**
* Follows same rules as request headers (2.6)
* Stops at first empty line

**Body Section:**
* Everything after first empty line following headers
* Preserved as raw text
* If Content-Type is `application/json`, body should be parsed as JSON object

#### 2.18.4 Association with Requests
* Each request may have **zero or one** expected response
* Response is associated with the **immediately preceding request**
* Multiple responses for same request are invalid
* Response blocks without preceding requests are ignored


## 3. Non-Functional Requirements

* Deterministic parsing
* Whitespace-preserving
* Line-number aware (for diagnostics)
* No side effects
* No I/O required
* No HTTP execution
* No authentication logic

---

## 4. System Architecture (Parser-Only)

The core parsing logic is encapsulated in the `HttpRequestParser` class. It manages the parsing lifecycle and supports plugins for extensibility.
For convenience, a `parseHttp` function is exported as the main public API entry point.

```
Input (via `parseText`, `parseStream`)
   ↓
HttpRequestParser (Entry Point)
   ↓
Line Scanner (very lightweight)
   ↓
Segmenter
   ↓
Segment Classifier
   ├── Request Segment (Curl, GraphQL, etc.)
   └── Response Segment
   ↓
Per-Segment Request / Response Parser
   ├── System Variable Scanner (Identify {{...}} references in all lines)
   ├── Directive Scanner (Identify metadata, regular comments, and actual content)
   ├── Variable Scanner (Extract @name, @setting, @prompt, @var definitions)
   ├── Curl Sub-Parser (If detected: Use this and exit segment parsing)
   ├── Request/Response Line Parser (Standard HTTP Anchor)
   ├── Query Parser (Multiline Continuations ? & &)
   ├── Header Parser
   └── Body Parser (Raw, Multipart, GraphQL, File References)
   ↓
AST / Structured Objects
```

---

## 4.1 System Architecture (examples)

## Input Text

Input is handled by the `HttpRequestParser` class methods:
* `parseText(text: string)` (Synchronous)
* `parseStream(stream: ReadableStream)` (Asynchronous)
* `parseChunk(chunk: any)` (Synchronous, Incremental)

These methods normalize the input into a unified string representation and attach metadata about the source.

**Output Object**:
```ts
{
  text: string,
  metadata: {
    length: number,
    lines: number,
    encoding: "UTF-8", // default or configured
    source: {
      type: "string" | "stream",
      name?: string // "raw" or "stream_input"
    }
  }
}
```

---

## Line Scanner (very lightweight)
Responsibility:
- Split text into lines
- Track line numbers and offsets
- Preserve raw text (empty lines, whitespace, indentation)
- `endOffset` is exclusive (points to position after last character of line)
- Line breaks are not included in the text field
No tokens. No semantics.

Input:
```
POST https://example.com/comments HTTP/1.1
content-type: application/json

{
  "title": "Hello"
}

###

GET https://example.com/posts?id=1
```

Output:
```
[
  { lineNumber: 1,  startOffset: 0,   endOffset: 43,  text: "POST https://example.com/comments HTTP/1.1" },
  { lineNumber: 2,  startOffset: 44,  endOffset: 74,  text: "content-type: application/json" },
  { lineNumber: 3,  startOffset: 75,  endOffset: 75,  text: "" },
  { lineNumber: 4,  startOffset: 76,  endOffset: 77,  text: "{" },
  { lineNumber: 5,  startOffset: 78,  endOffset: 97,  text: "  \"title\": \"Hello\"" },
  { lineNumber: 6,  startOffset: 98,  endOffset: 99,  text: "}" },
  { lineNumber: 7,  startOffset: 100, endOffset: 100, text: "" },
  { lineNumber: 8,  startOffset: 101, endOffset: 104, text: "###" },
  { lineNumber: 9,  startOffset: 105, endOffset: 105, text: "" },
  { lineNumber: 10, startOffset: 106, endOffset: 14,  text: "GET https://example.com/posts?id=1"0 }
]
```

---

## Segmenter
Output:
```
[
  {
    segmentId: 0,
    startLine: 1,
    endLine: 7,
    lines: [
      { lineNumber: 1,  startOffset: 0,   endOffset: 43,  text: "POST https://example.com/comments HTTP/1.1" },
      { lineNumber: 2,  startOffset: 44,  endOffset: 74,  text: "content-type: application/json" },
      { lineNumber: 3,  startOffset: 75,  endOffset: 75,  text: "" },
      { lineNumber: 4,  startOffset: 76,  endOffset: 77,  text: "{" },
      { lineNumber: 5,  startOffset: 78,  endOffset: 97,  text: "  \"title\": \"Hello\"" },
      { lineNumber: 6,  startOffset: 98,  endOffset: 99,  text: "}" },
      { lineNumber: 7,  startOffset: 100, endOffset: 100, text: "" }
    ]
  },
  {
    segmentId: 1,
    startLine: 9,
    endLine: 10,
    lines: [
      { lineNumber: 9,  startOffset: 105, endOffset: 105, text: "" },
      { lineNumber: 10, startOffset: 106, endOffset: 140, text: "GET https://example.com/posts?id=1" }
    ]
  }
]
```

---

## Segmenter Clasifier

[
  {
    segmentId: 0,
    startLine: 1,
    endLine: 7,
    type: "request",
    subtype: "http",
    firstNonEmptyLine: {
      lineNumber: 1,
      text: "POST https://example.com/comments HTTP/1.1"
    },
    lines: [
      { lineNumber: 1,  startOffset: 0,   endOffset: 43,  text: "POST https://example.com/comments HTTP/1.1" },
      { lineNumber: 2,  startOffset: 44,  endOffset: 74,  text: "content-type: application/json" },
      { lineNumber: 3,  startOffset: 75,  endOffset: 75,  text: "" },
      { lineNumber: 4,  startOffset: 76,  endOffset: 77,  text: "{" },
      { lineNumber: 5,  startOffset: 78,  endOffset: 97,  text: "  \"title\": \"Hello\"" },
      { lineNumber: 6,  startOffset: 98,  endOffset: 99,  text: "}" },
      { lineNumber: 7,  startOffset: 100, endOffset: 100, text: "" }
    ]
  },
  {
    segmentId: 1,
    startLine: 9,
    endLine: 10,
    type: "request",
    subtype: "http",
    firstNonEmptyLine: {
      lineNumber: 10,
      text: "GET https://example.com/posts?id=1"
    },
    lines: [
      { lineNumber: 9,  startOffset: 105, endOffset: 105, text: "" },
      { lineNumber: 10, startOffset: 106, endOffset: 140, text: "GET https://example.com/posts?id=1" }
    ]
  }
]

---

The Input Text step is essentially a **pass-through with validation** - it ensures the input is valid UTF-8 text and in a format the parser can process. No transformation occurs at this stage; the actual parsing begins in the next step (Line Scanner).

## 4.2 Machine Extensibility
The `HttpRequestParser` supports plugins via the `usePlugin(plugin)` method. This allows external tools or extensions to hook into the parsing lifecycle (details to be defined).

## 5. Configuration & Environment Requirements

* UTF-8 input by default
* Line-based parsing
* No dependency on VS Code APIs
* No dependency on HTTP libraries

---

## 6. Setup & Installation Steps (Parser Context)

Minimal environment:

* Any runtime capable of string processing
* No filesystem access required

---

## 7. Data Requirements

* Input: raw text
* Output: structured in-memory objects
* Preserve:

  * Original text slices
  * Variable references
  * Line ranges
  * Source metadata (type and name)

---

## 8. Assumptions & Constraints

### Assumptions

* Input follows documented syntax
* Variables may remain unresolved
* Multiple requests per file are common

### Constraints

* Parser must not:

  * Send HTTP requests
  * Resolve environment values
  * Read files
  * Execute scripts
  * Perform authentication

---
