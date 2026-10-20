# Screen-reader naming verification

Issue: #5520 (`Spartan UI 0054`)

This document describes the executable migration guard for `docs/screen-reader-naming-and-relationships.md`. It is intentionally a high-confidence regression gate rather than a claim that static analysis can prove complete accessibility.

## Verification command

Run the focused gate from the repository root:

```bash
npm run check:screen-reader-naming
```

The command first runs the verifier's Node-native regression suite and then compares changed Angular templates with their base-branch versions.

The dedicated `Screen-reader Naming Contract` workflow runs the same command for pull requests targeting `main`, pushes to `main` or `develop`, and merge-queue validation. The workflow uses a full Git history so the migration comparison can distinguish newly introduced violations from pre-existing migration debt.

The root `npm run verify` chain also includes this check.

## What the gate rejects

For changed production Angular templates under `frontend/src/app`, the verifier reports newly introduced high-confidence violations:

- hard-coded static product copy in `aria-label`;
- generic accessible names such as `Button`, `Text input`, `Icon`, `Modal`, or `Dialog`;
- positive `tabindex` values that create a custom tab order;
- duplicate literal IDs within one component template;
- literal `aria-labelledby` or `aria-describedby` references whose literal target ID is absent from the same template;
- literal `<label for="...">` relationships whose literal target ID is absent from the same template.

Both external `.html` templates and inline Angular `template:` declarations are covered.

The comparison is migration-safe: existing violations in an edited component do not fail a pull request unless the change introduces another occurrence or a new violation. That lets the repository converge without making unrelated changes repair all historical debt at once.

## Allowed patterns

The verifier intentionally allows:

- translated bindings such as `[attr.aria-label]="'profile.save' | t"`;
- dynamic, instance-safe IDs and bound IDREFs owned by Angular or Spartan primitives;
- native `tabindex="0"` and `tabindex="-1"` use where appropriate;
- Brain/Helm-generated accessibility relationships;
- deliberately untranslated static names, such as a product brand, when the same element includes `data-screen-reader-naming-ok`.

`data-screen-reader-naming-ok` is an explicit review escape hatch. It must not be used to silence normal product copy or generic labels.

## Expected failure mode

A failed check exits non-zero and prints the affected file, source line, rule code, offending relationship or value, and a remediation. For example:

```text
frontend/src/app/example/example.html:12 [missing-idref-target] aria-describedby references missing literal id "search-help"; render the referenced element in this template, use an instance-safe primitive relationship, or add screen-reader-naming-ok when the target is intentionally external
```

The intended repair is to correct the semantic relationship, use the approved Spartan/native composition, or translate the accessible name. Do not weaken the gate to make a broken relationship pass.

## Accessibility and theme coverage

The verifier's regression suite covers valid label/description relationships under both light and dark presentation states. Because accessible-name and IDREF semantics must not depend on theme, RTL, colour, responsive breakpoint, or user accent, the same relationship graph is expected in every visual state.

The static gate complements rather than replaces component and browser accessibility tests. Changed components should still use role/name queries or direct relationship resolution to prove that visible labels, descriptions, dialogs, repeated actions, loading/error states, and responsive renders expose the intended semantics.

## Rollout and rollback

This change adds no API, schema, persistence, routing, or rendered visual contract. Rollout consists of enabling the focused workflow and root verification command.

Rollback is a normal revert of the verifier, its tests, workflow, package script, and this document. Do not roll back by adding broad exceptions to production templates; accessibility exceptions must remain explicit and narrowly reviewed.
