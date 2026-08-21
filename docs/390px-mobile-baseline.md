# 390px mobile baseline

Status: authoritative responsive implementation contract for the Relay + Spartan UI migration.

This document defines what `DESIGN.md` means by "Mobile-first - design for 390px width, then scale up". It supplements `docs/spartan-relay-architecture.md` and does not create a second token system, breakpoint system, or component layer.

## 1. Scope

The 390px baseline applies to every user-facing Angular route, reusable Relay primitive, Spartan composition, dialog, sheet, form, list, card, navigation surface, and state view.

The goal is not to make 390px a special device class. The goal is to ensure the base, unprefixed layout is usable on a representative narrow mobile viewport before wider responsive adaptations are applied.

The baseline covers:

- layout and reflow;
- touch and keyboard interaction;
- translated and user-generated text;
- light and dark themes;
- per-user primary accent colours;
- RTL and mixed-direction content;
- loading, empty, error, disabled, pending and destructive states;
- dialogs, sheets, menus and other overlays;
- 200% and 400% zoom/reflow;
- safe areas, mobile browser chrome and the on-screen keyboard;
- design-preview and automated regression coverage.

It does not change API, route, persistence, analytics, or product behaviour by itself.

## 2. Current implementation audit

The repository already establishes most of the underlying responsive architecture:

- `DESIGN.md` explicitly requires a 390px mobile-first baseline.
- `docs/spartan-relay-architecture.md` requires 390px mobile-first composition, intentional tablet/desktop layouts, logical directional utilities, accessible touch targets, and 200%/400% zoom support.
- `frontend/tailwind.config.js` extends Relay colour, typography, radius, shadow and motion roles but does not define a custom 390px breakpoint.
- Tailwind base utilities therefore remain the mobile contract, while standard responsive prefixes refine the experience at wider widths.
- Relay semantic tokens already support independent light and dark palettes and a dynamic per-user primary accent.
- Spartan Brain and Helm own reusable interaction mechanics where applicable. Responsive feature composition remains a Feature/Relay responsibility.

The current architecture is correct in treating 390px as a design and verification viewport rather than a CSS breakpoint. A dedicated `390px` media query would encourage components to work only at one exact width and would duplicate Tailwind's mobile-first model.

The migration backlog has repeatedly found the same classes of mobile risk across individual surfaces:

- fixed or minimum widths that force horizontal page scrolling;
- action rows that cannot wrap or stack;
- text containers missing `min-w-0` or equivalent shrink behaviour;
- controls whose labels expand beyond their containers under translation;
- desktop-sized padding consuming too much of a narrow viewport;
- overlays with feature-owned fixed dimensions instead of responsive Dialog/Sheet composition;
- mobile interactions represented by sub-touch-size controls;
- responsive fixes that use physical left/right properties and regress RTL;
- visual states documented only at a wide viewport;
- components that work at normal zoom but lose content or actions at high zoom.

This document converts those repeated findings into one reusable contract.

## 3. Meaning of the 390px baseline

### 3.1 390px is a verification viewport, not a breakpoint

A compliant surface must render correctly when the viewport is 390 CSS pixels wide using its base styles.

Do:

```html
<section class="w-full min-w-0 ps-4 pe-4 sm:ps-6 sm:pe-6">
  ...
</section>
```

Do not:

```html
<section class="w-[390px]">
  ...
</section>
```

Do not add `min-[390px]:`, `max-[390px]:`, a custom `mobile390` Tailwind screen, or equivalent one-off media queries merely to satisfy this standard. Use the unprefixed mobile layout and existing responsive breakpoints unless a real product requirement cannot be expressed otherwise.

A layout must also behave sensibly slightly below and above 390px. Passing one screenshot at exactly 390px is not sufficient if 375px or 412px immediately breaks.

### 3.2 Base styles own mobile

Unprefixed Tailwind classes describe the mobile composition. Wider changes are progressive enhancements.

Preferred:

```html
<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
  ...
</div>
```

