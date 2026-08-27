# Incoming call modal

Issue: #1742

## Product contract

The application shell owns the single production incoming-call surface through `IncomingCallModalComponent`. A valid `incoming_call` realtime event opens a modal that identifies the caller, distinguishes voice and video calls, rings while unanswered, and exposes explicit Accept and Decline actions.

The modal treats realtime call metadata as untrusted. Required caller ID, caller name, room name, and call type fields are trimmed, type checked, and length bounded before they can be rendered or emitted back to the application shell. Optional caller avatars are restricted to credential-free HTTP(S) URLs. Malformed invitations fail closed and render no call UI.

Accept and Decline are single-shot actions for each invitation. This prevents rapid pointer, touch, keyboard, or assistive-technology activation from triggering duplicate navigation or duplicate rejection publication. A newly identified call resets that guard.

## Ringtone and failure behaviour

The modal does not depend on a checked-in or remotely hosted ringtone asset. By default it synthesizes a short repeating ringtone pattern with the browser Web Audio API. A trusted relative or HTTP(S) ringtone URL can still be supplied by a host; malformed URLs fall back to the generated pattern.

Browsers are allowed to block autoplay and Web Audio before user interaction. Ringtone failure is therefore non-fatal: the visible modal and controls remain authoritative and usable. Audio failures are not surfaced as application errors and do not block Accept or Decline.

All ringtone resources, timers, and audio contexts are stopped when the invitation is answered, declined, replaced, removed, or the component is destroyed. Server-side rendering never accesses browser audio APIs.

## Accessibility and responsive behaviour

The active surface is an `aria-modal` dialog with labelled title/status content. Focus moves to Decline when a new invitation opens so the safer action is first, Tab/Shift+Tab remain within the two call actions, Escape declines, and focus is restored to the previously focused element when the modal closes. Background document scrolling is locked while the dialog is open.

Accept and Decline use native Spartan-backed buttons with explicit accessible names and large touch targets. Caller names use `dir="auto"` for mixed-direction content. The panel is height bounded and scrollable for small viewports/high zoom, and non-essential entrance/pulse animation is disabled for `prefers-reduced-motion`.

The avatar is decorative because the caller name is already present as text. Avatar requests use `referrerpolicy="no-referrer"` to avoid sending the current application URL to the image host.

## Security and privacy

The frontend modal is not an authorization boundary. Joining a room and realtime signalling remain subject to the existing authenticated call/LiveKit backend controls. The modal never logs caller metadata, room names, tokens, credentials, or media URLs.

Only normalized call data is emitted by the modal. `javascript:`, `data:`, credential-bearing, relative, malformed, and overlong avatar URLs are not rendered. An invalid optional avatar degrades to the caller-initial placeholder rather than rejecting an otherwise valid call.

## Verification

Focused coverage lives in:

- `frontend/src/app/components/incoming-call-modal/incoming-call-data.spec.ts`
- `frontend/src/app/components/incoming-call-modal/incoming-call-modal.component.spec.ts`

The tests cover required-field validation, input bounds, avatar URL safety, dialog semantics, single-shot actions, Escape handling, malformed invitations, and reset behaviour for a new call. Repository CI remains authoritative for Angular compilation, lint, unit tests, translation safety, accessibility/design governance, and broader E2E contracts.

## Rollout and rollback

No database, API, or realtime channel migration is required. Existing callers continue to pass the same `IncomingCallData` shape and existing application-shell Accept/Decline handlers remain unchanged.

Rollback is a frontend code revert only. No persisted data is introduced. The generated ringtone removes the previous dependency on the missing `/assets/audio/ringtone.wav` asset, so rollback should restore that asset as well if the old default URL is reintroduced.
