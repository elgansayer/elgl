# External profile: Spartan / Relay audit

Issue: #6192
Target: `frontend/src/app/components/external-profile`

## Purpose

This audit records the current `ExternalProfileComponent` contract before the implementation-stage Spartan UI tickets modify the surface. It inventories every control, state, side effect and navigation boundary, maps ownership to Spartan or Relay, and identifies the smallest safe migration path.

The component is a compact action strip rather than a full profile page. It currently exposes three user actions across two mutually exclusive follow states: Send Message plus either Follow or Unfollow. All rendered controls already use Spartan Helm `hlmBtn`, so the primary migration work is not to replace native buttons. The important follow-up work is to remove feature-owned async interaction state, off-token button styling, and silent failure handling while preserving the service and route contracts.

## Sources reviewed

- `frontend/src/app/components/external-profile/external-profile.component.ts`
- `frontend/src/app/services/study-buddies.service.ts`
- `backend/src/study-buddies/study-buddies.controller.ts`
- repository search results for `ExternalProfileComponent`, `app-external-profile`, and `external-profile`
- `docs/spartan-relay-architecture.md`
- `docs/design-redesign-audit.md`
- `DESIGN.md`
- `AGENTS.md`
- `frontend/AGENTS.md`

Program dependency #5462 defines the Relay / Spartan ownership contract used here.

## Current public API

The component exposes one required signal input and no outputs.

| API | Type | Contract |
| --- | --- | --- |
| `userId` | required `string` input | Target account used by follow, unfollow, and direct-message channel creation. |

The component does not receive an initial following state, profile object, display name, disabled state, or mutation callbacks from its parent.

Repository search currently finds no production consumer of the `app-external-profile` selector outside the component declaration itself. That makes the surface effectively orphaned on current `main`. Follow-up tickets must not invent a new route or parent contract merely to make the component reachable. If a consumer is added separately, that work must preserve the API and behaviour documented here or intentionally revise it with tests.

## Rendered control inventory

The template always renders a two-column flex action row.

### Send Message

- Native `<button type="button">`.
- Already owned by Spartan Helm through `hlmBtn`.
- Visible label: translated `chat.sendMessage`.
- Calls `sendMessage()`.
- No haptic feedback.
- No pending, disabled, busy, success, or failure state.
- On success, navigates to `/chat/room/:channel` after the service returns a channel identifier.
- On failure, logs to `console.error` and leaves the user without visible feedback.

### Follow

Rendered only while `isFollowing()` is false.

- Native `<button type="button">`.
- Already owned by Spartan Helm through `hlmBtn`.
- Visible label: translated `profile.follow`.
- Calls `HapticFeedbackService.tap()` before the request.
- Calls `StudyBuddiesService.follow(userId)`.
- Sets local `isFollowing` to true only after successful completion.
- On failure, logs to `console.error` and leaves state unchanged.
- Has no pending guard, so repeated activation can create concurrent follow requests.

### Unfollow

Rendered only while `isFollowing()` is true.

- Native `<button type="button">`.
- Already owned by Spartan Helm through `hlmBtn`.
- Visible label: translated `profile.unfollow`.
- Calls `HapticFeedbackService.tap()` before the request.
- Calls `StudyBuddiesService.unfollow(userId)`.
- Sets local `isFollowing` to false only after successful completion.
- On failure, logs to `console.error` and leaves state unchanged.
- Has no pending guard, so repeated activation can create concurrent unfollow requests.

No other interactive element, overlay, menu, form control, link, tooltip, disclosure, checkbox, radio, select, slider, drag interaction, or keyboard-specific handler is present.

## State inventory

### Local feature state

`isFollowing: signal(false)` is the only explicit local state.

Current state model:

```text
component created
  -> isFollowing = false

follow succeeds
  -> isFollowing = true

unfollow succeeds
  -> isFollowing = false
```

The component does not load existing relationship state. Therefore every fresh instance initially presents Follow even when the authenticated user may already follow `userId`. This is a product-state gap that the implementation stage must resolve through an authoritative parent input or a relationship-status query before relying on the local toggle as truth.

### Missing async states

The current implementation has no explicit state for:

- follow pending;
- unfollow pending;
- channel creation pending;
- request failure;
- retry;
- rate limiting;
- offline/unavailable service;
- successful follow/unfollow announcement;
- navigation failure; or
- a changed `userId` while an earlier request is still in flight.

The implementation stage should add bounded, per-action pending state and stale-target protection rather than treating all failures as provider-neutral button clicks.

## Service and API contracts

