# Notification settings

Issue #1453 defines the legacy notification preference matrix used by **Settings → Notifications**.

## Preference contract

The page exposes independent **Push** and **Badge** switches for Direct Messages, Groups, Likes, and Voice Rooms. Values are loaded from the authenticated `/api/notifications/preferences` boundary and updates preserve the sibling channel for the same category.

Preference mutations are serialized. While one switch is being persisted, all switches are disabled so two overlapping responses cannot overwrite each other from the same stale preference snapshot. The active switch exposes busy state to assistive technology. A failed or rejected update preserves the last server-confirmed preferences and presents a retryable error instead of claiming success.

## Loading and failure behaviour

A failed initial preference load does not invent local defaults. The page displays an alert and an explicit retry action. Successful mutations are announced through a polite status region. Errors use alert semantics.

## Accessibility and responsive behaviour

Each setting is a native Spartan button with `role="switch"`, an accessible label containing both category and channel, and `aria-checked` state. The interactive target uses the repository's 44 CSS pixel `icon-touch` size while the visual switch track remains compact. Track alignment uses logical flex start/end rather than physical horizontal transforms, so the state remains direction-safe in RTL layouts.

The settings matrix stays usable at narrow widths and high zoom, and no preference state is communicated by colour alone.

## Privacy and security

Notification preferences are account-owned state and are only persisted through the existing authenticated API. The frontend does not log preference payloads, user identifiers, tokens, or provider failures. Server responses remain authoritative.

## Verification

Run the focused component test:

```bash
cd frontend
npm test -- --run src/app/pages/settings/notification-settings/notification-settings.component.spec.ts
```

Also run frontend static analysis and production build before rollout:

```bash
npm run lint:check
npm run build
```

## Rollout and rollback

No database or API migration is required. The change is compatible with the existing `LegacyNotificationPreferences` response shape.

Rollback is a normal frontend revert. Existing persisted notification preferences remain valid and are not modified during rollback.

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

