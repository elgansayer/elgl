# Navigation unread badges

Issue #1045 is implemented by the shared `UnreadCounterService` and the primary navigation surfaces.

## Runtime contract

The service owns independent counters for the five primary destinations:

- Chat: `chatUnread`
- Moments: `momentsUnread`
- Connect / Discovery: `discoveryUnread`
- Live Rooms: `audioRoomsUnread`
- Profile: `notificationUnread`

Both the desktop sidebar and the mobile bottom navigation read those counters through `tabCount(tab)`. A badge is rendered only when the corresponding count is greater than zero. Visible badge text is capped at `99+`; the service retains the full numeric count so totals, decrements, and later rendering are not lossy.

The global notification control is separate from the per-tab navigation contract. Realtime user-channel events and the initial unread-count bootstrap remain responsible for updating service state; navigation components only render that state and do not perform network requests.

## Accessibility and responsive behaviour

Navigation destinations remain native links with visible keyboard focus and route-aware `aria-current="page"` state where applicable. Badges are supplemental visual state inside those links and do not replace the translated destination label.

The desktop sidebar is intentionally hidden below the repository's desktop breakpoint, while the mobile bottom navigation owns the same five counters below that breakpoint. No counter state is duplicated between the two layouts.

## Failure behaviour

Unread-count bootstrap and realtime delivery are best-effort. If a backend count request or realtime event is unavailable, navigation remains usable and displays the latest in-memory count. The UI must not fabricate unread values to conceal a provider or network failure.

Counts are clamped to zero by `UnreadCounterService`; negative badge values are therefore never rendered.

## Verification

Relevant automated coverage lives in:

- `frontend/src/app/services/unread-counter.service.spec.ts` for counter updates, clamping, totals, and application-badge integration;
- `frontend/src/app/components/desktop-sidebar/desktop-sidebar.component.spec.ts` for per-tab navigation binding, zero-state badge removal, `99+` presentation, native-link semantics, focus treatment, and active-route semantics;
- `frontend/src/app/app.component.spec.ts` for root-service wiring and realtime unread updates.

Frontend CI should run the normal unit, static-analysis, and production-build gates before merge.

## Rollout and rollback

This completion change adds regression coverage and documentation around the existing production integration. It introduces no schema, API, route, storage, authentication, or migration changes. Rollback is a normal revert of the test/documentation commit; production unread behaviour is unchanged.
