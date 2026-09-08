# Font scale slider interaction ownership

Issue: #6218

## Decision

`FontScaleSliderComponent` keeps the browser's native `<input type="range">` as the interaction primitive. The repository does not currently expose an approved Spartan/Helm slider primitive, so adding a feature-owned keyboard, pointer, focus, drag, or disabled-state implementation would duplicate behavior already provided by the browser and would work against the Spartan migration goal.

The component therefore owns only presentation and translation. `FontScaleService` remains authoritative for the 0.80–1.50 range, 0.05 normalization, in-memory state, persistence, and application of the root font size.

## Interaction contract

- Native range semantics own keyboard, pointer, touch, focus, minimum, maximum, and step behavior.
- The translated label implicitly wraps the range control. This avoids a fixed global DOM id and remains safe if the component is rendered more than once.
- Native `min`, `max`, `step`, and current value semantics are not duplicated with manual ARIA attributes.
- `aria-valuetext` remains because the product presents the scale as a localized percentage rather than a raw factor such as `1.15`.
- Input handling consumes `HTMLInputElement.valueAsNumber` and ignores non-input or non-finite events. Normalization remains in `FontScaleService` rather than being reimplemented in the component.
- Chat-specific text sizing remains independent of the global font-scale slider.

## Failure and privacy behavior

The control has no network dependency and does not expose or transmit personal data. If browser storage is blocked or full, `FontScaleService` continues to apply the selected scale in memory. An invalid programmatic input is ignored rather than corrupting the scale signal.

## Verification

`font-scale-slider.component.spec.ts` locks:

- the native range primitive and 80–150% bounds;
- absence of custom/manual range roles and duplicated min/max/current ARIA state;
- propagation of the browser's numeric range value to `FontScaleService`;
- localized percentage value text;
- implicit label ownership without a fixed global id.

The normal frontend lint, unit, static-analysis, build, design-governance, and repository CI workflows remain the merge gate.

## Rollout and rollback

There is no API, schema, route, persistence-format, or visual-token migration. Deploy as a normal frontend release. Rollback is a code-only revert; existing `app_font_scale` values remain compatible because the service and storage contract are unchanged.
