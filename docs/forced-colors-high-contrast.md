# Forced colours and high-contrast contract

This is the Relay + Spartan implementation contract for Spartan UI 0027 and 0028.

## Ownership

Relay owns normal light/dark semantic colour roles. Spartan Helm consumes those roles for components. When the browser reports `forced-colors: active`, the user's operating-system palette becomes authoritative for contrast-critical UI.

The forced-colours layer is global and intentionally separate from the normal Relay palette. It must not redefine Ember, Tide, light-mode or dark-mode product tokens.

## Required behaviour

- Use CSS system colours such as `Canvas`, `CanvasText`, `ButtonFace`, `ButtonText`, `LinkText`, `Highlight`, and `GrayText` inside the forced-colours media query.
- Preserve visible boundaries for controls, cards, form fields and overlays even when shadows and gradients disappear.
- Preserve a non-colour selected/current state using a `Highlight` border or outline.
- Replace the normal Tailwind ring with an explicit `Highlight` outline for `:focus-visible`.
- Disabled controls must remain distinguishable with `GrayText`.
- Decorative gradients and shadows may be removed because they do not carry semantic information.
- Allow native controls and essential glyphs to participate in the browser's normal forced-colour adjustment.

## Prohibited patterns

Do not:

- use `forced-color-adjust: none` without a narrowly scoped, documented and tested exception;
- preserve hard-coded product colours in forced-colours mode merely for branding;
- remove borders/outlines that become necessary when shadows or fills are replaced;
- rely on colour alone to communicate selected, pressed, current or disabled state;
- create component-local high-contrast palettes when the global system-colour contract is sufficient.

## Verification

Run from `frontend/`:

```bash
npm run check:forced-colors
npm run lint:check
npm run build
```

`check:forced-colors` fails if the global stylesheet is no longer loaded, the forced-colours media query disappears, required system-colour semantics are removed, or an unaudited `forced-color-adjust: none` opt-out is introduced.

Manual accessibility review should also cover Windows High Contrast or an equivalent browser forced-colours emulation with keyboard focus, disabled controls, selected/pressed states, overlays, links, form fields and primary/secondary actions.
