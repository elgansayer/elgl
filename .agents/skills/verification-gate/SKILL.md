---
name: verification-gate
description: 'Run the full completion checklist (lint, build, test, control-flow, RTL-logical, constitution) before marking any HelloTalk clone task complete in TODO.md. Use before every commit or before checking off a TODO.md item, for both frontend and backend changes.'
---

# Verification Gate

## When to Use

Before marking any `TODO.md` item complete, before ending a work session, and after any non-trivial code change - per `AGENTS.md` Section 4 ("Autonomous Execution Protocol") and Section 6 ("Completion gate for frontend changes").

## Full Command Sequence

Run from the repo root unless noted:

```bash
# 1. Constitution check (British spelling, no em dash, RTL logical classes,
#    API-first/no direct Supabase client in frontend, no legacy *ngIf/*ngFor)
node scripts/verify-constitution.mjs

# 2. Backend
cd backend
npm run build
npm run lint
npm test

# 3. Frontend
cd ../frontend
npx ng build
npm run lint
npm run test -- --watch=false
npm run check:control-flow
npm run check:rtl-logical
npm run check:template-bindings
```

Or via the root `package.json` shortcuts:

```bash
npm run lint     # constitution check + backend eslint
npm run build    # frontend ng build + backend nest build
npm run test     # frontend vitest + backend vitest
npm run check:control-flow
```

## Pass Criteria

- Zero TypeScript compiler errors in both `frontend/` and `backend/`.
- Zero ESLint errors (warnings should still be reviewed, but the hard gate is errors) in both projects.
- 100% of existing Vitest (`backend/` and `frontend/`) test suites passing - do not mark work done with a known-broken test; fix or explicitly and visibly flag it first.
- `verify-constitution.mjs` reports `SUCCESS: Zero constitution violations detected.`
- Frontend `check:control-flow` / `check:rtl-logical` / `check:template-bindings` all report "passed" (no legacy `*ngIf`/physical direction classes/`ngClass`/`ngStyle`).

## What This Does NOT Catch (verify manually)

- Explicit `standalone: true` or `ChangeDetectionStrategy.OnPush` in `@Component`/`@Directive` decorators (banned by `AGENTS.md`/`copilot-instructions.md`, but not grepped by `verify-constitution.mjs`). Grep manually: `grep -rn "standalone: true" frontend/src`.
- Hard-coded UI strings that aren't obviously American-English words (see `i18n-translation-workflow` skill - there is no automated check for this yet).
- Payment/webhook authenticity (see `payment-webhook-security` skill - signature verification bugs pass every test above because the missing check simply isn't exercised by existing tests).
- Whether newly-added tests actually assert the security/behavioural property they claim to (happy-path-only tests can pass while a real vulnerability exists, as found in the 2026-07-22 audit of `monetisation`/`economy`).

## After Verification Passes

Only then check off the corresponding `TODO.md` item(s), and update `AGENTS.md` Section 8 if the change resolves (or newly reveals) a known issue.
