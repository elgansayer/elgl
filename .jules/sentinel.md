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

## 2026-08-23 - [Strict Secrets Validation in Production for STRIPE_SECRET_KEY in EconomyService]

**Vulnerability:** Monetisation service `EconomyService` relied on weak development fallback values for critical secrets (`STRIPE_SECRET_KEY`) when environment variables were missing.
**Learning:** Default fallbacks for application secrets represent a critical vulnerability in production as they allow silent initialization into an insecure state, avoiding startup crashes but preventing secure operations.
**Prevention:** Apply a fail-fast/fail-secure pattern in the service constructor. Check if `NODE_ENV === 'production'` and explicitly throw an `Error` if the secret is absent or matches the insecure default (`sk_test_123`), preventing the backend from initializing insecurely.

## 2026-08-25 - [Strict Secrets Validation in Production for STRIPE_SECRET_KEY in StripeService]

**Vulnerability:** Stripe service `StripeService` was missing strict secret validation and could potentially use default configurations or weak keys without failing if environment variables weren't carefully enforced.
**Learning:** Default fallbacks or missing explicit strict validation for application secrets represent a critical vulnerability in production as they allow silent initialization into an insecure state, preventing secure operations.
**Prevention:** Apply a fail-fast/fail-secure pattern in the service constructor. Check if `NODE_ENV === 'production'` and explicitly throw an `Error` if the secret is absent or matches the insecure default (`sk_test_123` or `sk_test`), preventing the backend from initializing insecurely.

## 2026-08-25 - [Fail-Fast SUPABASE_SERVICE_ROLE_KEY in Production]

**Vulnerability:** The SupabaseService could initialize using a well-known test default for `SUPABASE_SERVICE_ROLE_KEY` (e.g., `test-service-role-key`) if the environment variable was missing in a production environment, putting backend service authentication at risk.
**Learning:** Even though environment validation exists at the configuration module boundary, relying solely on global schemas is insufficient defense-in-depth. A missing production environment variable could still silently fall back to test defaults in the validation schema before injection.
**Prevention:** Apply a fail-fast/fail-secure pattern in the service constructor. Check if `NODE_ENV === 'production'` and explicitly throw an `Error` if the injected key matches known insecure defaults, preventing the service from initializing insecurely.

## 2026-08-25 - [Fail-Fast LiveKit Credentials in Production (Audio and Calls)]

**Vulnerability:** LiveKit API keys and secrets used in audio-rooms and calls services (`LIVEKIT_API_KEY`, `LIVEKIT_SECRET`) could default to insecure test values (e.g., `test-livekit-api-key`) if environment variables were missing in a production environment.
**Learning:** Default fallbacks for critical external service secrets present a high risk in production by allowing silent initialization into an insecure, predictable state. Consistent validation must occur anywhere a secret is injected into a service.
**Prevention:** Always apply strict fail-fast validation checks where `NODE_ENV === 'production'` alongside explicit validation for known development fallback credentials, directly within the module or service initialization.

## 2026-08-25 - [Fail-Fast TRANSFER_SECRET in Production]

**Vulnerability:** The TransferService could initialize using the well-known insecure fallback `test-transfer-secret` if the environment variable was omitted or masked in a production environment.
**Learning:** Hardcoded dev defaults or weak optional secret fallbacks can compromise critical authentication endpoints if not explicitly validated during app startup. We must check all potential insecure defaults.
**Prevention:** Apply a fail-fast/fail-secure pattern in the service constructor. Check if `NODE_ENV === 'production'` and explicitly throw an `Error` if the secret is absent or matches the insecure default (`test-transfer-secret`), preventing the backend from initializing insecurely.

## 2024-09-02 - Language Corrections Flow Audit
**Vulnerability:** Language corrections flow lacked a formal audit.
**Learning:** The current implementation in `frontend/src/app/components/visual-diff/visual-diff.component.ts` successfully satisfies the requirements: speed, clarity, neutrality, translatability, and reusability. It uses `Intl.Segmenter` for universal tokenization and integrates with `FlashcardService`.
**Prevention:** Maintain the current architecture and ensure any future modifications to the corrections flow adhere to these core requirements.

