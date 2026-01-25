# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-01-24

### Added
- Initial release of HTTP Parser
- Support for parsing HTTP requests from strings
- Support for parsing HTTP requests from streams and async iterables
- Line scanning and segmentation
- Segment classification (request/response/curl/GraphQL)
- Parsing of HTTP request lines
- Parsing of HTTP response lines
- Header parsing
- Body parsing (JSON, form-data, GraphQL, file references)
- Query parameter parsing (including multiline queries)
- cURL command parsing
- GraphQL request parsing
- Variable system (file, prompt, request, system variables)
- File reference body support
- Form data and URL-encoded body parsing
- Multi-part request support
- Request settings and annotations
- Plugin system for extensibility
- Incremental parsing support

### Documentation
- Comprehensive README.md with usage examples
- Detailed SPECIFICATION.md with all requirements
- JSDoc comments on all public API surfaces

### Testing
- 128 tests covering all major functionality
- Integration tests with real-world examples
- AST-level tests
- Parser-specific tests
- Fixture-based testing