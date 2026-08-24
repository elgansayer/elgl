# Follow list Spartan / Relay audit

Issue: #6212

Target: `frontend/src/app/components/follow-list`

Prerequisite: #5462 is complete.

## Purpose

This document is the ownership and migration map for `FollowListComponent`. It records every control, state, route, service boundary, side effect, and bespoke utility before the follow-up Spartan conversion work changes the surface.

The current component already uses Spartan Helm buttons for the back action and Follow / Unfollow actions. The main migration work is therefore not to invent another button primitive. It is to converge page, row, empty, loading, and error presentation on Relay; preserve native navigation semantics; fix failure-state ambiguity caused by the current `UserService` fallback behavior; and keep asynchronous follow mutations accessible and deterministic.

## Current surface

`FollowListComponent` is a standalone Angular route component used for two closely related surfaces:

- `/profile/:userId/followers`
- `/profile/:userId/following`

The route supplies `userId` and a `mode` value of `followers` or `following`. The same component then loads the corresponding collection and renders each person as:

- a profile navigation link containing avatar, display name, and language summary;
- an optional Follow / Unfollow action for users other than the signed-in viewer.

The component owns optimistic follow state, one pending mutation set, one toggle-error state, and the route-level collection resource. It has no overlays, no local persistence, no analytics hooks, and no direct database access.

## Control and state inventory

| Current UI / state | Current implementation | Spartan / Relay owner | Migration decision |
| --- | --- | --- | --- |
| Back action | Native `<button hlmBtn>` calling `Location.back()` | Spartan Helm Button inside Relay page header | Keep Spartan Button. Relay should own header spacing, surface, icon treatment, and focus composition. Preserve browser-history behavior. |
| Page title | Translated `h1`, selected by `mode()` | Relay typography | Keep semantic heading. Preserve one page-level heading and translated followers/following copy. |
| Profile row navigation | Native `<a [routerLink]>` | Native Angular RouterLink inside Relay row composition | Keep native link semantics. Do not replace row navigation with a button or synthetic click directive. |
| Avatar image | Native `<img>` with empty `alt` when image exists | Relay avatar/media composition | Keep native image. Empty `alt` is appropriate because the adjacent visible name identifies the linked user. |
| Avatar fallback | Initial inside a circular surface | Relay avatar fallback | Keep presentation-only fallback. It must not become another focus target. |
| Display name | Text inside the profile link | Relay typography | Keep. Continue using the translated unknown-user fallback. |
| Language summary | Uppercased native/target language codes with a literal arrow | Relay metadata presentation | Preserve the underlying language data, but review the visual arrow for RTL and accessible reading order. Do not encode direction with a physical arrow alone. |
| Follow action | Native `<button hlmBtn variant="secondary">` | Spartan Helm Button | Keep Spartan ownership. Relay owns product copy, spacing, busy/error composition, and semantic primary/accent treatment. |
| Unfollow action | Same button, changing label and `aria-pressed` | Spartan Helm Button | Keep as the same binary action control. Preserve the server mutation contract and optimistic rollback behavior. |
| Follow pending state | `pendingIds` Set disables one user's action | Relay async-state composition over Spartan Button | Preserve per-user pending isolation. Add explicit busy semantics rather than communicating pending only through disabled state. |
| Optimistic follow override | `followOverrides` Map updates immediately | Feature state | Keep feature-owned. Spartan and Relay must not own API mutation state. |
| Toggle failure state | `toggleError()` renders an alert | Relay alert/status composition | Keep a translated, sanitized failure state. The current raw `Error.message` path should not become the long-term product contract. |
| Initial loading | `resource().isLoading()` plus an aria-hidden spinner | Relay loading composition | Replace or wrap with the approved Relay loading treatment. Provide meaningful screen-reader status text. |
| Load error | `resource().error()` renders `role="alert"` | Relay error composition | Preserve the state, but first fix the service contract so backend failures can actually reach it. |
| Empty list | A `<p>` emitted inside the `<ul>` | Relay `AppEmptyStateComponent` or equivalent list empty composition | Migrate to the approved Relay empty-state primitive outside invalid list structure. |
| User list | `<ul role="list">` | Native list semantics plus Relay row composition | Keep native list semantics. `role="list"` is unnecessary unless future CSS removes list semantics. |
| User row | `<li>` with one link and one sibling button | Relay list-row/card composition | Preserve split interaction ownership. Do not make the whole row a button because it already contains a separate Follow action. |
| Sticky header | Hand-authored sticky `div` with surface/border/backdrop utilities | Relay page/header composition | Converge on the canonical header/shell recipe instead of creating a feature-local sticky-header primitive. |
| Scroll container | Root `div` owns `h-full overflow-y-auto` | Relay page composition | Preserve one intentional scroll owner. Verify route shell does not create nested scroll traps. |

