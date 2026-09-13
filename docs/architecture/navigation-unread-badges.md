# Navigation unread badges

Issues #1045 and #1046 are implemented by the shared `UnreadCounterService` and both primary navigation surfaces.

## Runtime contract

`UnreadCounterService` is the single in-memory owner for the five primary destinations:

- Chat: `chatUnread`
- Moments: `momentsUnread`
- Connect / Discovery: `discoveryUnread`
- Live Rooms: `audioRoomsUnread`
- Profile: `notificationUnread`

Both the desktop sidebar and mobile bottom navigation read those counters through `tabCount(tab)`. A visual badge is rendered only when the corresponding count is greater than zero. `badgeText(tab)` caps visual text at `99+`, while the full integer remains in service state for totals, assistive technology, later decrements, and the application badge.

Counter producers remain separate from presentation. The root user-channel subscription and unread bootstrap populate chat/notification state, while feature-specific producers may update the other tab counters through the same service. Navigation components perform no network requests and must not fabricate counts when a producer is unavailable.

## Defensive count handling

All values passed to `set()` are normalized before becoming navigation state:

- negative, `NaN`, and infinite values become zero;
- fractional values are floored to an integer;
- increments saturate at `Number.MAX_SAFE_INTEGER` rather than overflowing into an unsafe value.

This prevents malformed provider/API values from producing `NaN`, `Infinity`, negative, or unstable badge content. Legacy chat/profile helper methods delegate to the same normalization path.

## Accessibility and responsive behavior

The desktop sidebar and mobile bottom navigation expose the same five counters without duplicating state.

- Desktop visual badge text is marked `aria-hidden`; a visually hidden localized unread count remains part of the link's accessible name.
- Mobile links include the full localized unread count in `aria-label`, even when the visible badge is capped at `99+`.
- Mobile primary links now expose `aria-current="page"` through `RouterLinkActive`, matching desktop route semantics.
- Emoji icons are decorative for the mobile primary links and are hidden from assistive technology.
- Both navigation landmarks use the translated `nav.mainNav` label and retain visible keyboard focus treatment.

The desktop sidebar remains hidden below the repository's desktop breakpoint, while the mobile bottom navigation owns the same service state below that breakpoint.

## Failure behavior

Unread bootstrap and realtime delivery are best-effort. If a backend count request or realtime event is unavailable, navigation remains usable and displays the latest valid in-memory count. The UI does not invent unread values to conceal provider or network failures.

Application Badge API failures remain non-fatal because browser support is optional. The navigation UI continues to display service state even when `navigator.setAppBadge()` or `navigator.clearAppBadge()` is unavailable or rejects.

## Security and privacy

Unread counters contain aggregate numbers only. Navigation does not persist message contents, notification payloads, credentials, tokens, or user identifiers. No new API, database, storage, analytics, or logging surface is introduced by this implementation.

## Verification

Relevant automated coverage lives in:

- `frontend/src/app/services/unread-counter.service.spec.ts` for per-tab state, normalization, saturation, compact badge presentation, totals, and optional application-badge integration;
- `frontend/src/app/components/desktop-sidebar/desktop-sidebar.component.spec.ts` for all five tab bindings, zero-state removal, `99+` presentation, full assistive unread text, native-link semantics, focus treatment, and active-route semantics;
- `frontend/src/app/app.component.spec.ts` for root-service wiring and realtime unread updates.

Frontend CI should run the normal unit, static-analysis, production-build, translation-safety, UI-design, and repository verification gates before merge.

## Rollout and rollback

This is a frontend-only compatibility change. It introduces no schema, API, route, persistence, authentication, or migration changes and is safe to deploy independently of the backend.

Rollback is a normal revert of the issue #1046 commits. Existing producer APIs and persisted data require no cleanup or downgrade procedure.
