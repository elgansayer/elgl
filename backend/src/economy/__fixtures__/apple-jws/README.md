# Apple signed-transaction test fixtures

Self-signed EC P-256 chain generated for `apple-signed-transaction.verifier.spec.ts` only.

- `root.pem`, `intermediate.pem`, `leaf.pem`: certificate chain used as the JWS `x5c` header and as the test trust anchor.
- `leaf.key`: private key used by the test to sign synthetic transaction payloads.

These files are never loaded by production code. The production verifier pins `Apple Root CA - G3` in `backend/src/economy/apple-signed-transaction.verifier.ts`.