## 2026-09-04 - [Strict Secrets Validation in Production for Cloudflare Services]
**Vulnerability:** Cloudflare service tokens and signing secrets (`CLOUDFLARE_R2_SIGNING_SECRET`, `CLOUDFLARE_R2_SERVICE_TOKEN`, `CLOUDFLARE_STREAM_API_TOKEN`) could default to insecure test values if missing in production.
**Learning:** Default fallbacks for critical external service secrets present a high risk in production by allowing silent initialization into an insecure, predictable state.
**Prevention:** Apply strict fail-fast validation checks where `NODE_ENV === 'production'` alongside explicit validation for known development fallback credentials directly within the service initialization.


## 2026-08-29 - Fixed Insecure Random Number Generation

**Vulnerability:** The daily check-in reward used predictable `Math.random()`, while the host dashboard displayed invented random earnings instead of persisted gift transactions.
**Learning:** Economy rewards that genuinely require randomness need a cryptographically secure source. Values presented as persisted earnings must not be random at all.
**Prevention:** Generate the reward with Node's `crypto.randomInt()` before entering the atomic claim transaction, validate its range again inside the RPC, and derive authenticated dashboard totals from authoritative host-scoped transaction data.

## 2026-08-30 - [Fail-Fast Centrifugo Credentials in Production]

**Vulnerability:** Centrifugo `CENTRIFUGO_API_KEY` and `CENTRIFUGO_SECRET` could reach production as configuration defaults, tracked example placeholders, or whitespace-only values.
**Learning:** Configuration defaults and example environment files can mask missing deployment secrets with predictable strings. Protect the service startup boundary against every repository-known placeholder, not only the schema default.
**Prevention:** Reject missing, blank, whitespace-padded, test-default and example-placeholder Centrifugo credentials in the global production environment validator. Require both variables during production Compose interpolation and start Centrifugo only after the validated API is healthy, so predictable credentials are never exposed by the standalone WebSocket container.

## 2026-09-05 - Missing authentication on admin dashboard

**Vulnerability:** The `factory-dashboard/src/server.js` file claimed in its comment and README that Basic Auth was enforced on all routes except `/health`. However, the implementation was completely missing, leaving all endpoints (including state data and GitHub integration) exposed without any authentication check.
**Learning:** Comments and documentation do not guarantee security mechanisms are actually implemented. The `createServer` callback was blindly invoking `handleRoute(req, res)` without inspecting `req.headers.authorization`.
**Prevention:** Implement programmatic assertions or integration tests that specifically attempt to access protected endpoints without credentials and expect 401 Unauthorized responses to ensure auth middleware is active.
## 2026-09-07 - [Strict Secrets Validation in Production for VideoCallsService]

**Vulnerability:** The VideoCallsService lacked strict environment secret validation, allowing it to potentially use default or known test keys for `LIVEKIT_API_KEY` and `LIVEKIT_SECRET` in a production environment if misconfigured.
**Learning:** Services like audio rooms and general calls successfully fail-fast when encountering these known test keys. Video calls bypassed this explicit validation, representing a critical risk of silent insecure fallback.
**Prevention:** Always apply strict fail-fast validation checks where `NODE_ENV === 'production'` alongside explicit validation for known development fallback credentials directly within the initialization.


## 2026-09-09 - [Strict Secrets Validation for Video Calls]
**Vulnerability:** LiveKit `LIVEKIT_API_KEY` and `LIVEKIT_SECRET` defaulted to insecure test values if missing in production within the VideoCallsService.
**Learning:** Default fallbacks for application secrets represent a critical vulnerability in production as they allow silent initialization into an insecure state.
**Prevention:** Apply a fail-fast/fail-secure pattern in the service constructor. Check if `NODE_ENV === 'production'` and explicitly throw an `Error` if the secret is absent or matches the insecure default, preventing the backend from initializing insecurely.

## 2026-09-10 - Replace blocking Redis KEYS with SCAN

**Vulnerability:** A blocking `KEYS` command was used in `SafetyCacheInvalidationService` to delete cache keys for recommendations and login history, posing a Denial of Service (DoS) risk by blocking the event loop on larger instances.
**Learning:** Using `KEYS` in production can quickly cause performance degradation and denial-of-service in an application because it executes as a single, O(N) command blocking the Redis event loop for other concurrent operations.
**Prevention:** Avoid `KEYS` commands in all production code paths, always use non-blocking iterator commands like `SCAN`, iterating over the dataset in batches.

