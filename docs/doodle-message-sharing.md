# Doodle message sharing

Issue #1176 is implemented by the existing chat-room and doodle-pad flow. This document records the production contract and the regression coverage that closes the remaining integration-test gap. Issue #1734 completes the chat modal host (see `docs/doodle-pad.md`) and the message-level details recorded below.

## User flow

1. A user opens the Doodle action from an authenticated chat room. The pad opens in a modal Spartan dialog.
2. `DoodlePadComponent` owns freehand drawing, colour selection, brush sizing, clear, cancel, and save behaviour.
3. Save serialises the canvas as a PNG data URL and emits it only when the result has the expected `data:image/png;base64,` prefix.
4. `ChatRoomComponent` closes the dialog and sends the result through the normal authenticated `ChatService.sendMessage()` path with `message_type: 'doodle'`, `media_url` set to the emitted PNG data URL, and a short translated caption in `text_content`.
5. The saved message is appended locally once and arrives through the same persisted/realtime chat model as other messages.
6. Doodle messages render as images in the conversation timeline.

The feature deliberately reuses the existing chat-message API and does not introduce a separate doodle persistence service or privileged browser-to-database path.

## Data and API contract

`SendMessageDto` already treats `doodle` as a media message, requires `media_url`, and has regression coverage accepting PNG data URLs. The backend stores the doodle using the ordinary authenticated chat-message path and publishes the resulting message through the existing room realtime channel.

The caption in `text_content` comes from the `chatRoom.doodleCaption` translation key (English: "Doodle"). It exists for surfaces that quote a message's stored text, such as reply previews. The timeline renders the image, and the message type remains authoritative. `I18nService.translate` echoes any key it cannot find, and `chatRoom.doodleCaption` was missing from the base dictionary, so doodles sent before issue #1734 may carry the literal text `chatRoom.doodleCaption`. No backfill is performed because the value is cosmetic and a backfill would need a data migration that this change does not otherwise require.

No new schema or migration is required. Doodles follow the same room membership, deletion, retention, blocking, and message lifecycle as the containing chat message.

## Failure behaviour

- Cancelling, pressing Escape, or clicking the backdrop closes the doodle surface without sending a message.
- A failed send does not insert a fictional local success message and does not throw out of the chat-room action handler.
- A failed send shows a translated error notice (`chatRoom.doodleSendFailed`), so the sender is no longer left with a silently missing doodle. The failure is logged without the drawing contents. The pad is already closed when the send starts, so the drawing is not retained and has to be redrawn.
- When the browser is offline, `ChatService.sendMessage()` queues the message locally and resolves normally, so no failure notice is shown and the doodle is delivered when the queue syncs.
- Duplicate local insertion is suppressed when the returned message is already present, which keeps the optimistic/realtime paths compatible.
- Invalid non-PNG canvas serialisation is rejected by `DoodlePadComponent` before the chat send path is invoked.

The normal chat API remains authoritative for authentication, room access, validation, persistence, and abuse controls.

## Privacy and security

Doodle content is private chat content. It must not be copied into analytics, logs, issue comments, or diagnostics. The integration sends only through the existing authenticated chat API. No token, credential, participant metadata, or additional identifier is embedded by the doodle feature itself.

The client does not interpret doodle data as HTML or executable content. Rendering uses an image `src`, and the producer restricts saved canvas output to PNG data URLs.

## Accessibility and input

The doodle editor has existing regression coverage for pointer input, primary-pointer filtering, pointer cancellation, translated controls, Spartan single-selection controls, and an accessible drawing-surface description. The chat room hosts it in a labelled modal dialog with focus containment, focus return to the Doodle trigger, and Escape, backdrop, header close, and footer Cancel dismissal, all covered by the chat-room doodle spec.

The chat timeline presents saved doodles as images with a translated accessible name (`chatRoom.doodleImageAlt`, English: "Doodle drawing") in both `ChatRoomComponent` and `ChatMessageComponent`. Follow-up accessibility work may extend the image alternative text with sender/context information without changing the storage contract.

## Verification

Relevant automated coverage includes:

- `frontend/src/app/components/doodle-pad/doodle-pad.component.spec.ts` for drawing, pointer, selection, cancellation, and PNG serialisation behaviour.
- `frontend/src/app/components/chat-room/chat-room.doodle-sharing.spec.ts` for the modal dialog host, authenticated message payload, persisted caption, duplicate suppression, failure behaviour and notice, and timeline rendering with its translated image name.
- `frontend/src/app/components/chat-message/chat-message.component.spec.ts` for the translated doodle image name in the shared message component.
- `frontend/src/app/services/i18n.service.spec.ts` for the doodle translation keys.
- `backend/src/chat/dto/send-message.dto.spec.ts` for the `doodle` message type, required media URL, and accepted PNG data URLs.

Run the normal frontend and backend unit suites plus repository static analysis/build checks. GitHub Actions remains the authoritative clean-environment validation for pull requests.

## Rollout and rollback

There is no schema, environment, API-version, or persisted-data migration in this completion change. Mixed frontend versions remain compatible because the `doodle` chat message contract already exists.

Rollback is a normal revert of the frontend and documentation commit. Existing doodle messages remain valid chat records and require no cleanup.
