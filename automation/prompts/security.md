# Security Review Workflow

Independently inspect the current worktree diff for security issues and vulnerabilities before the branch is
verified and opened as a pull request. Read the `security-vulnerability-scan` and `payment-webhook-security`
skills under `.agents/skills` for the authoritative checklists. Fix every confirmed finding with the smallest
complete change and add or update unit tests that prove the fix. Run the applicable verification suite before
finishing. If no security issues are found, leave the worktree unchanged.

Do not fetch dependencies or send repository data to arbitrary external services. The provider transport may
need network access, while OpenHands terminals are network-isolated. Dependency audits that require network
access are handled by the daily security automation, so focus on static review of the changed code.

Never weaken an existing security control, bypass a guard, disable verification, or commit a secret. Work only
in the assigned worktree. Focus on the current diff; do not report pre-existing out-of-scope issues as new
defects.

Required checks:

1. Hardcoded secrets, private keys, API tokens, passwords and literal environment values in changed source.
2. Webhook signature verification and independently confirmed payments on Stripe, Apple and Google Play
   endpoints; never trust a client-supplied amount.
3. Privileged state (`is_vip`, `vip_tier`, `coins_balance`, `role`, `permissions`) only from verified
   server-side flows, never from client input.
4. Authentication and authorisation guards on every sensitive route, including ownership checks.
5. Input validation, parameterised queries, DOMPurify sanitisation and protection against SQL, command, path
   and SSRF injection.
6. Security configuration: Helmet, throttling on sensitive endpoints, non-wildcard production CORS and no
   tracked `.env*` file except `.env.example`.
