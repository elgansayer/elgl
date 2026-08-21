# Spartan UI + Claude Design: next 599 recommendations

This programme covers exactly 599 existing migration tickets: `[Spartan UI 0025]` through `[Spartan UI 0623]` inclusive.

The numbered GitHub backlog remains the issue source of truth. `scripts/generate-spartan-next-599-recommendations.mjs` deterministically expands those 599 tickets into a repository-derived recommendation manifest using the same foundation-area and UI-surface ordering as the original backlog seeder. It deliberately fails if it cannot produce exactly 599 entries.

## Why this is a recommendation programme instead of 599 duplicate issues

The repository already has a contiguous 1,050-ticket Spartan UI + Claude Design backlog. Creating another 599 issues would duplicate scope and make autonomous agents more likely to implement the same surface twice. The recommendation manifest therefore enriches IDs 0025-0623 with execution priority, actual target paths, implementation intent and verification requirements without creating competing tickets.

## Current deep-dive findings

The migration should prioritise architecture and shared behaviour before visual cleanup. Current code search still shows hand-built overlays/dialogs, feature-level control styling, generic spacing utilities such as `space-y-*`, raw overlay z-index ownership, and shared primitives that are only part-way through Relay token migration. These are exactly the failure modes the Spartan skill and architecture docs are intended to remove.

The highest-value sequence is:

1. Finish the dependency-ready foundation stack through theme/accent ownership.
2. Implement dark-theme parity, forced-colours/high-contrast, focus-ring, reduced-motion, RTL and translation-safe API guards.
3. Establish multilingual rendering, responsive, touch, keyboard, screen-reader and zoom/reflow contracts before mass screen conversion.
4. Establish SSR/hydration, interaction, bundle, tree-shaking, lazy-route and animation budgets before adding many Helm components.
5. Standardise fields, validation, error/loading/empty/offline/skeleton/toast states and overlay/focus restoration.
6. Add reusable component test harnesses, visual-regression baselines and Claude Design source-of-truth sync.
7. For every feature surface, execute the five-workstream loop: audit, Spartan conversion, Relay visual pass, accessibility/RTL/zoom pass, tests plus Claude Design sync.

## Mandatory implementation rules

- Check open PRs and recent implementation before starting any branch.
- Prefer existing app-owned Helm components under `frontend/src/app/components/ui` before generating or hand-building UI.
- Use the Spartan CLI and current component docs/MCP when a capability is absent. Never guess selectors or APIs.
- Brain owns behaviour and accessibility. Do not edit Brain packages.
- Relay owns product semantic colour, radius, shadow, spacing and motion decisions.
- Preserve first-class light and dark themes, per-user accent colour, RTL logical layout, i18n, forced-colours, reduced motion and WCAG AA.
- Replace hand-built dialog/menu/select/popover behaviour when an approved Spartan primitive exists.
- Keep feature classes for layout rather than overriding Helm internals. Prefer `gap-*` composition over `space-*` in new Spartan layouts.
- Update associated unit/integration tests and Claude Design/design-preview states when a visual or interaction contract changes.
- Merge only after repository-required CI is green. Fix failures in the same PR branch.

## Generate the exact 599-entry manifest

From repository root:

```bash
node scripts/generate-spartan-next-599-recommendations.mjs
```

The command writes this file as the full 599-entry manifest. Every generated entry includes:

- exact `[Spartan UI ####]` backlog key;
- priority tier;
- real repository target path for surface work;
- recommended implementation action;
- verification requirement.

## Priority interpretation

`P0 foundation` work should land before broad feature conversion. `P1 structure` and `P1 accessibility` work should normally precede presentation-only changes on a surface. `P2 presentation` and `P2 verification` complete the conversion and lock it against regression.

When dependencies allow parallel work, parallelise across unrelated feature surfaces, not across competing implementations of the same shared primitive.