## Existing Spartan ownership

The component already imports `HlmButtonImports` and uses `hlmBtn` for every command-style button:

- Back
- Follow
- Unfollow

No additional Spartan Brain primitive is required for the current interaction model.

A Follow / Unfollow action is a server-backed binary command, not a local form switch. Keeping it as a native Spartan button is clearer than converting it to a Switch. A Toggle primitive would only be justified if the repository standardizes remote follow state on that primitive and its async behavior remains explicit. The follow relationship side effect must remain feature-owned either way.

The profile destination is already a native RouterLink. Do not replace it with Spartan Button merely to make the row look clickable.

## Relay ownership opportunities

The current template duplicates several visual patterns that already belong to the Relay layer:

- page background and text surface;
- sticky header composition;
- list-row/card surface;
- empty state;
- loading state;
- error / status messaging;
- avatar/fallback presentation;
- responsive spacing and truncation.

The conversion ticket should prefer existing Relay primitives when their visual contract matches. It should not force a primitive solely for code reuse if that would change the intended list density or interaction semantics.

`AppEmptyStateComponent` is the clearest existing convergence target for the no-users case. The empty state must not be emitted as a paragraph directly inside a `<ul>`.

## Route and navigation contracts

The canonical routes are defined in `frontend/src/app/routes/social.routes.ts`:

```text
/profile/:userId/followers
/profile/:userId/following
```

Both lazy-load `FollowListComponent` and supply route data for `mode`.

The component itself accepts:

```ts
userId = input.required<string>();
mode = input<'followers' | 'following'>('followers');
```

Route/component input binding is therefore part of the surface contract. The migration must not replace it with manual `ActivatedRoute` subscription unless there is a repository-wide routing reason to do so.

Each user row navigates to:

```text
/profile/:userId
```

The Back action uses `Location.back()` and intentionally follows browser/application history rather than a hard-coded profile URL. Preserve that distinction.

There is no navigation after a Follow or Unfollow mutation.

## Data and API contracts

The component calls `UserService` only:

```text
getFollowers(userId, limit = 20, offset = 0)
getFollowing(userId, limit = 20, offset = 0)
followUser(userId)
unfollowUser(userId)
```

The corresponding authenticated backend routes are:

```text
GET    /users/:id/followers?limit=20&offset=0
GET    /users/:id/following?limit=20&offset=0
POST   /users/:id/follow
DELETE /users/:id/follow
```

`UsersController` is protected by `SupabaseAuthGuard`. The list responses include:

```ts
{
  data: UserProfile[];
  total: number;
}
```

The current component reads `data` but ignores `total` and never changes limit or offset. As a result, the UI can only show the first 20 relationships even when the backend reports more.

That is an existing product/data-contract gap. The migration must not accidentally present the first page as the complete set. The follow-up implementation should either:

1. add bounded pagination / Load More using the existing `limit` and `offset` contract, or
2. explicitly defer pagination in product scope and document that the route remains first-page-only.

Do not solve this by requesting an unbounded collection.

## Critical current failure-contract mismatch

`FollowListComponent` contains explicit load and mutation error UI, but the current `UserService` prevents most of those errors from reaching it:

- `getFollowers()` catches every HTTP error and returns `{ data: [], total: 0 }`;
- `getFollowing()` catches every HTTP error and returns `{ data: [], total: 0 }`;
- `followUser()` catches every HTTP error and returns `undefined`;
- `unfollowUser()` catches every HTTP error and returns `undefined`.

Consequences:

- a network/backend failure can be rendered as a legitimate empty followers/following list;
- an unsuccessful Follow can remain optimistically shown as successful because no exception is thrown;
- an unsuccessful Unfollow can remain optimistically shown as successful for the same reason;
- `listResource.error()` and the component's mutation `catch` block are effectively bypassed for these HTTP failures;
- tests that mock `UserService` rejections exercise component logic that the production service currently does not expose.

This must be treated as a correctness prerequisite for the implementation stage. Relay error presentation cannot be considered complete while the service converts unavailable states into successful empty/mutation results.

