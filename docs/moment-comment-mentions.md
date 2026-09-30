# Moment comment @mentions

Issue: #1683

## Contract

Moment comments use one authenticated comment mutation and one best-effort notification fan-out. The comment text remains the canonical persisted content. Typing `@` followed by a supported name fragment in the Moments comment composer activates the existing bounded user search (`limit=5`). Selecting a suggestion inserts the display name into the comment; Arrow Up/Down move through suggestions, Enter selects the active suggestion, and Escape closes the popup. Enter submits only when the mention popup is not consuming the key.

The frontend exposes the suggestion popup as an ARIA combobox/listbox relationship. Every result is an actual button with a 44px minimum touch target, keyboard focus styling, `aria-selected`, decorative avatar alt text, and `dir="auto"` around user-controlled display names. The comment input stays usable if user search fails; no autocomplete result is required to submit a comment.

## Backend and notification flow

`MomentsService.addComment()` owns the server-side mention boundary. After the authenticated comment is stored, the service resolves textual mentions against current user records and emits a bounded `moment.mention` event with resolved user IDs. The event listener never trusts the client to choose a notification recipient directly.

`CommentMentionNotificationListener` applies a second delivery boundary:

- duplicate recipient IDs and self-mentions are removed;
- at most 20 recipients are processed for a single event;
- the recipient's `moment_comment` push preference is checked before delivery;
- preference lookup failures fail closed, so an outage cannot bypass an opt-out;
- notification delivery failures are isolated per recipient so one provider failure does not block the remaining recipients;
- legacy single-recipient events still fall back to `momentAuthorId` for mixed-version deployments.

Mention notifications are best-effort. A push-provider or preference-store failure must never roll back an already persisted comment.

## Security and privacy

The comment mutation remains protected by the existing Supabase authentication and Moments authorization rules. Mention resolution operates on server-side user records after the comment is accepted; arbitrary browser-supplied notification recipients are not used. The existing Moments block checks continue to prevent interaction where either side has blocked the other.

The listener deliberately avoids logging comment text, recipient IDs, access tokens, provider payloads, or raw provider/database errors. Operational warnings describe only the failure class. Notification preference failures suppress delivery rather than assuming consent.

Autocomplete search is intentionally bounded to five users per request and only runs while the user is actively typing a mention fragment. Suggestions are transient Angular state and are not persisted to local storage. The only durable user content added by this flow is the comment text and, when delivery is allowed, the existing notification record.

## Failure handling

- User-search failure: return no suggestions and keep the comment composer available.
- Empty/no-match fragment: no popup is displayed; ordinary comment entry continues.
- Preference-store failure: suppress that mention notification and continue with other recipients.
- Notification delivery failure: log a sanitized warning and continue with other recipients.
- Comment persistence failure: existing comment mutation behavior remains authoritative; the input is not cleared until the mutation resolves successfully.

## Verification

Backend regression coverage in `comment-mention-notification.listener.spec.ts` verifies recipient deduplication, self-mention suppression, bounded fan-out, opt-out handling, fail-closed preference lookup, per-recipient failure isolation, and mixed-version fallback behavior. Existing `MomentsService` tests cover resolving `@name` text to user IDs and emitting `moment.mention`.

The Angular production build validates the new template wiring between the comment input and the existing `onCommentInput`, `onCommentKeydown`, `mentionSuggestionsMap`, `mentionActiveIndexMap`, and `selectMention` implementation. Manual verification should additionally cover mouse/touch selection, Arrow Up/Down, Enter, Escape, 390px layout, 200%/400% zoom, and mixed RTL/LTR display names.

## Rollout and rollback

This change is additive and requires no database migration or API-version change. It is compatible with existing backend `moment.mention` events and older clients because the server-side textual resolver remains authoritative. Deploy backend and frontend in either order.

Rollback is code-only: revert the frontend autocomplete wiring and listener hardening. Existing comments and notification rows require no cleanup, and no schema rollback is necessary.
