# Doodle message sharing

Issue #1176 is implemented by the existing chat-room and doodle-pad flow. This document records the production contract and the regression coverage that closes the remaining integration-test gap.

## User flow

1. A user opens the Doodle action from an authenticated chat room.
2. `DoodlePadComponent` owns freehand drawing, colour selection, brush sizing, clear, cancel, and save behaviour.
3. Save serialises the canvas as a PNG data URL and emits it only when the result has the expected `data:image/png;base64,` prefix.
4. `ChatRoomComponent` sends the result through the normal authenticated `ChatService.sendMessage()` path with `message_type: 'doodle'` and `media_url` set to the emitted PNG data URL.
5. The saved message is appended locally once and arrives through the same persisted/realtime chat model as other messages.
6. Doodle messages render as images in the conversation timeline.

The feature deliberately reuses the existing chat-message API and does not introduce a separate doodle persistence service or privileged browser-to-database path.

## Data and API contract

`SendMessageDto` already treats `doodle` as a media message, requires `media_url`, and has regression coverage accepting PNG data URLs. The backend stores the doodle using the ordinary authenticated chat-message path and publishes the resulting message through the existing room realtime channel.

No new schema or migration is required. Doodles follow the same room membership, deletion, retention, blocking, and message lifecycle as the containing chat message.

## Failure behaviour

- Cancelling closes the doodle surface without sending a message.
- A failed send does not insert a fictional local success message and does not throw out of the chat-room action handler.
- Duplicate local insertion is suppressed when the returned message is already present, which keeps the optimistic/realtime paths compatible.
- Invalid non-PNG canvas serialisation is rejected by `DoodlePadComponent` before the chat send path is invoked.

The normal chat API remains authoritative for authentication, room access, validation, persistence, and abuse controls.

## Privacy and security

Doodle content is private chat content. It must not be copied into analytics, logs, issue comments, or diagnostics. The integration sends only through the existing authenticated chat API. No token, credential, participant metadata, or additional identifier is embedded by the doodle feature itself.

The client does not interpret doodle data as HTML or executable content. Rendering uses an image `src`, and the producer restricts saved canvas output to PNG data URLs.

## Accessibility and input

The doodle editor has existing regression coverage for pointer input, primary-pointer filtering, pointer cancellation, translated controls, Spartan single-selection controls, and an accessible drawing-surface description. Chat-room cancellation remains available through the doodle component's explicit cancel output.

The chat timeline presents saved doodles as images. Follow-up accessibility work may improve the generic image alternative text with sender/context information without changing the storage contract.

## Verification

Relevant automated coverage includes:

- `frontend/src/app/components/doodle-pad/doodle-pad.component.spec.ts` for drawing, pointer, selection, cancellation, and PNG serialisation behaviour.
- `frontend/src/app/components/chat-room/chat-room.doodle-sharing.spec.ts` for chat-room modal wiring, authenticated message payload, duplicate suppression, failure behaviour, and timeline rendering.
- `backend/src/chat/dto/send-message.dto.spec.ts` for the `doodle` message type, required media URL, and accepted PNG data URLs.

Run the normal frontend and backend unit suites plus repository static analysis/build checks. GitHub Actions remains the authoritative clean-environment validation for pull requests.

## Rollout and rollback

There is no schema, environment, API-version, or persisted-data migration in this completion change. Mixed frontend versions remain compatible because the `doodle` chat message contract already exists.

Rollback is a normal revert of the regression/documentation commit. Existing doodle messages remain valid chat records and require no cleanup.