The recommended boundary is for these four first-party authenticated methods to fail closed and let `FollowListComponent` own the retry/user-feedback behavior. Do not use mock profiles or silent success as a production fallback for relationship mutations.

## Follow mutation state contract

Current behavior is optimistic:

1. Ignore a second request while that user ID is pending.
2. Record the user's current `is_followed_by_me` state.
3. Add the user ID to `pendingIds`.
4. Clear the prior toggle error.
5. Immediately set an override to the opposite state.
6. Call Follow or Unfollow.
7. If the call rejects, restore the prior override and show an error.
8. Always remove the user ID from `pendingIds`.

This is a reasonable feature-owned state machine and should survive the visual migration.

Important details:

- pending state is per user, so another row can remain actionable;
- duplicate requests for the same user are suppressed;
- rollback must use the pre-request value, not whatever a later render happens to contain;
- the error should be stable translated product copy, not arbitrary provider/database text;
- successful state should reconcile with authoritative data on a later resource refresh;
- if pagination is added, override state must remain deterministic when rows leave/re-enter the viewport.

The current component does not explicitly reload the list after success. That is acceptable for an optimistic UI provided the backend mutation is authoritative and later route/resource reloads reconcile state.

## Authentication and authorization

The full Users controller is guarded by `SupabaseAuthGuard`, so list and mutation routes require an authenticated Supabase session.

The component also injects `AuthService` to avoid rendering a Follow / Unfollow button for the signed-in viewer's own row:

```ts
user.id !== authService.currentUser()?.id
```

This is a UI rule, not an authorization boundary. Backend relationship mutations must continue to reject invalid operations independently.

The migration must not expose access tokens, user IDs, or backend error payloads in logs or status text beyond what is necessary for the UI.

No analytics events are emitted by this component today. Do not add analytics as an incidental primitive-conversion side effect.

## Accessibility audit

### Page structure

The root is a generic `div` and the sticky header is also a `div`. The conversion should use the repository's semantic page/header structure where available. There should be one page-level `h1` and a clearly identifiable main content region.

### Back action

The Back action already uses a native button through Spartan and has a translated accessible name. The arrow glyph is `aria-hidden`, which is correct because the translated label owns the accessible name.

Keep a touch-sized target and visible focus treatment.

For RTL, do not assume the literal left arrow is semantically correct. The visible back icon should follow the repository's directional-icon convention while the accessible name remains `common.back`.

### User links

Each profile destination is a native anchor, which gives correct keyboard activation and focus semantics. Keep the full avatar/name/language block within one link and preserve a visible focus indicator for the whole link region.

Do not wrap the whole `<li>` in an additional clickable role. That would create overlapping interactive targets with the Follow button.

### Avatar semantics

When an avatar exists, `alt=""` is appropriate because the same link contains the person's visible display name. Announcing the same name twice would be noisy.

The fallback initial is presentation-only and should remain hidden from duplicate semantic naming if necessary.

### Follow / Unfollow action

The action already uses a native button and `aria-pressed` to communicate binary state. That is a valid toggle-button pattern, provided the state continues to represent whether the current viewer follows that user.

The implementation should additionally expose pending state with `aria-busy` or the repository's standard async-button treatment. Disabled alone does not explain why the control became unavailable.

If the visible label continues to switch between Follow and Unfollow, test the combined label/state behavior with screen readers. Avoid redundant accessible text such as "Unfollow, pressed" if the chosen product wording becomes confusing.

### Loading state

The outer content wrapper has `role="status" aria-live="polite"`, but the loading state contains only an aria-hidden spinner. A non-visual user may receive no meaningful loading announcement.

Use the approved Relay loading composition with translated status copy or another deliberate accessible loading contract.

Do not make the entire changing list one noisy live region. Announce meaningful load and mutation state changes only.

### Error states

The load and toggle errors use `role="alert"`, which is appropriate for important failures, but the entire content wrapper is also a live `status` region. Avoid redundant announcements after migration.

User-facing errors should be stable translated copy. Raw JavaScript/backend `Error.message` values must not be the presentation contract.

### Empty state markup

The current `@empty` branch renders a `<p>` directly inside `<ul>`. A list should contain list items only. Move the empty state outside the `<ul>` or render it through the approved Relay empty-state composition.

### Touch targets

Back already uses `size="icon-touch"`. Follow / Unfollow currently uses `size="sm"`, so its minimum interactive target must be verified against the repository's 44 x 44 CSS-pixel touch-target standard. If `sm` does not satisfy it, use the approved touch-size variant without unnecessarily enlarging dense desktop presentation.

