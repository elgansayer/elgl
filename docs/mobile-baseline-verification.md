# 390px mobile baseline verification

Status: executable migration verification contract for `[Spartan UI 0044]` / issue #5510.

This document implements the rendered verification stage defined by `docs/390px-mobile-baseline.md`. It does not introduce a 390px CSS breakpoint. The normal unprefixed Tailwind layout remains the mobile implementation; 390 CSS pixels is a deterministic verification viewport.

## Scope

The gate uses the existing Relay + Spartan design-preview and Cypress visual-contract infrastructure. It intentionally avoids a second browser test stack or a collection of fragile class-name checks.

The representative product screens are:

- Discovery (`screen.discovery`)
- Chat (`screen.chat`)
- Vocabulary (`screen.vocabulary`)
- Moderation (`screen.moderation`)

Each representative must retain these rendered states:

- `mobile-390-light`
- `mobile-390-dark`
- `mobile-390-rtl`
- `mobile-390-text-200`
- `mobile-390-text-400`

The existing `390px` state remains available for older primitive/surface contracts. The explicit `mobile-390-*` states are the migration gate because they combine the fixed viewport with theme and accessibility conditions rather than testing those conditions at an unrelated default width.

## What the gate verifies

For every required mobile state, Cypress:

1. sets the viewport to 390 CSS pixels wide using `visual-contract.matrix.json`;
2. renders the repository-owned deterministic preview;
3. disables animation and transition timing that would make capture non-deterministic;
4. waits for document fonts to load;
5. fails if the document develops unintended horizontal overflow;
6. verifies the expected light/dark or RTL document state where applicable;
7. applies deterministic 200% and 400% root text scaling as reflow stress states;
8. captures the rendered state as a CI artefact.

The text-scale checks are deterministic reflow signals, not claims that CSS `font-size` exactly reproduces browser zoom. Browser-level zoom and assistive-technology tests remain complementary accessibility coverage.

## Verification commands

Run the cheap structural gate from the repository root:

```bash
npm run check:visual-contract-matrix
```

This checks that the canonical mobile viewport is still exactly 390 CSS pixels wide and that all four representative screens retain every required mobile state.

Expected failures are explicit. For example:

```text
viewportMobile: visual matrix must define the 390px mobile verification viewport with a positive integer height
```

or:

```text
screen.chat: 390px mobile baseline gate is missing state: mobile-390-dark
```

Run the rendered browser gate with:

```bash
cd frontend
npm run visual:capture:ci
```

A mobile layout that creates document-level horizontal overflow fails with the state name, for example:

```text
mobile-390-text-400: 390px mobile layout must not create horizontal document overflow
```

The rendered gate also fails if the viewport is no longer 390px, if the expected dark/RTL state is not applied, or if the text-scale stress state does not enlarge root text.

## CI ownership

`.github/workflows/ui-visual-capture.yml` runs the matrix check and Cypress capture for pull requests and the repository's normal validation events. The workflow uploads screenshots for review, but screenshots are evidence rather than silently accepted pixel baselines.

The gate belongs to the existing visual-contract pipeline:

- `design-sync.manifest.json` owns stable design identities and preview mappings;
- `visual-contract.matrix.json` owns the required state matrix;
- `scripts/verify-visual-contract-matrix.mjs` owns cheap structural enforcement;
- `frontend/cypress/visual/design-contracts.cy.ts` owns deterministic rendered assertions and capture.

## Accessibility and theme coverage

The mobile gate deliberately covers light and dark themes independently. Responsive changes must not create a mobile-only colour system or bypass Relay semantic tokens.

RTL is exercised at the same 390px width so physical-direction regressions that are hidden at desktop widths become visible. `npm run check:rtl-logical-contract` and the frontend logical-direction checks remain authoritative static enforcement; this rendered gate complements rather than duplicates them.

The 200% and 400% text-scale states stress wrapping, action reachability, and reflow. Required content must remain available and the document must not gain horizontal overflow. Feature-specific keyboard, screen-reader naming, focus, dialog, and touch semantics remain covered by their focused component/accessibility tests.

## Failure handling

A failure should be fixed in the component or Relay composition that caused the regression. Do not make the gate pass by:

- adding a custom 390px Tailwind breakpoint;
- applying global `overflow-x-hidden`;
- shrinking touch targets or essential text;
- removing translated labels or actions;
- disabling the failing mobile state;
- adding state-specific hard-coded colours;
- accepting screenshots automatically.

If a preview intentionally contains a horizontal product interaction, keep that scroller locally bounded so the document itself still satisfies the no-overflow assertion.

## Rollback

This gate changes verification only. It introduces no API, route, persistence, analytics, authentication, or production rendering behavior.

A rollback may revert the verification changes if the harness itself is faulty. Do not remove mobile coverage solely to permit a product layout regression. Fix or revert the product change instead.

## Completion contract

Issue #5510 is complete when:

- the matrix structurally requires the 390px viewport and mobile states;
- Cypress renders those states in the existing browser stack;
- light, dark, RTL, 200% text scale, and 400% text scale are represented at 390px;
- unintended mobile horizontal overflow fails CI;
- the commands and failure modes are documented here.