`StudyBuddiesService` owns the frontend HTTP boundary.

| Feature action | Frontend request | Backend route | Backend protection |
| --- | --- | --- | --- |
| Follow | `POST /study-buddies/follow` with `{ targetUserId }` | `@Post('follow')` | `SupabaseAuthGuard`, `StudyBuddiesRateLimiterGuard`, 20 requests / 60 s |
| Unfollow | `DELETE /study-buddies/unfollow` with body `{ targetUserId }` | `@Delete('unfollow')` | `SupabaseAuthGuard`, `StudyBuddiesRateLimiterGuard`, 20 requests / 60 s |
| Message | `GET /study-buddies/channel?partnerId=...` | `@Get('channel')` | `SupabaseAuthGuard`, `StudyBuddiesRateLimiterGuard`, 30 requests / 60 s |

These service contracts are feature/application concerns. Spartan controls must not absorb HTTP knowledge or target-user identifiers.

The backend supplies authenticated caller identity from the Supabase session. Migration must not add client-controlled caller IDs.

## Navigation contract

`sendMessage()` requests or resolves a channel, then performs:

```text
/chat/room/:channel
```

Navigation belongs to the feature layer. The button should remain a command button because a channel must be resolved before the final route is known. Converting it to a static `routerLink` would change behaviour and is not appropriate unless the API contract changes separately.

No other route, query parameter, fragment, history manipulation, external URL, or deep-link behaviour is present.

## Analytics, storage, and browser side effects

The component currently has no analytics event, local/session storage use, cookie use, timer, clipboard interaction, global event listener, media lifecycle, or direct DOM manipulation.

Observed side effects are limited to:

- haptic tap on Follow and Unfollow;
- authenticated study-buddies API requests;
- local `isFollowing` mutation after successful follow/unfollow;
- navigation after channel resolution; and
- `console.error` on failures.

Do not add telemetry during the Spartan conversion unless a separately defined analytics contract requires it.

## Current styling inventory

The wrapper uses:

```text
flex gap-3
```

Each action uses Spartan `hlmBtn` plus feature-owned classes including:

```text
flex-1
btn-primary / btn-secondary
px-4 py-2
rounded-lg
text-sm
font-medium
```

This duplicates presentation that should normally be owned by Relay/Helm variants and semantic tokens. In particular:

- `btn-primary` / `btn-secondary` are app-level legacy button classes layered on top of Helm ownership;
- `rounded-lg` overrides the primitive's radius contract;
- manual horizontal/vertical padding can fight Helm touch sizing;
- typography should follow the approved button primitive contract unless the design system defines an explicit variant.

The audit introduces no visual change, but the Relay token stage should remove redundant feature styling rather than creating another button abstraction.

## Ownership map

| Surface / behaviour | Current owner | Target owner | Migration rule |
| --- | --- | --- | --- |
| Send Message activation | Native button + feature method | Spartan Helm button + feature command | Keep command semantics; add pending/error state in feature layer. |
| Follow activation | Native button + feature method | Spartan Helm button + feature command | Keep service call outside primitive; prevent duplicate requests. |
| Unfollow activation | Native button + feature method | Spartan Helm button + feature command | Keep service call outside primitive; prevent duplicate requests. |
| Button keyboard/focus semantics | Browser + Helm | Spartan Helm | Do not add synthetic role/tabindex/key handlers. |
| Button visual variants | Helm plus legacy classes | Relay/Helm variants and Relay tokens | Remove `btn-*`, manual radius/padding when equivalent primitive variants exist. |
| Follow relationship truth | Local signal only | Feature/application state | Load or receive authoritative relationship state and handle target changes. |
| Pending state | Missing | Feature state expressed through Helm disabled/busy semantics | Use bounded pending signals; keep buttons reachable and labelled. |
| Error/retry feedback | `console.error` only | Feature + Relay feedback primitive | Show accessible, translated retryable feedback without exposing raw errors. |
| Haptics | Feature service | Feature service | Keep optional haptic side effect outside Spartan. |
| Channel resolution | StudyBuddiesService | StudyBuddiesService | Preserve typed service boundary. |
| Chat navigation | Router in feature | Router in feature | Preserve `/chat/room/:channel`. |
| Layout | Feature Tailwind | Relay composition | Keep mobile-first logical layout and theme tokens. |
| Translation | TranslatePipe | App i18n layer | Keep visible product copy translated before rendering. |

No control is intentionally left unclassified.

## Spartan ownership decision

### Brain