### Truncation and zoom

Display name and language metadata both use `truncate`. At 200% and 400% zoom, important identity information must remain discoverable rather than being permanently hidden by ellipsis. The implementation should prefer wrapping or a responsive density rule where space becomes constrained.

## RTL and internationalization

All page/action/empty/error labels should remain translation-owned.

Current translated keys include the page titles, Follow / Unfollow, empty states, Back, and load/follow error fallbacks.

The language summary is assembled as:

```text
NATIVE_CODES -> TARGET_CODES
```

with a literal right arrow. This requires review for RTL because:

- the arrow visually encodes a physical direction;
- mixed Latin language codes inside an RTL document can reorder unexpectedly;
- native and target language meaning should not depend on arrow direction alone.

Prefer a Relay metadata composition that has explicit native/learning labels where space permits, or isolate bidi fragments and use a logical/decorative separator. If an arrow remains, make it presentation-only and use the repository's directional-icon policy.

Continue using logical spacing utilities such as `gap`, `min-w-0`, `flex-1`, and logical start/end properties. Do not introduce `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, or `right-*` feature layout dependencies.

Test long translated Follow/Unfollow copy and long display names at narrow widths. The row must reflow rather than create horizontal page overflow.

## Theme and token audit

The component already uses several semantic token families:

- `surface-*`
- `text-*`
- `primary`
- `on-fill`

Those are compatible with light/dark themes and per-user primary accents when used according to Relay ownership.

However, several visual decisions are still feature-local:

- `bg-surface-500` on the whole page and sticky header;
- `bg-surface-300` for rows;
- generic `rounded-2xl` rows;
- `rounded-full` Follow buttons;
- `shadow`/backdrop treatment in the header;
- `text-neon-pink` and `bg-neon-pink/10` for failures;
- conditional `bg-primary` / `text-on-fill` classes layered over `variant="secondary"`.

Migration should converge these onto Relay page/card/status/button recipes rather than preserving one-off class bundles.

The conditional Follow styling is particularly important: avoid mixing a Spartan `secondary` variant with manual primary-state classes if an approved Relay/Spartan variant can express the state cleanly. Dynamic user accent must continue to flow through the semantic `primary` token, not a hard-coded brand colour.

Errors should use the repository's semantic danger/error role rather than a neon decorative token unless the design system explicitly maps that token to errors.

Validate light and dark themes independently.

## Responsive contract

The route is a full-height vertically scrolling list. Verify it at the repository's established responsive baselines:

- 390px mobile;
- 768px tablet;
- 1024px tablet/desktop transition;
- 1440px desktop;
- 200% and 400% text/browser zoom.

Key rules:

- profile link and Follow action must not overlap;
- long names/languages/action labels must not force horizontal document overflow;
- the Follow action must remain reachable without hover;
- sticky header must not consume an excessive fraction of the viewport at high zoom;
- one deliberate scroll owner must remain usable with keyboard, touch, and assistive technology;
- row density can increase on wider screens, but touch targets cannot regress on touch-capable devices.

## Empty, loading, error, and unavailable states

The converted surface needs explicit ownership for all route-level states:

### Loading

Show a Relay loading state with translated accessible status. Do not expose an empty list while the request is unresolved.

### Empty

Show a true empty state only when the authenticated request succeeds and `data` is empty.

### Load failure

Show a Relay error/unavailable state when the request fails. The current `UserService` fallback must be corrected so this state is reachable.

The implementation should include a retry action unless route/resource reload is provided through another clear application convention.

### Follow mutation failure

Rollback the optimistic state, clear pending, and present a stable translated error. The user should be able to retry the same action.

### Unauthorized/session failure

Do not render an empty social graph as if the request succeeded. Let the application authentication/session boundary handle expired or missing sessions consistently with other authenticated routes.

## Pagination and scale

The backend contract is already bounded with `limit` and `offset`, but the current route always requests the default first 20 rows and discards `total`.

Follow lists can grow well beyond 20 entries. A production migration should therefore define one of these explicit patterns:

```text
initial 20
  -> Load More / infinite page trigger
  -> offset += received row count
  -> append deduplicated rows
  -> stop when loaded count >= total