Avoid desktop-first reversal such as relying on a large base layout and then adding many `max-*` overrides to reconstruct mobile.

### 3.3 No horizontal page scrolling

At 390px, normal application content must not make the document wider than the viewport.

A horizontal scroller is allowed only when horizontal scrolling is itself the product interaction, for example a deliberately scrollable chip row or timeline. In that case:

- the scroller must be locally bounded;
- the page itself must not overflow;
- keyboard and touch access must remain usable;
- important actions must not exist only off-screen without an understandable scrolling affordance.

Common containment tools include:

- `w-full` and `max-w-full`;
- `min-w-0` on flex/grid children that contain text;
- `break-words` or an equivalent safe wrapping strategy for untrusted long text;
- responsive stacking for action groups;
- bounded media using `max-w-full` and an appropriate aspect ratio;
- local `overflow-x-auto` only for a genuinely horizontal interaction.

Do not solve overflow by globally applying `overflow-x-hidden`. That hides defects and can make focused controls, menus, translated text or browser zoom content unreachable.

## 4. Layout contract

### 4.1 Page containers

Route-level surfaces should use the available inline size and a deliberate maximum width at larger viewports.

Mobile page padding must leave enough room for content and touch controls. Use the established Relay/app spacing conventions or Tailwind spacing scale rather than one-off pixel values.

Directional spacing must use logical utilities:

- `ps-*` / `pe-*`;
- `ms-*` / `me-*`;
- `start-*` / `end-*`;
- `border-s-*` / `border-e-*`.

Do not introduce physical `pl-*`, `pr-*`, `ml-*`, `mr-*`, `left-*`, `right-*`, `border-l-*` or `border-r-*` in migrated UI.

### 4.2 Cards and grouped content

Cards remain Relay presentation components. A card must not gain Spartan Brain solely because its layout changes at mobile width.

At 390px:

- cards must fit the parent inline size;
- internal content must be allowed to shrink;
- long headings, descriptions and user content must wrap;
- card grids normally collapse to one column unless a compact multi-column treatment has been specifically designed and verified;
- borders, radii, shadows and colours must use Relay roles.

At wider breakpoints, feature surfaces may introduce multi-column grids or side-by-side cards where that improves information density.

### 4.3 Forms

Forms must be usable without horizontal panning.

At the baseline:

- labels remain visible and associated with controls;
- inputs and textareas fill the available width unless a shorter field has a strong semantic reason;
- help and validation text wraps without covering controls;
- related controls can stack when a row would compress labels or touch targets;
- primary submit actions may become full-width on mobile and return to intrinsic width on wider layouts;
- pending/disabled state must remain programmatically available and not depend on colour alone.

Do not reduce label font size, truncate essential field names, or remove help text merely to make a desktop row fit.

### 4.4 Action groups

Action groups need an explicit narrow-width strategy.

Choose one of these based on product semantics:

1. stack full-width actions;
2. allow a wrapping row when each action still has an adequate touch target;
3. keep one primary action prominent and move secondary actions into an approved menu/sheet if that interaction is already part of the product design.

Do not squeeze three or more labelled actions into a single row simply because they fit on desktop.

Use the existing Relay/Spartan button APIs and owned touch-size variants. Do not recreate touch sizing, focus rings or disabled behaviour in feature CSS when the shared primitive owns them.

### 4.5 Navigation

Mobile navigation must preserve the same destinations and permissions as wider navigation, even if the visual composition changes.

A desktop sidebar may become a compact mobile navigation pattern, but responsive presentation must not silently remove essential destinations.

Native links should remain links. Do not convert navigation to command buttons merely to make a mobile layout easier to style.

### 4.6 Media

Images, video, charts, canvases and other media must be bounded by their parent.

At 390px:

- media must not force the document wider than the viewport;
- meaningful content should remain legible without requiring horizontal page scrolling;
- controls layered over media must retain adequate touch and focus targets;
- object-fit/cropping choices must not remove essential information;
- fixed-height media should have a deliberate mobile height rather than inheriting an oversized desktop frame.

