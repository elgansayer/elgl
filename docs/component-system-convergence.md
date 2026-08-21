# Component-system convergence

This is the canonical implementation contract for the Relay + Spartan migration of the Angular applications.

The repository-wide technology assessment and sequencing are documented in [`technology-modernisation-audit-2026-08.md`](./technology-modernisation-audit-2026-08.md) and [`technology-modernisation-roadmap.md`](./technology-modernisation-roadmap.md). UI-platform implementation is tracked in #7453, with executable component documentation/testing in #7454.

## Ownership

- Spartan Brain owns interaction mechanics and baseline accessibility for supported controls.
- The repository-owned Spartan Helm layer owns the rendered component source and permitted local visual composition.
- Relay owns semantic product tokens, density, motion, state and product-specific visual meaning.
- Feature components compose Helm directly or consume thin `app-*` compatibility wrappers in `components/primitives`.
- Compatibility wrappers must delegate native interactive elements to Helm. They must not recreate focus, disabled, keyboard or ARIA mechanics in parallel.
- Product-specific composites remain repository-owned, but their primitive controls must use the shared layer.

## Application scope

This contract applies to both Angular applications:

```text
frontend/       # user-facing web application
admin-portal/   # separately deployed privileged operator application
```

The admin portal retains a separate deployment, authentication and capability boundary. It must not retain a second primitive behaviour system or hard-coded parallel design language. Shared Relay tokens and Spartan Helm primitives should be consumed through a stable workspace-library/public-entry-point boundary as #7452 and #7453 progress.

## Generated Helm surface

`frontend/components.json` is the Spartan CLI configuration and currently targets:

```text
frontend/src/app/components/ui
```

The repository-owned surface present at the 2026-08-19 audit is:

- autocomplete;
- button;
- checkbox;
- combobox;
- dialog;
- input group;
- input;
- native select;
- popover;
- radio group;
- textarea;
- shared Helm utilities.

The directory and the Spartan CLI `info --json` output are authoritative. Hand-written inventories in documentation must be updated whenever the generated surface changes. Scheduled/upgrade CI should run the Spartan healthcheck and compare installed versus available primitives.

A primitive should be added because repeated product behaviour requires it, not merely because it exists in the catalogue.

## Migration rule

A shared primitive containing `<button>`, `<input>` or `<textarea>` is incomplete unless the element carries `hlmBtn`, `hlmInput` or `hlmTextarea` respectively. `npm run check:component-system` enforces this fail-closed rule across every non-test shared primitive source file.

Equivalent rules should be extended to other generated primitives where a reliable static invariant exists. Do not duplicate an official Spartan healthcheck rule in custom scripts unless Relay imposes a stricter requirement or the official rule is insufficient.

Native controls may remain where platform-native behaviour is an explicit product requirement. Native select is an approved mobile picker boundary. It must still consume Relay tokens and accessibility conventions and must not create a competing focus/visual system.

## Import boundary

Feature code must import through stable public aliases such as `@spartan-ng/helm/*` or the future shared workspace-library entry points. It must not deep-import arbitrary source paths or copy Helm implementation files into feature directories.

During the workspace migration, compatibility re-exports may remain. They need an owner and removal condition.

## Primitive versus product pattern

Use this decision rule:

### Spartan primitive

Use or generate a Spartan primitive when the behaviour is a standard control or overlay, such as a button, dialog, menu, popover, combobox, tabs, tooltip, checkbox, radio group, select, sheet or toast.

### Shared Relay product pattern

Create a shared composition when the product repeatedly combines primitives with the same semantics, such as:

- destructive confirmation;
- offline/degraded-state notice;
- correction diff and create-flashcard action;
- admin capability action panel;
- paginated/filterable operator table;
- lesson/SRS feedback card;
- authentication/MFA factor form.

### Feature-owned component

Keep a component feature-owned when its behaviour and semantics are genuinely domain-specific and not repeated. It must still use the shared primitives and tokens.

## Accessibility contract

Every shared primitive and repeated product pattern must cover:

- semantic role/name/state;
- keyboard-only operation;
- visible focus and correct focus return;
- disabled and loading semantics;
- screen-reader announcements for important async changes;
- no important colour-only communication;
- RTL and logical layout properties;
- long translations and content overflow;
- 200% and 400% zoom/reflow where applicable;
- high contrast/forced colours;
- reduced motion;
- touch target sizing;
- error, empty, unavailable and partial-failure states.

These requirements apply especially to privileged admin actions. Destructive or high-impact operations need consequence text, explicit confirmation and observable success/failure feedback.

## Executable catalogue and testing

#7454 introduces an executable catalogue using a Storybook Angular Vite pilot, Vitest browser interaction tests and axe accessibility checks.

Stories should become the primary discoverable catalogue for shared primitives and repeated product patterns if the pilot passes its go/no-go gate. They do not replace:

- full user-journey E2E tests;
- Relay semantic-token/static checks;
- architecture/import-boundary checks;
- translation-key completeness checks;
- production-build and SSR/hydration validation.

Existing custom visual-matrix/conformance tooling must be removed only after a coverage map proves the replacement is equivalent or stronger.

## Design synchronization

`spartan.component-system` in `design-sync.manifest.json` maps the component tree to `frontend/design-preview/components/component-system.html`. Any visual component-system change therefore participates in the two-way Claude Design reconciliation gate.

The design tool does not own runtime behaviour. Spartan Brain and verified application code remain authoritative for keyboard, focus, ARIA and state mechanics.

## Upgrade procedure

When updating Spartan:

1. pin and update Brain/CLI versions together where supported;
2. run CLI `info --json` and healthcheck before modifying generated source;
3. review upstream changes rather than overwriting Relay customisations blindly;
4. regenerate/update one primitive category at a time;
5. run component-system, static analysis, unit, browser interaction, accessibility and visual checks;
6. test representative RTL, high-zoom, reduced-motion and admin states;
7. update this document and `frontend/src/app/components/ui/README.md` if the surface changes.

## Completion definition

The component migration is complete when:

1. web and admin consume one governed Relay/Spartan token and primitive layer;
2. all shared interactive primitives delegate to the owned Helm layer;
3. feature components use Helm or approved shared patterns rather than bespoke interaction mechanics;
4. no new raw feature control bypasses the Spartan changed-file boundary without an approved exemption;
5. the Helm inventory matches the directory and CLI metadata;
6. shared primitives/patterns have executable interaction/accessibility coverage;
7. the component-system verifier, Relay-specific design checks, Spartan healthcheck, frontend/admin builds and relevant browser suites pass;
8. compatibility wrappers and parallel admin styles have been removed or have a documented owner and removal milestone.
