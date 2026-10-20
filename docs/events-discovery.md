# Events discovery

Issue #852 is implemented through the existing NestJS Events API and the Angular `/events` discovery route.

## Runtime contract

The centralized feed uses `EventsService.listEvents()` against authenticated `GET /events`. The default view requests upcoming events with bounded 20-item pages and relies on the backend's deterministic `date_time` ordering. Upcoming/past, language pair, and canonical category filters reset pagination and stale responses are ignored rather than replacing a newer filter result.

Category identifiers are owned by the backend. The Angular client loads `GET /events/categories` and sends the canonical values (`audio_room`, `learning_seminar`, `in_person_meetup`, `cultural_exchange`) instead of maintaining a second display-string API contract.

Each feed title is a native link to `/events/:eventId`. The detail route loads `GET /events/:id` and renders host, localised browser date/time, category, location, description, capacity and aggregate RSVP counts when available. Event text is rendered with Angular interpolation, not trusted HTML.

## Timezone and privacy

Event timestamps cross the API boundary as ISO 8601 values. Angular's `DatePipe` displays them in the browser's local timezone, so daylight-saving changes are handled by the platform rather than by hard-coded offsets.

The discovery UI never receives or renders an attendee list. The detail API exposes aggregate attending/interested counts only. Event descriptions and locations are rendered as text, so user-controlled markup is not executed.

## Failure and concurrency behaviour

- loading, empty and failed first-page states are explicit;
- failed pagination is retryable without skipping a page;
- changing a filter while an older request is in flight prevents the stale response from overwriting the new result;
- category-endpoint failure does not fabricate categories or block the event feed;
- detail failures expose an accessible retry action for the same event ID.

## Verification

Focused coverage lives in:

- `frontend/src/app/services/events.service.spec.ts` for query serialization, server-owned categories and detail requests;
- `frontend/src/app/components/events-feed/events-feed.component.spec.ts` for initial loading, category filtering, detail navigation, stale-response protection, pagination retry and error recovery;
- `frontend/src/app/components/event-detail/event-detail.component.spec.ts` for detail loading, text-safe rendering and retry behaviour.

The normal frontend unit, static-analysis, build, design-governance and repository CI gates remain authoritative before merge.

## Rollback

This change is API-compatible and has no migration. Reverting the frontend commit restores the previous feed. The NestJS Events endpoints and persisted event/RSVP data are unchanged.
