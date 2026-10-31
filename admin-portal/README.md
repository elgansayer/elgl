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

## Modules

Overview, users, moderation, network security, roles, audit, logs and system health are wired to their versioned `/api/admin/v1` contracts and gated by the backend capability named on each route. User management is an investigation surface (search, open by ID, detail and capability-gated login history); `docs/admin/USER_MANAGEMENT.md` records its failure states and why account enforcement actions are not part of it yet.

See `docs/admin/README.md`, `docs/admin/ARCHITECTURE.md`, `docs/admin/ADMIN_PORTAL.md`, `docs/admin/SECURITY.md`, and `docs/admin/MODULES.md` before implementing privileged features.
