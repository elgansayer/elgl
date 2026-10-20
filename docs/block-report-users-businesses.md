# Block and Report Users or Businesses

Issue #1198 is implemented through the shared trust-and-safety boundary. Business profiles are not a separate identity type: business metadata is stored on the existing `users` record, so the same authenticated safety APIs apply to personal and business accounts.

## Runtime contract

All safety routes are protected by `SupabaseAuthGuard` under `/safety`.

- `POST /safety/block/:blockedId` blocks an existing target account.
- `POST /safety/unblock/:blockedId` removes the caller's block.
- `POST /safety/report` records a report with a validated reason category and optional description/context URL.
- `GET /safety/blocked-ids` returns the caller's blocked-account IDs.
- `GET /safety/report-categories` supplies the report reason catalogue used by the report dialog.

The backend validates the target against `users` before a block or report is persisted. This includes accounts using the optional business profile fields because those fields are columns on the same user record.

## User interface

The Angular safety service owns the authenticated block, unblock and report API calls. `ReportUserModalComponent` provides the shared report flow and an optional block-after-report action. The same target user ID is used regardless of whether the profile represents an individual or business account.

The report flow uses Spartan dialog, radio, checkbox, textarea and button primitives so keyboard, focus, disabled and dismissal behavior remain primitive-owned. Reporting and blocking must never rely on colour alone to communicate state.

## Privacy and authorization

- Callers cannot report or block themselves.
- The target must exist as an application user before a safety mutation is accepted.
- Block relationships are stored as caller-owned edges in `blocks`.
- Reports are stored in `reports`; clients receive the normal success/failure contract, not database records or provider diagnostics.
- Business contact/profile metadata is not copied into block or report records.
- Safety cache invalidation runs after successful trust-graph mutations so discovery, chat and feed filtering can converge on the new relationship.

## Failure behavior

A missing target fails without creating a block/report. Persistence failures do not return a fabricated success. The UI keeps error handling at the safety boundary and should allow a failed action to be retried without exposing database/provider detail.

## Verification

Focused business-target coverage:

```bash
cd backend
npm test -- src/safety/safety-business-targets.spec.ts
```

Repository validation:

```bash
cd backend
npm run lint:check
npm run build
npm test
npm run test:e2e
```

The pull-request CI suite remains authoritative for cross-project checks, database replay, dependency review and repository governance.

## Rollout and rollback

No schema migration or backfill is required for #1198. Existing business accounts already use the `users` identity row and therefore inherit the same safety behavior. Rollout is a normal application/test deployment. Rollback is a normal revert of the regression/documentation commit; persisted block/report data is unaffected.
