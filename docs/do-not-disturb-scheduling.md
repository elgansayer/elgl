# Do Not Disturb scheduling

Issue: #784

## Behaviour

Notification preferences expose two independent quieting controls:

- **Do Not Disturb** is a manual switch. While it is enabled, interruptive `push` and `email` delivery is suppressed immediately.
- **Scheduled quiet hours** are enabled whenever both a start and end time are saved. They suppress interruptive `push` and `email` delivery inside that local-time interval, whether or not manual Do Not Disturb is enabled.

In-app notification delivery is intentionally preserved in both cases. This keeps the notification inbox and badge state available when a user opens the product without producing an interruptive device/email alert.

Category-level channel preferences remain authoritative outside a DND/quiet-hours suppression window. No notification event is deleted because of DND; the delivery decision is made when each listener evaluates the recipient's preferences.

## Schedule contract

`quiet_hours_start` and `quiet_hours_end` use strict 24-hour `HH:mm` values from `00:00` through `23:59`.

- Both values must be supplied or both must be cleared.
- Equal start and end values are rejected instead of ambiguously meaning either disabled or 24-hour suppression.
- The start boundary is inclusive.
- The end boundary is exclusive.
- An end earlier than the start represents an overnight interval, for example `22:00` to `07:00`.
- Clearing both values disables scheduled quiet hours without changing manual DND.

The Angular settings page saves the browser's current IANA timezone in `quiet_hours_timezone` whenever a schedule is configured. The backend uses `Intl.DateTimeFormat` with that IANA zone, so daylight-saving transitions and later server-host timezone changes do not alter the user's intended local schedule.

Legacy rows without a timezone are evaluated as UTC until the user next saves a schedule. Corrupt/unknown stored timezone values also fail safely to UTC during delivery evaluation; new invalid timezone values are rejected on update.

## API and persistence

The authenticated `GET /notification-preferences`, `PUT /notification-preferences`, `POST /notification-preferences/reset`, and category/channel patch endpoints remain the canonical API.

The canonical category shape is:

```text
{ push: boolean, email: boolean, in_app: boolean, badges: boolean }
```

The old frontend-only `badge` field and legacy category names (`direct_messages`, `groups`, `likes`, `voice_rooms`) are not part of this endpoint's contract. Legacy `/notifications/preferences` helpers remain isolated for callers that still need the historical endpoint.

Migration `20260820204500_notification_preferences_timezone.sql` converges `notification_preferences` into the root Supabase migration history and adds the nullable `quiet_hours_timezone` field. The table was originally defined only by a module-local backend migration, so a clean `supabase db reset` could otherwise reach the timezone migration without having the table. The migration is idempotent: on a fresh database it creates the canonical table, trigger, index, and owner-only RLS policies; on an existing deployment it only adds missing newer fields. Existing rows are not rewritten.

## Validation and failure behaviour

The backend validates time syntax, paired start/end semantics, unequal boundaries, and IANA timezone validity before writing preferences. Invalid schedule updates return a client error and leave the previous persisted preferences unchanged.

The Angular screen keeps edits local until **Save**, prevents duplicate submissions, persists time edits even when the DND checkbox itself was not toggled, and keeps unsaved edits after a failed request so the user can retry. Reset uses the server reset endpoint and therefore clears DND and scheduled quiet hours as well as restoring category defaults.

Loading failure blocks the editor because the current server state is unknown. Save/reset failures are exposed as live alerts without replacing the loaded form. Saving and success states are announced through polite live regions. Controls remain keyboard-native and reflow to one column on narrow/high-zoom layouts.

## Verification

Backend coverage includes:

- manual DND for push/email;
- in-app preservation;
- scheduled suppression in an IANA timezone;
- spring/fall daylight-saving transitions;
- overnight and exact boundary behaviour;
- invalid legacy timezone fallback;
- unpaired schedules, equal boundaries, malformed times, and invalid IANA zones.

Frontend coverage includes:

- canonical channel rendering;
- local dirty state;
- save-without-toggle for edited quiet hours;
- independent manual DND save;
- invalid/unpaired schedule rejection;
- duplicate-submit prevention;
- server reset semantics;
- save-failure retention.

The repository's normal CI remains authoritative for lint, type checking, unit tests, production builds, database clean-reset checks, and UI governance.

## Rollout

1. Apply the Supabase migration. Existing installations gain `quiet_hours_timezone`; clean installations also converge the canonical notification-preferences table into root migration history.
2. Deploy the backend. Existing rows continue to work, using UTC when no timezone is stored.
3. Deploy the frontend. The next scheduled-quiet-hours save records the browser's current IANA timezone and uses the canonical channel contract.
4. Observe notification-delivery error rates and preference-update validation failures. No private notification content or preference values should be added to logs.

## Rollback

Roll back frontend and backend application code normally. Leave the converged notification-preferences schema and nullable timezone column in place; older code ignores the extra field and retaining the schema avoids a destructive database rollback. If the new frontend is rolled back before the backend, the backend still accepts existing preference updates that do not include the timezone field. If the new backend is rolled back before the frontend, scheduled saves may persist only the fields understood by that older backend, so application versions should normally be rolled back together.
