# Premium AI coin services

Issue #1156 adds server-authoritative, one-off AI purchases to the existing virtual coin economy. The first product is **Conversation Analysis Report**, priced at **30 coins**.

## User flow

The application-level launcher is mounted once and renders only on `/chat/:roomId`. It loads the server catalog, displays the current server price, and asks for confirmation through the shared confirmation dialog before spending coins. The completed report is rendered as escaped text and updates the visible coin balance immediately.

The client creates a cryptographically random UUID idempotency key before submitting the purchase. If the HTTP outcome is unknown, such as a network disconnect, the same key is retained for retry. A completed request with the same key returns its saved result without another charge or another LLM call.

## API

All endpoints are authenticated with the normal Supabase JWT guard, protected by the economy per-user limiter, and return `Cache-Control: no-store`.

- `GET /api/economy/premium-ai/services` returns the backend-owned catalog. Clients must never hard-code or submit a price.
- `POST /api/economy/premium-ai/conversation-analysis` accepts `{ room_id, idempotency_key }`. Both values are UUIDs. The caller must be a member of the room.

The current catalog entry is `conversation_analysis_report` at 30 coins. Pricing lives in the database charge function as well as the read-only catalog, so a modified client cannot buy a report for a different amount.

## State and money movement

`premium_ai_runs` stores one row per `(user_id, service_key, idempotency_key)` and has three states:

1. `pending`: the database has verified room membership, locked the user's balance row, deducted the server-defined price, inserted the run, and recorded `premium_ai_spend` in `coin_transactions`.
2. `completed`: the generated report has been persisted successfully.
3. `failed`: generation or persistence failed while the run was pending, the exact purchase price was returned to the user, and `premium_ai_refund` was recorded.

The `start_premium_ai_service` RPC takes a row lock on the user before charging and rechecks the idempotency key after acquiring that lock. Concurrent duplicate requests therefore cannot double-spend. Charge, run creation, and transaction audit insertion are in one PostgreSQL transaction. Completion and failure mutations are backend-only RPCs.

A provider failure is not a successful purchase. The service calls `fail_premium_ai_service` before returning the failure response. If refund persistence itself fails, the API returns an internal error that explicitly requires reconciliation rather than claiming a refund happened.

## Privacy and authorization

The NestJS service uses the service-role Supabase client, so it performs an application-level membership check **before** reading any private conversation text. The charging RPC independently repeats room membership authorization at the database boundary.

Only recent text required for the report is sent to the configured LLM:

- at most 120 recent messages;
- at most 1,200 characters from one message;
- at most 12,000 transcript characters in total;
- sender identities are reduced to `Learner` and `Partner` labels;
- NUL characters are removed;
- the system prompt treats the transcript as untrusted data, forbids obeying instructions inside it, forbids sensitive-trait inference, and asks the model not to quote private messages verbatim.

Raw conversation text is never written to `premium_ai_runs`, `coin_transactions`, or application logs. Only the generated report, message count, service key, cost, run identifiers, and sanitized operational status are retained. RLS allows authenticated users to read only their own run rows; authenticated browser clients cannot insert, mutate, complete, fail, or refund runs directly.

Runs cascade-delete when the owning user or subject chat room is deleted. This ties report retention to the source conversation/account lifecycle and avoids orphaned private analysis data.

## Failure handling

The LLM call is bounded to 12 seconds at the service layer. Empty responses and reports over 8,000 characters fail closed. Fewer than two usable text messages are rejected before any charge. Insufficient funds are rejected by the database before provider work begins.

Known server failures may be retried with a new idempotency key after the API confirms failure/refund. Unknown network outcomes must reuse the original key. A duplicate key in `pending` returns conflict rather than launching a second provider request, while a duplicate key in `completed` returns the persisted result.

The frontend validates catalog and report response shapes before displaying them. Angular interpolation renders generated output as text, not HTML.

## Accessibility and responsive behavior

The chat launcher uses the existing Spartan button primitive and semantic Relay surface tokens. It remains above the mobile bottom navigation, wraps long service names and model output, caps viewport height, and scrolls long reports rather than overflowing the page. Loading and error states are announced through live regions, the action exposes `aria-busy`, and confirmation uses the application's shared focus-managed confirmation dialog.

## Verification

Focused coverage includes:

- room authorization before service-role message reads;
- no charge for conversations without enough text;
- successful charge, generation, completion, and remaining balance;
- idempotent completed-result replay without another LLM call;
- insufficient-funds handling;
- automatic provider-failure refunds;
- controller fail-closed authentication and user scoping;
- authenticated Angular catalog/report requests, identifier validation, secure idempotency key generation, and response-shape bounds.

Before deployment, run the normal repository verification pipeline and a clean Supabase migration replay. In a staging account, verify one successful 30-coin purchase, retry the same idempotency key, simulate an LLM outage to observe the compensating refund transaction, and verify another room member cannot be analyzed by a non-member.

## Rollout and rollback

Deploy in this order:

1. Apply `20260823001000_premium_ai_coin_unlocks.sql`.
2. Deploy the backend with the premium AI controller/service.
3. Deploy the Angular client/launcher.

The change is additive and safe for older clients. During rollback, revert the Angular launcher and backend routes first. Keep the migration, run records, and coin transaction audit rows in place; do not drop them or rewrite financial history. Backend-only RPC permissions mean leaving the schema deployed does not expose a direct client mutation path.

If an incident occurs after a charge and before a normal refund response, reconcile any `pending` run against its corresponding `premium_ai_spend` transaction before manually changing balances. Never edit the balance without an accompanying auditable transaction record.