```

or a deliberate product decision that the list is capped.

If infinite loading is used, intersection observers and pagination state remain feature behavior. Do not bury network pagination inside a visual primitive.

Any collection extension must remain bounded, deduplicate by user ID, cancel or ignore stale requests when `userId` / `mode` changes, and preserve follow overrides for rows already interacted with.

## Focus behavior

Mode/user changes can replace the collection while focus is inside a row. The implementation should define focus behavior rather than relying on DOM replacement side effects.

Expected behavior:

- initial navigation focus follows the normal route/page heading convention;
- Follow/Unfollow completion does not move focus away from the activated button;
- a failed mutation leaves focus on the action so it can be retried;
- Load More, if added, retains focus on the initiating control or moves according to the repository pagination standard;
- Back uses the normal browser/application history focus restoration path;
- route changes between followers/following do not leave focus on a removed node.

## Concurrency and stale state

Per-user `pendingIds` correctly blocks duplicate mutations for one row while allowing independent rows to update.

The follow-up should additionally account for resource churn:

- if `userId` changes while a request is in flight, stale results must not replace the new route's list;
- if `mode` changes, prior follower results must not leak into following;
- if a follow mutation finishes after the row is no longer present, it must not corrupt another user's state;
- if the resource reloads after an optimistic update, authoritative server state should win or be reconciled deliberately.

Angular `resource` already helps bind loads to reactive params, but mutation maps remain component-owned and should be cleared or scoped when the route identity changes if required by testing.

## Security and privacy

The surface displays relationship data returned by authenticated first-party endpoints. Keep these boundaries:

- never log access tokens or Authorization headers;
- do not log entire user-profile payloads merely to diagnose a list failure;
- do not expose raw database/provider errors in the UI;
- keep follow/unfollow authorization server-side;
- do not infer or expose private relationship data from local mocks when a server request fails;
- respect profile visibility and block/privacy filtering already applied by backend services;
- keep avatar URLs and user IDs confined to the existing display/navigation contract.

A list failure must fail visibly rather than substitute fabricated users or an apparently valid empty relationship set.

## Analytics and observability

There are no explicit analytics hooks in `FollowListComponent` today.

Do not add analytics to Spartan or Relay primitives during migration.

If product telemetry is added later, useful events would be feature-level and privacy-minimized, such as successful/failed Follow mutation counts and list-load latency/error classes. Do not record display names, profile content, access tokens, or raw error text.

## Existing regression coverage

`follow-list.component.spec.ts` currently covers:

- default follower loading;
- following-mode loading;
- rendering returned users;
- empty state;
- hiding Follow controls for the signed-in user's row;
- optimistic Follow behavior;
- rendering multiple rows;
- load error presentation using a mocked rejected service call;
- mutation rollback/error presentation using a mocked rejected service call.

The current tests do not prove the production `UserService` failure contract because the real service catches these HTTP errors.

## Regression coverage required by conversion

Preserve the existing cases and add coverage for:

- native RouterLink semantics and exact `/profile/:userId` destinations;
- Back remains a touch-sized native Spartan button;
- Follow / Unfollow stays a native Spartan button without synthetic role/tabindex behavior;
- `aria-pressed` reflects authoritative/optimistic follow state;
- pending action is disabled and exposes busy state;
- duplicate same-user mutations are suppressed;
- different-user mutations can proceed independently;
- failed Follow rolls back to Follow;
- failed Unfollow rolls back to Unfollow;
- production `UserService` list errors propagate instead of becoming a successful empty list;
- production `UserService` mutation errors propagate instead of becoming successful no-ops;
- load error has a retry path;
- successful empty state is distinct from unavailable state;
- no Follow action appears for the signed-in viewer;
- no invalid child content is emitted directly inside `<ul>`;
- loading has translated screen-reader status;
- user avatar/name link has one coherent accessible identity;
- language metadata remains understandable in RTL;
- no horizontal overflow at 390px and high zoom;
- light and dark theme parity;
- dynamic primary accent behavior on Follow state;
- pagination behavior if the implementation ticket exposes more than the first 20 results;
- stale list responses cannot overwrite a newer `userId` / `mode` request.

## Design-preview requirement

This audit changes documentation only and does not change the visual contract, so no Claude Design/design-preview update is required in this PR.

The implementation stages should add or update the mapped preview when they change:

- row composition;
- Follow/Unfollow variants;
- empty/loading/error states;
- mobile versus desktop density;
- pagination controls;
- RTL metadata presentation.

At minimum, visual coverage should include:

- light mobile populated followers;
- dark mobile populated following;
- loading;
- successful empty;
- load failure with retry;
- pending Follow/Unfollow;
- long translated copy / RTL;
- wider tablet/desktop layout.

## Migration risks

1. **Silent service fallbacks.** Current `UserService` converts list failures into empty data and follow failures into successful `undefined`, making the component's failure states unreliable.
2. **First-page-only data.** The backend exposes `total`, `limit`, and `offset`, but the component shows only the default 20 rows.
3. **Invalid empty-state list markup.** The empty paragraph is emitted directly inside `<ul>`.
4. **Mixed button styling ownership.** `variant="secondary"` is combined with manual primary-state classes, creating potential Spartan/Relay drift.
5. **Small follow target.** `size="sm"` must be checked against the 44px touch-target standard.
6. **RTL language arrow.** The literal right arrow can communicate incorrect direction or reorder badly with bidi content.
7. **Raw error messages.** Mutation failures can expose arbitrary `Error.message` strings when tests/custom callers reject.
8. **Loading announcement gap.** The spinner is hidden from assistive technology without meaningful translated loading text.
9. **Redundant live regions.** `role="status"` around the whole body plus nested `role="alert"` can create duplicate announcements.
10. **Truncation at zoom.** Both identity and language metadata rely on ellipsis in a dense horizontal row.
11. **Optimistic state versus refresh.** Follow overrides need a deliberate reconciliation policy when the list reloads.
12. **Route churn.** User/mode changes need stale-request and focus-restoration coverage.
13. **Nested scroll risk.** The route owns `overflow-y-auto`; migration to a shell primitive must avoid creating a second competing scroll container.
14. **Token drift.** `neon-pink`, `rounded-2xl`, and feature-local surface combinations should converge on semantic Relay roles.

## Prerequisites for the implementation stages

Before declaring the visual migration complete:

1. Fix or explicitly redesign the `UserService` error contract for these relationship methods so empty and unavailable states are distinguishable.
2. Decide the bounded pagination / first-page-only product contract.
3. Verify the approved Relay empty-state and page/header/list-row compositions.
4. Verify the Follow button size/variant against the touch-target and Relay button standards.
5. Define the RTL-safe language metadata separator/labels.

No new universal Spartan primitive is required by this audit.

## Recommended ownership shape

```text
FollowListComponent
  |- feature state
  |    |- route userId / mode
  |    |- collection resource + bounded paging
  |    |- followOverrides
  |    |- per-user pending mutations
  |    `- retry / error state
  |
  |- Relay page composition
  |    |- semantic page + sticky header
  |    |- list row / avatar / metadata
  |    |- loading
  |    |- empty
  |    `- error / retry
  |
  |- native Angular navigation
  |    |- RouterLink -> /profile/:userId
  |    `- Location.back()
  |
  |- Spartan Helm Button
  |    |- Back
  |    `- Follow / Unfollow
  |
  `- UserService
       |- GET followers / following
       `- POST / DELETE follow relationship
