# Moment “Liked By” modal

## Product behavior

The like count on a Moment opens an authenticated dialog that lists the people who liked that Moment, newest like first. Each row links to the existing public profile route and shows the learner's first native/target language pair when both values are available.

The dialog has explicit loading, empty, unavailable, retry and incremental-loading states. Closing the Spartan dialog through its close action, Escape/focus-management behavior, or navigation returns control to the Moments feed. At narrow widths and high zoom the dialog is constrained to the viewport and its user list scrolls independently.

## API contract

`GET /moments/:id/likes?offset=0&limit=50`

- requires the existing `SupabaseAuthGuard`;
- returns an array of liker profile summaries for backward compatibility with the pre-existing endpoint;
- defaults to 50 rows and rejects limits outside `1..50` or offsets outside `0..10000`;
- orders by `moment_likes.created_at DESC`;
- returns `404` when the Moment no longer exists;
- returns `403` when the viewer and Moment author are blocked in either direction;
- removes liker profiles that are blocked in either direction with the viewer;
- never returns credentials, email addresses or private Moment content.

The Angular `MomentsStore` owns the authenticated request and always uses `environment.apiUrl`, matching the rest of the Moments API. The modal requests additional pages only when the preceding page is full and deduplicates user IDs before rendering.

## Privacy and failure behavior

The viewer must be authenticated before a social-graph query is issued. The backend verifies the Moment before querying its likes and applies bidirectional block filtering using `SafetyService`. Database/provider errors are converted to a generic failure and are not included in the HTTP response body by this feature.

Frontend errors do not log response payloads or retain a stale list from a previous Moment. A request-version guard discards late responses after the selected Moment changes or the dialog closes.

No new data is persisted. Like retention and account-deletion behavior remain owned by the existing `moment_likes` foreign keys and deletion workflows.

## Accessibility

The modal uses the repository's Spartan dialog primitive for focus trapping and Escape handling. It has labelled dialog content, an `aria-live` status region, non-color loading/error state, keyboard-focusable profile links, touch-sized controls and text alternatives that avoid duplicating avatar names.

## Verification

Automated coverage includes:

- bounded paging and ordering arguments;
- missing/blocked Moment authorization;
- blocked liker filtering;
- sanitized storage failures;
- controller viewer/page forwarding;
- initial load, retry, pagination, duplicate-request suppression and stale-response protection in Angular;
- profile-link and language-pair rendering behavior.

Repository CI remains authoritative for backend unit/lint/build/E2E, frontend Vitest/static-analysis/build, dependency review and UI/translation governance.

## Rollout and rollback

No schema migration or data backfill is required. The endpoint keeps its existing array response, so older clients remain compatible when the backend deploys first. New clients add optional `offset` and `limit` parameters.

Rollback is a normal application revert. Existing likes and Moment rows require no cleanup.
