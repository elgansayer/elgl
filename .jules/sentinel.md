## 2026-08-05 - [Add Helmet and secure CORS]
**Vulnerability:** Missing secure HTTP headers and overly permissive CORS policy.
**Learning:** Default NestJS/Express apps need external middleware to set security headers. The CORS config was defaulting to '*'.
**Prevention:** Always use `helmet` and configure CORS with specific origins from environment variables.

## 2026-08-11 - [Replace Insecure Math.random() with randomUUID()]
**Vulnerability:** Weak random number generation (`Math.random()`) used for security purposes (rate-limit bypass keys).
**Learning:** `Math.random()` generates predictable values. Using it to generate keys or identifiers for security contexts like rate-limiting makes the application susceptible to bypass or collision attacks.
**Prevention:** Always use Node.js's native `crypto.randomUUID()` or `crypto.randomBytes()` for generating unique identifiers, tokens, or security keys.
## 2025-02-12 - Hardcoded livekit secret fallback

**Vulnerability:** Found a hardcoded fallback string for `LIVEKIT_SECRET` and `LIVEKIT_API_KEY` in `backend/src/audio-rooms/audio-rooms.module.ts`.
**Learning:** Default fallback configs in module files can easily expose hardcoded secrets. Missing secrets should fail fast instead of providing a fallback value that an attacker might try to use.
**Prevention:** Avoid providing hardcoded string fallbacks for secrets. Throw an error on initialization if a required API key or secret is missing.

## 2026-08-13 - [Strict Secrets Validation in Production]
**Vulnerability:** Missing strict environment secret validation allowed insecure defaults or missing keys (e.g. `TRANSFER_SECRET`) to pass unnoticed into production.
**Learning:** Hardcoded dev defaults or weak optional secret fallbacks can compromise critical authentication endpoints if not explicitly validated during app startup.
**Prevention:** Apply a fail-fast/fail-secure pattern in the service constructor. Check if `NODE_ENV === 'production'` and explicitly throw an `Error` if the secret is absent or matches the insecure default, preventing the backend from initializing insecurely.
