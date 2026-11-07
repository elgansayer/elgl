# Block and Report Users or Businesses

Issue #1198 delivered the first implementation. Issue #1831 hardens it into a production contract: one shared server boundary, explicit idempotency and abuse limits, database-level invariants, observability and a consistent user interface. Business profiles are not a separate identity type: business metadata is stored on the existing `users` record, so the same authenticated safety APIs apply to personal and business accounts.

## One shared boundary

Every route that creates or removes a block, or files a report, delegates to `SafetyService` (`backend/src/safety/safety.service.ts`). No route keeps its own weaker copy of the rules.

| Capability | Routes (all require `SupabaseAuthGuard`) |
| --- | --- |
| Report | `POST /safety/report` (canonical), `POST /users/report` (legacy snake_case), `POST /moderation/report` (legacy camelCase) |
| Block | `POST /safety/block`, `POST /safety/block/:blockedId`, `POST /users/block/:id`, `POST /blocks` |
| Unblock | `POST /safety/unblock`, `POST /safety/unblock/:blockedId`, `DELETE /users/block/:id`, `DELETE /blocks/:blockedId` |
| Read | `GET /safety/report-categories`, `GET /safety/blocked-ids`, `GET /blocks` (paged, see `docs/block-management.md`) and the other `GET /safety/*` helpers |

`BlocksModule`, `ModerationModule` and `UsersModule` import `SafetyModule` for this reason. `backend/src/safety/safety.constants.ts` is the single source of truth for the category list, length limits, link pattern and daily limit used by the DTOs, the service, the catalogue returned to clients and the database migration.

## Input validation

