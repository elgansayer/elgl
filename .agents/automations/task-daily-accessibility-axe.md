# Daily Accessibility (A11y) Axe Check

## Objective
Ensure the application meets WCAG AA requirements across the current Relay + Spartan design system and representative product surfaces.

## Instructions
1. Run the repository accessibility audit tooling against representative high-value views including Discovery, Chat, Settings, learning/vocabulary surfaces, overlays/dialogs, and Room Chat.
2. Check semantic names, roles, descriptions, `aria-expanded`/`aria-controls` relationships, error association, focus order, focus restoration, keyboard operation, and screen-reader announcements on interactive controls.
3. Verify colour contrast and non-colour state cues in both light and dark themes using Relay semantic tokens. Also verify forced-colours/high-contrast behaviour for custom visual controls where applicable.
4. Verify 200% and 400% zoom/reflow on critical workflows, RTL directionality, reduced motion, touch target sizing, and visible focus.
5. Prefer Relay primitives and Spartan-owned interaction behaviour when fixing violations. Do not introduce a parallel custom primitive or hand-rolled focus/keyboard state machine to solve an accessibility issue.
6. Add or update regression tests for every fixed violation and run the relevant frontend verification gates before completing the task.
7. When an accessibility fix materially changes a mapped visual contract, update its repository preview and reconcile its `design-sync.manifest.json` ID with Claude Design.
