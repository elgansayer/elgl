# Chat Settings

## Scope

The Chat Settings page owns the account-level controls for Auto-Translate, Read Receipts, and Enter-to-Send. It reuses the existing authenticated `GET /api/chat/settings` and `PUT /api/chat/settings` contract through `ChatSettingsService`; it does not create a second persistence store.

The three message-behaviour preferences default to `false` when no preference has been saved. Chat text size remains a separate preference consumed by Appearance Settings and is deliberately not changed by **Reset to defaults** on this page.

## State and failure contract

The page distinguishes four states:

- **Loading:** controls are not editable until the authenticated settings request completes.
- **Load unavailable:** the page shows an alert and Retry action rather than presenting local defaults as if they were saved account state.
- **Saving:** all mutation controls are disabled and the page exposes an `aria-busy`/live status. This prevents conflicting concurrent writes from the settings surface.
- **Save failed:** the last server-confirmed values remain visible and an alert is shown. A later user action retries normally.

Individual setting changes are applied locally only after the server confirms the `PUT`. Reset sends all three message-behaviour defaults in one request so a network interruption cannot leave a partially reset UI. The existing text-size value is preserved.

## Security and privacy

Settings requests use the current Supabase bearer session through `AuthService.getBearerHeaders()`. The browser never accepts a caller-supplied user identifier for this page. No chat content, credentials, tokens, or preference payloads are logged or stored in an additional browser cache by this feature.

API responses are treated as untrusted input. Boolean preferences are accepted only as actual booleans; malformed response objects fail the authoritative load rather than enabling controls with guessed state.

## Accessibility and responsive behaviour

- Each preference uses a native button with `role="switch"`, an explicit translated accessible name, and `aria-checked`.
- Switches and Reset have a minimum 44 px interaction height.
- Switch thumb alignment uses flex start/end rather than physical X-axis transforms, so it follows document direction in RTL layouts.
- Loading/saving states use polite status announcements and failures use alerts.
- Labels/descriptions wrap on narrow screens and at high zoom; rows stack on the mobile baseline and return to a horizontal layout when space permits.
- Disabled controls remain visibly and programmatically unavailable while a mutation is in flight.

## Verification

Focused regression coverage lives in:

- `frontend/src/app/services/chat-settings.service.spec.ts`
- `frontend/src/app/pages/chat-settings/chat-settings.component.spec.ts`

The tests cover authenticated loading, malformed responses, transport failures, server-confirmed mutations, concurrent mutation suppression, reset persistence, retry UI, accessible switch state, touch sizing, busy state, and save failures. Canonical repository CI remains authoritative for frontend unit tests, static analysis, build, translation safety, Spartan/design checks, and dependency review.

## Rollout and rollback

This change is frontend-only and does not alter the API path, schema, stored JSON keys, or account migration requirements. It is safe with existing backends that implement the current Chat Settings endpoints.

Rollback is a normal code revert. Existing persisted preferences remain intact. A rollback should not require deleting or rewriting `chat_preferences` data.
