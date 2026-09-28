# Premium AI coin services

The premium AI coin flow provides server-authoritative, one-off AI purchases inside the existing virtual coin economy. Issue #1700 completes the production contract for the first product, **Conversation Analysis Report**, priced at **30 coins**.

## User flow

The application-level launcher is mounted once and renders only on `/chat/:roomId`. It loads the server catalog, displays the current server price, and asks for confirmation through the shared confirmation dialog before spending coins. The completed report is rendered as escaped text and updates the visible coin balance immediately.

The client creates a cryptographically random UUID idempotency key before submitting the purchase. If the HTTP outcome is unknown, such as a network disconnect, the same key is retained for retry. A completed request with the same key returns its saved result without another charge or another LLM call.

An idempotency key is permanently bound to the conversation room used for its first purchase attempt. Reusing it for another room is rejected before any saved report can be returned. This prevents a retry bug or modified client from using a valid key to cross a private-conversation boundary.

## API

All endpoints are authenticated with the normal Supabase JWT guard, protected by the economy per-user limiter, and return `Cache-Control: no-store`.

- `GET /api/economy/premium-ai/services` returns the backend-owned catalog. Clients must never hard-code or submit a price.
- `POST /api/economy/premium-ai/conversation-analysis` accepts `{ room_id, idempotency_key }`. Both values are UUIDs. The caller must be a member of the room.

The current catalog entry is `conversation_analysis_report` at 30 coins. Pricing lives in the database charge function as well as the read-only catalog, so a modified client cannot buy a report for a different amount.

The purchase endpoint uses these retry-relevant statuses:

- `201`: report completed; the returned balance is authoritative.
- `409`: the same idempotency key is still actively processing. Keep the key for retry.
- `410`: the key belongs to a definitively failed/refunded request or cannot be reused for the requested conversation. Generate a new key before a new purchase attempt.
- `500`: refund/persistence reconciliation is ambiguous. Keep the same key so a retry cannot create a second charge.
- `503`: a known provider/backend failure was returned after the request was either not charged or successfully refunded; a later attempt may use a fresh key.

## State and money movement

`premium_ai_runs` stores one row per `(user_id, service_key, idempotency_key)` and has three states:

1. `pending`: the database has verified room membership, locked the user's balance row, deducted the server-defined price, inserted the run, and recorded `premium_ai_spend` in `coin_transactions`.
2. `completed`: the generated report has been persisted successfully.
3. `failed`: generation or persistence failed while the run was pending, the exact purchase price was returned to the user, and `premium_ai_refund` was recorded.

The `start_premium_ai_service` RPC takes a row lock on the user's wallet before locking or creating a run. `fail_premium_ai_service` uses the same user-then-run lock order. Concurrent purchases and refunds therefore cannot deadlock by taking the same locks in opposite order. The start RPC rechecks the idempotency key while the wallet is locked, so concurrent duplicate requests cannot double-spend. Charge, run creation, and transaction audit insertion are in one PostgreSQL transaction. Completion and failure mutations are backend-only RPCs.

A provider failure is not a successful purchase. The service calls `fail_premium_ai_service` before returning the failure response and now verifies that the RPC actually returned `true`. A false/no-op refund result is treated as reconciliation failure rather than claiming coins were returned.

### Crash recovery

Provider work is bounded to seconds, so a `pending` run whose `updated_at` is at least five minutes old is considered abandoned. The next retry with the same idempotency key atomically:

1. locks the user wallet and the existing run;
2. refunds the exact original `cost_coins`;
3. changes the run to `failed` with the sanitized `stale_timeout` error code;
4. appends a `premium_ai_refund` ledger transaction; and
5. returns the failed run without starting another provider request.

The API then returns `410 Gone`, allowing the client to discard that key and explicitly start a fresh purchase. Recovery-on-retry prevents a backend crash between charge and completion from leaving the learner permanently charged, while avoiding a background unbounded scan. A partial index on `premium_ai_runs(updated_at) WHERE status = 'pending'` also supports bounded operational inspection of stale work.

## Privacy and authorization

The NestJS service uses the service-role Supabase client, so it performs an application-level membership check **before** reading any private conversation text. The charging RPC independently repeats room membership authorization at the database boundary. Existing-run lookup also verifies that the persisted `subject_id` matches the requested room before returning any result.

Only recent text required for the report is sent to the configured LLM:

- at most 120 recent messages;
- at most 1,200 characters from one message;
- at most 12,000 transcript characters in total;
- sender identities are reduced to `Learner` and `Partner` labels;
- NUL characters are removed;
- the system prompt treats the transcript as untrusted data, forbids obeying instructions inside it, forbids sensitive-trait inference, and asks the model not to quote private messages verbatim.

Raw conversation text is never written to `premium_ai_runs`, `coin_transactions`, or application logs. Only the generated report, message count, service key, cost, run identifiers, and sanitized operational status are retained. RLS allows authenticated users to read only their own run rows; authenticated browser clients cannot insert, mutate, complete, fail, refund, or recover runs directly.

Runs cascade-delete when the owning user or subject chat room is deleted. This ties report retention to the source conversation/account lifecycle and avoids orphaned private analysis data.

## Failure handling

The LLM call is bounded to 12 seconds at the service layer. Empty responses and reports over 8,000 characters fail closed. Fewer than two usable text messages are rejected before any charge. Insufficient funds are rejected by the database before provider work begins.

Unknown transport outcomes, active `409` responses, and reconciliation `500` responses must reuse the original key. Known refunded/dead requests return `410` and must use a new key. A duplicate key in `completed` returns the persisted result. These rules avoid both double charging and retry loops around already-refunded runs.

The frontend validates catalog and report response shapes before displaying them. Angular interpolation renders generated output as text, not HTML.

## Accessibility and responsive behavior

The chat launcher uses the existing Spartan button primitive and semantic Relay surface tokens. It remains above the mobile bottom navigation, wraps long service names and model output, caps viewport height, and scrolls long reports rather than overflowing the page. Loading and error states are announced through live regions, the action exposes `aria-busy`, and confirmation uses the application's shared focus-managed confirmation dialog.

## Verification

Focused coverage includes:

- room authorization before service-role message reads;
- no charge for conversations without enough text;
- successful charge, generation, completion, and remaining balance;
- idempotent completed-result replay without another LLM call;
- active-pending `409` behavior;
- failed/refunded `410` behavior;
- cross-room idempotency-key rejection;
- insufficient-funds handling;
- automatic provider-failure refunds;
- fail-closed behavior when the refund RPC reports no mutation;
- the migration's five-minute stale-run refund, audit trail, subject binding, lock order, index, and service-role-only RPC grants;
- frontend preservation of keys for network/409/500 ambiguity and rotation after definitive 410/refunded outcomes;
- controller fail-closed authentication and user scoping;
- authenticated Angular catalog/report requests, identifier validation, secure idempotency key generation, and response-shape bounds.

Before deployment, run the normal repository verification pipeline and a clean Supabase migration replay. In a staging account, verify one successful 30-coin purchase, retry the same idempotency key, simulate an LLM outage to observe the compensating refund transaction, age a synthetic pending run beyond five minutes and verify retry recovery, and verify that a key created for one room cannot retrieve a report through another room.

## Observability

Application logs use fixed/sanitized premium-AI failure classifications and never include transcript text, generated report text, user IDs, room IDs, tokens, or credentials. Operational reconciliation should correlate `premium_ai_runs` with `coin_transactions.metadata.run_id`; `error_code = 'stale_timeout'` identifies crash-recovered runs without exposing conversation content.

Useful production signals are the counts/rates of `pending` runs older than five minutes, `premium_ai_refund` transactions, `stale_timeout` failures, refund-reconciliation errors, provider failures, and latency for the conversation-analysis route. Alert on sustained stale or reconciliation volume rather than individual user activity.

## Rollout and rollback

Deploy in this order:

1. Apply `20260823001000_premium_ai_coin_unlocks.sql` if it is not already deployed.
2. Apply `20260825144500_harden_premium_ai_recovery.sql`.
3. Deploy the backend premium AI service behavior.
4. Deploy the Angular retry-policy update.

The hardening migration preserves existing table and RPC signatures, so it is safe during a mixed-version rollout. Older backends continue to call the same RPCs; old clients remain compatible with successful responses.

During rollback, revert the Angular/backend code first. Leave the forward migration, run records, partial index, and coin transaction audit rows in place: the stronger subject binding, consistent lock order, and stale refund behavior are backward compatible and should not be weakened during an application rollback. Do not rewrite financial history.

If a reconciliation incident remains after a `500`, retry with the **same** idempotency key before taking manual action. Reconcile the run against its `premium_ai_spend` and any `premium_ai_refund` transaction before changing a balance. Never edit the wallet without an accompanying auditable transaction record.
