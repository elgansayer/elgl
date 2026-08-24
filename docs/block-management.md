# Block management

Issue #1672 exposes the existing authenticated block APIs as a production user-facing management flow.

## Product contract

- Privacy Settings links to `/blocks`; `/settings/blocked-users` is a compatibility alias.
- The page loads the signed-in user's blocked-account summaries from `GET /blocks`.
- Loading, empty, stale-data refresh failure, and first-load failure are distinct states.
- Unblocking is a two-step action. The first activation reveals Cancel/Unblock controls; no mutation is sent until the second activation.
- A row is removed only after `DELETE /blocks/:blockedId` returns `{ success: true }`.
- Failed unblocks keep the account in the list and keep confirmation available for an explicit retry.
- Duplicate unblock requests for the same account are suppressed while the first request is pending.

## Authentication and privacy

`BlockedUsersService` obtains the current Supabase access token from `AuthService`; it does not read a separate token from `localStorage`. The NestJS `BlocksController` remains protected by `SupabaseAuthGuard`, and the backend scopes reads/deletes to the authenticated blocker ID.

The client treats profile summaries as untrusted input. It:

- accepts at most 500 rows from a response;
- deduplicates IDs;
- bounds display/language fields;
- limits displayed target languages to three;
- permits avatar URLs only when they use HTTP or HTTPS; and
- sends avatar requests with `no-referrer`.

Block-management errors are deliberately generic and do not copy database/provider messages, tokens, profile content, or target user IDs into logs or UI diagnostics.

## Failure and concurrency behavior

Refresh failures retain the last successfully loaded list. This prevents a network outage from being presented as an empty block list. A later Retry starts a new generation; stale responses from an older request cannot overwrite newer state.

Unblock failures are fail-closed: the local row and `SafetyService` blocked-user cache are changed only after server confirmation. While a delete is in flight, controls for that row are disabled and expose `aria-busy`.

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

- `frontend/src/app/services/blocked-users.service.spec.ts`
- `frontend/src/app/pages/block-management/block-management.component.spec.ts`
- the existing backend block controller/service suites

Repository CI should additionally run the normal frontend build, unit, lint, translation-safety, and UI-design checks.

## Rollout and rollback

The change is additive and requires no schema migration. It can be deployed with existing backend versions that already expose `GET /blocks` and `DELETE /blocks/:blockedId`.

Rollback consists of reverting the route and frontend changes. Blocking data is not rewritten or deleted by rollout itself; only explicit, authenticated unblock requests mutate existing rows.
