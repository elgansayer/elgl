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

## 2026-08-12 - Strict Environment Secret Validation

**Vulnerability:** A hardcoded dev fallback string (`device-transfer-secret-dev-only`) was used in `TransferService` for `TRANSFER_SECRET` if the environment variable was omitted, risking weak signatures in production if misconfigured.
**Learning:** Hardcoded default secrets represent a critical vulnerability in production as they allow silent fallback to insecure states.
**Prevention:** Always validate that environment secrets are explicitly configured on initialization (fail-fast) and actively reject any known dev/test default strings.

## 2026-08-13 - [Strict Secrets Validation in Production]

**Vulnerability:** Missing strict environment secret validation allowed insecure defaults or missing keys (e.g. `TRANSFER_SECRET`) to pass unnoticed into production.
**Learning:** Hardcoded dev defaults or weak optional secret fallbacks can compromise critical authentication endpoints if not explicitly validated during app startup.
**Prevention:** Apply a fail-fast/fail-secure pattern in the service constructor. Check if `NODE_ENV === 'production'` and explicitly throw an `Error` if the secret is absent or matches the insecure default, preventing the backend from initializing insecurely.

## 2026-08-13 - [Remove hardcoded fallback for LiveKit TURN credentials]

**Vulnerability:** Found hardcoded fallback strings for `LIVEKIT_TURN_USERNAME`, `LIVEKIT_TURN_PASSWORD`, and `LIVEKIT_TURN_DOMAIN` in `backend/src/livekit/livekit.service.ts`.
**Learning:** Default fallback configs in service files can easily expose hardcoded credentials or domains that an attacker could leverage or that could misdirect traffic if environmental variables are absent.
**Prevention:** Avoid providing hardcoded string fallbacks for secrets and domains when configuring network services like TURN. Throw an error on initialization or usage if a required configuration value is missing.

## 2025-02-12 - Fail fast on missing TRANSFER_SECRET in production

**Vulnerability:** A hardcoded default secret (`device-transfer-secret-dev-only`) was used as a fallback for `TRANSFER_SECRET` in `TransferService`.
**Learning:** Default fallbacks for application secrets (such as JWT signing keys or system transfer secrets) in backend services can expose the application in production if the environment variable is accidentally left unset. Attackers can leverage the publicly known fallback.
**Prevention:** Remove insecure fallbacks for secrets. Enforce that they are securely set, and deliberately throw an initialization error in production environments if the secret is missing or matching the insecure development default.

## 2024-05-24 - [Enforce critical secrets in production]

**Vulnerability:** JWT signing keys (e.g. `TRANSFER_SECRET`) can default to insecure fallbacks if misconfigured, allowing attackers to forge tokens.
**Learning:** Services should employ a fail-secure approach during startup. Defaulting to development secrets is risky unless explicitly constrained to non-production environments.
**Prevention:** In constructors or initialization blocks, verify that `NODE_ENV === "production"` has the required sensitive environment variables set, and throw a fast-failing error if not.

## 2025-02-12 - [Strict Secrets Validation for Centrifugo]

**Vulnerability:** Missing strict environment secret validation allowed insecure defaults or missing keys (`CENTRIFUGO_SECRET` and `CENTRIFUGO_API_KEY`) to pass unnoticed in production.
**Learning:** Defaulting to development secrets or using the non-null assertion operator (`!`) on optional config values can compromise critical API endpoints if not explicitly validated during app startup.
**Prevention:** Apply a fail-fast/fail-secure pattern in the service constructor. Check if `NODE_ENV === 'production'` and explicitly throw an `Error` if the secret or API key is absent, preventing the backend from initializing insecurely.

## 2026-08-18 - [Strict Secrets Validation in Production for Monetisation]

**Vulnerability:** Monetisation services (`AppleReceiptValidatorService` and `MonetisationService`) relied on weak development fallback values for critical secrets (`APPLE_SHARED_SECRET` and `STRIPE_SECRET_KEY`) when environment variables were missing.
**Learning:** Default fallbacks for application secrets represent a critical vulnerability in production as they allow silent initialization into an insecure state, preventing real payments while avoiding startup crashes.
**Prevention:** Apply a fail-fast/fail-secure pattern in the service constructor. Check if `NODE_ENV === 'production'` and explicitly throw an `Error` if the secret is absent or matches the insecure default, preventing the backend from initializing insecurely.
## 2026-08-21 - [Fail-Fast LiveKit Credentials in Production]
**Vulnerability:** LiveKit `LIVEKIT_API_KEY`, `LIVEKIT_SECRET`, and TURN credentials defaulted to insecure test values (e.g., `guest`, `somepassword`, `turn.example.com`) if missing in production.
**Learning:** Default configuration schemas (like `validation.schema.ts`) can mask missing environment variables by silently providing valid but insecure fallback strings to services like `LivekitService`. This is a critical risk for WebRTC authentication.
**Prevention:** Apply a strict fail-fast validation in the service constructor or before usage. Check if `NODE_ENV === 'production'` and explicitly throw an `Error` if any credential matches the known insecure defaults.
