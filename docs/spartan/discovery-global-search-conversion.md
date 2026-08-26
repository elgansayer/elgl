# Discovery global search Spartan conversion

Issue: #6139 (`Spartan UI 0357`)

Target: `frontend/src/app/components/discovery/global-search`

This stage implements the interaction-ownership decisions recorded by the completed #6138 audit. It intentionally leaves the later Relay token, accessibility/zoom, and design-preview stages to #6140-#6142.

## Ownership after conversion

- Native Language, Target Language, and Proficiency Level use the shared `AppSelectComponent`. The Relay wrapper owns label association and the Spartan Helm native-select boundary while the browser continues to own native select keyboard, type-ahead, screen-reader, and mobile picker behavior.
- Search Partners uses `AppButtonPrimaryComponent`. The Relay wrapper owns the Spartan button interaction and primary-action treatment; feature code only handles the emitted search intent.
- Has Audio Intro continues to use `HlmCheckbox` because the repository has no approved Relay checkbox wrapper. The component consumes Spartan's typed `checkedChange` output instead of listening for a synthetic DOM `change` and manually inverting local state.
- Global Search remains a pure filter-intent component. It does not call the discovery API, navigate, write storage, or own loading/error state.

No new Brain primitive or feature-local keyboard state machine is introduced.

## Clear-filter contract

The #6138 audit identified a stale-filter defect: converting `Any` selections to `undefined` made the parent `DiscoveryComponent` preserve the previous filter because omitted fields are ignored. The same problem applied when Has Audio Intro was switched off.

The conversion now treats all four controls as an explicit snapshot of this surface:

- `native_languages`, `target_language`, and `proficiency_level` emit `''` for `Any`;
- `has_audio_intro` emits `false` when unchecked.

`DiscoveryComponent.onGlobalSearch()` therefore clears its corresponding signals. The downstream `searchPartners()` method still converts empty strings and `false` to omitted HTTP query parameters, so unchecked/default filters do not become server requirements.

This is backward-compatible at the discovery API boundary while making the component-to-parent state transition deterministic.

## Accessibility and input behavior

- The named `role="search"` landmark and visible translated heading are preserved.
- Relay select wrappers generate instance-safe IDs and keep every translated label associated with its native select.
- The audio-intro checkbox now uses an instance-safe ID rather than a document-global fixed ID.
- The Search Partners action relies on its visible translated text for its accessible name instead of duplicating the same text in `aria-label`.
- Native select and native button semantics remain authoritative. Feature code does not implement Arrow key, Enter, Space, focus, disabled, or selected-state behavior already owned by the platform/Spartan primitives.

## Verification

The colocated Angular/Vitest suite covers:

- Relay ownership for all three selects and the primary action;
- translated label-to-control associations;
- explicit clear-filter emission;
- typed checkbox state propagation without manual inversion;
- instance-safe checkbox labelling;
- exactly-once search activation;
- native select value propagation through Relay wrappers;
- existing language and CEFR option behavior.

Repository CI remains the authoritative integration gate for frontend unit tests, static analysis, build, Spartan/design governance, dependency review, and E2E contracts.

## Rollout and rollback

There is no backend, route, schema, persistence, analytics, or migration change. Deploy with the normal frontend release. Rollback is a normal revert of the conversion commit; doing so would also restore the stale clear-filter behavior documented above.
