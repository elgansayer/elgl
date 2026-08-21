# Empty state Relay implementation

Issue: #5554  
Target: `frontend/src/app/components/primitives/empty-state`

## Result

`AppEmptyStateComponent` remains the shared Relay presentation primitive and keeps the optional action delegated to Spartan Helm `hlmBtn`. The implementation deliberately preserves the established default visual contract (`rounded-card`, `border-surface-100`, `bg-surface-300`, semantic text tokens, and the existing spacing) while hardening reflow for narrow and zoomed layouts.

The component now keeps its host, surface, illustration, copy, and optional action within the available inline size. Long translated titles/descriptions use wrapping-safe text classes and long action labels are allowed to wrap instead of forcing horizontal overflow. These changes are direction-neutral and introduce no physical left/right utilities or stock Tailwind product colours.

## Relay and Spartan ownership

- Surface radius, border, background, typography, spacing, illustration sizing, and responsive behaviour remain Relay-owned.
- The optional primary action remains a native `button` enhanced by Spartan Helm `hlmBtn` with `size="touch"`.
- The component remains side-effect free: it emits `actionClicked`; callers own navigation, API calls, retries, analytics, and mutations.
- `customClass` remains a compatibility escape hatch and is appended after primitive-owned classes.

## Theme and accent behaviour

No hardcoded colour was added. The empty-state surface continues to use `surface-*` and `text-*` tokens, so light and dark theme parity follows the shared Relay token definitions. The action continues to inherit the shared Spartan primary treatment, including the configured user accent and `text-on-fill` behavior.

## Responsive and RTL contract

The host and surface now include `min-w-0 max-w-full`. Decorative illustrations use `max-w-full`; title/description text can break long words; and action copy uses `max-w-full whitespace-normal`.

This preserves the existing desktop composition while making the same primitive safe at the 390px mobile baseline, tablet widths, high zoom, and long translated copy. No `left`, `right`, `ml`, `mr`, `pl`, or `pr` utility was introduced.

## Design-preview reconciliation

The canonical component-system preview remains `frontend/design-preview/components/primitives/feedback-states.html`. It already represents the empty-state token palette, light/dark theme toggle, radius, border, typography hierarchy, illustration/icon variants, and optional primary action.

This change does not alter those default visual values; it only adds overflow/reflow constraints that are inert for the preview's representative content. Therefore the existing preview remains authoritative and no duplicate preview surface is introduced. The focused unit suite locks the new narrow-layout contract while the repository UI-design and visual-capture gates continue to validate the mapped preview.

## Regression coverage

The colocated `empty-state.component.spec.ts` now covers:

- default region/icon/input behavior;
- decorative lazy illustrations and fallback-icon suppression;
- title/description rendering and accessible naming;
- optional action visibility, native button behavior, and one emission per activation;
- Relay surface tokens and absence of physical-direction / stock product-colour utilities;
- caller class extension ordering; and
- long-copy/action reflow constraints for the 390px baseline.

## Verification

The authoritative repository gates for this change are the frontend unit suite, static analysis/lint, production build, Spartan ownership/convergence checks, RTL and translation-safe checks, UI Design Coverage, and UI Visual Capture in GitHub Actions.

## Rollout and rollback

No API, routing, persistence, database, or translation-key change is required. The change is backwards compatible with existing empty-state inputs and projected content.

Rollback is a normal revert of the issue #5554 pull request. There is no data migration or cleanup step.
