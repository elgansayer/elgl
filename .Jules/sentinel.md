
## 2024-05-20 - Unverified JWT Decoding in Auth Endpoints
**Vulnerability:** The `change-password` and `reset-password` endpoints used `jwt-decode` to extract the `userId` (`sub`) from JWTs. `jwt-decode` only decodes the payload without verifying the signature, allowing arbitrary user impersonation and account takeover by forging a token.
**Learning:** Never trust client-provided JWT payloads. Relying on `jwt-decode` for authentication decisions completely bypasses cryptographic verification.
**Prevention:** Always use `@UseGuards(SupabaseAuthGuard)` on protected endpoints and extract user info from `req.user`. For standalone tokens, use `supabase.auth.getUser(token)` to verify authenticity and integrity before extracting data.
