# Keyboard interaction verification

Issue: #5518 (`Spartan UI 0052`)

This document describes the executable migration gate for the keyboard interaction standard in `docs/keyboard-interaction-standards.md`.

## Commands

Run the focused regression suite and migration scan with:

```bash
npm run check:keyboard-interaction-contract
```

The dedicated GitHub Actions job supplies `KEYBOARD_INTERACTION_BASE_SHA` so the scan compares the pull-request head with its base commit. When no explicit base is supplied, the command compares against `HEAD^`, which keeps local and post-merge verification useful without forcing existing migration debt to fail unrelated work.

The workflow also runs:

```bash
npm run check:focus-ring-contract
npm run check:rtl-logical-contract
```

These existing contracts keep keyboard focus presentation on Relay semantic tokens, so visible focus remains theme-safe in light and dark modes and directional layout remains RTL-safe.

## What fails

The migration scan rejects newly introduced feature-code instances of:

- positive `tabindex` values;
- `appA11yClickable` compatibility call sites;
- deprecated `KeyboardEvent.keyCode` or `which` usage;
- non-native `role="button"` controls that recreate Enter/Space activation;
- obvious feature-owned roving-tabindex state for standard composite widgets.

Owned Spartan implementations under `frontend/src/app/components/ui/`, tests, and the transitional `a11y-clickable` implementation itself are outside the feature migration scan.

The gate intentionally reports, but does not automatically reject, newly introduced `(keydown.escape)` handlers and Enter handlers on text-entry controls. Those cases can be legitimate, but reviewers must confirm that generic dismissal belongs to Spartan and that Enter-based text actions ignore `KeyboardEvent.isComposing`.

## Expected failure output

Failures name the file, line, rule and replacement guidance. For example:

```text
Keyboard interaction contract verification failed:
- frontend/src/app/example/example.component.html:12 [positive-tabindex] Use DOM order, native focus order, or an approved Spartan composite instead of positive tabindex values.
```

The fix is normally to use native HTML, an approved Relay wrapper, or the matching Spartan Helm/Brain primitive. Do not silence the gate by adding another synthetic keyboard state machine.

## Accessibility states

The migration gate is structural rather than screenshot-based. Relevant accessibility states are covered as follows:

- visible focus: `check:focus-ring-contract` verifies the canonical Relay primary focus ring and semantic surface offset;
- light/dark: the focus ring uses semantic Relay tokens rather than theme-specific hardcoded colours, so the same keyboard contract applies in both themes;
- RTL: `check:rtl-logical-contract` runs alongside this gate and feature-level Arrow-key semantics remain owned by native/Spartan composites;
- IME: Enter handlers on inputs and textareas produce a review warning requiring `KeyboardEvent.isComposing` protection;
- disabled/busy/error: component tests remain responsible for product-specific state while native/Spartan controls own generic keyboard mechanics;
- high zoom and long translations: existing responsive/zoom and translation-safe verification remain authoritative because keyboard order must follow DOM order rather than a zoom-specific implementation.

No Claude Design preview is changed by this ticket because the gate changes verification behavior only, not a visual product contract.

## Rollback

The gate is migration-safe: historical debt is tolerated when its count does not increase in a changed file. If a rule produces a genuine false positive for a specialised control, narrow the scanner with a reviewed, code-level exception and add a regression test explaining that case. Do not disable the workflow or remove the root verification command to bypass a feature migration.
