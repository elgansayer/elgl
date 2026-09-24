# Notification settings contract

## Scope

The Notification Settings screen lets an authenticated user independently control **Push Alerts** and **Badges** for four product categories:

- Direct Messages
- Groups
- Likes
- Voice Rooms

These four settings use the existing `GET /api/notifications/preferences` and `PUT /api/notifications/preferences` compatibility API. They intentionally remain separate from the richer per-event notification-preference model while older and newer clients coexist.

## Persistence and mutation rules

The server is authoritative. A client may update one category/channel at a time, but the controller first reads the authenticated user's current preferences and merges the requested partial category into that state before persistence. This prevents a Direct Messages change from resetting Group, Like, Voice Room, badge, or Do Not Disturb choices to defaults.

The request DTO explicitly validates the four compatibility categories and their `push`/`badge` booleans. Unknown or wrongly typed values are rejected by the normal NestJS validation boundary rather than being silently stripped into an apparent successful no-op.

The Angular screen serializes mutations. While one switch is being saved, the other switches are disabled. The UI does not optimistically flip a preference: it renders the new state only after receiving and validating the server-confirmed preference object. A failed write therefore leaves the last confirmed state visible and immediately retryable.

## Failure handling

Initial-load failures clear private preference state, disable the switches, show an alert, and expose an explicit Retry action. Save failures preserve the prior confirmed settings and show an alert. API responses are treated as untrusted input; the Angular service requires a bounded user identifier, timestamp, Do Not Disturb boolean, and complete boolean `push`/`badge` state for every category before the response may enter UI state.

Backend read/write failures are allowed to propagate through the authenticated API. A failed authoritative read prevents the partial update from being written, avoiding preference loss when the database is degraded.

## Accessibility and responsive behavior

Each control is a named `role="switch"` with `aria-checked`. Pending controls expose `aria-busy`, all mutation controls are disabled while a write is in flight, save success is announced using a polite status region, and failures use alert semantics. Controls retain at least a 44px interaction target and category text may wrap under narrow/high-zoom layouts. Emoji are decorative; the translated category label carries the meaning.

## Privacy and security

Preference routes remain protected by `SupabaseAuthGuard` and derive the target user from the authenticated session. The client cannot nominate another user's ID. Preference API validation errors do not include preference payloads, tokens, or other private content. No notification message bodies or contact data are added to the settings payload.

## Verification

Regression coverage locks the following behaviors:

- all four categories and both channels render;
- one-category updates preserve every untouched category and the sibling channel;
- unauthenticated mutations are rejected;
- a failed authoritative read never performs a write;
- rapid switch presses cannot create competing writes;
- failed writes retain the prior server-confirmed state;
- malformed GET/PUT responses fail closed in the Angular API client;
- load failures can be retried without retaining stale private state.

Repository CI remains authoritative for the complete backend/frontend lint, build, unit, E2E, accessibility/design, and contract suites.

## Rollout and rollback

The change is mixed-version safe. Deploying the backend first is preferred because it begins accepting and correctly merging the legacy category DTO fields before the hardened frontend is served. Older clients continue using the same route and JSON shape.

Rollback requires no migration or data cleanup because the persisted schema and response shape do not change. If the frontend is rolled back first, the backend merge/validation fix should normally be retained because it prevents data loss for older clients as well. A full revert restores the previous behavior but can reintroduce silent no-op validation and unrelated-category resets on partial updates.
