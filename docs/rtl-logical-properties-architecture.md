# Relay + Spartan RTL logical-properties architecture

Issues: #5499 (`Spartan UI 0033`) and #5500 (`Spartan UI 0034`)

## Current implementation audit

The application already establishes `html[dir='rtl']` at the global Relay layer and uses logical Tailwind utilities such as `ms-*`, `me-*`, `ps-*`, and `pe-*` in shared styles. The migration risk is feature code reintroducing physical-direction utilities such as `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, or `right-*` where layout direction should mirror.

## Canonical contract

1. Direction-sensitive spacing uses logical start/end utilities or CSS logical properties.
2. Direction-sensitive positioning uses `inset-inline-start` / `inset-inline-end` or logical Tailwind equivalents.
3. Physical left/right values are allowed only when the visual meaning is intentionally physical and direction-independent, such as a media crop coordinate.
4. Shared Spartan/Helm wrappers must not impose a second RTL system; they inherit document direction.
5. Iconography that conveys direction (back, forward, previous, next, disclosure arrows) mirrors with `rtl:rotate-180` on an element that can be transformed (`inline-block` for a `span`). Media controls, brand marks and status icons never mirror.
6. Keyboard and gesture handlers that map a horizontal direction to "next" or "previous" read `I18nService.direction()` and mirror in RTL.
7. Centring never relies on an inline offset plus a physical translate; use `inset-x-0 mx-auto w-fit`.
8. Light/dark theme behavior must remain identical under RTL; direction changes layout, not semantic colour.

## Approved examples

```html
<div class="ms-3 pe-4 text-start">...</div>
```

```css
.callout {
  margin-inline-start: 1rem;
  padding-inline-end: 1rem;
}
```

## Prohibited patterns

Do not introduce direction-sensitive feature layout with `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `margin-left`, `margin-right`, `padding-left`, `padding-right`, `left`, or `right` when a logical equivalent exists.

## Verification

Run `npm run check:rtl-logical-contract`. The verifier checks the global RTL boundary and fails when changed frontend source lines introduce common physical-direction Tailwind/CSS patterns without an explicit `rtl-physical-ok` annotation on the same line.

From `frontend`, `npm run check:rtl-logical` blocks the classic physical utilities and `npm run check:rtl-audit` blocks the families that regex cannot see (see the whole-tree audit below). Both run inside `npm run lint` and `npm run lint:check`.

## Whole-tree audit (issue #2041)

Issue #2041 audited every Angular template, inline template, stylesheet and keyboard or gesture handler under `frontend/src` for layout that only works left to right. The classic utilities (`pl-*`, `ml-*`, `left-*`, `border-l`) were already clean, so the audit looked for what that regex cannot see.

### Findings and fixes

| Area | Defect in RTL | Fix |
| --- | --- | --- |
| Document direction | `I18nService` kept two hard-coded `['ar', 'he', 'fa', 'ur']` lists beside the `isRtl` flags, and an exact-match lookup treated `ar-SA`, `he-IL`, `fa-IR` and `ur-PK` as left to right | `resolveTextDirection()` in `frontend/src/app/services/text-direction.ts` decides from the primary language subtag. `I18nService.direction` and the `<html dir>` writer both use it, and a spec keeps every `availableLanguages[].isRtl` flag aligned with it |
| CDK and Spartan direction | The CDK `Directionality` service reads `<html dir>` once, when it is created, so a runtime language switch left Spartan Brain tabs, radio groups, sliders and every overlay laid out for the previous direction | `I18nService` pushes the new direction into `Directionality` (its value and its `change` event) whenever it writes `<html dir>` |
| Language picker data | Persian was labelled with Hebrew script plus Arabic script | The native name is `فارسی`, and a spec rejects any native name that mixes Hebrew and Arabic script |
| Switch knobs | The chat and notification switches moved the knob with `translate-x-6`, a physical offset that pushed it out of the track in RTL | The knob rests with `ms-1` (off) or `ms-6` (on), so it sits at the inline start or end in both directions |
| Centring | `start-1/2 -translate-x-1/2` only centres in LTR (lightbox indicator strip, VIP badge) | `inset-x-0 mx-auto w-fit` centres symmetrically |
| Back, next and disclosure arrows | 44 `←` and `→` glyphs and the lightbox chevrons kept pointing the same way in RTL | Each arrow is an element with `inline-block rtl:rotate-180` |
| Lightbox | Arrow keys and swipes always meant that next is on the right | Next is `ArrowLeft` and a rightward drag in RTL, matching the mirrored previous and next controls |
| Reading engine tabs | `ArrowRight` always moved to the next tab | The keys swap in RTL, as the WAI-ARIA tabs pattern requires |

