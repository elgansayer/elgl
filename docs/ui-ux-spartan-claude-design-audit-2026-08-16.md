# UI/UX deep audit: Spartan UI + Claude Design

Date: 2026-08-16

## Executive status

The frontend has **not** fully integrated Spartan UI yet.

The repository has completed the high-risk prerequisites and has a credible long-run architecture:

- Angular 22 and Tailwind CSS 4 are in place.
- `@spartan-ng/brain` and `@spartan-ng/cli` are installed.
- generated/owned Helm code lives under `frontend/src/app/components/ui/`.
- Relay remains the stable product-facing design-system API.
- `DESIGN.md`, `docs/spartan-relay-architecture.md`, frontend checks and the numbered Spartan migration backlog establish the intended ownership model.

However, the repository itself still records outstanding migration work. The open Spartan programme reaches beyond 1,000 numbered tasks, and the design audit still lists bespoke controls, hand-built overlays, incomplete primitive consolidation, remaining raw utility composition, route-level migration work and incomplete design-preview parity. Therefore "Spartan installed" must not be treated as "Spartan fully integrated".

Claude Design is also **not yet a complete two-way design sink/source workflow**. The repository documents `/design-sync` and `/design` and mirrors design artefacts, but it does not yet provide a machine-readable bidirectional ownership/provenance contract, conflict resolution rules, or automated drift detection between runtime code, Relay tokens, design previews and Claude Design artefacts.

## What is already strong

### Architecture

The current architecture is correct and should be retained:

1. Feature surfaces own product behaviour and composition.
2. Relay primitives are the stable application-facing component API.
3. Spartan Helm is the generated visual/adapter layer.
4. Spartan Brain owns accessible interaction state machines.

This prevents Spartan implementation details from leaking across the application while still allowing its accessible behaviours to replace hand-rolled state machines.

### Design tokens

Relay semantic tokens are already the right single product token system. Spartan semantic variables should continue to alias into Relay rather than becoming a second palette. Per-user primary accent behaviour, first-class light/dark themes, RTL logical properties and multilingual typography rules are all important differentiators that generic upstream Spartan defaults must not override.

### Automated static checks

The frontend already has useful policy checks for:

- Angular control-flow syntax,
- template binding rules,
- RTL logical properties,
- Relay token ownership,
- multilingual typography,
- semantic colour roles,
- surface/elevation rules,
- radius hierarchy.

These are important because a design-system migration without automated regression checks tends to drift back into local utility markup.

## Gaps that prove Spartan is not complete

### 1. Open migration backlog

The numbered Spartan programme still contains per-surface audit, conversion, Relay token/theme, accessibility and Claude Design sync work across primitives and feature components. The backlog itself reaches at least `[Spartan UI 1042]`.

A programme with active conversion tickets is, by definition, not complete.

### 2. Contradictory design authority

Root `AGENTS.md` still contains a legacy design mandate describing strict `#121212` dark mode and vibrant neon styling. That conflicts with the newer Relay design contract, where light and dark are both first-class and semantic tokens own product colour roles.

Issue #6997 already captures this and should be treated as P0 because autonomous agents cannot reliably follow contradictory mandatory instructions.

### 3. Primitive consolidation remains incomplete

`DESIGN.md` and the redesign audit describe structural issues including historical button duplication, wrapper/attribute-forwarding gaps, bespoke presentation primitives, and the need to move suitable interaction mechanics to Spartan-backed primitives.

Spartan adoption should be measured by interaction ownership, not by package presence. A bespoke card or static badge does not need Brain. A dialog, combobox, select, menu, popover or other focus/keyboard state machine should not remain hand-rolled when an approved Spartan path exists.

### 4. Overlay/dialog migration is a high-leverage remaining area

The repository still contains multiple modal and overlay surfaces. Shared overlay behaviour should converge first because focus trapping, Escape handling, backdrop semantics, restoration and portal layering are both accessibility-sensitive and highly duplicated when left bespoke.

### 5. Generated Helm health and upgrade drift need continuous verification

The repository has a generated Helm layer, but full integration also requires proving that local generated code stays close enough to upstream Spartan for future upgrades to remain reviewable. Healthcheck/regeneration comparison should become a regular CI/release gate rather than an occasional manual activity.

### 6. Completion metrics are prose-heavy