## 2024-05-18 - Missing IDOR Check on Audio Intro Update
**Vulnerability:** The `/audio-intro/:userId` PATCH endpoint lacked an authorization check to verify that the authenticated user's ID matched the requested `:userId` parameter, allowing any authenticated user to overwrite another user's audio intro.
**Learning:** Even when `SupabaseAuthGuard` is present to ensure authentication, we must explicitly verify authorization (ownership) for parameterized endpoints using `@Req() req: { user: { id: string } }` or `@CurrentUser()`.
**Prevention:** Always extract the authenticated user's ID and explicitly compare it against path parameters that identify resources, throwing a `ForbiddenException` if they do not match.

## 2025-01-07 - Insecure Direct Object Reference (IDOR) in AudioIntroController
**Vulnerability:** The PATCH `/audio-intro/:userId` endpoint allowed users to modify the audio intro of other users because it did not check if the authenticated user matched the requested `userId`.
**Learning:** This vulnerability existed due to the assumption that since `SupabaseAuthGuard` is present, the request is secure. We need to explicitly check that the parameter ID and the authenticated user ID match when a request tries to mutate data associated with a specific user.
**Prevention:** Always extract the user's ID via `@Req() req: { user: { id: string } }` (provided by `SupabaseAuthGuard`) and explicitly throw a `ForbiddenException` from `@nestjs/common` if it does not match the requested `userId`.

## 2024-05-18 - Fix IDOR in audio-intro update endpoint
**Vulnerability:** Insecure Direct Object Reference (IDOR) in the `audio-intro` update endpoint allowing any authenticated user to update another user's audio intro.
**Learning:** Some endpoints missed validating the requested `userId` parameter against the authenticated user's ID (`req.user.id`) provided by the `SupabaseAuthGuard`.
**Prevention:** Always verify that the requested entity matches the authenticated user ID extracted from the request context before performing modifications.

## 2026-09-23 - [Strict Secrets Validation in Production for Video Calls]
**Vulnerability:** The VideoCallsService lacked validation to prevent fallback insecure default development values for LIVEKIT_API_KEY and LIVEKIT_SECRET from being used in production.
**Learning:** Hardcoded development credentials for external service APIs represent a critical vulnerability in production as they allow silent initialization into an insecure state if environment variables are missing.
**Prevention:** Always apply strict fail-fast validation checks where NODE_ENV === 'production' alongside explicit validation for known development fallback credentials, directly within the module or service initialization.

## 2026-09-24 - [Fix IDOR in LiveKit Token Generation]
**Vulnerability:** The `/api/livekit/token` endpoint trusted the user-supplied `participant_identity` from the request body to generate a LiveKit token. This allowed an authenticated attacker to mint an access token for any other user (IDOR) and potentially eavesdrop or impersonate them in a room.
**Learning:** Never trust client-provided identifiers for token generation or sensitive actions when an authoritative, authenticated identity (e.g., from a JWT or session) is available. Trusting user input for identity leads directly to IDOR.
**Prevention:** Always extract the authenticated user from the request context (e.g., via the `@CurrentUser()` decorator) and strictly use that server-validated identity (`user.id`) for generating access tokens or performing authorization checks.

## 2026-09-25 - IDOR in Moment Text Editing
**Vulnerability:** Insecure Direct Object Reference (IDOR) allowed any user to edit the text of any moment created by others. The check for whether the editor was the author of the moment (`userId === momentAuthorId`) was missing in `editMomentText`.
**Learning:** Security checks that verify if a user is *blocked* by the author were present, creating a false sense of security that authorization was handled, while the most basic ownership check was omitted.
**Prevention:** Always verify ownership (`userId === ownerId`) *before* checking secondary authorization conditions like blocklists or privacy settings on mutable endpoints.

