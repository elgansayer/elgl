## 2026-08-05 - [Add Helmet and secure CORS]
**Vulnerability:** Missing secure HTTP headers and overly permissive CORS policy.
**Learning:** Default NestJS/Express apps need external middleware to set security headers. The CORS config was defaulting to '*'.
**Prevention:** Always use `helmet` and configure CORS with specific origins from environment variables.
## 2023-10-27 - [Path Traversal in Media Upload]
**Vulnerability:** The `MediaService.uploadAndCompressVoiceNote` function used the raw `file.originalname` directly inside `path.join()` when constructing the temporary file path. This could allow an attacker to write files outside of the temporary directory (e.g., `../../../etc/passwd`).
**Learning:** Always extract and sanitize the file extension (e.g., using `path.extname` and regex) and generate a random identifier (e.g., `crypto.randomBytes(8).toString('hex')`) instead of trusting user-provided filenames. Node's `crypto` module needs to be explicitly imported (`import * as crypto from 'crypto'`).
**Prevention:** Use standard patterns for generating unique filenames for uploads and validate/sanitize file extensions.
