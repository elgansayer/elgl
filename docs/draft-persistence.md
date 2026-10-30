# Local draft persistence

## Contract

Unsent Chat messages and Moment compositions are preserved on the device through the shared Angular `DraftService`. The browser is the persistence boundary: drafts are never uploaded to the backend merely because they are drafts, and no API, schema or server configuration is involved.

`DraftService` is the only code that touches draft storage. Feature components call it and never read `localStorage` themselves.

### What is stored

Each draft is one JSON record, written under an account-scoped key and stamped with `savedAt` (milliseconds since the epoch of the last save).

| Draft | Key | Fields |
| --- | --- | --- |
| Chat room | `ht_<userId>_draft_chat_v2_<roomId>` | `textInput`, `replyToId`, `originalText`, `correctedText`, `explanationText`, `savedAt` |
| Moment | `ht_<userId>_draft_moment` | `text`, `mediaUrls`, `mediaType`, `targetLanguage`, `voiceDurationSec`, `savedAt` |

Blank fields are omitted. A chat record with nothing in it, and a Moment record that holds only settings (no text and no media), are not stored. The key `ht_<userId>_draft_chat_<roomId>` is the raw-text format written before the enriched record existed. It is no longer written; it is only read as a fallback and is migrated by the clean-up described under Retention.

`DraftService` still falls back to an anonymous `ht_anon` namespace when no account is known, but neither composer uses it: both wait for the account, so private text is never stored where another account could find it.

### Chat composer

- **Restore:** `ChatRoomComponent` restores the room draft as soon as the room is known not to be locked, before the message history is requested. The text is in the composer immediately and the saved reply target is matched when the history arrives. A locked room restores nothing until it is unlocked. Text typed while the room was still loading is newer than the stored draft and is kept.
- **Save:** on every keystroke, when a reply is started or cancelled, when the grammar review replaces the text, when the room changes, and on teardown.
- **Never save an unrestored composer:** nothing is written until the draft for the current room and account has been restored. Leaving a room that is still loading, or locked, therefore cannot overwrite its stored draft with an empty composer.
- **Room changes inside one component:** the outgoing room is saved, then the composer, reply target and correction state are emptied before the next room restores its own draft.
- **Send:** the composer keeps its text until delivery succeeds, and a second submit is ignored while a request is pending. Success clears the submitted draft only if it is still current. Text written while delivery is pending remains in the composer and storage. Failure keeps both and records the attempted text with the existing reply target. Completion is scoped to the room the message was written in, so a send that finishes after the learner changed rooms never touches the new room.

### Moments composer

- **Save:** every change to the text, media, language or voice duration is saved as it happens, and once more on teardown. A reload, crash or discarded mobile tab never runs teardown, so teardown alone is not relied on.
- **Restore:** after the first browser render and once the account is known, in either order, because the session can resolve after the first render on a reload. A restored draft opens the composer so it is visible. A language restored from a draft, or chosen by the learner, is not replaced by the profile default that arrives later.
- **Publish:** a second submit is ignored while a request is pending. Success clears and closes the submitted draft only if it is still current. A newer composition written while publishing is pending remains open and stored. A failure, or a grammar suggestion that needs reviewing, keeps the draft and leaves the composer open.
- **Accounts:** if the signed-in account changes while the composer is mounted, the composer is emptied before the new account's draft is restored.

## Retention

A draft is removed when:

1. the message is sent or the Moment is published;
2. the composer is emptied;
3. it has gone 30 days without being saved again (`DRAFT_RETENTION_MS`).

Opening a draft and leaving it re-saves it, so the 30 days run from the last time it was touched. Expired records are discarded when read. Once per page session, before the first draft is read or written, `DraftService` also scans the stored drafts of every account on the browser. It removes expired and unreadable records, stamps records written before timestamps existed, and migrates raw-text chat drafts into stamped records. Rooms that are never reopened therefore cannot leave drafts behind indefinitely. The scan only reads the values of keys that match the draft naming pattern.