## 2026-10-01 - Prevent Authorization Bypass (Missing ID/Sub Check)
**Vulnerability:** The admin `banUser` and `warnUser` endpoints implicitly trusted `req.user.sub` to determine the admin actor ID, without checking for undefined or falling back to `id`.
**Learning:** In authentication contexts where the user ID might reside in either `id` or `sub`, failing to normalize and explicitly check for truthiness can result in actions being attributed to `undefined` or null, breaking audit trails and bypassing expected actor checks.
**Prevention:** Always extract identity using `id ?? sub`, explicitly check for truthiness, and throw an `UnauthorizedException` if missing before performing sensitive operations.

## 2026-10-03 - [Fix IDOR vulnerability in cart controller]
**Vulnerability:** Cart endpoints were using `(req as any).user?.id ?? 'unknown'`, allowing unauthenticated or partially authenticated users without IDs to share and manipulate the same 'unknown' cart.
**Learning:** Bypassing types using `any` to extract authentication state often hides missing verification logic. Controllers must strictly enforce user presence via decorators like `@CurrentUser()`.
**Prevention:** Use typed user decorators (`@CurrentUser() user: User | null`) and explicitly verify existence (`if (!user?.id) throw new UnauthorizedException(...)`) rather than falling back to default identifier strings.


## 2026-09-06 - [Fix IDOR in CartController by removing 'unknown' fallback]
**Vulnerability:** The `CartController` explicitly extracted `userId` from the request and defaulted to the string `'unknown'` if the user object or ID was missing.
**Learning:** Defaulting to a static, non-unique fallback identifier like `'unknown'` when authentication state is missing or malformed bypasses authorization completely and causes IDOR. Any request processed under the `'unknown'` fallback shares the same global context with other unauthorized requests.
**Prevention:** In NestJS controllers, retrieve the authenticated user context explicitly using the `@CurrentUser()` decorator and immediately throw an `UnauthorizedException` if the user or `user.id` is missing. Never fall back to default identifier strings.

## 2026-10-04 - [Strict Path Resolution for Static File Servers]

**Vulnerability:** A static file server used a naive regex `replace(/^(\.\.[/\\])+/, '')` to prevent path traversal. This could be bypassed using URL encoded dot-dot-slash sequences (e.g., `%2e%2e%2f%2e%2e%2fetc%2fpasswd`), allowing attackers to read arbitrary files on the filesystem.
**Learning:** URL components remain encoded in `req.url` and `new URL(req.url).pathname`. Node's `path.normalize()` will not resolve encoded traversal attempts. Manual regex sanitisation is almost always brittle and prone to bypasses via encoding or malformed characters like null bytes (`%00`).
**Prevention:** Always use `decodeURIComponent` before manipulating request paths. Remove null bytes (`\0`). Use `path.resolve()` against the intended base directory (after stripping leading slashes) to generate an absolute target path. Finally, enforce a strict prefix check ensuring the resulting `targetPath` starts exactly with the base directory plus a path separator (`PUBLIC_DIR + path.sep`).

## 2024-10-06 - [Fix Path Traversal in Factory Dashboard]
**Vulnerability:** Static file server used regex replacement `replace(/^(\.\.[/\\])+/, '')` which can be bypassed using URL-encoded sequences like `%2e%2e`.
**Learning:** Fragile regex replacements for path traversal prevention are inadequate against URL-encoded paths.
**Prevention:** Use `decodeURIComponent` on the path, resolve it to an absolute path using `path.resolve` (stripping leading slashes first), and verify it strictly starts with the intended base directory using `targetPath.startsWith(PUBLIC_DIR + path.sep)`.

## 2026-10-06 - [Strict Path Traversal Protection]

**Vulnerability:** The factory-dashboard was vulnerable to path traversal due to reliance on regex `.replace(/^(\.\.[/\\])+/, '')` which could be bypassed with URL encoding (e.g. `%2e%2e`).
**Learning:** Fragile regex replacements for `../` sequences in Node.js static file servers are not sufficient as they can be bypassed with URL encoding.
**Prevention:** Always use `decodeURIComponent` on the path, strip leading slashes to prevent absolute path resolution, resolve to an absolute path with `path.resolve`, and verify it strictly starts with the base directory using `targetPath.startsWith(PUBLIC_DIR + path.sep)`.

