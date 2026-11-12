# Unread counter and navigation badge contract

This document describes the frontend unread-count contract implemented by `UnreadCounterService` and consumed by the primary desktop and mobile navigation surfaces.

## State ownership

`UnreadCounterService` is the single frontend owner for the five primary navigation counters:

- `chat`
- `moments`
- `discovery`
- `audioRooms`
- `profile` (notification activity)

Producers update counts through `set`, `increment`, or `decrement`. Navigation components read them through `tabCount` and render compact badge text through `badgeText`. Existing chat/notification helper methods remain supported for mixed-version callers.

The authenticated chat count endpoint remains the source of truth for Chat. The authenticated notification count endpoint preserves its existing `unreadCount` field and also returns bounded per-tab counts for Moments, Discovery, and Profile. It performs four fixed indexed count queries in parallel, not a collection scan or per-notification query. Chat-backed `mention_chat` inbox rows remain in `unreadCount` for inbox actions but are excluded from notification tab counts because the corresponding messages are already owned by Chat.

After durable chat messages or notification rows create unread activity, the backend emits an internal `unread.counts_changed` event. A single listener publishes `{ "type": "unread_counts_changed", "source": "chat" | "notifications" }` to the recipient's authenticated `user_{id}` channel. The Angular app treats that payload as an invalidation signal, coalesces repeated events by source while a refresh is active, and serialises authoritative refreshes through the existing REST APIs. It does not trust client-supplied absolute counts or retain private event content.

Each refresh captures a service snapshot. `reconcile` applies the authoritative response without overwriting an increment or persisted read that completed while the request was in flight. Conflicting local increase and decrease transitions preserve the final locally observed value until the next serialised authoritative refresh. Opening a chat decrements Chat only after the read receipt succeeds. Notification read and mark-all actions update their owning tabs only after persistence succeeds. Read mutations are not echoed to the initiating client through the personal channel, avoiding a refresh plus local-decrement race.

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
- `frontend/src/app/app.component.spec.ts`
- `frontend/src/app/components/chat-room/chat-room.component.spec.ts`
- `frontend/src/app/components/notifications-inbox/notifications-inbox.component.spec.ts`
- `backend/src/notifications/notifications-inbox.service.spec.ts`
- `backend/src/chat/listeners/personal-unread.listener.spec.ts`

The focused suites cover normalisation, concurrent reconciliation, compact presentation, browser badge failure behaviour, authenticated grouped counts, persistence-before-invalidation ordering, realtime delivery failure, read transitions, and both navigation surfaces.

Run the focused frontend tests with the repository's normal Vitest command, and use the full frontend lint/build/test CI jobs as the merge gate.

## Rollout and rollback

This change extends the existing notification unread response without removing `unreadCount`. It has no schema or migration impact. Deploy the backend before or with the frontend so the personal invalidation event and per-tab response are available together. Existing notification retention and deletion rules are unchanged.

Rollback is code-only: revert the response extension, event publisher, and frontend consumer together. Persisted messages and notifications remain authoritative and require no cleanup.