### Reviewed and intentionally unchanged

- The recommended-for-you carousel already mirrors its scroll direction and arrow keys; only its arrows changed.
- The trust and safety tab strip has two tabs with wrap-around, so `ArrowLeft` and `ArrowRight` reach the same tab in either direction.
- Swipe-to-reply in the long-press menu measures the absolute horizontal distance, so it is direction-neutral.
- The avatar crop box and the doodle pad work in image or canvas pixels measured from the left edge and never mirror. The crop box carries an `rtl-physical-ok` note.
- The angle quotes `‹ ›` and `« »` are Bidi_Mirrored characters that flip on their own, and play or pause glyphs must not mirror, so the audit ignores both.
- Tailwind 4 compiles `space-x-*` and `divide-x` to `margin-inline-*` and `border-inline-*`, so they already follow the direction.

### The `check:rtl-audit` gate

`frontend/scripts/check-rtl-audit.mjs` scans every non-spec `.html`, `.ts`, `.scss` and `.css` file under `frontend/src` (including inline `template:` and `styles:` literals) and fails on:

- Tailwind `text-left/right`, `rounded-l/r/tl/tr/bl/br`, `float` and `clear-left/right`, `scroll-ml/mr/pl/pr`, and `start-1/2` or `end-1/2` centring;
- `translate-x-*` and `origin-left/right` unless an `rtl:` or `ltr:` counterpart is on the same line;
- physical style bindings such as `[style.left.px]` and `[style.marginLeft.px]`;
- physical CSS declarations in stylesheets and inline styles: `text-align`, `float`, `clear`, `left`, `right`, physical corner radii, the `border-left-*` and `border-right-*` longhands and `scroll-margin/padding-left/right`;
- arrow glyphs (`←`, `→`, `&larr;`, `&rarr;`) that are element content or loose text without an `rtl:` mirror, and `<ng-icon>` elements named `lucideArrowLeft`, `lucideChevronRight` and similar without one.

Opt out of a single line with `rtl-physical-ok` on that line, on the line before it, or in an HTML comment above a multi-line element, and say why next to it. Use it only for coordinates that are physical by design.

`frontend/scripts/check-rtl-audit.test.mjs` unit-tests every rule, the opt-out and the real source tree, and runs in `npm test` through `pretest`.

### Known gaps and follow-ups

- Arrows inside translated or computed strings (`discovery.audioIntroFeed.languagePair`, the recommended-for-you language pair label) cannot carry an element-level mirror. Render the arrow as its own element or isolate the pair with a bidi isolate when those labels are next revisited.
- The back and disclosure arrows are legacy Unicode glyphs (see `docs/design/iconography-contract.md`). When they move to Lucide, keep `rtl:rotate-180` on the `<ng-icon>`; the audit already enforces it.
- The recommended-for-you carousel template still contains hard-coded English copy and needs translation keys.
- Language pickers render native names without `lang` or `dir="auto"`, so screen readers use the interface voice for them.
- `vip.component.spec.ts` and `reading-engine.component.spec.ts` are `describe.skip`. The reading-engine tab keys are covered by `reading-engine-tab-keys.spec.ts`; the VIP badge is covered by the audit.
- The admin portal has no interface translation, so it has no RTL surface to audit yet.

### Rollout and rollback

There is no schema, API or persisted-state change. Rollout is the normal frontend deployment. Rolling back reverts the template classes and the audit gate together; reverting only the gate re-opens the regressions listed above.