Sign-out does not delete drafts. They stay scoped to the account that wrote them and are removed by expiry. The application has no sign-out entry point at present; if shared-device wiping is required when one is added, it needs a bulk clear in `DraftService`.

Clearing the cache from Data & Storage never removes drafts (see `data-storage.md`).

## Privacy and security

`localStorage` is durable browser storage, not encrypted storage. Drafts can contain private conversation or Moment content, so keys are account-scoped to stop one signed-in account reading another's draft through the application. Credentials, access tokens, API keys and raw media must never be added to the draft schema.

Stored input is treated as untrusted when restored. The service validates object shapes, bounds text and identifiers, accepts only HTTP(S) media URLs, constrains voice duration, and removes malformed or oversized records instead of letting them break every later restore. Restored text is rendered through Angular's normal text bindings, never as HTML.

### Limits

| Item | Limit |
| --- | --- |
| room identifier | 160 characters |
| chat text and each correction field | 10,000 characters |
| Moment text | 10,000 characters |
| Moment media | 9 HTTP(S) URLs, 4,096 characters each |
| target-language identifier | 32 characters |
| voice duration | 0 to 60 seconds |
| serialised record | 96,000 characters |
| retention | 30 days since the last save |

Text over its limit is dropped rather than truncated, so a restored draft is never a silently altered version of what the learner wrote. Product and backend validation remains authoritative when content is actually submitted.

## Failure behaviour

| Situation | Behaviour |
| --- | --- |
| storage unavailable (server rendering, privacy settings, sandboxed frame) | composing, sending and publishing work; nothing is persisted |
| read blocked | continue with an empty composer |
| write fails (quota, security) | the composer stays usable; one warning is logged per page session |
| clean-up blocked | ignored |
| corrupt, oversized or expired record | removed and treated as absent |
| failed chat send | text kept in the composer and stored |
| failed Moment publish | draft kept and composer left open |
| two tabs editing the same draft | last write wins |

Known limits: a saved reply target is restored only if that message is within the loaded history, and the correction fields are stored but a correction in progress is not reopened. Only the chat room and Moments composers are covered; other text inputs, such as Moment comments and AI conversation practice, are not persisted.

## Observability

Draft text, account identifiers, room identifiers and storage keys are never logged or sent to analytics. The only output is a single `console.warn` per page session when a write fails, carrying the error name alone (for example `QuotaExceededError`), which is enough to tell a support engineer that the browser blocked storage without exposing anything the learner wrote.

## Verification

```bash
node --test scripts/draft-persistence-contract.test.mjs scripts/chat-send-draft-contract.test.mjs

cd frontend
npx ng test --no-watch \
  --include src/app/services/draft.service.spec.ts \
  --include 'src/app/components/chat-room/**/*.spec.ts' \
  --include 'src/app/components/moments-feed/**/*.spec.ts'
```

- `draft.service.spec.ts`: storage, account isolation, bounds, corruption, retention, the one-off clean-up and failure reporting.
- `chat-room.draft-restore.spec.ts`: restore order, reply target, typing during load, leaving before restore, room changes inside one component, scoped send completion and the in-flight guard.
- `chat-room.draft-recovery.spec.ts`: a failed send keeps the draft and success clears it.
- `moments-feed.draft-persistence.spec.ts`: save on every change, restore after render and sign-in, language precedence, account changes, and publish success, failure and suggestion handling.
- The two contract scripts guard the source shape of the service and both composers without a frontend install, and run in the `Draft Persistence Contract` and `Chat Draft Failure Contract` workflows.

## Rollout and rollback

No migration, API change or server rollout is required. Deploy with the frontend.

Mixed versions are safe in both directions. An older tab keeps writing the previous format: the enriched record without `savedAt` is read as current and stamped by the next clean-up, and a raw-text copy is migrated. Older code ignores the new `savedAt` field and reads the same enriched record, so a rollback loses no stored draft. It is a normal code revert; stored drafts can be left in place, and records stamped by the newer code simply stop expiring until the change is rolled forward again. Do not introduce server-side draft persistence as a rollback shortcut, because that would change the privacy and retention model.
