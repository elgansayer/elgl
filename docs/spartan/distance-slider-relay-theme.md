# Distance slider Relay theme completion

Issue: #6145 (`Spartan UI 0363`)

Target: `frontend/src/app/components/distance-slider`

## What changed

The distance slider now resolves its custom range track and thumb entirely from the canonical Relay token variables used by the application theme:

- track: `--surface-100-rgb`
- thumb: `--color-primary-rgb`
- thumb boundary: `--surface-500-rgb`
- browser accent fallback: `--color-primary`

The obsolete `--color-surface-100` and `--color-surface` references have been removed. Those variables are not part of the checked-in Relay contract and could leave the custom track or thumb border browser-dependent when unresolved.

The thumb intentionally uses the per-user primary accent. The secondary/Tide token is not used because this control represents the current learner's own discovery preference rather than a paired learner/exchange-partner relationship.

## Responsive and theme contract

The control remains fluid at every breakpoint and does not introduce a fixed page width. The interactive range box is now 44px high, while the translated radius label can wrap instead of forcing `whitespace-nowrap` overflow. This keeps the component usable at the 390px baseline and under text expansion/high zoom while preserving the browser-owned range interaction model.

Light and dark modes use the same semantic token names and therefore resolve to their independently-designed theme values. No product colour literal is introduced by the production component.

A dedicated design preview at `frontend/design-preview/components/distance-slider.html` records light/390px and dark/wide states. The preview is registered under the `spartan.component-system` design-sync mapping.

## Behaviour deliberately unchanged

- native `<input type="range">` keyboard and pointer behaviour
- 1km step size
- min/max normalization and value clamping
- parent-provided value synchronization without a synthetic output event
- `distanceChanged` emission only for user input
- parent-owned discovery debouncing and kilometre-to-metre conversion
- native disabled semantics for non-VIP use

## Verification

Focused Angular coverage locks the existing value/disabled/label contract and now also checks:

- fluid/min-width-safe layout;
- translated-label wrapping;
- 44px control hit area;
- canonical Relay surface and primary token usage;
- removal of the obsolete surface variables and hard-coded product colours.

Repository CI remains the authoritative integration gate for frontend unit tests, build/static analysis, Relay/Spartan governance and design-sync validation.

## Rollback

Revert the #6145 commits. There are no API, route, schema, storage or persisted-user-data changes. The rollback returns only the distance slider's presentation and design-preview registration to the prior state.