Specialised interactions such as image cropping can remain feature-owned or library-owned while their surrounding dialog, controls and responsive shell follow Relay/Spartan.

## 5. Responsive ownership

The existing layer boundaries remain authoritative.

### Feature surfaces own

- route and screen composition;
- when a one-column layout becomes a wider multi-pane layout;
- product-specific content priority;
- which feature content is visible in each responsive composition;
- feature-specific media sizing.

### Relay primitives own

- reusable mobile-safe sizing defaults;
- product spacing, radius, surface and typography roles;
- shared responsive variants where multiple feature surfaces need the same behaviour;
- translated accessible labels and product-facing component APIs.

### Spartan Helm / Brain own

- generic focus and keyboard state machines;
- dialog Escape and backdrop behaviour;
- combobox/listbox/menu selection mechanics;
- other reusable interaction semantics.

Spartan is not a responsive layout framework. Do not push feature breakpoints or business-content priority into Brain.

## 6. Overlay contract

Dialogs, sheets, popovers and menus are especially sensitive at narrow widths.

At 390px:

- the overlay must remain within the visual viewport;
- required actions must be reachable without page-level horizontal scrolling;
- long translated headings and descriptions must wrap;
- the content region may scroll internally when necessary while the user retains a clear way to dismiss or complete the action;
- focus management, Escape handling, backdrop interaction and modal semantics must come from the approved Spartan primitive rather than feature-owned event handlers;
- mobile bottom-sheet presentation belongs to Relay composition where that pattern is appropriate;
- the on-screen keyboard must not permanently hide the active field or the only completion action.

Do not use a fixed desktop modal width such as `w-[640px]` without a mobile-safe `w-full`/`max-w-*` composition.

## 7. Text, localisation and user content

A 390px layout is not complete if it works only with short English copy.

Every mobile verification should consider:

- long translated labels;
- languages that commonly produce longer product copy;
- CJK text without spaces;
- Arabic/Persian/Hebrew directionality and mixed-direction content;
- Devanagari and other complex scripts;
- long usernames, URLs and user-generated tokens;
- dynamic numbers and dates.

Required rules:

- do not set fixed heights on containers whose user-facing text can wrap unless overflow behaviour is explicitly designed;
- use the system body font for user-generated and translated content as required by `DESIGN.md`;
- preserve semantic `lang` and direction boundaries where applicable;
- use logical layout rather than maintaining separate LTR and RTL mobile templates;
- truncation is appropriate only when the product explicitly treats the content as a preview and the full value remains accessible elsewhere.

## 8. Accessibility and input methods

The 390px baseline is an interaction contract, not only a screenshot size.

### Touch

- interactive controls must use the repository's approved touch-size primitive/variant where available;
- adjacent targets need enough separation to avoid accidental activation;
- actions must not depend on hover;
- gestures need an accessible non-gesture path when the action is important.

### Keyboard

- all interactive controls remain reachable in a deterministic order;
- visible focus must not be clipped by overflow containers;
- native elements should retain native keyboard semantics;
- feature code must not emulate button/link keyboard behaviour on generic `div` elements when a native or Spartan-owned control is available.

### Screen readers

Responsive changes must not change the semantic reading order into something unrelated to the visual order. Hiding a duplicate desktop/mobile presentation from sighted users is not enough if both copies remain in the accessibility tree.

Important loading, error, success and pending states need suitable status/alert semantics according to the feature contract.

## 9. Zoom and reflow

WCAG reflow is part of the responsive definition.

Required content and actions must remain available at 200% and 400% browser zoom. A component that fits at 390px but loses a button at high zoom is not compliant.

When zoom increases:

- action rows may stack or wrap;
- grids may collapse;
- text must reflow instead of being clipped;
- fixed-position regions must not cover the only way to continue;
- overlays must provide an internal scroll region when their content exceeds the viewport height;
- focus targets must remain scrollable into view.

Do not add a second special layout solely for zoom. Correct mobile-first flexible layout should generally provide the same reflow behaviour.

## 10. Safe areas and mobile browser UI

