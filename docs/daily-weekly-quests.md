# Daily and weekly quests

Issue #1122 adds a production contract around the existing quest UI and Moment activity hooks.

## Product rules

The initial catalogue is intentionally small and server-owned:

| Period | Quest | Target | Reward |
| --- | --- | ---: | ---: |
| Daily | Correct Moments | 3 | 5 coins |
| Daily | Post a Moment | 1 | 5 coins |
| Weekly | Correct Moments | 10 | 20 coins |

Daily periods start at 00:00 UTC. Weekly periods start Monday at 00:00 UTC. `GET /quests` is authenticated and returns both periods. A first read creates the current default rows; later reads also roll stale rows into the current period.

The existing `MomentsService` activity hooks advance `post_moment` after a Moment is persisted and `correct_moments` after a correction is persisted. Quest configuration remains authoritative in PostgreSQL so clients cannot choose targets or rewards.

## Atomic rewards and retries

`advance_user_quests` locks every matching current quest row before changing progress. The same transaction marks the completion, writes `reward_claimed_at`, increments `users.coins_balance` through `add_user_coins`, and appends a `coin_transactions` row. Concurrent completion attempts therefore observe the claimed row and cannot award the same period twice.

Progress inputs are restricted to known quest keys and integer increments from 1 through 100 in both NestJS and PostgreSQL. Direct authenticated INSERT/UPDATE/DELETE access to `user_quests` is revoked. Authenticated clients can only read their own rows through RLS; mutations are service-role RPCs reached through authenticated application behavior.

Legacy duplicate defaults are collapsed during migration, keeping the most advanced row. Existing completed legacy rows are backfilled as already claimed so deployment cannot replay historical rewards.

## Failure behavior and observability

Database failures are converted to stable API errors and logged without user IDs, database details, content, credentials, or tokens. The Angular store keeps previously loaded quests on transient refresh failures and renders an explicit retry state instead of presenting an outage as an empty quest list. Progress bars clamp malformed values and do not divide by zero.

A quest-progress RPC is transactional: coin mutation, transaction history, and completion state either all commit or all roll back. This prevents partial coin rewards when PostgreSQL rejects any step.

## Data lifecycle

There is one mutable row per `(user_id, quest_type, quest_key)`, not an ever-growing row per day/week. Period rollover resets progress and advances `period_start`. `coin_transactions` is the durable audit trail for awarded currency. User deletion cascades quest and coin-transaction rows through their existing foreign keys.

## Verification

Run the normal repository verification pipeline, including a clean Supabase migration replay. Focused coverage lives in:

- `backend/src/quests/quests.service.spec.ts` for RPC delegation, validation, read normalization and failure behavior.
- `frontend/src/app/components/quests/quests.component.spec.ts` for loading, empty, retry, daily/weekly display and bounded progress rendering.
- the migration itself, exercised by the repository's clean database reset job, for schema/function validity.

For a manual smoke test, create a test user, call `GET /quests`, create one Moment, then correct three Moments. Confirm daily progress reaches its targets, exactly one `quest_reward` transaction exists per completed quest, and repeated/concurrent completion calls do not increase the reward again.

## Rollout

Deploy `20260822120000_harden_daily_weekly_quests.sql` before the backend build that calls the new RPCs. The migration is mixed-version safe: the legacy columns remain available and the new uniqueness/RLS rules match existing application ownership.

Then deploy backend and frontend normally. Watch quest RPC error logs and `coin_transactions` rows with `type = 'quest_reward'` for unexpected volume.

## Rollback and recovery

Application rollback is safe because the legacy quest columns remain. Do **not** reverse coin transactions automatically: rewards may already have been legitimately consumed. If the new RPCs must be disabled, roll the application back first, revoke their service-role EXECUTE grants, and investigate any suspect `quest_reward` audit rows before making compensating economy changes.

The `period_start` and `reward_claimed_at` columns can remain in place during rollback. Removing them or the uniqueness constraint is unnecessary and would weaken retry safety.
