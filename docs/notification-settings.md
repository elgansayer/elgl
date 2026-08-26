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
