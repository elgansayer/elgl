# Confirm dialog regression and design-preview status

Tracks issue #6065 and complements `docs/spartan/confirm-dialog-audit.md`.

## Completion status

The confirm-dialog Spartan/Relay conversion is locked by focused component regression coverage and an explicit Claude Design-compatible preview.

- Interaction ownership remains Spartan Dialog plus Spartan Button.
- Caller-provided confirmation copy remains feature content and is not treated as a translation key.
- Inactive, open, Confirm, Cancel, dialog-dismissal, duplicate-close, accessible-labelling, reduced-motion, RTL-safe layout and high-zoom contracts are covered by `confirm-dialog.component.spec.ts`.
- `frontend/design-preview/components/confirm-dialog.html` represents the light 390px mobile state and the dark tablet/desktop state.
- The mobile preview keeps both touch actions full width and stacked; wider layouts return to an end-aligned row.
- Both preview states use Relay semantic surface/text tokens and the primary accent token rather than product-specific hardcoded colours.
- The dark/wide state includes expanded Japanese copy to exercise multilingual wrapping without introducing physical-direction layout rules.

## Verification contract

Run the normal frontend gate, including:

```bash
cd frontend
npm test
npm run lint:check
npm run check:spartan-health
npm run build
```

Repository-level design coverage and visual-capture workflows should also remain green when the preview changes.

## Remaining scope

No additional visual or interaction migration is required by #6065. Any future change to confirmation queueing/concurrency belongs to `ConfirmService` product semantics and should be tracked separately rather than folded into the shared dialog presentation contract.
