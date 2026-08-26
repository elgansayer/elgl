# Discovery global search Spartan conversion

Issue: #6139 (`Spartan UI 0357`)

Target: `frontend/src/app/components/discovery/global-search`

This stage implements the interaction-ownership decisions from the completed #6138 audit against the repository's current Spartan governance. The audit predates the newer convergence gate that retires several legacy `app-*` primitives, so current CI policy is authoritative where the two differ. The later Relay token, accessibility/zoom, and design-preview stages remain #6140-#6142.

## Ownership after conversion

- Native Language, Target Language, and Proficiency Level remain on installed `HlmNativeSelect`. Spartan/Helm and the browser own native select keyboard, type-ahead, screen-reader, focus, and mobile picker behaviour. Feature code only owns the selected filter values.
- Search Partners remains on `HlmButton`. Spartan/native button semantics own activation and focus behaviour; feature code only handles the search intent.
- Has Audio Intro uses `HlmCheckbox` and consumes its typed `checkedChange` output directly. The component no longer listens for a synthetic DOM change and manually inverts state.
- Global Search remains a pure filter-intent component. It does not call the discovery API, navigate, write storage, or own loading/error state.

No Brain import, feature-local keyboard state machine, or new retired `app-*` primitive call site is introduced. If a future non-retired Relay abstraction becomes the approved owner for these controls, this surface can migrate to that API without changing the feature contract.

## Clear-filter contract

The #6138 audit identified a stale-filter defect: converting `Any` selections to `undefined` made the parent `DiscoveryComponent` preserve the previous filter because omitted fields are ignored. The same issue occurred when Has Audio Intro was switched off.

The conversion treats all four controls as an explicit snapshot of this surface:

- `native_languages`, `target_language`, and `proficiency_level` emit `''` for `Any`;
- `has_audio_intro` emits `false` when unchecked.

`DiscoveryComponent.onGlobalSearch()` therefore clears its corresponding signals. The downstream `searchPartners()` method still converts empty strings and `false` to omitted HTTP query parameters, so inactive filters do not become server requirements.

This is backward-compatible at the discovery API boundary while making the component-to-parent state transition deterministic.

## Accessibility and input behaviour

- The named `role="search"` landmark and visible translated heading are preserved.
- Native select label relationships are preserved for all three filters.
- The audio-intro checkbox now uses an instance-safe ID rather than a document-global fixed ID.
- Search Partners is explicitly `type="button"`, preventing accidental form submission if the surface is composed inside a form later.
- The visible translated Search Partners text supplies the accessible name, so the redundant duplicate `aria-label` is removed.
- Native/Spartan semantics remain authoritative. Feature code does not implement Arrow key, Enter, Space, focus, disabled, or selected-state behaviour already owned by the platform/Spartan primitives.

The select IDs remain unchanged in this interaction stage because #6141 owns the dedicated accessibility, RTL, zoom, and multi-instance pass.

## Verification

The colocated Angular/Vitest suite covers:

- Spartan `HlmNativeSelect` ownership for all three dropdowns;
- translated label-to-control associations;
- Spartan button ownership and safe button type;
- explicit clear-filter emission;
- typed checkbox state propagation without manual inversion;
- instance-safe checkbox labelling;
- exactly-once search activation;
- native select value propagation;
- existing language and CEFR option behaviour.

Repository CI is the authoritative integration gate for frontend unit tests, static analysis, build, Spartan/design governance, dependency review, and E2E contracts. In particular, `check:legacy-primitive-delta` ensures this conversion cannot regress by introducing retired product primitives.

## Rollout and rollback

There is no backend, route, schema, persistence, analytics, or migration change. Deploy with the normal frontend release. Rollback is a normal revert of this PR; doing so would also restore the stale clear-filter behaviour documented above.
