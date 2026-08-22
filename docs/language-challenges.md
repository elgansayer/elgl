# Language challenges

Issue: #1157

Language Challenges are opt-in study streaks funded by learner coin entry fees. The first shipped experience is exposed from `/study-streak` and defaults to a seven-day writing/study streak. The backend contract remains generic enough for future challenge templates without allowing the browser to mutate balances, prize pools, participation, or progress directly.

## Product rules

- A signed-in learner can create a challenge lasting 1–30 days with an entry fee of 1–1,000 coins.
- Creating a challenge does not spend coins and does not auto-enrol the creator. Entry fees are charged only after an explicit Join confirmation.
- Challenge days use UTC so changing a device timezone cannot create extra daily progress.
- A learner can check in once per UTC day. Repeating a request for the same day is idempotent and returns the existing progress.
- `streak` is the default challenge type. The historical `points` type remains API-compatible and currently uses the same one-daily-participation-unit completion rule; a future scored activity source must change that contract explicitly rather than trusting client-supplied points.
- The challenge closes for new joins and check-ins at `ends_at`.
- After the deadline, an eligible participant can trigger settlement. Settlement determines every participant who has at least `duration_days` distinct activity dates, splits the prize pool evenly, credits all winners in one database transaction, and persists each winner's prize.
- Integer remainder coins remain on the completed challenge as an auditable remainder. They are not minted, discarded, or assigned according to claim order.
- Once settled, later claim retries return the stored prize for that learner and never pay winners twice.

The daily activity is deliberately a participation/check-in primitive. This issue does not inspect or retain a learner's private chat text or Moment content to prove study activity. A future content-verified challenge must introduce an explicit, privacy-reviewed evidence source.

## API

All routes are protected by `SupabaseAuthGuard` and use the authenticated user ID from `CurrentUser`.

| Method | Route | Behavior |
| --- | --- | --- |
| `GET` | `/language-challenges?limit=20&offset=0` | Returns a bounded challenge page enriched only with the caller's participation/progress. |
| `POST` | `/language-challenges` | Creates a bounded challenge. |
| `POST` | `/language-challenges/:id/join` | Atomically charges the entry fee, creates participation, grows the pool, and writes a coin ledger row. Retry-safe. |
| `POST` | `/language-challenges/:id/daily-checkin` | Records one UTC-day check-in. Retry-safe. |
| `POST` | `/language-challenges/:id/claim` | Atomically settles all winners after the deadline or returns the caller's previously settled prize. |

Collection reads are capped at 50 rows per request and offsets at 10,000. Database/provider failures are surfaced as unavailable states rather than being misrepresented as an empty challenge list.

## Data model

`20260823003000_harden_language_challenges.sql` owns the production contract:

- `language_challenges`: public challenge metadata, dates, entry fee, pool, lifecycle state, creator.
- `language_challenge_participants`: one row per challenge/user with final status and persisted prize.
- `language_challenge_daily_activity`: one row per challenge/user/UTC date.
- existing `users.coins_balance`: authoritative balance.
- existing `coin_transactions`: auditable `challenge_entry` debits and `challenge_prize` credits.

Indexes cover status/end-time listing and participant/progress lookups. Participant and activity rows cascade with user/challenge deletion. A challenge created by a deleted creator also cascades, including its participant/activity rows; coin transaction rows follow the repository's existing user-retention policy.

## Economy integrity and concurrency

Economy mutations are PostgreSQL functions executed only by the service role. `PUBLIC`, `anon`, and `authenticated` cannot execute them directly.

`join_language_challenge` locks both the challenge and balance row. The `(challenge_id, user_id)` uniqueness rule plus an existing-participant check makes duplicate transport retries return success without a second debit. Balance debit, participant insertion, pool increment, and ledger insertion share one transaction.

`claim_language_challenge_prize` locks the challenge row. That serialises concurrent settlement attempts. The first valid settlement credits every winner, records each ledger credit, persists participant outcomes, and completes the challenge in the same transaction. Later attempts observe `completed` and return persisted state.

No code path calls the old multi-step `MonetisationService.deductCoins()` / `addCoins()` sequence for challenges, because those separate calls could leave partial debits or duplicate payouts after process failure.

