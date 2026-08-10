## 2026-08-05 - [Add Helmet and secure CORS]
**Vulnerability:** Missing secure HTTP headers and overly permissive CORS policy.
**Learning:** Default NestJS/Express apps need external middleware to set security headers. The CORS config was defaulting to '*'.
**Prevention:** Always use `helmet` and configure CORS with specific origins from environment variables.
## Insecure PRNG in Message ID Generation (Fixed)
- **Vulnerability:** Weak PRNG (`Math.random()`) used for generating chat message IDs in the frontend.
- **Risk:** Identifiers generated with `Math.random()` are predictable and susceptible to collision or enumeration attacks. An attacker could potentially guess or manipulate identifiers, risking data integrity.
- **Remediation:** Replaced `Math.random()` (and the accompanying timestamp) with `crypto.randomUUID()` from the Web Crypto API, which is cryptographically secure and standard across modern browsers. Always use a CSPRNG for generating tokens, session IDs, or unique identifiers.
