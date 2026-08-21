# UX/UI + Spartan + Claude Design 100% completion contract

Status: authoritative programme completion contract.

This document defines the evidence required before the repository may claim that the UX/UI, Spartan UI and Claude Design conversion is complete. "100%" is an evidence state, not a migration slogan.

## 1. Completion dimensions

The programme is complete only when all dimensions below pass simultaneously.

### Runtime component architecture

- Feature code uses Relay product primitives where a reusable product primitive exists.
- Reusable interaction behaviour is delegated to owned Spartan Helm components and Spartan Brain.
- Spartan Brain imports are confined to the owned Helm layer.
- No new hand-rolled focus traps, roving tabindex, combobox keyboard state, menu keyboard state or dialog escape handling exists when Spartan provides that behaviour.
- Presentation-only components remain Relay-owned when Spartan behaviour provides no benefit.

### Tokens and visual semantics

- Product colour, radius, spacing, elevation, motion and focus treatment use Relay semantic tokens.
- Light and dark themes remain first-class.
- Per-user primary accent behaviour remains supported.
- Forced-colours/high-contrast is supported for custom controls.
- Reduced-motion preferences are honoured.

### Responsive and accessible behaviour

- 390px mobile is the baseline.
- Tablet and desktop layouts are intentional.
- Required actions remain usable at 200% and 400% zoom/reflow.
- Touch targets meet the product touch contract.
- Keyboard navigation and visible focus are deterministic.
- Screen-reader names, roles, states and relationships are valid.
- Directional layout uses logical properties and remains valid in RTL.

### Multilingual rendering

- Translation-safe component APIs are used.
- UI strings are not hard-coded in feature templates or components.
- CJK, Arabic, Cyrillic, Devanagari and other complex scripts retain suitable font fallback, shaping, wrapping and line-height behaviour.
- RTL is driven by document/locale direction rather than duplicated templates.

### Forms and state presentation

- Form controls use Relay/Spartan composition rather than bespoke interaction state where an approved primitive exists.
- Validation and error relationships are programmatic and screen-reader discoverable.
- Loading, empty and error states use the shared product contract.
- Disabled states remain distinguishable without colour alone.

### Rendering and performance

- Angular SSR builds successfully.
- Hydration does not depend on browser-only state during server render.
- Route features remain lazy-loaded according to the application routing contract.
- Spartan imports remain tree-shakeable and do not introduce global all-component barrels into feature code.
- Bundle and interaction performance budgets remain enforced by the existing build and CI budgets.
- Non-essential animation remains compositor-friendly and reduced-motion safe.

### Design evidence

- Every `design-sync.manifest.json` item has an existing repository preview.
- Every required state in the manifest is represented by the visual contract matrix or an equivalent automated/state preview.
- Every manifest item has a real `lastReconciledCommit` from an actual reconciliation with the canonical **HelloTalk Design System** Claude Design project.
- No reconciliation SHA may be invented or copied merely to satisfy CI.
- Material visual changes update the mapped preview and design-sync metadata in the same reviewed change.

## 2. One canonical verification entry point

Run:

```bash
npm run check:ux-100-percent
```

This gate verifies programme-level structural evidence and composes the existing specialised checks. It deliberately fails while any Claude Design mapping lacks real reconciliation provenance.

A green result means the repository has evidence for all machine-verifiable completion dimensions. It does not waive manual visual review where visual judgement is required.

## 3. Claude Design external dependency

The Claude Design portion is not complete until the external project has actually been reconciled. Repository previews are a deterministic fallback and review mirror, not a substitute for external reconciliation.

When Claude Design is unavailable:

1. Keep `lastReconciledCommit` as `null` for unreconciled items.
2. Continue completing runtime, preview, accessibility and CI work.
3. Do not claim 100% completion.
4. Reconcile every pending stable ID when connectivity is available.
5. Record the genuine reconciliation commit only after that operation succeeds.

## 4. Relationship to the migration backlog

The numbered Spartan migration issues describe work units. This contract supersedes duplicate issue wording as the programme-level definition of done. An issue may be closed when its acceptance criteria are satisfied by runtime code, shared architecture and automated evidence, even if the exact implementation landed in a broader convergence PR.

Do not preserve obsolete issue debt solely because a migration ticket predates the canonical component architecture. Conversely, do not close a ticket merely because a broad architecture document exists if its runtime or verification requirement is still missing.

## 5. Final completion rule

The project may state **UX/UI + Spartan + Claude Design = 100% complete** only when:

- `npm run check:ux-100-percent` passes,
- canonical repository verification passes,
- the UX system health report shows 100% Claude Design reconciliation provenance,
- no known open Spartan/UX migration issue represents unmet acceptance criteria,
- and the final PR has passed its required CI and visual/accessibility checks.
