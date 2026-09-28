# Supabase authentication boundary

Issue #949 tracks the NestJS authentication boundary used by authenticated REST and WebSocket entry points. The repository already had `SupabaseAuthGuard` and `CurrentUser`; this document records the production contract and the hardening required to treat both transports consistently.

## Contract

Authenticated REST requests send exactly one `Authorization` header using the Bearer scheme. The scheme is case-insensitive, surrounding horizontal whitespace is tolerated, and the credential itself must be a single non-whitespace token. Duplicate/array-valued authorization headers are rejected rather than choosing one implicitly.

WebSocket clients may authenticate with the same Bearer header. A transport that cannot set the header may instead provide a single string token through `handshake.auth.token`. A malformed or non-Bearer authorization header is never reinterpreted as a JWT. When the explicit WebSocket auth token is present, it is validated with the same Supabase verification path.

The backend does not trust decoded JWT claims supplied by the client. `SupabaseAuthGuard` sends the access token to `supabase.auth.getUser(...)` and only then attaches the returned Supabase `User` to `request.user` or `client.user`. `CurrentUser` reads that verified principal for controller or gateway handlers.

## Failure behaviour

Authentication fails closed when:

- the token is missing or malformed;
- a duplicate/ambiguous authorization header is supplied;
- Supabase reports an invalid or expired token;
- Supabase cannot be reached or throws while verifying the token;
- the NestJS execution context is neither HTTP nor WebSocket.

Any stale `user` value on a reused request/client object is cleared before a new verification attempt. Provider failures return a stable unauthorized response and emit only a generic warning. Tokens, user IDs, email addresses, request bodies and other private content are not written to authentication logs.

The intentionally public authentication bootstrap/exchange endpoints remain public. For example, a transfer token must be consumable before an authenticated session exists. Authenticated product endpoints continue to opt into `SupabaseAuthGuard` at controller or handler scope, and the global `AuthModule` exports the guard for those modules.

## CurrentUser

`CurrentUser` supports both authenticated HTTP requests and WebSocket clients. It returns the verified Supabase `User` attached by the guard, or `null` when invoked outside the authenticated boundary. Handlers remain responsible for applying `SupabaseAuthGuard`; the decorator is not an authentication mechanism by itself.

## Verification

`backend/src/auth/supabase-auth.guard.spec.ts` covers:

- normal REST Bearer verification and principal propagation;
- scheme casing/whitespace handling;
- missing, non-Bearer and duplicate authorization headers;
- invalid/expired Supabase responses;
- provider exceptions and stale-principal clearing;
- WebSocket Bearer and `handshake.auth.token` verification;
- rejection of malformed/non-string WebSocket credentials;
- prevention of Basic/other auth schemes being treated as Supabase JWTs;
- unsupported execution contexts.

The normal backend unit, lint, build and E2E jobs remain the authoritative repository validation gates.

## Rollout and rollback

No database migration, persisted-state conversion, API response-shape change or client token format change is required. Deploy the backend normally after the repository checks pass.

Rollback is a normal revert of the application/test/documentation commits. A rollback restores the previous parsing behaviour but does not require data cleanup. Do not introduce a fallback that trusts client-decoded JWT claims or silently accepts malformed authorization headers during rollback.
