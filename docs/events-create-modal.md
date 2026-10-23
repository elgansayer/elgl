# Create Event modal

Issue: #853

## User flow

The Events feed exposes **Create Event** through the shared Spartan dialog primitive. The dialog traps focus, supports keyboard dismissal, returns focus to its trigger, and reflows within the viewport at high zoom.

Required fields are event title, local date/time, venue/platform, venue detail, and description. Category is required by the UI. Language pair and participant limit remain optional.

The venue contract is explicit:

- `audio_room`: `location` is an existing Audio Room UUID. The backend verifies that the room exists, is active, and belongs to the authenticated event creator.
- `zoom`: `location` is an HTTP(S) meeting URL. Unsafe URL schemes are rejected by both client and server.
- `in_person`: `location` is a non-empty physical location string.

The browser displays its IANA timezone next to the date/time field. A `datetime-local` value is converted to an ISO UTC timestamp before submission, while `timezone` is sent as request metadata and validated by the backend. `venue_type` and `timezone` are creation-policy inputs only; the existing events table remains the persistence contract, so no schema migration is required.

## Validation and failure behavior

The API trims bounded strings and rejects whitespace-only required values. Current bounds are 120 characters for title, 2,000 for description, 500 for location, 64 for timezone, and 1-100 participants. Event timestamps must be in the future.

The create button is guarded while a request is pending to prevent duplicate submissions. A retryable API failure leaves the user's draft intact and exposes an alert. Explicit cancel and successful creation reset the form. On success, the new event is inserted into the active upcoming feed when it matches the current language filter, avoiding a full list reload.

The server remains authoritative for date, timezone, URL, and Audio Room ownership checks. Audio Room validation fails closed if storage cannot verify the referenced room. Validation logs do not include event text, URLs, room identifiers, or other user content.

## Deployment

Deploy the backend contract and `EventCreationPolicyService` before the frontend that sends `venue_type` and `timezone`. There is no database migration. Existing reads, event reminders, RSVP behavior, and stored event rows are unchanged.

Verification:

1. Create a future in-person event and confirm it appears immediately in the upcoming feed.
2. Create an HTTPS Zoom event and confirm the persisted `location` is the submitted URL.
3. Confirm `javascript:` and malformed URL inputs cannot be submitted.
4. Confirm a user cannot schedule another user's Audio Room, and a valid owned active room succeeds.
5. Confirm past dates, whitespace-only title/description/location, and participant limits above 100 are rejected.
6. Simulate an API failure, verify the draft remains, then retry successfully.
7. Verify keyboard focus remains in the dialog, Escape closes it, focus returns to the trigger, and the form remains usable at 200%+ zoom.

## Rollback

Rollback the frontend first, then the backend policy/DTO changes. Because this feature does not add or mutate schema, rollback requires no data migration. Events created by the new flow use the existing event columns and remain readable by older application versions.
