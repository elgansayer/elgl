# Block management

Issue #1672 exposes the authenticated block APIs as a production user-facing management flow.

## Product contract

- Privacy Settings links to `/blocks`; `/settings/blocked-users` is a compatibility alias.
- The page loads the signed-in user's blocked-account summaries from `GET /blocks`.
- Loading, empty, stale-data refresh failure, and first-load failure are distinct states.
- Unblocking is a two-step action. The first activation reveals Cancel/Unblock controls; no mutation is sent until the second activation.
- A row is removed only after `DELETE /blocks/:blockedId` returns `{ success: true }`.
- Failed unblocks keep the account in the list and keep confirmation available for an explicit retry.
- Duplicate unblock requests for the same account are suppressed while the first request is pending.

## API and query contract

`GET /blocks` remains an array response for compatibility and now accepts bounded pagination:

- `limit`: integer from 1 through 100, default 100;
- `offset`: integer from 0 through 10,000, default 0.

Rows are selected newest-block first. The service clamps limits again internally so non-HTTP callers cannot trigger an unbounded query. The Angular client requests 100-row pages sequentially and stops at a short page or 500 rows, whichever comes first. Profile hydration is a single `users ... IN (...)` query per page rather than an N+1 lookup, and the resulting profiles are restored to block-recency order.

Read requests are throttled to 60/minute per configured throttler policy; block and unblock mutations are throttled to 30/minute. Block creation uses the existing `(blocker_id, blocked_id)` uniqueness contract through an idempotent upsert, and self-block attempts are rejected. Deleting an already-absent block remains retry-safe.

## Authentication and privacy

`BlockedUsersService` obtains the current Supabase access token from `AuthService`; it does not read a separate token from `localStorage`. The NestJS `BlocksController` remains protected by `SupabaseAuthGuard`, and the backend scopes reads/deletes to the authenticated blocker ID.

The client treats profile summaries as untrusted input. It:

- accepts at most 500 rows per load;
- deduplicates IDs;
- bounds display/language fields;
- limits displayed target languages to three;
- permits avatar URLs only when they use HTTP or HTTPS; and
- sends avatar requests with `no-referrer`.

Block-management errors are deliberately generic and do not copy database/provider messages, tokens, profile content, or target user IDs into logs or UI diagnostics. Backend query/mutation failures emit only sanitized operation-level warnings. Successful removals retain the existing trust-and-safety block-removal metric.

## Failure and concurrency behavior

Refresh failures retain the last successfully loaded list. This prevents a network outage from being presented as an empty block list. A later Retry starts a new generation; stale responses from an older request cannot overwrite newer state.

Unblock failures are fail-closed: the local row and `SafetyService` blocked-user cache are changed only after server confirmation. While a delete is in flight, controls for that row are disabled and expose `aria-busy`.

Malformed pagination, missing target IDs and self-blocking return validation errors before persistence. Database failures return sanitized server errors rather than raw provider messages.

## Accessibility

The page uses the shared header/button/card/empty-state primitives and logical RTL spacing. It provides:

- a keyboard-operable back action and minimum touch-sized mutation controls;
- semantic list/list-item structure;
- `dir="auto"` for user-provided names/language text;
- screen-reader loading, status, failure, and busy states;
- a confirmation step before the privacy-reducing unblock action; and
- stacked controls and breakable content for narrow screens/high zoom.

No important state is communicated by colour alone.

## Verification

Focused coverage lives in:

- `backend/src/blocks/blocks.controller.spec.ts`
- `backend/src/blocks/blocks.service.spec.ts`
- `frontend/src/app/services/blocked-users.service.spec.ts`
- `frontend/src/app/pages/block-management/block-management.component.spec.ts`
- `frontend/src/app/routes/settings.routes.spec.ts`

Coverage includes authorization guards at the controller boundary, bounded pagination, query ordering, retry-safe mutations, sanitized failure behavior, current-session authentication, response validation, paged loading, stale-data recovery, concurrent unblock suppression, explicit confirmation, RTL and high-zoom semantics.

Repository CI should additionally run the normal backend/frontend build, unit, lint, translation-safety, UI-design and dependency checks.

## Rollout and rollback

The change requires no schema migration. Deploy the backend before or with the frontend so the client receives bounded pages immediately. Existing clients remain compatible because `GET /blocks` still returns the same array shape and the block/unblock response contracts are unchanged.

Rollback consists of reverting the route/client changes and then, if necessary, the API pagination hardening. Blocking data is not rewritten or deleted by rollout itself; only explicit, authenticated block/unblock requests mutate existing rows.
