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

## 2026-08-16 - [Fail-fast for configuration validation for critical secrets]
**Vulnerability:** A hardcoded default secret (`device-transfer-secret-dev-only`) was being used for `TRANSFER_SECRET` without strict validation. If the production environment failed to pass a secret, it would silently fallback to this dev-only string, creating a critical vulnerability where transfers could be intercepted or forged.
**Learning:** Default fallback configs for secrets are extremely dangerous and can mask missing configuration in production.
**Prevention:** Avoid providing hardcoded string fallbacks for secrets in production. Ensure validation schemas strictly require secrets when `NODE_ENV === 'production'` and apply fail-fast checks within the consuming class constructors to throw an error on startup.