## 2026-10-05 - Auth Bypass in LiveKit Token Generation
**Vulnerability:** The LiveKit controller (`backend/src/livekit/livekit.controller.ts`) generates LiveKit access tokens using an arbitrary `participant_identity` provided in the request body, ignoring the authenticated user's actual ID.
**Learning:** Even though the endpoint is protected by `@UseGuards(SupabaseAuthGuard)`, failing to tie the action to the `@CurrentUser()` leads to Insecure Direct Object Reference (IDOR) / authorization bypass, allowing users to impersonate others in video rooms.
**Prevention:** Always extract identity from the `@CurrentUser()` decorator rather than trusting client-provided identifiers for sensitive actions.


## 2026-10-02 - Permissive CORS Configuration
**Vulnerability:** Permissive CORS configuration with localhost fallback in non-production environments.
**Learning:** Fallbacks to localhost in CORS configurations can inadvertently expose APIs if an environment is misconfigured or if non-production environments are exposed to the public internet.
**Prevention:** Strictly require and validate origin variables (like `FRONTEND_URL`) across all environments without hardcoded fallbacks in application bootstrap code.

## 2026-10-06 - Remove hardcoded Firebase configuration placeholders
**Vulnerability:** The service worker `frontend/src/firebase-messaging-sw.js` used a fallback of `|| 'YOUR_API_KEY'` which acts as an explicit invitation for developers to commit raw secret string literals into source control.
**Learning:** Having placeholders for secrets directly in source files often leads to those placeholders being overwritten by the real secrets and committed.
**Prevention:** Remove all fallback strings for configuration keys. Instead, parse them securely from query parameters injected dynamically by the framework at registration, or fetch them dynamically via a designated init endpoint like `/__/firebase/init.json`.

## 2026-09-13 - Basic Auth Timing Attack Vulnerability in Node.js

**Vulnerability:** The basic authentication check in `factory-dashboard/src/server.js` was implemented using standard string inequality `!==` to compare passwords, making the server vulnerable to timing attacks where attackers could measure validation time to guess the length and characters of the password.
**Learning:** Basic string comparison operators short-circuit, causing the comparison time to vary based on how many characters match. This is a well-known vulnerability for authentication paths.
**Prevention:** Always use `crypto.timingSafeEqual(userBuf, expectedUserBuf)` from the native `crypto` module when validating passwords, tokens, or hashes to ensure a constant time comparison.

## 2024-05-18 - Fix Redis DoS vulnerability by replacing KEYS with SCAN

**Vulnerability:** The codebase was using the blocking `redis.keys()` command in production cache invalidation paths (`admin.service.ts`, `safety-cache-invalidation.service.ts`) and metrics aggregation (`recommendations-metrics.aggregator.ts`).
**Learning:** `KEYS` blocks the Redis event loop, creating a Denial of Service (DoS) vulnerability. An attacker or normal system usage could trigger cache invalidations or metrics collection that blocks all services relying on Redis. The codebase relies heavily on prefix matching for cache invalidation.
**Prevention:** Always use the non-blocking `SCAN` command with a cursor loop to search for keys by pattern instead of `KEYS`.

## 2026-09-15 - [Fix IDOR in Safety Controller Block Lists]

**Vulnerability:** Insecure Direct Object Reference (IDOR) on `getBlockedUserIds`, `getBlockerUserIds`, and `getBlockedAndBlockerIds` allowed any authenticated user to view the block lists of any other user.
**Learning:** Endpoints that accept a `userId` parameter in route paths must explicitly verify that the requesting user's identity matches the requested `userId` when exposing sensitive relationships.
**Prevention:** Always compare the `userId` parameter against the authenticated user's ID (`req.user.id`) and throw a `ForbiddenException` if they differ on endpoints dealing with personal data.

## 2026-09-15 - Hardcoded Test Secrets allowed in Production

**Vulnerability:** The application was allowing insecure placeholder/test credentials (e.g. 'test-centrifugo-api-key', 'test-centrifugo-secret') to be successfully loaded and used in production environments.
**Learning:** Checking for the presence of a secret (`!secret`) is insufficient if the configuration system falls back to default test credentials when environment variables are omitted or misconfigured.
**Prevention:** Always implement explicit fail-fast validations that check the configured secrets against known insecure default/placeholder strings, especially in production environments, to prevent the system from booting into a vulnerable state.

