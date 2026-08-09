# Hourly RTL Logical Consistency Check

## Objective
Maintain 100% RTL (Right-to-Left) readiness on all recent UI changes.

## Instructions
1. Run `npm run check:rtl-logical`.
2. Identify any accidental physical direction CSS classes (`ml-`, `pr-`, `border-l`) added recently.
3. Convert them to their logical equivalents (`ms-`, `pe-`, `border-s`).
4. Boot the app and toggle `I18nService` to Arabic (`ar`) to visually confirm recent components mirror correctly.
