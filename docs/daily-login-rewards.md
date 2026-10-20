# Daily login rewards

## Product behavior

An authenticated account may receive one free virtual-coin reward on its first successful login/check-in for each UTC calendar day. The server selects an integer reward from **5 through 10 coins**. A successful first claim returns `claimed: true`, the awarded amount, and the authoritative post-claim balance. Repeated or concurrent attempts for the same UTC day return `claimed: false`, `coins_rewarded: 0`, and the authoritative current balance.

The Angular application already invokes the check-in after authenticated startup and opens the shared Spartan daily-login dialog only when `claimed` is true. Existing clients therefore continue to work without a new navigation surface. The dialog remains keyboard-operable, screen-reader labelled, touch sized, high-zoom compatible, and dismissible through the shared dialog primitive.

## Authority and concurrency

`public.claim_daily_checkin_reward` is the source of truth. Redis is deliberately not used for correctness. The PostgreSQL function:

1. uses a UTC date boundary;
2. locks the user's balance row;
3. inserts a `(user_id, claim_date)` marker protected by a primary key;
4. atomically increments `users.coins_balance` only for a new marker; and
5. writes the matching `coin_transactions` audit row in the same database transaction.

If any write fails, PostgreSQL rolls the whole function call back. Retries and multi-replica concurrent requests cannot award a second reward for the same UTC day.

The backend chooses the 5-10 coin value using Node's cryptographic random-number generator. Browser clients cannot select a reward amount or call the privileged database function directly.

## Security and privacy

`daily_checkin_claims` has RLS enabled and direct access is revoked from `anon` and `authenticated`. The RPC is `SECURITY DEFINER`, pins its search path, and is executable only by `service_role`. The public API remains behind the existing Supabase authentication guard and economy rate limits.

The claim table contains only account ID, UTC claim date, awarded amount, and creation timestamp. It contains no message content, location, device identifier, IP address, or payment credential. Rows are deleted automatically when the owning account is deleted. They are otherwise retained with the account as compact economy-integrity/audit state.

Provider/database failures are logged only as a generic daily-check-in availability event. The new path does not log account IDs, balances, reward amounts, raw database errors, tokens, or request content.

## Failure behavior

A database/provider failure does not fabricate the previous development fallback balance of 50 and never displays a reward that was not committed. The service returns an additive `unavailable: true` state with `claimed: false`; older clients safely treat it as no reward, while newer consumers may surface a retry message. The normal application remains usable, and a later login/reload can safely retry because the database mutation is idempotent.

Malformed RPC responses fail closed in the same way. Valid duplicate claims remain distinguishable from provider degradation because they include the authoritative balance and do not set `unavailable`.

Metrics continue to record daily check-in claim/no-op volume and transaction latency. Provider/contract failures use the existing economy error metric with the `atomic_rpc_unavailable` classification.

## Deployment and verification

Deploy in this order:

1. Apply `20260824155000_atomic_daily_checkin_rewards.sql`.
2. Deploy the NestJS backend with `AtomicEconomyService` bound to the existing `EconomyService` token.
3. No frontend rollout dependency is required because the existing modal contract is backward compatible.

Verify with two authenticated requests for the same test account on the same UTC day. Exactly one request must return `claimed: true`; the other must return `claimed: false`, and exactly one `daily_checkin` ledger row plus one daily claim marker must exist. Repeat from multiple backend replicas to verify database-level idempotency.

Automated coverage checks the RPC response contract, provider degradation, malformed results, concurrent duplicate behavior, reward bounds, row locking, atomic balance mutation, same-transaction ledger writes, role revocations, UTC semantics, and account-deletion behavior.

## Rollback

Roll application code back first so the previous service implementation is restored only if operationally necessary. The additive `daily_checkin_claims` table and RPC can remain deployed safely during an application rollback and should not be dropped while claim history may be needed to prevent duplicate grants.

Do not reverse already-awarded coin transactions automatically. Any economic correction should use a separately reviewed compensating transaction. If the feature must be disabled, block the API/application trigger while retaining claim and ledger history.
