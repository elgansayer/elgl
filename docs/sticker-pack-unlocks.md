# Sticker pack coin unlock contract

Issue: #1659

## User flow

The Sticker Store lists the authenticated user's current coin balance, pack ownership, pack cost, and whether a pack contains animated stickers. A pack can be unlocked only when the client is online, the pack is not already owned, and the user has enough coins.

Only one unlock can be in flight in the Sticker Store at a time. While an unlock is pending, every remaining purchase action is disabled. This prevents double-clicks or rapid clicks across multiple packs from creating surprising concurrent spends.

The store reads ownership from `EconomyStore.stickerPacks()` rather than retaining the initial resource snapshot, so a successful unlock is reflected immediately without a page reload.

Offline unlocks are deliberately unavailable. Coin spending is not an operation that can be safely queued without a fresh server-authoritative balance and ownership check. The UI displays the existing `economy.offlinePurchaseUnavailable` message and does not call the unlock mutation while offline.

## Server-authoritative transaction

`POST /economy/unlock-sticker-pack` is authenticated and rate limited. The backend delegates the mutation to `public.unlock_sticker_pack_atomic(user_id, pack_id)` using service-role access.

The PostgreSQL function:

- verifies that the pack and user exist;
- locks the user's balance row with `FOR UPDATE`, serialising concurrent unlocks for that user;
- treats an already-owned pack as an idempotent successful no-op;
- rejects insufficient balance before any ownership change;
- deducts the pack cost and inserts `user_sticker_packs` in the same database transaction;
- relies on the unique `(user_id, pack_id)` ownership constraint as the final integrity guard; and
- is executable only by `service_role`, not `anon` or `authenticated` database roles.

A failed ownership insert rolls back the balance deduction with the surrounding PostgreSQL statement. Retried completed requests do not charge twice.

## Privacy and caching

`GET /economy/sticker-packs` contains user-specific ownership and coin-balance information. It must never become a shared browser/CDN object.

`CacheControlInterceptor` now fails closed whenever a request containing an `Authorization` header is paired with a public cache directive. In that case it emits:

- `Cache-Control: private, no-store`
- `CDN-Cache-Control: private, no-store`

and omits cache tags. Unauthenticated requests using the same public directive retain their normal cache policy. This is intentionally a generic safety boundary so a future controller cannot accidentally expose authenticated response state by choosing a public cache constant.

Errors are also always converted to `private, no-store` as before.

## Failure behaviour

- Offline: no mutation is attempted and the purchase buttons are disabled.
- Insufficient coins: the existing backend economy exception contract rejects the request; ownership and balance remain unchanged.
- Unknown pack: the backend returns the existing not-found failure; no coins are deducted.
- Duplicate/retried unlock: the atomic function returns the existing ownership and current balance without another deduction.
- Concurrent unlock clicks: the UI serialises attempts; the database row lock remains the authoritative concurrency boundary for alternate or stale clients.
- Backend/database failure: PostgreSQL atomicity prevents a partial coin-deduction/ownership state.

No private sticker choices, access tokens, balances, or ownership sets are added to application logs by this change.

## Accessibility

The offline state is announced through a polite `role="status"` region. Purchase controls remain native Spartan buttons and expose pack name and coin cost through their existing accessible label. Disabled actions communicate unavailable state semantically rather than by colour alone, and the layout continues to use logical-direction spacing for RTL locales.

## Verification

Regression coverage includes:

- public cache directives staying public for unauthenticated traffic;
- authenticated public directives being downgraded to `private, no-store`;
- cache tags not being attached to downgraded responses;
- normal sticker unlock invocation;
- owned-pack no-op behaviour;
- offline purchase suppression and disabled actions; and
- serialisation of concurrent UI purchase attempts.

The pre-existing economy service tests cover the server unlock business rules and the deployed atomic migration remains forward-only rather than being rewritten.

## Rollout and rollback

No schema migration is required for this PR because the atomic unlock migration is already on `main`. Deploy backend and frontend normally; mixed versions are safe because the API contract is unchanged.

Rollback is a normal revert of this PR. Reverting restores the previous cache/UX behaviour and does not require data repair or a database rollback. The existing atomic unlock function and ownership data remain valid.