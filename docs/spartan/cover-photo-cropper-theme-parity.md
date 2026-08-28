# Cover photo cropper Relay theme parity

Tracks issue #6073 for `frontend/src/app/components/cover-photo-cropper/`.

## Scope

This stage keeps the interaction contract established by #6072 and changes presentation only. Spartan Dialog continues to own modal mechanics, Spartan Button continues to own action mechanics, and `ngx-image-cropper` continues to own crop interaction and image processing.

## Relay presentation contract

- The modal uses the Relay sheet recipe: `rounded-sheet`, semantic surface/border roles, and `shadow-lift`.
- The crop viewport uses semantic surface and border tokens plus the standard application radius. No fixed product colour is introduced.
- The default Spartan primary button remains the per-user accent-aware Save action; Cancel remains the secondary action.
- Actions stack full-width at the 390px mobile baseline and become an end-aligned row at the `sm` breakpoint.
- Dialog padding is mobile-first (`p-4`) and increases on wider layouts (`sm:p-6`).
- Long translated titles can wrap without forcing horizontal overflow.
- The dialog is bounded to the dynamic viewport and scrolls vertically when content cannot fit.
- Directional layout remains logical/direction-neutral; no physical left/right utilities are introduced.

## Theme and responsive verification

`frontend/design-preview/components/cover-photo-cropper.html` records the visual contract with explicit light/mobile and dark/wide states. The preview uses system semantic colours so it documents ownership and state composition rather than duplicating product palette values.

Automated component coverage locks the Relay sheet/elevation/surface tokens, semantic crop surface, mobile-first action stacking, wider action row, and native button semantics while retaining the existing crop/save/cancel behavior tests.

## Rollout and rollback

There is no API, schema, route, persistence, upload, image-format, or analytics change. Rollout is the normal frontend deployment after repository CI and design-sync verification pass.

Rollback is a direct revert of the #6073 commits. No data migration or cleanup is required.

## Verification

Run the repository frontend gate:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

Also run the repository design-sync/preview checks required by CI because this issue changes a mapped visual contract.
