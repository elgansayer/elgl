# Unread counter and navigation badge contract

This document describes the frontend unread-count contract implemented by `UnreadCounterService` and consumed by the primary desktop and mobile navigation surfaces.

## State ownership

`UnreadCounterService` is the single frontend owner for the five primary navigation counters:

- `chat`
- `moments`
- `discovery`
- `audioRooms`
- `profile` (notification activity)

Producers update counts through `set`, `setCount`, `increment`, `decrement`, or `reset`. Navigation components read them through `tabCount` (or `get`) and render compact badge text through `badgeText`. Existing chat/notification helper methods remain supported for mixed-version callers.

After a chat message or in-app notification is persisted, the backend emits a count-only `unread.created` domain event. The Chat-owned personal unread listener publishes `{ type: "unread_count_changed", tab }` to the recipient's authenticated `user_{id}` channel. Notification activity is routed to Moments, Discovery, or Profile according to its persisted type; chat messages target Chat; incoming call events target Live Rooms. Payloads contain no message, profile, or room content.

Successful persisted chat read receipts decrement the shared Chat count immediately. Failed receipts preserve the current count so the client does not claim that server state changed. Initial chat and notification totals start independently of economy, safety, daily check-in, realtime, and push startup tasks; either count can load when another startup dependency is unavailable.

All incoming count values are normalised before entering UI state. Negative, non-finite, and invalid values become zero, fractional values are floored, and individual plus aggregate counts saturate at `Number.MAX_SAFE_INTEGER`. Visible badges display `99+` above 99 without discarding the full underlying count used for accessibility and arithmetic.

## Navigation and accessibility

Both primary navigation implementations consume the same service instance:

- mobile navigation in `frontend/src/app/app.component.html`
- desktop navigation in `frontend/src/app/components/desktop-sidebar/`

Badges are supplementary visual indicators. Their numeric state is also exposed as text to assistive technology, and active routes retain native links with `aria-current="page"`. The badge must not become an independent focus target or button.

## Application badge

The aggregate `totalUnread` count drives the browser/PWA App Badging API when the browser exposes callable `navigator.setAppBadge` / `navigator.clearAppBadge` functions.

App Badging is deliberately best-effort:

- unsupported browsers continue without a badge;
- browser/OS permission or platform failures do not block navigation or message delivery;
- no user, message, room, or notification content is logged when a badge update fails;
- malformed/non-callable browser shims are ignored rather than invoked.

The in-app navigation badges remain authoritative when the platform badge is unavailable.

## Privacy and security

Unread state contains counts only. The global service must never retain message text, profile details, room titles, tokens, or other private payloads. Counter updates must continue to originate from authenticated application flows; the badge service itself performs no network or privileged operation.

## Failure handling

A failure to update the platform application badge is isolated from in-app state. Invalid producer counts are normalised at the service boundary, so a malformed response or realtime event cannot create negative, infinite, or fractional navigation badges.

The aggregate count is saturated before it reaches the browser API, preventing arithmetic outside JavaScript's safe-integer range when several independently bounded tab counters are combined.

## Verification

Focused checks live in:

- `frontend/src/app/services/unread-counter.service.spec.ts`
- `frontend/src/app/app-navigation-tabs.contract.spec.ts`

The service suite covers normalisation, saturation, compact presentation, lifecycle operations, and browser badge failure behaviour. Root and chat component tests cover real-time tab routing, partial startup failure, and persisted read transitions. Backend listener tests cover personal channel payloads, notification classification, persistence failure, and realtime delivery failure. The navigation contract verifies that all five tabs remain wired to the shared service in both mobile and desktop navigation and retain accessibility semantics.

Run the focused frontend tests with the repository's normal Vitest command, and use the full frontend lint/build/test CI jobs as the merge gate.

## Rollout and rollback

This change has no API, database, or migration impact. Deploy the backend before or with the frontend so typed personal unread events are available. Older frontends ignore the new event discriminator, and newer frontends retain bootstrap counts when connected to an older backend.

Rollback is code-only: revert the personal event publisher and frontend consumer together. Persisted messages and notifications remain authoritative and require no cleanup or migration.
