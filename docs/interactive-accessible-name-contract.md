# Interactive accessible-name contract

This document defines the repository contract for icon-only and otherwise textless interactive controls in the Angular client and admin portal.

## Product rule

Every interactive control must expose a meaningful accessible name. Controls with visible text already derive a name from that text. Controls whose visible content is only an icon, avatar, spinner, illustration, or other non-text content must provide one of the following:

- a non-empty `aria-label`;
- a non-empty `aria-labelledby` reference;
- equivalent Angular bindings such as `[attr.aria-label]` or `[attr.aria-labelledby]`;
- meaningful screen-reader-only text (`sr-only` / `visually-hidden`); or
- meaningful image alternative text when the image is the control's accessible content.

This applies to native buttons, navigational anchors, and custom elements explicitly exposed with `role="button"`.

Do not use placeholder text, an icon name, `title` alone, or an empty ARIA attribute as the accessible name. Labels must describe the action in the current state, for example `Close`, `Mute Aya`, or `Remove photo`, rather than merely `X`, `microphone`, or `trash`.

## Automated enforcement

Run:

```sh
npm run check:interactive-accessible-names
```

The check has two parts:

1. Node regression tests validate the verifier itself.
2. `scripts/verify-interactive-accessible-names.mjs` recursively audits production `.html` and `.ts` sources under `frontend/src/app` and `admin-portal/src/app`.

The verifier intentionally excludes unit-test/story files and low-level `components/ui/` primitives. Shared primitives receive projected content and cannot reliably determine the final consumer-facing accessible name statically; concrete feature usage remains in scope.

A violation reports the repository-relative file and line so it can be fixed without copying user content or runtime data into logs.

## Accessibility behavior

The rule is independent of input method. A labelled control must retain native keyboard behavior, visible focus, touch targeting, RTL layout, and 200%/400% zoom behavior already owned by the relevant Spartan/Relay primitive or native element.

Dynamic labels must stay synchronized with state. For example, a toggle that changes from mute to unmute must expose the matching action after the state transition. If a label includes user-generated display text, render it through normal Angular bindings and do not construct HTML.

## Failure handling

This is a build-time/static contract. It performs no network requests and reads no credentials or user data. If the verifier cannot establish an accessible name for a textless interactive element, CI fails closed and reports only the source location and element type.

The check is deliberately conservative about visible Angular interpolation: an interpolation is treated as visible text because its value is resolved by the application at runtime. Icon-only controls should therefore use explicit ARIA naming rather than relying on an empty or optional interpolation.

## Security and privacy

No new runtime telemetry, persistence, API surface, or authorization behavior is introduced. The verifier scans repository source only. Diagnostics never include template contents, translated strings, user identifiers, credentials, or production payloads.

## Verification

For changed controls, combine the static contract with component-level assertions where behavior is stateful. Recommended checks include:

- `getByRole('button', { name: ... })` or equivalent role/name queries;
- keyboard activation with Enter/Space where the control is not a native button;
- state-dependent names after asynchronous success/failure;
- translated and RTL labels;
- focus preservation after DOM-changing actions.

## Rollout and rollback

The contract is additive and has no database or API migration. It can be deployed independently of backend services. Rollback is a code revert of the verifier, its tests, workflow/package integration, and this document; reverting the guard does not require reverting accessibility labels that already satisfy it.
