# 200 percent zoom verification

Issue #5522 adds the migration gate for the architecture defined in `docs/200-percent-zoom-behaviour.md`.

## What the gate protects

The gate keeps four representative product surfaces in the visual-contract matrix: Discovery, Chat, Vocabulary, and Moderation. Each representative must retain light, dark, and RTL coverage together with rendered 200 percent text/reflow states at the canonical 390px mobile viewport and 768px effective tablet viewport.

The Cypress visual harness must continue to apply a 200 percent root text scale and reject document-level horizontal overflow in both mobile and tablet reflow states. Theme coverage remains separate from geometry on purpose: the architecture prohibits theme-specific layout, so the same representative DOM contract is verified in both light and dark while the zoom states verify reflow.

## Commands

Run the cheap migration contract without installing frontend dependencies:

```sh
node --test scripts/verify-200-percent-zoom-contract.test.mjs
node scripts/verify-visual-contract-matrix.mjs
node scripts/verify-200-percent-zoom-contract.mjs
```

Run the rendered visual contract when frontend dependencies are installed:

```sh
cd frontend
npm run visual:capture:ci
```

The dedicated `200 Percent Zoom Contract` workflow runs the cheap checks on pull requests, merge queues, and relevant changes pushed to `main`. The existing UI visual-capture workflow remains authoritative for the rendered screenshots.

## Expected failure modes

The gate fails with a specific diagnostic if a representative loses light, dark, RTL, mobile 200 percent, or tablet 200 percent coverage; if the canonical 390px/768px effective viewports drift; if the Cypress harness stops applying `200%`; or if the harness stops checking horizontal document overflow for the reflow states.

Rendered visual capture additionally fails when a representative produces page-level horizontal overflow at high scale. A local horizontal scroller remains allowed only when it is an intentional content contract, as defined by the architecture standard.

## Accessibility and theme scope

This is a migration guard, not a second responsive system. Application code must not detect browser zoom or add zoom-specific breakpoints. Normal responsive composition must reflow naturally, keep required content and actions reachable, preserve keyboard and screen-reader semantics, use logical RTL-safe layout, and remain valid under both Relay light and dark themes and user accent colours.

## Rollback

Reverting this gate removes only verification. It does not change application routes, APIs, persisted data, analytics, or runtime styling. A rollback must not weaken the underlying 200 percent zoom architecture contract; if the gate itself proves incorrect, replace it with an equivalent or stronger automated check before removing coverage.
