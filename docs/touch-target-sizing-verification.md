# Touch target sizing verification

Issue: #5516 (`Spartan UI 0050`)

This document describes the executable migration guard for `docs/touch-target-sizing.md`. The guard is intentionally migration-safe: it prevents new high-confidence touch-target regressions without requiring an unrelated pull request to repair every historical compact control in the application.

## Verification command

Run the focused contract from the repository root:

```bash
npm run check:touch-target-sizing
```

The command runs the Node-native regression suite and then verifies changed production Angular templates against their base-branch versions. The dedicated `Touch Target Sizing Contract` workflow runs the same command for pull requests targeting `main`, pushes to `main` or `develop`, and merge-queue validation. The workflow checks out full history so the verifier can distinguish new violations from existing migration debt.

The root `npm run verify` chain also includes the focused contract.

## What the guard enforces

The guard always verifies the shared Spartan Helm button contract:

- `size="touch"` must retain `min-h-11`, the repository 44 CSS pixel minimum height;
- `size="icon-touch"` must retain `size-11`, the repository 44 by 44 CSS pixel icon-button hit area.

For changed production Angular templates under `frontend/src/app`, including inline `template:` declarations, the guard rejects newly introduced high-confidence violations:

- a direct Spartan `button[hlmBtn]` or `a[hlmBtn]` that uses the compact default size or an explicit size other than `touch` or `icon-touch`;
- a `(click)` handler attached directly to a generic `div`, `span`, `img`, `ng-icon`, or `svg` instead of a native or Spartan interaction primitive.

Existing occurrences in a changed file do not fail the pull request unless the change adds another occurrence. This lets the migration converge incrementally.

## Reviewed exceptions

Two narrow cases are supported:

- shared Relay/Spartan wrappers may bind `[size]` dynamically because the wrapper owns the sizing decision and its own contract tests;
- a deliberately dense or specialised control may use `data-touch-target-exception` when its compact hit area is explicitly justified by the component audit and covered by keyboard, pointer, responsive, and accessibility tests.

The exception marker is not a general suppression mechanism. Inline prose links should normally remain native links and do not need the marker because the verifier only evaluates links that opt into `hlmBtn`.

## Expected failure mode

A failed check exits non-zero and prints the exact file, source line, rule code, offending control, and remediation. For example:

```text
Touch target contract verification failed:
- frontend/src/app/example/example.component.html:12 [undersized-spartan-action] standalone Spartan <button> uses size="sm"; use size="touch" or size="icon-touch"; if this is a deliberately dense audited exception, add data-touch-target-exception with review coverage
```

For generic click targets the remediation directs the author to use a native button/link or the approved Spartan primitive instead of enlarging a non-semantic element with feature-local CSS.

The verifier never rewrites application code.

## Theme, direction, and accessibility coverage

The regression suite proves that the contract is independent from light/dark presentation classes, logical RTL utilities, and user accent styling. It also covers:

- touch and icon-touch Spartan actions;
- deliberately audited dense exceptions;
- shared wrapper-owned dynamic sizing;
- generic click targets;
- native prose links;
- labelled checkbox rows whose associated label contributes to the practical hit area;
- inline Angular templates;
- migration-safe baseline comparison;
- regression of the shared 44 CSS pixel button variants.

Static verification complements rather than replaces rendered tests. A migrated surface must still prove that controls are reachable at the 390px baseline, remain usable at 200% and 400% zoom, preserve keyboard focus and screen-reader semantics, and do not create overlapping targets.

## Design preview

This verification change does not alter a rendered product surface, Relay token, responsive layout, or interaction state. No Claude Design/design-preview reconciliation is required. A feature PR that changes a visible touch-target composition must still update its mapped preview when the visual contract changes.

## Rollout and rollback

Rollout consists of enabling the read-only workflow and root verification command. No API, database, route, persistence, analytics, or deployment migration is required.

Rollback is a normal revert of the verifier, regression tests, workflow, package script, and this document. Do not roll back a failing migration by weakening the shared 44 CSS pixel touch variants or by adding broad exception markers to production templates.
