# Chat system-message integration

Issues: #1085, #1087

## Architecture

System messages are transient product events delivered over Centrifugo on the existing `chat:<roomId>` channel. They are not persisted in `chat_messages`, do not participate in read receipts, and introduce no schema or retention changes. The browser receives the same outer `{ message }` envelope used for normal realtime chat updates, with `message_type: "system"`, an empty `sender_id`, and a typed `system_event` payload.

This keeps operational events such as profile updates, missed calls, group renames, membership changes, and announcements out of the durable conversation history while allowing an open room to render them immediately.

## Event contract

The backend owns the event type. Callers may provide interpolation parameters, but a `type` parameter can never replace the trusted event type.

System event types:

| Event | Required interpolation data | Producer |
| --- | --- | --- |
| `profileUpdated` | `name` | `profile.updated` application event |
| `missedCall` | `name` | `call.missed` application event |
| `groupRenamed` | `name` | group admin rename mutation |
| `memberAdded` | `count` | group membership mutation |
| `memberRemoved` | none | group membership mutation |
| `announcement` | `message` | system announcement producer |

The wire contract is intentionally bounded:

- event types are 1-64 characters and limited to letters, digits, `.`, `_`, and `-`, beginning with a letter;
- at most 12 interpolation parameters are accepted;
- parameter names are bounded identifiers;
- parameter values are scalar strings, finite numbers, booleans, or `null` only;
- strings are capped at 500 characters;
- nested objects, arrays, non-finite numbers, invalid keys, and a caller-provided `type` field are discarded.

The frontend independently validates the same limits before accepting an untrusted Centrifugo payload into room state. Syntactically valid event types are deliberately not restricted to the current six-event catalogue so newer backends can coexist with older clients during rolling deployments.

## Localisation and failure behaviour

`ChatSystemBubbleComponent` renders known events through the existing `system.*` i18n keys. Profile and missed-call application events resolve the relevant display name on the backend before publication so happy-path messages do not expose unresolved `{{name}}` placeholders.

Known-event lookup uses an explicit `Map`, not a JavaScript object property lookup. This is important because unknown event names such as `constructor`, `toString`, and `valueOf` satisfy the wire-format identifier rules but also exist on `Object.prototype`. They must be treated exactly like every other unknown future event and render the generic localised `notifications.systemAlert` fallback. They must never resolve inherited JavaScript members as event configuration.

If a display-name lookup is unavailable, publication can still continue without private provider/database details. The frontend then renders the generic localised `notifications.systemAlert` label instead of exposing a translation key or interpolation placeholder. Unknown but syntactically valid future event types receive this same generic fallback, which makes mixed-version deployments safe.

Room fan-out uses `Promise.allSettled`: one Centrifugo publish failure does not prevent delivery to other rooms, and the service records only an aggregate failure count. Membership-query failures fail closed and do not publish to guessed rooms. Direct-message events are published only to a mutually shared room with exactly two members.

## Security and privacy

System-message creation remains an internal backend capability. Existing authenticated product mutations and application events are the producers; no new public mutation endpoint is added.

The payload contains only data needed for rendering. User IDs and provider/database error messages are not written to the new system-message logs. Display names are sent only into rooms that membership resolution already identifies for delivery. The frontend renders interpolation values as Angular text bindings, not HTML.

The final rendering boundary stores accepted interpolation parameters in a null-prototype dictionary. This keeps untrusted keys isolated from inherited JavaScript object members while preserving valid scalar interpolation values. Together with the `Map`-backed event registry, this prevents prototype-like names from changing event classification or fallback behavior.

## Accessibility and responsive behaviour

System bubbles are exposed as an atomic polite status region (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`). Icons are decorative and important state remains available in localised text. Bubbles use bounded widths and wrapping so long translated strings reflow at narrow viewports and high zoom.

## Verification

Relevant automated coverage:

- `backend/src/chat/services/system-message.service.spec.ts`
- `backend/src/chat/services/system-message.hardening.spec.ts`
- `backend/src/chat/listeners/chat-system-event.listener.spec.ts`
- `frontend/src/app/components/chat-room/chat-room-realtime.spec.ts`
- `frontend/src/app/components/chat-system-bubble/chat-system-bubble.component.spec.ts`

The coverage verifies event-type ownership, bounded payloads, partial fan-out failures, database failure behaviour, producer enrichment, malformed realtime rejection, generic localisation fallback, accessibility semantics, prototype-like unknown event names, and null-prototype interpolation storage.

## Rollout and rollback

No migration, feature flag, new environment variable, or background backfill is required. Backend and frontend can be rolled out independently: older clients already understand the established event envelope, while the hardened frontend safely renders unknown valid events as a generic system alert.

The #1087 follow-up is frontend-only and can be rolled out as a normal web deployment after #1085. Roll it back by reverting the #1087 pull request; no data cleanup or database recovery is required. Reverting #1087 restores the previous event-registry implementation but does not alter the Centrifugo wire contract or persisted state.