No additional Spartan Brain state machine is required for the current three command actions. They are ordinary buttons, not a menu, radio group, toggle group, disclosure, tabs, dialog, select, or composite keyboard widget.

The follow/unfollow pair is mutually exclusive product state, but it is not a choice group presented simultaneously to the user. Converting it to radio/toggle primitives would misrepresent the semantics.

### Helm

`HlmButton` is already the correct primitive for all three rendered actions. Follow-up conversion work should improve how Helm is used rather than replace it.

Expected Helm responsibilities:

- native button semantics;
- visible focus styling;
- disabled state;
- touch target sizing;
- semantic primary/secondary/ghost variants as chosen by the design contract; and
- theme-safe interaction styling.

### Relay

Relay should own:

- the action-row composition;
- semantic spacing;
- responsive stacking/wrapping if required at narrow widths or long translations;
- light/dark surface compatibility;
- primary accent propagation;
- status/error presentation; and
- shared product-facing button wrappers only where they add a stable app contract rather than duplicate Helm.

## Accessibility requirements

The current native buttons are structurally sound, but the converted surface must additionally guarantee:

- all actions remain native buttons with `type="button"`;
- no synthetic `role="button"`, manual `tabindex`, or Enter/Space emulation is introduced;
- deterministic DOM/focus order remains Send Message then Follow/Unfollow;
- visible focus comes from the approved Spartan interaction layer;
- disabled/pending actions expose state without removing meaningful labels;
- pending actions use `aria-busy` or equivalent app convention when useful;
- request failures are presented as readable status/alert content, not only logged;
- repeated controls remain unambiguous if the component is used more than once on a page;
- long translated labels can wrap without clipping;
- 200% and 400% zoom leave all required actions reachable;
- colour is not the sole indication of follow state or error state; and
- haptic feedback remains supplementary, never the only feedback.

The visible button text is currently sufficient as the accessible name. No extra `aria-label` should duplicate it unless contextual disambiguation is required by a future consumer.

## RTL and multilingual requirements

The current flex row has no physical left/right utilities, which is safe for RTL ordering at the CSS level. Follow-up styling must preserve logical layout and avoid `ml`, `mr`, `pl`, `pr`, `left`, or `right` for directional spacing.

The three labels already pass through `TranslatePipe` and must stay in the app translation layer.

Implementation and preview coverage should include:

- long German-like labels;
- Arabic/RTL labels;
- CJK labels;
- mixed-direction user context if a future accessible name includes a display name; and
- narrow 390px width where two long actions may need to stack or wrap.

The currently injected `I18nService` is unused and should be removed when runtime code is touched unless a concrete locale-dependent behaviour is introduced.

## Theme and accent requirements

No hard-coded colour literal appears directly in this component, but `btn-primary` / `btn-secondary` are legacy presentation classes layered on top of Helm. The Relay/theme stage should converge them on the approved semantic primitive variants.

Required invariants:

- primary actions continue to follow the user's configured primary accent;
- text on saturated fills uses the approved on-fill token;
- secondary actions remain readable in both light and dark themes;
- no hard-coded white/black/hex/RGB product colour is added;
- focus, disabled, hover, and pressed states remain visible in both themes; and
- forced-colour mode does not hide the action boundary.

## Responsive and high-zoom requirements

Two `flex-1` actions currently share one row. That is compact at typical widths but fragile with long translations or large text.

The implementation stage should verify:

- 390px mobile baseline;
- tablet and desktop widths;
- 200% and 400% browser zoom;
- text-size increase independent of viewport zoom;
- no horizontal document overflow;
- no truncated action labels; and
- a stacking or wrapping strategy if both controls cannot preserve comfortable touch targets in one row.

The component should not encode device detection or arbitrary JavaScript breakpoints.

## Failure and concurrency risks

### Duplicate mutations

Follow and Unfollow have no pending guard. Fast repeated activation can send duplicate requests until the first promise resolves.

Required mitigation: feature-owned pending state with the affected action disabled while in flight. Do not rely on rate limiting as UI debouncing.

### Stale target races

`userId` is a signal input, but async methods read it only when invoked and later update shared local state. If a host reuses the component for another user while an earlier request is in flight, the prior response can change `isFollowing` for the new target.

Required mitigation: capture the target ID per request and only commit local state if it still matches the active target, or move relationship state to a target-keyed parent/store.

### Incorrect initial relationship state

`isFollowing` always starts false and no status request is made. A pre-existing follow therefore renders as Follow until the user acts.

