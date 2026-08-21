# ELGL Admin Portal

Dedicated privileged Angular application for ELGL operations. It is intentionally separate from the consumer frontend and must communicate only with the versioned admin API described in `docs/admin/`.

## Local development

```bash
cd admin-portal
npm install
npm start
```

The development server uses port `4300` by default.

## Security rules

- Never connect directly to Supabase, databases, storage providers or infrastructure control planes from browser code.
- Never ship service-role keys, provider tokens, encryption keys or other secrets to this application.
- Backend capability checks are authoritative. Route or navigation hiding is UX only.
- Do not introduce mock-success fallbacks for privileged mutations.
- Sensitive data must already be minimized/redacted by the admin API.
- High-risk actions must use backend step-up authentication, reason, approval and audit mechanisms.

## Initial modules

The foundation reserves routes for overview, users, moderation, audit, logs and system health. These are placeholders until their versioned `/api/admin/v1` contracts are wired.

See `docs/admin/README.md`, `docs/admin/ARCHITECTURE.md`, `docs/admin/ADMIN_PORTAL.md`, `docs/admin/SECURITY.md`, and `docs/admin/MODULES.md` before implementing privileged features.