## Security and privacy

- The list endpoint is authenticated; it exposes only the caller's participation/progress enrichment.
- Browser roles have read-only RLS access to challenge metadata and owner-only access to their participant/activity records.
- Direct table writes are not granted to browser roles.
- Challenge IDs are UUID-validated at the controller boundary.
- Title/description, duration, fee, pagination, and type inputs are bounded independently in DTO/database layers where applicable.
- Backend logs contain operation/error categories and identifiers already used for request correlation, but not challenge descriptions, check-in content, balances, access tokens, or provider error bodies.
- The feature does not add analytics containing challenge text or participant identities.

## UX and accessibility

The `/study-streak` page retains the learner's existing streak indicator and adds the challenge dashboard. The UI provides explicit loading, empty, retry, mutation-failure, joined, active, ended, completed, and failed states.

Joining is a high-impact coin-spend action and requires a second confirmation that names the coin amount. Actions use Spartan buttons/inputs, layouts wrap at narrow widths/high zoom, progress exposes native progressbar semantics, live status changes are announced, and completion/failure text does not rely on colour alone.

## Failure and recovery

- **List provider failure:** existing loaded rows remain visible and a retry action is shown.
- **Join network ambiguity:** repeating Join is safe; the RPC detects existing participation and does not charge again.
- **Concurrent joins:** challenge/user row locking serialises pool/balance changes.
- **Duplicate daily check-in:** treated as successful already-recorded progress.
- **Check-in after deadline:** rejected without changing progress.
- **Claim before deadline/incomplete streak:** rejected without changing balances.
- **Concurrent claims:** challenge row locking permits one settlement only.
- **Process/database failure during an RPC:** PostgreSQL rolls back the transaction, so balance, ledger, pool, participation, and settlement remain consistent.
- **Malformed provider/RPC response:** backend fails closed with a stable unavailable response.

## Verification

Automated coverage includes:

- backend service contract tests for idempotent joins/check-ins/claims, error mapping, malformed RPC responses, bounded listing, and creation normalisation;
- migration contract tests for constraints, RLS, service-role-only RPCs, atomic debit/pool/ledger behavior, UTC check-ins, one-time settlement, and replay safety;
- Angular component tests for loading, fee/pool rendering, two-step join confirmation, canonical refresh after a join, stale-data preservation on failure, and bounded progress rendering;
- the repository's normal clean Supabase migration replay, backend/frontend unit/build/static-analysis, design governance, dependency review, and E2E gates.

Manual release smoke test:

1. Give test learner A and B known coin balances.
2. Create a seven-day challenge and verify creation alone changes no balance.
3. Join A twice using the same account and verify exactly one debit/participant/ledger entry and one pool contribution.
4. Join B and verify the pool equals both fees.
5. Check in twice during one UTC day and verify progress grows by only one.
6. Seed/advance seven distinct activity dates in staging, move the challenge past `ends_at`, then trigger Claim concurrently from A and B.
7. Verify every eligible winner receives one equal credit, no duplicate `challenge_prize` rows appear, final participant prizes are persisted, and the completed challenge keeps only the integer remainder.
8. Verify a third claim request only returns the stored prize.
9. Verify free navigation, keyboard-only use, a narrow mobile viewport, dark/light themes, and 400% browser zoom.

## Rollout

1. Apply `20260823003000_harden_language_challenges.sql` first. It is additive/convergent and preserves historical rows through `IF NOT EXISTS`, `CREATE OR REPLACE`, and `NOT VALID` compatibility constraints.
2. Deploy the backend so challenge actions use the atomic RPCs.
3. Deploy the frontend challenge dashboard.
4. Run the smoke sequence above and watch sanitized API/DB error rates for challenge operations.

Mixed versions are safe: old clients cannot invoke the new service-role-only functions directly, and the backend remains the write authority.

## Rollback

Disable/remove the frontend challenge surface first, then revert backend routing/service changes if required. Do **not** blindly reverse coin transactions, remove settled participant rows, or drop the migration during a normal application rollback: those rows are financial/audit state. Leave the additive schema/RPCs in place while application traffic is disabled. Any compensating coin correction or destructive data removal requires a separate reviewed migration with an explicit ledger policy.
