# Device transfer Spartan control contract

Issue: #6119

## Scope

`DeviceTransferComponent` keeps feature-specific transfer/session behaviour in the feature and delegates generic button interaction to the repository-owned Spartan Helm button boundary.

The transfer route has one direct user action while a generated link is ready: **Copy Link**. It remains a native `<button>` enhanced with `hlmBtn`, uses the shared touch size, and deliberately has no feature-level role, tabindex, keydown handler, focus trap, or synthetic click implementation. Keyboard activation, disabled semantics, focus indication, pointer handling, and assistive-technology exposure therefore remain owned by the browser and Spartan rather than duplicated in feature code.

The generated link itself remains selectable text rather than being converted into a fake button. Session generation, token consumption, Supabase session installation, and routing remain outside presentation primitives.

## Interaction states

The copy action uses a bounded local state machine:

- `idle`: the generated link can be copied;
- `copying`: exactly one clipboard operation is in flight, the button is disabled, and `aria-busy=true` is exposed;
- `copied`: the action is available again and a polite status confirms success;
- `error`: the action is available for retry and a generic status tells the user to copy the visible link manually.

Duplicate activations while `copying` are ignored. Programmatic copy attempts are also ignored unless the transfer state is `ready` and a non-empty link exists.

The modern Clipboard API is preferred. Browsers without it use the existing short-lived textarea/`execCommand('copy')` compatibility fallback; the textarea is removed in a `finally` block. Clipboard failures are not surfaced verbatim because browser/provider error strings are not a product contract and may contain environment details.

## Accessibility and input methods

- The route uses a labelled `main` landmark and heading.
- Generating, consuming, completion, copy-success, and copy-failure states use status/live-region semantics where appropriate.
- Transfer failures use `role=alert`.
- The copy control has a minimum shared touch target through Spartan `size="touch"`.
- No mouse-only, touch-only, or custom keyboard handlers are introduced.
- Logical layout is direction-neutral; this issue does not add directional positioning.
- Dynamic feedback is text-based and does not depend on colour alone.

## Security and privacy

The transfer URL is bearer-like temporary material. This UI does not persist or log the link, transfer token, clipboard contents, access token, refresh token, or browser clipboard errors. Existing server-side expiry and one-time token semantics remain authoritative.

Backend/provider exception text is not copied into the UI for generation, consumption, or clipboard failures. User-facing errors are stable generic messages.

## Verification

Focused component tests cover:

- native Spartan touch-button semantics and absence of custom keyboard behaviour;
- labelled page/status semantics;
- duplicate copy suppression and busy state;
- successful copy acknowledgement;
- retryable, privacy-safe clipboard failure behaviour;
- rejection of copy attempts outside the ready state.

Repository CI remains authoritative for frontend unit tests, static analysis, build, Spartan ownership/governance, design checks, and wider integration gates.

## Design-sync decision

This ticket changes interaction ownership and state feedback, not the device-transfer layout or Relay visual contract. No new Claude Design preview state is introduced here; the follow-on Relay/theme and design-preview tickets remain responsible for their respective visual stages.

## Rollout and rollback

The change is frontend-only and requires no API, schema, migration, feature flag, or persisted-state rollout. It is backward-compatible with the existing transfer endpoints.

Rollback is a normal revert of the component, focused tests, and this document. No production data requires recovery.