Current documents contain useful inventories and historical counts, but there is no single generated coverage dashboard proving:

- total routes,
- total modal/dialog surfaces,
- total Relay primitives,
- total installed Helm capabilities,
- direct Brain imports,
- hand-rolled interaction patterns,
- unit/integration coverage,
- light/dark preview coverage,
- Claude Design mapping coverage.

Without a generated denominator, "fully integrated" remains subjective.

## Claude Design two-way audit

### Current state

The repository already instructs Claude-based UI work to use `/design-sync` and `/design`. The redesign audit also identifies an existing `HelloTalk Design System` project and explicitly says to reuse it rather than creating a parallel design system.

That is a good start but it is not a complete bidirectional workflow.

### Missing two-way guarantees

A robust code ↔ design loop needs all of the following:

1. **Stable identity**: each syncable primitive/screen/modal has a stable repository-owned ID.
2. **Provenance**: each artefact records its repository path, design path/project and last reconciled commit.
3. **Direction**: a change can be code-first, design-first or reconciliation, and that direction is recorded.
4. **Conflict policy**: if both sides changed since the last reconciliation, automation must stop and require an explicit merge decision.
5. **Changed-only operation**: avoid resyncing the entire design system for every small PR.
6. **Drift detection**: CI should identify visual-contract code changes with missing design/preview reconciliation.
7. **State coverage**: theme, viewport, interaction, RTL and high-zoom states must be represented where relevant.
8. **No silent runtime mutation**: Claude Design output must enter runtime through normal reviewed code/PR paths.

### Source-of-truth decision

The correct model is not two competing sources of truth.

- Runtime code, Relay semantic tokens and tested interaction contracts are canonical for shipped software.
- Claude Design is the canonical editable **design-intent and review workspace**.
- `frontend/design-preview/` is the repository-local deterministic visual mirror used for review, CI and offline fallback.
- A reconciliation record links the two.

This allows true two-way iteration while keeping production changes auditable.

## Priority recommendations

### P0

- Resolve #6997 so autonomous agents see one visual authority.
- Land the bidirectional Claude Design sync contract (#7065).
- Add stable design-sync manifest/provenance IDs (#7067).
- Add design/code drift CI (#7068).
- Standardise Claude Design MCP setup (#7070).
- Generate a real route/modal/primitive coverage dashboard (#7071).

### P1

- Prioritise shared dialog/overlay migration before leaf feature surfaces.
- Eliminate remaining direct Brain imports from feature code where Relay wrappers exist.
- Add static detection for newly introduced hand-rolled focus traps, Escape handlers, roving tabindex and custom combobox keyboard logic.
- Add generated Helm upstream-diff health checks.
- Add attribute/ARIA forwarding contract tests for Relay form controls and wrappers.
- Add visual regression snapshots for representative Relay primitives in light/dark, 390px/wide, RTL and forced-colour states.

### P2

- Generate migration waves from dependency topology rather than issue number alone: shared primitives first, shell/layout second, high-traffic feature surfaces third, low-risk leaves last.
- Add bundle and interaction performance budgets for Spartan migration.
- Track number of bespoke interactive state machines remaining over time.
- Track duplicated utility composition and hard-coded semantic style violations as burn-down metrics.

## Definition of "fully integrated Spartan"

Do not mark the migration complete until all are true:

- All reusable interaction classes have a documented owner.
- No feature surface reimplements a Spartan-owned interaction when an approved Relay/Helm path exists.
- Direct Brain imports are limited to approved infrastructure/wrapper locations.
- Shared dialogs, comboboxes, menus/selects and other complex controls use the canonical Spartan path.
- All Relay primitives have tests for their public contract.
- Light/dark, RTL, keyboard, screen-reader, reduced-motion and high-zoom requirements are continuously verified.
- Generated Helm drift is measurable and controlled.
- A generated coverage report has no unexplained migration gaps.

## Definition of "fully embraced Claude Design two-way sync"

Do not call the workflow complete until:

- every syncable artefact has a stable ID and mapping,
- both design-first and code-first flows are documented,
- `/design-sync`/`/design`/MCP usage is standardised,
- conflict resolution is explicit,
- CI can detect unreconciled visual-contract changes,
- design changes reach runtime only through reviewed code,
- repository previews remain a deterministic fallback,
- full coverage is measured automatically rather than inferred from a small representative sample.