- Account identifiers must be UUIDs (`@IsUUID()` on the DTOs, `ParseUUIDPipe` on path parameters, `isUUID` in `BlocksController`). The service lower-cases them before comparing, so an upper-case copy of the caller's own id cannot slip past the self-block and self-report checks.
- `reason_category` must be one of `harassment`, `spam`, `inappropriate_content`, `fake_profile`, `other`.
- `description` is trimmed, a blank value counts as absent, and the maximum is 500 characters.
- `context_url` is optional, at most 2048 characters, and must be an absolute `http(s)` link or an app-relative path. `javascript:`, `data:`, protocol-relative `//host` links, whitespace, quotes, angle brackets and backslashes are rejected because moderators see the value.
- The global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted` and `transform`) rejects unknown properties and malformed values with `400` before the service runs, so malformed input never reaches the database.

## State transitions and idempotency

| Operation | First request | Repeat of the same request | Concurrent identical requests |
| --- | --- | --- | --- |
| Block | Success body `{ success: true, blocked_id, already_blocked: false }` | Same success body with `already_blocked: true`, caches refreshed so a retry after a partial failure converges | The `(blocker_id, blocked_id)` unique constraint lets one insert win and the rest report `already_blocked` |
| Unblock | Success body `{ success: true }` and the block-removed metric increments | Same success body, no metric, no error | Deleting an absent row is a no-op |
| Report | Creates a `pending` report and returns `report_id` with `duplicate: false` | While a `pending` report for the same reporter, target and reason exists, the existing `report_id` is returned with `duplicate: true` and nothing new is stored | A partial unique index on open reports lets one insert win; the loser reads the winner's row and returns it as a duplicate |

Success bodies use the framework default status: `201` for the `POST` routes and `200` for the `DELETE` routes. State only changes on the server. The Angular client updates its blocked-account cache after the API has accepted the request, never before, so a failed request cannot leave the interface showing a block that does not exist.

## Failure behaviour

| Condition | Result |
| --- | --- |
| Missing or invalid token | `401` |
| Invalid payload, self-block or self-report | `400` with a validation message |
| Target account does not exist, or was deleted between the lookup and the write | `404`, nothing is persisted |
| Per-route throttle exceeded (see below) | `429` from the throttler |
| Reporter already filed 20 distinct reports in a rolling 24 hours | `429 Report limit reached. Please try again later.` |
| Database or provider failure | `500` with a generic message such as `Unable to submit report`; provider text is never returned |

A failed duplicate or quota lookup never fabricates success. Two lookups fail soft by design: the daily-limit count fails open (a report is a protective action and the insert that follows fails on its own if the database is genuinely down), and cache invalidation runs in the background so a Redis problem can never fail or delay a block or report that already succeeded.

## Abuse resistance

- Throttles per client: `5/min` for the report routes, `30/min` for block and unblock mutations.
- Daily report ceiling of 20 distinct reports per account (`SAFETY_MAX_REPORTS_PER_REPORTER_PER_DAY`). Retries and repeats of an already open report never count against it.
- One open report per reporter, target and reason, so repeated taps or a scripted loop cannot flood the moderation queue with copies.
- The legacy moderation queue routes (`GET /moderation/items`, `POST /moderation/approve`, `POST /moderation/reject`, `GET /moderation/analyse/:userId`) now require `AdminGuard` plus the `moderation.cases.read` or `moderation.cases.manage` capability. Previously any signed-in account could list reports and approve or reject them, which would have let a reported person dismiss a report about themselves. The first-party moderation dashboard is already behind `adminGuard` and the admin portal uses `/admin/v1/moderation/reports`, so legitimate operators are unaffected.

## Authorisation and privacy

- Every route acts only on the caller's own trust graph. Reading another person's block lists returns `403`.
- Reports are stored in `reports`; clients receive the success contract, never database rows or provider diagnostics.
- Business contact and profile metadata is never copied into block or report records.
- Cache invalidation after a successful change lets discovery, chat and feed filtering converge on the new relationship.
- Logs are structured and sanitised. They carry an event name, opaque ids, a bounded category and a database error code. They never carry the description, the context link, tokens or provider messages.

## Data model and migration

`supabase/migrations/20261104090000_harden_block_and_report_invariants.sql` enforces the same invariants in the database so a racing request, an older application version or a direct PostgREST client cannot bypass them:

1. `blocks_no_self_block`: `CHECK (blocker_id <> blocked_id) NOT VALID`. It applies to every new row without scanning or rejecting history.
2. `reports_open_user_report_unique_idx`: partial unique index on `(reporter_id, reported_user_id, reason_category)` for open, user-category reports created at or after the migration. Older duplicate rows are deliberately outside the index so the migration can never fail on historical data; the application still de-duplicates against them by query.
3. `reports_insert_own`: the row-level security policy now only admits an open, non-self report with a known category and bounded text from a direct authenticated client. The backend uses the service role and is unaffected.

Expected query patterns, all served by existing or new indexes with no unbounded scans or N+1 lookups:

- open-report lookup by reporter, target, category and `pending` status (oldest row, `LIMIT 1`);
- daily-limit count of one reporter's recent reports (`reports_reporter_created_at_idx`);
- block upsert `ON CONFLICT (blocker_id, blocked_id)` (`unique_block`).

Retention is unchanged. Terminal reports are purged after 365 days by `DataRetentionService`; blocks live until unblocked or until the account is deleted (`ON DELETE CASCADE`).

## Observability

- `hellotalk_ts_safety_operations_total{operation, outcome}` counts every block, unblock and report request. `operation` is `report`, `block` or `unblock`; `outcome` is `success`, `duplicate`, `rejected`, `rate_limited` or `failure`. Both labels come from closed vocabularies so the series count stays bounded.
- The existing `hellotalk_ts_reports_submitted_total`, `hellotalk_ts_blocks_created_total` and `hellotalk_ts_blocks_removed_total` counters now increment only on real state changes, not on repeats.
- Datadog monitors in `config/datadog/ts-monitors.json`: **Block and report request failures** (more than 5 failures in 10 minutes) and **Daily report limit reached** (more than 10 refused reports in 30 minutes). The agent scrape list in `config/datadog/datadog-agent.yaml` includes the new counter.
- Structured log events: `safety.report.created`, `safety.report.duplicate`, `safety.report.rate_limited`, `safety.report.insert_failed`, `safety.report.insert_empty`, `safety.report.duplicate_lookup_failed`, `safety.report.quota_check_failed`, `safety.block.created`, `safety.block.repeated`, `safety.block.insert_failed`, `safety.unblock.removed`, `safety.unblock.repeated`, `safety.unblock.delete_failed`, `safety.<operation>.target_lookup_failed` and `safety.cache_invalidation_failed`.

To diagnose a failure without database access, filter the API logs on the event name above, read the database error code, and correlate the spike with `hellotalk_ts_safety_operations_total{outcome="failure"}`.

## User interface

- **Profile page** (`UserDetailComponent`): Report and Block or Unblock actions for every account that is not the signed-in member. Blocking asks for confirmation that spells out the consequences, wording differs for a business, the control is disabled with `aria-busy` and a screen-reader status while the request is pending, and a failure shows a retryable inline alert plus a toast.
- **Report dialog** (`ReportUserModalComponent`, opened through `ReportButtonComponent` and `ReportUserModalService`): the reason catalogue comes from the API with a fully translated offline fallback. Personal and business reports use different headings and introductions. An optional "also block this account" choice explains its consequence. The dialog stays open with a safe, translated message when the report fails (daily limit, account not found or a generic error) and never shows raw transport text or request URLs. A repeat of an open report says so instead of claiming a new one was filed. If the follow-up block fails, the filed report is kept and the person is told.
- **Chat messages**: the context menu reports a sender after confirmation and blocks after confirmation. Success and failure are announced with toasts, and the message is hidden only when the API accepted the block.
- **Trust and safety modal** and **economy store**: use the same translated catalogue and copy, including the duplicate-report message.
- **Own profile**: no block or report controls are rendered for the signed-in member's own account.

Keyboard operation, focus management and dismissal come from the Spartan dialog, radio, checkbox, textarea and button primitives. State is never communicated by colour alone, spacing uses logical (RTL-safe) utilities, and every string is a translation key.

## Verification

Focused backend coverage:

```bash
cd backend
npx vitest run src/safety src/blocks src/moderation src/users/users.controller.spec.ts src/metrics
npx vitest run src/database/migrations/20261104090000_harden_block_and_report_invariants.spec.ts
npx vitest run --config vitest.e2e.config.mts test/safety.e2e-spec.ts
```

The end-to-end suite runs the real controllers, validation pipe, throttler and `SafetyService` against an in-memory database that enforces the same uniqueness rules as the migration. It covers validation, idempotent block, unblock and report, the daily limit, the legacy `/users` routes and failure paths.

Focused frontend coverage:

```bash
cd frontend
npx ng test --no-watch \
  --include 'src/app/services/safety.service.spec.ts' \
  --include 'src/app/services/economy.store.safety.spec.ts' \
  --include 'src/app/components/report-user-modal/*.spec.ts' \
  --include 'src/app/components/user-detail/*.spec.ts' \
  --include 'src/app/components/chat-message/*.spec.ts'
```

Repository validation (`lint:check`, `build`, `test`, `test:e2e` for the backend and the frontend equivalents) remains authoritative in CI.

## Rollout and rollback

Rollout order:

1. Apply the migration. It is idempotent and safe to retry. It holds a short `SHARE ROW EXCLUSIVE` lock on `reports` only while the index is built, and adds the `blocks` check without scanning existing rows.
2. Deploy the backend.
3. Deploy the frontend. It tolerates a backend that does not yet return `duplicate` or `already_blocked`.

Mixed versions are safe. An older backend running against the new migration still works: a duplicate open report now fails with a unique violation, which the older code already surfaces as a generic failure. An older frontend running against the new backend sees a repeated block succeed instead of returning `400`.

Rollback: revert the application deployment (backend, frontend or both independently); persisted blocks and reports are untouched. To remove the database invariants as well, run the manual rollback statements documented at the top of the migration (`DROP INDEX IF EXISTS public.reports_open_user_report_unique_idx;`, `ALTER TABLE public.blocks DROP CONSTRAINT IF EXISTS blocks_no_self_block;`, then recreate `reports_insert_own` from `20260816032203_moderation_report_capability_boundary.sql`). No data is modified by the migration, so there is nothing to restore.