For surfaces that pin controls to viewport edges, account for browser safe-area insets using the repository's shared shell or a documented semantic utility rather than scattering device-specific offsets through feature code.

Pinned bottom actions must remain usable with:

- iOS/Android gesture areas;
- mobile browser chrome;
- the virtual keyboard;
- landscape orientation and reduced viewport height.

Do not hardcode device model dimensions.

## 11. Theme and token parity

Responsive changes must preserve the Relay token contract.

At every viewport:

- light and dark themes are independently valid;
- the user-defined `primary` accent continues to work;
- text on saturated fills uses `on-fill` rather than hard-coded white or black;
- surfaces, borders, radii, shadows and semantic states use Relay roles;
- responsive variants must not introduce a separate mobile colour palette.

A mobile layout difference is not justification for a one-off product colour, radius or shadow.

## 12. Migration examples

### Example A: fixed-width card

Before:

```html
<div class="w-[36rem] rounded-xl bg-surface-200 p-6">
  ...
</div>
```

After:

```html
<div class="w-full min-w-0 rounded-card bg-surface-200 p-4 sm:p-6">
  ...
</div>
```

The base layout fits the mobile container. The wider viewport only increases spacing.

### Example B: actions forced into one row

Before:

```html
<div class="flex items-center gap-2">
  <app-button-secondary>...</app-button-secondary>
  <app-button-primary>...</app-button-primary>
</div>
```

After:

```html
<div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
  <app-button-secondary customClass="w-full sm:w-auto">...</app-button-secondary>
  <app-button-primary customClass="w-full sm:w-auto">...</app-button-primary>
</div>
```

The interaction remains owned by the shared buttons. Feature code owns only composition.

### Example C: text overflow in a flex row

Before:

```html
<div class="flex items-center gap-3">
  <div>
    <p class="truncate">...</p>
  </div>
  <button hlmBtn>...</button>
</div>
```

After:

```html
<div class="flex items-center gap-3">
  <div class="min-w-0 flex-1">
    <p class="break-words">...</p>
  </div>
  <button hlmBtn size="touch">...</button>
</div>
```

The text-bearing child may shrink and the action preserves its interaction target.

### Example D: RTL-safe mobile spacing

Before:

```html
<div class="pl-4 pr-3 ml-2 border-l-2">...</div>
```

After:

```html
<div class="ps-4 pe-3 ms-2 border-s-2">...</div>
```

The same responsive composition mirrors without a duplicate template.

### Example E: desktop modal shell

Before:

```html
<div class="fixed inset-0" (click)="close()">
  <div class="w-[640px]">...</div>
</div>
```

After:

Use the approved Spartan Dialog/Relay composition with a mobile-safe width and the established `rounded-sheet`/surface roles. Spartan owns focus, Escape and dismissal semantics; the responsive shell owns width, spacing and internal scrolling.

## 13. Prohibited patterns

The following patterns are prohibited in new or migrated responsive UI unless a documented product requirement justifies an exception:

- treating `390px` as a custom Tailwind breakpoint;
- fixed page/container widths that exceed the available mobile inline size;
- large `min-width` values on normal page content;
- globally hiding horizontal overflow to conceal layout defects;
- desktop-first layouts rebuilt through a collection of `max-*` overrides;
- physical directional utilities in migrated UI;
- controls made smaller than the shared touch variant to preserve a one-line desktop composition;
- removing labels, descriptions or actions only to make them fit;
- feature-owned focus traps, keyboard navigation or dialog dismissal behaviour;
- duplicate mobile and desktop DOM trees when one responsive semantic tree can express the design;
- hard-coded mobile colours, radii or shadows outside Relay tokens;
- raw hard-coded user-facing text in responsive alternatives;
- arbitrary device-specific width/height checks in TypeScript for layout that CSS can express;
- required content hidden at 200% or 400% zoom;
- design previews that show only a wide state for a materially responsive component.

## 14. Verification contract

Responsive correctness needs both static policy checks and rendered tests.

### 14.1 Existing static checks

