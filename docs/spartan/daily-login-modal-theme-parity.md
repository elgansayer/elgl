# Daily login modal Relay theme parity

Issue: #6098 (`Spartan UI 0318`)

Target: `frontend/src/app/components/daily-login-modal`

## Outcome

The daily-login modal keeps Spartan Dialog and Button ownership while Relay owns the surrounding visual composition.

The implementation removes the feature-level `rounded-2xl` / `sm:rounded-3xl` and `shadow-2xl` treatment and uses the shared Relay `rounded-sheet` and `shadow-lift` tokens instead. Surface, border and text roles remain semantic (`surface-*` / `text-*`), and the CTA remains the default Spartan primary action so the current per-user primary accent controls its fill and text-on-fill contract.

No reward-claim, routing, persistence, API or analytics ownership was moved into the presentation component.

## Responsive contract

The dialog panel now uses a one-rem viewport gutter on each inline edge through `w-[calc(100%-2rem)]`, remains capped at `max-w-sm`, and is vertically contained with `max-h-[calc(100dvh-2rem)] overflow-y-auto`.

Spacing is mobile-first (`p-5`) and expands at the existing `sm` breakpoint (`sm:p-6`). Title, body and CTA copy explicitly permit wrapping so long translations do not force horizontal overflow.

Verification states represented in `frontend/design-preview/components/daily-login-modal.html`:

- light theme at the 390px mobile baseline;
- dark theme at tablet width;
- light theme at desktop width with non-English long-form copy;
- user-accent primary action represented with system `Highlight` / `HighlightText` semantics.

The preview intentionally uses system semantic colours rather than inventing product palette literals.

## Accessibility and RTL

This ticket does not change the Dialog interaction model. Spartan continues to own portal, focus and dismissal mechanics, and the existing translated accessible-name/title association remains intact.

The layout remains direction-neutral and introduces no physical left/right utilities. The CTA keeps the shared `touch` size and full-width mobile hit target.

## Verification

Focused Angular regression coverage now locks:

- Relay surface, radius and elevation classes;
- absence of the replaced off-token radius/elevation utilities;
- dynamic-viewport containment and responsive padding;
- translated text wrapping;
- non-default coin interpolation;
- the existing controlled close and Spartan Dialog close-button contracts.

Repository CI remains authoritative for frontend tests, static analysis, production build, design-sync governance, UI preview coverage and RTL checks.

## Rollout

Deploy as a normal frontend-only visual update after required checks pass. There are no feature flags, migrations or mixed-version API constraints.

## Rollback

Revert the component/test/preview/documentation commits together. No persisted state or server-side rollback is required.
