# Hourly Relay + Spartan UI Boundary Check

## Objective
Prevent new feature UI from bypassing Relay presentation APIs or recreating interaction behaviour already owned by Spartan.

## Instructions
1. Audit frontend changes since the previous run and check existing overlapping Spartan migration issues before editing.
2. Identify new hand-rolled buttons, form controls, selection widgets, menus, dialogs, sheets, popovers, tabs, tooltips and similar interaction surfaces.
3. Prefer the current approved Relay public primitive/API. Where Spartan provides the capability, keep Brain/Helm interaction mechanics inside the owned UI layer rather than importing Brain directly from feature code.
4. Run `npm run check:spartan-boundaries` and the relevant frontend verification checks. Do not add a permanent allow-list exception to make the check pass.
5. Verify Relay semantic-token use, first-class light/dark themes, responsive behaviour, RTL/logical direction, keyboard/focus behaviour and applicable high-zoom/reflow states.
6. Treat original HelloTalk screenshots as product-reference evidence only. Do not restore legacy strict-dark, neon or pixel-parity mandates.
7. When a material shared visual contract changes, update repository previews/design-sync metadata and reconcile with the canonical HelloTalk Design System Claude Design project according to `docs/claude-design-two-way-sync.md`.
8. Fix focused regressions and create a PR with tests. If the required work is already represented by an active migration PR, do not create competing implementation.