# Notification settings

The Notification Settings screen (`/settings/notification`) lets an authenticated user control
delivery per event category. There is exactly one preference contract:

- `GET /api/notification-preferences`
- `PUT /api/notification-preferences`
- `POST /api/notification-preferences/reset`

`notifications/notification-preferences.controller.ts` owns all three routes; the removed
`/api/notifications/preferences` and `/api/users/me/notification-preferences` endpoints must not be
reintroduced. `notification-preferences-routes.contract.spec.ts` fails if they are.

## Preference model

Eleven categories (`new_message`, `call_invite`, `moment_like`, `moment_comment`, `correction`,
`gift`, `profile_view`, `study_reminder`, `friend_request`, `audio_room_invite`, `new_follower`)
each carry four channels: `push`, `email`, `in_app` and `badges`. The same document also carries
`do_not_disturb`, `quiet_hours_start`, `quiet_hours_end`, `quiet_hours_timezone`, `customToneUrl`,
`vibrationPattern` and `updatedAt`.

Persistence lives in the `public.notification_preferences` table (11 JSONB category columns plus the
quiet-hours/tone columns). `NotificationPreferencesService.shouldSendNotification` enforces the
toggle and quiet-hours/DND rules for push and email; `in_app` remains available so the inbox can be
reviewed later.

## Mutation rules

- `PUT` merges the supplied partial document with the stored row, validates quiet-hour pairs and
  timezones, then upserts. One channel toggle cannot reset sibling channels or categories.
- The UI does not optimistically flip a switch: it renders only the server-confirmed document and
  keeps all controls disabled while a mutation is in flight.
- `POST /reset` restores the documented defaults. No other endpoint may write preferences.

## Failure handling

Initial-load failures clear the local document, show an alert and offer retry. Save failures keep
the last confirmed state and show a retryable error. The Nest API is the only writer; the Angular
client never reads or writes the Supabase table directly.

## Accessibility

Category and channel labels come from the translation dictionary, controls expose switch semantics
with busy state, targets meet the repository touch-target minimum, and layout uses logical
properties so the matrix mirrors correctly in RTL.

## Verification

- `backend/src/notifications/notification-preferences.service.spec.ts` covers quiet hours, DND,
  timezone fallback and merge behaviour.
- `backend/src/notifications/notification-preferences-routes.contract.spec.ts` pins the single route
  inventory and the removal of the legacy endpoints.
- `backend/src/notifications/notifications.service.spec.ts` covers push suppression through the rich
  preference service, including the legacy-category mapping.
- `frontend/src/app/services/notification-preferences.service.spec.ts` covers GET, PUT, toggle,
  DND and reset against `${environment.apiUrl}/notification-preferences`.

## Rollout and rollback

Deploy the backend first: it removes the legacy endpoints and starts serving the rich contract.
Deploy the frontend immediately after; the settings route now lazy-loads the rich preference
component. Rollback is a code revert; the `notification_preferences` table already stores every
field, so no data migration is needed.