Required mitigation: establish an authoritative source for initial state before the migration is considered product-complete. Do not infer relationship state from previous local button clicks across component instances.

### Silent failures

All three operations catch errors and only call `console.error`. The user receives no visible explanation or retry guidance.

Required mitigation: translated, sanitized, accessible error state. Never render raw provider/database error text.

### Rate limits

The backend applies explicit per-route matchmaking rate limits. UI should avoid duplicate calls and present a retryable unavailable/rate-limited state where the shared error layer exposes one. Do not weaken backend rate limiting to make the UI appear responsive.

### Navigation after stale channel resolution

If the target changes while `getOrCreateChannel()` is pending, the old result can still navigate to the previous target's channel.

Required mitigation: stale-target protection or cancellation at the feature layer.

## Security and privacy boundaries

- Backend Supabase authentication remains authoritative for caller identity.
- Do not send an arbitrary caller ID from the browser.
- `userId` / `partnerId` is a target identifier and must remain validated/authorized server-side.
- Do not log tokens, authorization headers, or raw provider errors.
- Avoid adding target identifiers to analytics without an approved privacy contract.
- Follow/unfollow state must not be treated as proof of authorization for chat creation.
- The component must not bypass the StudyBuddiesService boundary with raw `fetch()` calls.

## Current test coverage

No colocated `external-profile.component.spec.ts` exists on current `main`.

That is a migration risk because all three actions have observable service, state, haptic, error, and navigation behaviour. The regression ticket must establish coverage before or with runtime conversion.

## Required regression coverage

At minimum add tests for:

1. component creation with a required `userId`;
2. native Spartan ownership for every rendered action;
3. Send Message calls `getOrCreateChannel(userId)` and navigates to exactly `/chat/room/:channel`;
4. Send Message does not navigate when channel resolution fails;
5. Follow calls the service with the active target and changes state only after success;
6. failed Follow leaves relationship state unchanged;
7. Unfollow calls the service with the active target and changes state only after success;
8. failed Unfollow leaves relationship state unchanged;
9. Follow and Unfollow haptic behaviour remains supplementary;
10. duplicate Follow/Unfollow activation is suppressed while pending;
11. duplicate Send Message activation is suppressed while pending;
12. stale follow/unfollow responses cannot mutate a newly selected target;
13. stale channel responses cannot navigate after the target changes;
14. initial authoritative following state is represented correctly once that contract is added;
15. translated labels remain visible and accessible;
16. error feedback is announced/readable and retryable;
17. RTL rendering contains no physical-direction utility dependency;
18. 390px and high-zoom layouts retain both actions without horizontal overflow; and
19. light/dark plus user-primary-accent states are present in design/visual coverage.

## Design-preview requirements

This audit does not change the visual contract, so no design-preview modification is required in this PR.

The later token/regression stages should add or update a mapped preview showing at least:

- light theme, 390px, not-following state;
- dark theme, wider layout, following state;
- pending Follow or Unfollow state;
- message-channel pending state;
- retryable failure state;
- long translated labels; and
- RTL layout.

If the repository mapping assigns the component to a broader profile/discovery preview rather than a component-specific file, update that existing mapped surface instead of creating an unregistered duplicate preview.

## Migration sequence

1. Preserve current API/service/navigation contracts and add regression coverage.
2. Establish authoritative initial follow state and target-safe async handling.
3. Add per-action pending/error state and duplicate-request protection.
4. Keep actions on Spartan `hlmBtn`; remove redundant legacy button styling.
5. Apply Relay semantic tokens and responsive composition.
6. Verify keyboard, touch, RTL, long translations, reduced motion where relevant, and high zoom.
7. Sync the mapped design preview and close the target's final regression ticket only after visual and unit contracts are green.

## Prerequisite primitive work

No new Spartan primitive is required.

Existing capability is sufficient:

- Spartan Helm Button for all three commands;
- Relay layout and feedback primitives for composition/status;
- existing app translation, haptic, router, and StudyBuddiesService boundaries.

Any new shared primitive should be justified by repeated product use, not by this component alone.

## Definition of done for issue #6192

This audit is complete when it records:

- every rendered control and mutually exclusive state;
- all API, haptic, state, error, and navigation side effects;
- current Spartan ownership;
- Relay/theme/responsive requirements;
- accessibility, RTL, multilingual, high-zoom, and input-method requirements;
- missing initial-follow/pending/error contracts;
- concurrency and stale-target risks;
- security/privacy boundaries;
- required test/design-preview coverage; and
- prerequisite primitive decisions.

No runtime behaviour is intentionally changed by this audit.