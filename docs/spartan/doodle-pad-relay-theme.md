# Doodle pad Relay theme parity

Issue: #6155

Target: `frontend/src/app/components/doodle-pad`

## Outcome

The doodle pad now uses Relay semantic surface, border, text, radius, focus, and elevation roles for all product chrome. The legacy component stylesheet no longer hard-codes greys, purple gradients, white text, bespoke borders, or raw focus-ring colours.

The drawing raster remains feature-owned user content. It uses stable white paper in both UI themes so the default black brush and the fixed drawing palette remain legible, and an exported PNG does not change appearance merely because the sender or recipient changes application theme.

## Responsive contract

- The card uses compact mobile padding and increases spacing from the `sm` breakpoint.
- The canvas keeps its 600×400 backing raster but remains `max-w-full`; pointer coordinate scaling remains unchanged.
- The colour and brush toolbars form one column at the 390px baseline and two columns on wider screens.
- Clear, Cancel, and Send stack at narrow widths and return to a compact horizontal composition when space allows.
- Long translated labels may wrap rather than forcing horizontal overflow.

## Theme and token contract

- Card elevation remains `shadow-lift`, the named Relay transient-elevation role.
- Canvas framing uses `surface-300`, `surface-100`, and `rounded-app`.
- Selection and focus use the per-user `primary` token and `text-on-fill` rather than fixed purple/white styling.
- Destructive Clear treatment uses the semantic `danger` token.
- Fixed palette colours are drawing-content values, not application chrome, and remain deliberately outside Relay theme tokens.

## Compatibility and failure behaviour

No API, routing, persistence, analytics, chat-delivery, PNG message, or output-event contract changes. `doodleSaved` still emits one PNG data URL and `cancelled` still emits cancellation. The existing pointer-event drawing lifecycle and responsive coordinate conversion are unchanged.

The theme work does not add asynchronous state or network failure paths. If canvas context creation is unavailable, existing fail-safe behaviour remains: drawing and clearing become no-ops and no synthetic successful image is emitted.

## Verification

Focused coverage now checks the neutral raster background, semantic canvas framing, responsive toolbar grid, and mobile-first footer composition in addition to the existing pointer, validation, clear, save, and cancellation contracts.

Canonical frontend verification remains:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run check:surface-elevation
npm run lint:check
npm run build
npm run test -- --watch=false
```

GitHub Actions is the authoritative clean-environment verification for connector-authored changes.

## Rollout and rollback

This is a frontend-only presentation change with no migration or persisted-state transition. Roll out through the normal frontend deployment after required checks pass. Roll back by reverting this PR; existing stored/sent doodle PNGs are unaffected.