```

Spartan primitives own interaction mechanics. Relay owns application presentation. `FollowListComponent` owns relationship state and orchestration. `UserService` owns typed first-party HTTP calls. The backend remains authoritative for authentication, authorization, relationship persistence, privacy filtering, and collection data.

## Verification gate for the follow-up

Run the repository's current frontend verification gate after implementation, including the applicable equivalents of:

```bash
cd frontend
npm run test:unit
npm run lint:check
npm run build
```

Also run the repository-level constitution, RTL/logical-property, Spartan ownership/convergence, design-sync, UI design coverage, and visual-capture checks required by CI when the implementation changes a mapped visual contract.

For changes to `UserService`, run its focused API-client tests as well as the Follow List component tests. If pagination changes request/query behavior, include exact URL/parameter contract coverage.

## Decision summary

- Keep native RouterLink for profile navigation.
- Keep Spartan Helm Button for Back and Follow / Unfollow.
- Do not introduce a new Spartan Brain primitive for this surface.
- Move page, row, loading, empty, and error presentation toward existing Relay ownership.
- Fix the current service error swallowing before relying on the UI's unavailable and rollback states.
- Define a bounded pagination contract instead of silently showing only the first 20 relationships.
- Preserve per-user optimistic mutation isolation and duplicate-request suppression.
- Replace invalid empty-list markup with the approved Relay empty state.
- Add explicit busy/loading semantics and stable translated errors.
- Make language metadata and the visible Back direction safe for RTL.
- Validate light/dark themes, dynamic primary accent, 390px mobile, tablet/desktop, keyboard/touch operation, and 200%/400% zoom in the implementation stages.
