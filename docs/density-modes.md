# Compact and comfortable density

Status: authoritative contract for `[Spartan UI 0019]` and `[Spartan UI 0020]`.

Density is a component-level product choice, not a second visual theme. Relay maps compact, standard and comfortable intent onto stable component variants while preserving accessibility, typography, RTL and token ownership.

## Density mapping

Existing public `sm` / `md` / `lg` variants map to semantic density intent:

- `sm` = compact
- `md` = standard/default
- `lg` = comfortable

This preserves compatibility while giving the variants a product meaning. New primitives should prefer semantic density naming when introducing a new API, but existing stable APIs do not need churn solely to rename enum values.

## Interactive target floors

Reducing whitespace must not reduce the actionable area below usable sizes. The primary button establishes the shared control baseline:

- compact: `min-h-10` (40px)
- standard: `min-h-11` (44px)
- comfortable: `min-h-12` (48px)

Icon glyph size and internal padding may vary independently from the target floor. Compact controls used in dense desktop contexts still retain visible focus and a usable pointer target.

## Content containers

Cards may vary padding (`sm`/`md`/`lg`) without imposing artificial fixed heights. Comfortable density should add whitespace, not enlarge text or change semantic hierarchy unless the component explicitly owns a typography variant.

## Responsive behaviour

Density is not a substitute for responsive layout. Do not force compact density merely because a viewport is small. Mobile layouts still require suitable touch targets; wider layouts may choose compact data-dense controls where the product context warrants it.

## Accessibility

- Compact density must not clip translated or fallback-font text.
- Focus rings remain fully visible at all density levels.
- Required actions remain reachable at 200% and 400% zoom/reflow.
- Icon-only controls preserve accessible names and target floors.
- Density does not change colour contrast or semantic state treatment.

## Prohibited patterns

- Raw pixel density inputs exposed by shared primitives.
- A global compact-mode CSS override that indiscriminately shrinks all controls.
- Compact variants that only reduce height without reviewing touch/focus usability.
- Fixed heights on text containers where translated text may wrap.
- Using viewport width alone as the meaning of compact versus comfortable density.

## Verification

Run:

```bash
cd frontend
npm run check:density-modes
```

The gate verifies the primary shared control's compact/standard/comfortable target floors, checks that the three stable size variants remain present, and protects the component from arbitrary fixed-height density values.