Continue running the existing frontend gates:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

`check:rtl-logical` remains authoritative for physical-direction utility enforcement. Do not create a duplicate mobile-specific RTL checker.

### 14.2 Required mobile-baseline guard

A follow-up implementation should add one canonical rendered mobile-baseline check rather than a collection of fragile grep rules.

Recommended contract:

1. run representative routed screens and mapped design-preview surfaces at a 390 CSS pixel viewport;
2. assert the document does not have unintended horizontal overflow;
3. assert required controls remain visible/reachable and focusable;
4. exercise at least one long-translation fixture and RTL direction where the surface contains user-facing copy;
5. cover light and dark states for theme-sensitive surfaces;
6. include 200%/400% reflow checks for critical flows or a viewport-equivalent automated test that proves required actions remain reachable;
7. fail CI on regressions rather than storing screenshots as non-blocking artefacts only.

The existing browser E2E/design-preview infrastructure should own this check. Do not introduce a third browser-testing stack solely for 390px verification.

A future command may be exposed as `npm run check:mobile-baseline` once the rendered test is implemented. The command should delegate to the existing browser runner and remain deterministic in CI.

### 14.3 Component tests

When a component changes responsive behaviour, its focused tests should lock the semantic contract rather than asserting every utility class.

Useful assertions include:

- the narrow composition keeps all required actions in the DOM and accessibility tree;
- navigation/control semantics remain native or Spartan-owned;
- translated labels remain associated with controls;
- pending/disabled state remains accessible;
- a mobile-specific presentation does not duplicate interactive elements in the accessibility tree.

### 14.4 Design-preview coverage

When a visual/layout contract changes materially, update the mapped Claude Design/design-preview surface with:

- a 390px light state;
- a 390px dark state when theme-sensitive;
- a wider tablet/desktop state when the composition changes at a breakpoint;
- representative loading/error/empty/pending states where those affect layout;
- long-copy or RTL examples when they expose a meaningful responsive risk.

The design preview is a review mirror. Runtime Angular behaviour and automated tests remain authoritative.

## 15. Review checklist

Before approving a responsive UI PR, verify:

- [ ] Base, unprefixed styles are usable at 390px.
- [ ] No unintended document-level horizontal scroll exists.
- [ ] Flex/grid text children can shrink and wrap where required.
- [ ] Action groups have an explicit mobile composition.
- [ ] Touch targets use approved shared sizing.
- [ ] Keyboard focus remains visible and ordered.
- [ ] Light and dark themes remain valid.
- [ ] Per-user primary accent behaviour remains intact.
- [ ] Directional layout uses logical properties.
- [ ] Long translated and user-generated text does not clip required content.
- [ ] Required content/actions remain available at high zoom/reflow.
- [ ] Dialog/sheet interaction mechanics are Spartan-owned where an approved primitive exists.
- [ ] Wider tablet/desktop layouts are deliberate rather than stretched mobile layouts.
- [ ] Relevant design-preview states are reconciled when the visual contract changed.
- [ ] Existing frontend verification commands pass.

## 16. Rollback

This architecture standard changes documentation only. It can be reverted independently without data, API, route or runtime rollback.

Future migrations based on this standard should remain small enough to revert per surface. If a responsive migration introduces an accessibility, route or interaction regression that cannot be corrected in the same pull request, revert that migration rather than shipping a partially functional mobile fallback.

## 17. Canonical summary

The HelloTalk mobile contract is:

- design and verify the base layout at 390px;
- do not create a 390px breakpoint;
- use flexible mobile-first layout and existing Tailwind breakpoints for wider adaptations;
- keep responsive visual ownership in Feature/Relay layers and generic interaction ownership in Spartan;
- preserve Relay themes, tokens and per-user primary accent;
- use logical direction utilities;
- keep all required content/actions usable with long copy, RTL, touch, keyboard and high zoom;
- verify the contract in the existing browser/design-preview stack and fail CI on regressions.

This standard resolves `[Spartan UI 0043]` and is the architecture baseline for subsequent responsive migration tickets.