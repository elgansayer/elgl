# Owned Spartan Helm layer

This directory contains the repository-owned Spartan Helm sources used by product code. Spartan Brain owns primitive interaction/accessibility behaviour; Relay tokens and the local Helm source own product visuals and composition.

## Current surface

As of 2026-08-21, the checked-in surface is:

- `autocomplete/`
- `button/`
- `checkbox/`
- `combobox/`
- `dialog/`
- `input-group/`
- `input/`
- `native-select/`
- `popover/`
- `radio-group/`
- `tabs/`
- `textarea/`
- `utils/`

The directory contents and Spartan CLI `info --json` output are authoritative. Update this list when primitives are added, regenerated or removed.

## Usage rules

- Feature code imports through `@spartan-ng/helm/*` aliases or future shared-workspace public entry points, not deep relative paths into this directory.
- Do not copy primitive focus, keyboard, disabled or ARIA mechanics into feature components.
- Product-specific composites should compose these primitives rather than fork them.
- Preserve Relay semantic tokens and repository customisations when reconciling upstream Helm changes.
- Keep approved native-control boundaries, such as the mobile native select, explicit and tested.

## Validation

Run the repository component-system checks and Spartan healthcheck after changing this directory. Shared components also require keyboard, screen-reader, focus, RTL, long-translation, high-zoom/reflow, high-contrast and reduced-motion coverage appropriate to their behaviour.

See [`docs/component-system-convergence.md`](../../../../../docs/component-system-convergence.md), issue #7453 and issue #7454 for the full convergence and executable-catalogue plan.
