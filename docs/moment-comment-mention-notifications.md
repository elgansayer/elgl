# Moment comment mention notifications

Issue: #1380

Moment comments already emit `moment.mention` events after the comment has been persisted and the mentioned display names have been resolved to user IDs. `CommentMentionNotificationListener` is the delivery boundary for those events.

## Product contract

- A persisted Moment comment may notify users explicitly mentioned in its text.
- The commenter is never notified for mentioning themselves.
- The Moment author continues to receive the normal Moment-comment notification; mention delivery does not duplicate that author notification.
- Repeated occurrences of the same resolved user are de-duplicated before delivery.
- A single comment processes at most 10 distinct mention recipients. This bounds accidental or abusive notification fan-out.
- Existing events without `mentionedUserIds` retain the historical `momentAuthorId` fallback during mixed-version rollout.

## Preferences and failure behaviour

Notification preferences are an authoritative privacy boundary. Each recipient is checked with the existing `moment_comment` push preference before a `mention_comment` notification is created.

If the preference store is unavailable, delivery fails closed for that recipient. The system does not guess that push is allowed. A delivery/storage failure for one recipient does not prevent other mentioned recipients from being processed.

Both failure paths emit only fixed diagnostic event names:

- `comment_mention_preferences_unavailable`
- `comment_mention_delivery_failed`

User IDs, Moment IDs, comment text, display names and raw provider/database errors are deliberately excluded from these diagnostics.

## Security and privacy

The notification listener receives backend-resolved user IDs; the browser never chooses notification recipients directly at this boundary. Existing Moment-comment authentication, block checks and comment persistence remain authoritative before the event is emitted.

Mention previews are limited by the existing comment path before they reach the notification event. This change does not add a new API, database table, credential, analytics event or public user-enumeration surface.

## Verification

Focused backend regression coverage verifies:

- normal single- and multi-recipient delivery;
- duplicate-recipient suppression;
- the 10-recipient fan-out bound;
- legacy event compatibility;
- disabled notification preferences;
- fail-closed preference-store outages;
- isolated delivery failures;
- self-mention suppression;
- privacy-safe diagnostics.

Run the focused suite with:

```bash
cd backend
npm test -- src/notifications/listeners/comment-mention-notification.listener.spec.ts
```

The normal backend lint, build, unit and E2E workflows remain the integration gate.

## Rollout and rollback

No schema migration is required. Deploy as a normal backend release. Mixed versions remain compatible because the event shape is unchanged.

Rollback is a normal application revert. Do not restore fail-open behavior on preference-read failures; if notification preferences cannot be established, suppressing the mention is safer than sending against an unknown user preference.
