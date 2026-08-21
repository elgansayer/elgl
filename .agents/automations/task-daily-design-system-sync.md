# Daily Relay + Spartan Design System Sync

## Objective
Prevent UI drift by enforcing the current Relay + Spartan architecture and reconciling material visual contracts with Claude Design.

## Instructions
1. Read `DESIGN.md`, `docs/spartan-relay-architecture.md`, and `docs/claude-design-two-way-sync.md` before changing UI.
2. Audit changed and high-traffic surfaces for ad hoc product styling, duplicated interaction state machines, direct feature-level Spartan Brain usage, and obsolete primitive families.
3. Prefer approved Relay primitives and existing Spartan Helm components. Use Spartan Brain for accessible interaction mechanics through the documented ownership boundary instead of recreating focus, keyboard, overlay, combobox, menu, or dialog behaviour.
4. Preserve first-class light and dark themes, semantic Relay token roles, per-user primary accents, RTL logical properties, multilingual typography, reduced motion, forced colours, and high-zoom/reflow requirements. Never impose a dark-only or `#121212` global mandate.
5. Treat original HelloTalk screenshots as product-reference material only. They do not override the current Relay token system, accessibility requirements, or Spartan component ownership.
6. Run `npm run check:design-sync`, `npm run check:spartan-boundaries`, the frontend verification gates, and relevant tests for changed code.
7. For material visual-contract changes, reconcile the affected stable IDs in `design-sync.manifest.json`, repository previews, and the existing `HelloTalk Design System` Claude Design project according to the two-way sync contract.
8. Do not create a parallel design system, duplicate primitive family, or separate Claude Design project.
