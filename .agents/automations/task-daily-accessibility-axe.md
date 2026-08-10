# Daily Accessibility (A11y) Axe Check

## Objective

Ensure the HelloTalk clone is accessible to all users by meeting WCAG AA standards.

## Instructions

1. Run a dedicated accessibility audit tool (like `axe-core` via Cypress or Playwright) against the major views: Discovery, Chat List, Settings, and Room Chat.
2. Identify missing `aria-label`, `aria-expanded`, or `role` attributes on custom primitives (especially horizontal scrollable pills and custom toggle buttons).
3. Ensure color contrast ratios meet minimum guidelines against the `#121212` dark background.
4. Fix all violations and push the clean code.