## 2026-09-17 - [Fail-Fast LiveKit Credentials in Production (Video Calls)]

**Vulnerability:** LiveKit API keys and secrets used in video-calls service (`LIVEKIT_API_KEY`, `LIVEKIT_SECRET`) could default to insecure test values (e.g., `test-livekit-api-key`) if environment variables were missing in a production environment.
**Learning:** Default fallbacks for critical external service secrets present a high risk in production by allowing silent initialization into an insecure, predictable state. Consistent validation must occur anywhere a secret is injected into a service, missing checks in just one module (VideoCalls) can circumvent valid checks in others.
**Prevention:** Always apply strict fail-fast validation checks where `NODE_ENV === 'production'` alongside explicit validation for known development fallback credentials, directly within every module or service initialization.

## 2024-05-24 - IDOR in Audio Intro Update

**Vulnerability:** IDOR in audio intro update endpoint where any authenticated user could overwrite the audio intro for any other user because the route parameter `userId` was not compared against the authenticated user's ID.
**Learning:** Endpoints mapped by `userId` or updating user-specific resources need explicit authorization checks beyond just authentication (`SupabaseAuthGuard`) to ensure users can only modify their own data.
**Prevention:** Always extract the authenticated user ID via `@Req() req: { user: { id: string } }` (or similar decorators like `CurrentUser`) and assert it matches the target resource ID with a `ForbiddenException` or `UnauthorizedException`.

## 2024-10-09 - Path Traversal Vulnerability in Static File Server
**Vulnerability:** The factory-dashboard static file server used `path.normalize(pathname).replace(/^(\.\.[/\\])+/, '')` which is vulnerable to path traversal via URL encoding (e.g., `%2e%2e`).
**Learning:** URL encoded strings can bypass simple regex-based path traversal protections because the `URL` object parser retains encoded sequences.
**Prevention:** Always use `decodeURIComponent` on the path, strip leading slashes to prevent absolute path resolution, resolve it to an absolute path using `path.resolve`, and verify it strictly starts with the intended base directory using `targetPath.startsWith(PUBLIC_DIR + path.sep)`.
## 2026-10-09 - [Fix IDOR in Resource Library]
**Vulnerability:** Insecure Direct Object Reference (IDOR) in `ResourceLibraryController`. The `update` and `remove` endpoints accepted an `id` parameter from the path and performed database modifications without verifying if the authenticated user owned the resource.
**Learning:** Endpoints mapped by `id` or updating user-specific resources need explicit authorization checks beyond just authentication (`SupabaseAuthGuard`) to ensure users can only modify their own data.
**Prevention:** Always extract the authenticated user ID via `@CurrentUser() user: any` and pass it to the service layer to assert it matches the target resource owner ID with an `.eq('created_by', userId)` condition in the database query.
## 2026-10-11 - [Admin Authorization ID Extraction Fallback]
**Vulnerability:** The Admin API `banUser` and `warnUser` endpoints relied solely on `req.user.sub` to extract the admin's user ID for auditing and blocking actions. Depending on the `SupabaseAuthGuard` implementation and JWT structure, the user ID might be mapped to `req.user.id` instead of `sub`, leading to an undefined user ID being passed to the `AdminService` without failing fast.
**Learning:** Hardcoding a specific property name for authenticated user IDs when multiple representations exist in the request context (e.g., `id` and `sub`) can lead to authorization bypass or unexpected application state. Furthermore, failing to validate the presence of the extracted ID before initiating destructive actions like bans introduces a risk.
**Prevention:** Update authentication interfaces (like `AuthRequest`) to reflect the union of possible ID properties. In controller handlers, explicitly extract the ID using a nullish coalescing operator (`req.user.id ?? req.user.sub`) and immediately throw an `UnauthorizedException` if the resolved ID is falsy before passing it to services.
## 2026-10-12 - Improper Authentication Extraction in NestJS Controllers
**Vulnerability:** IDOR and authorization bypass risks due to trusting internal `req` object for extracting `user.id`.
**Learning:** `req.user` might not always be rigorously validated depending on the execution context or misconfigured guards.
**Prevention:** Always use `@CurrentUser()` to extract the authenticated user securely and assert its validity before using its properties.




















