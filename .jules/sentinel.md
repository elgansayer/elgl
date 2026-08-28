## 2026-08-21 - [Livekit Insecure Direct Object Reference (IDOR)]
**Vulnerability:** Livekit connection tokens were generated based on `participant_identity` provided in the HTTP request body (`LivekitTokenDto`) rather than securely deriving the identity from the authenticated user's session token.
**Learning:** Even when endpoints are protected by `SupabaseAuthGuard`, relying on client-provided IDs in the request body for security-critical operations (like generating access tokens) allows malicious authenticated users to spoof identities and gain unauthorized access (IDOR).
**Prevention:** Always extract the user identity directly from the authenticated request context (e.g., `req.user.id`) for authorization and token generation, never trust client-provided IDs for self-identification.
