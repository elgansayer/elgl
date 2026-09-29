# Correction Modal regression and design-preview completion

Issue: #6070

Target: `frontend/src/app/components/correction-modal`

Status: complete once the focused regression suite and repository verification pass.

## Scope

This is the final regression/design-sync pass for the Correction Modal Spartan conversion. It preserves the existing correction workflow while locking the interaction, Relay styling, accessibility, RTL, high-zoom and responsive contracts delivered by the preceding conversion work.

## Regression contract

`correction-modal.completion.spec.ts` covers the remaining high-value behaviour around the converted surface:

- quick explanation tags append to a trimmed explanation without losing user text
- an empty explanation starts cleanly with the selected quick tag
- the visual diff stays absent for an unchanged sentence and appears once the correction differs
- the runtime template remains on Relay semantic surface, text, primary/secondary and on-fill tokens
- direction-sensitive badge placement remains expressed with the logical `end` utility
- no hardcoded hexadecimal product colours are introduced
- the dialog retains its bounded viewport height, scrollable body, wrapping footer and reduced-motion safeguards

The pre-existing component suite continues to cover dialog semantics, initial/reset state, invalid submission suppression, trimmed submission payloads, optional explanations, native field labelling, bidi-safe text inputs, non-submit action buttons, explicit close controls, high-zoom access and cancellation.

## Claude Design / design-preview synchronization

`frontend/design-preview/components/correction-modal.html` is the checked-in HelloTalk Design System representation for this surface and contains two explicit states:

- **light/mobile** at the 390px baseline, labelled `Correction modal light mobile preview`
- **dark/wide** with the wider dialog treatment, labelled `Correction modal dark wide preview`

Both states represent the original ghost text, editable correction, live diff, explanation input, quick tags and footer actions. The preview uses semantic system variables, logical inline placement, minimum touch targets and wrapping footer actions rather than fixed product palette values.

The completion test reads the checked-in preview and fails if either theme/responsive state disappears, keeping the repository representation synchronized with the Claude Design component mapping.

## DESIGN.md alignment

The completed surface retains the repository design constraints:

- Spartan Helm owns dialog, textarea, input and button interaction primitives.
- Relay semantic tokens own surfaces, text, primary/secondary duet, warning and on-fill contrast.
- Light and dark themes remain first-class in the design representation.
- Mobile remains the baseline while the wide state demonstrates the larger viewport treatment.
- RTL-sensitive placement uses logical inline-end positioning.
- Reduced-motion handling remains explicit on feature-owned transitions.
- The dialog body remains scrollable and footer actions wrap for 200%/400% zoom reflow.
- User-authored text keeps `dir="auto"` so mixed-direction corrections remain readable.

No API, routing, persistence, schema, authorization, analytics or backend behaviour changes are introduced.

## Verification

The relevant verification gate is:

```bash
cd frontend
npm run check:control-flow
npm run check:rtl-logical
npm run lint
npm run test -- --watch=false
npm run build
cd ..
npm run check:design-sync
```

GitHub Actions remains the canonical clean-environment validation for the pull request.

## Rollout and rollback

This is test/design-preview/documentation-only and can ship with any backend version. Rollback is a normal revert of the #6070 commit; no data repair, migration or feature flag is required.
