# Daily check-in reward

## Contract

Authenticated users may call `POST /api/economy/daily-check-in`. A successful first claim for the current UTC calendar day returns:

```json
{
  "claimed": true,
  "coins_rewarded": 7,
  "new_balance": 257
}
```

The reward is generated server-side and is always between 5 and 10 coins. A repeated or concurrent claim for the same user and UTC day is idempotent and returns `claimed: false`, `coins_rewarded: 0`, and the user's current authoritative balance.

The Angular app already calls this endpoint after authenticated startup. It opens `DailyLoginModalComponent` only when `claimed` is true, so repeat visits do not display a second reward modal.

## Persistence and concurrency

`20260825090000_atomic_daily_checkins.sql` owns the mutation boundary:

- `daily_checkins` has a `(user_id, checkin_date)` primary key.
- `claim_daily_checkin(uuid)` locks the user's balance row with `FOR UPDATE`.
- the user balance update, daily claim record, and `coin_transactions` ledger entry happen in one PostgreSQL transaction;
- the function derives the calendar day in UTC;
- browser roles cannot execute the function or mutate the table directly; only the service role can execute the claim RPC.

This replaces Redis as the source of truth for claim deduplication. Redis remains an optional cache elsewhere in the economy subsystem and is not required to decide whether a reward was already granted.

## Failure behaviour

Database/provider failure is not represented as `claimed: false` with a fabricated balance. The backend returns HTTP 503 with the stable message `Daily check-in is temporarily unavailable.` The client therefore does not show the reward modal or overwrite its balance with invented data.

The endpoint keeps the existing authentication boundary, no-store response policy, global throttling, and per-user economy rate limit. Diagnostics record aggregate failure/latency metrics and a generic error message without logging the user ID or upstream provider error from the claim service.

## Accessibility and UI

The existing modal uses the repository-owned Spartan Dialog and button primitives. It has an accessible dialog title, a live reward announcement, a touch-sized close action, and translated copy. This change does not alter its visual design or focus lifecycle.

## Verification

Relevant automated coverage:

- `backend/src/economy/atomic-economy.service.spec.ts`
- `backend/src/database/daily-checkin-migration.contract.spec.ts`
- backend unit, lint, build and E2E jobs
- database clean-reset/migration validation
- frontend unit/static-analysis/build jobs for the existing startup/modal integration

## Rollout and rollback

Deploy the migration before or with the backend version that calls `claim_daily_checkin`. The migration is additive and safe to replay through the repository migration runner.

Rollback should restore the previous application version while leaving `daily_checkins` and its ledger history in place. Do not delete claim rows or subtract awarded coins during rollback: those rows are financial/economy history and prevent accidental duplicate grants if the atomic path is re-enabled.
