# Tablet responsive breakpoint architecture

Status: authoritative implementation contract for `[Spartan UI 0045]`.

This document defines how HelloTalk surfaces adapt from the mobile-first composition into tablet layouts while preserving Relay visual ownership, Spartan interaction ownership, accessibility, localisation, themes, and per-user accent behaviour.

It supplements `docs/spartan-relay-architecture.md`. It does not create a second responsive system or replace Tailwind's default breakpoint scale.

## 1. Outcome

Tablet layouts must be deliberate compositions rather than stretched phone screens or compressed desktop screens.

The repository contract is:

- Base styles own the mobile layout.
- Tailwind's default `sm`, `md`, `lg`, `xl`, and `2xl` breakpoints remain the only standard viewport breakpoints.
- `md` is the primary tablet composition breakpoint when the layout genuinely benefits from more horizontal space.
- `lg` is the normal boundary for desktop-only composition changes such as persistent secondary navigation or wider multi-column information density.
- Components must not assume that a tablet means a particular device model, orientation, pointer type, or pixel ratio.
- Responsive changes must be driven by available CSS viewport space, not JavaScript user-agent or device-name detection.
- Feature code owns page composition. Relay primitives own reusable responsive defaults. Spartan owns interaction mechanics, not viewport layout policy.

## 2. Current implementation audit

The current frontend already has the right architectural foundations:

1. `frontend/tailwind.config.js` extends Relay tokens but does not override Tailwind's breakpoint scale.
2. `docs/spartan-relay-architecture.md` requires a mobile-first baseline and intentional tablet and desktop layouts.
3. Existing screens regularly use Tailwind responsive variants such as `md:grid-cols-2`, proving that responsive layout is already expressed through CSS utilities rather than device detection.
4. Relay semantic colours are CSS-variable-driven and therefore remain theme-aware at every viewport size.
5. `primary` remains dynamically user-controlled through `ThemeService`, so responsive variants must never replace it with viewport-specific product colours.
6. The RTL verification gate already prohibits physical directional utilities in application source.
7. Spartan migration work already treats responsive layout as a feature or Relay concern rather than a Spartan Brain concern.

The main inconsistency is not missing technology. It is missing policy. Individual features currently decide independently when to introduce tablet columns, how wide cards may grow, when actions move inline, and when overlays stop behaving like mobile sheets. That can produce several failure modes:

- A two-column layout starts as soon as `md` is available even when translated labels no longer fit.
- A phone-sized card is merely centered on a tablet, leaving excessive unused space while related information remains vertically fragmented.
- A desktop multi-column composition activates too early and makes touch controls cramped.
- Fixed widths or `min-width` values create horizontal scrolling between mobile and desktop sizes.
- Actions that are comfortably stacked on mobile become a dense row before their labels have enough room.
- Secondary content appears beside primary content without preserving reading and focus order.
- Modal presentation changes visually while focus, dismissal, or accessible naming behaviour diverges.
- Feature code introduces one-off arbitrary breakpoints for a symptom that should be solved through flexible layout.

This standard closes those policy gaps.

## 3. Canonical breakpoint model

HelloTalk uses Tailwind's standard responsive scale. Do not redefine it globally for product-specific device assumptions.

| Range | Canonical interpretation | Default composition intent |
| --- | --- | --- |
| Base, below `sm` | narrow/mobile | single-column, touch-first, no horizontal overflow |
| `sm` and above | roomy mobile / narrow landscape | small spacing or action-row enhancements only when safe |
| `md` and above | tablet-capable width | primary tablet composition breakpoint |
| `lg` and above | desktop-capable width | persistent desktop navigation and denser multi-column composition may begin |
| `xl` and `2xl` | wide desktop | constrain readable content; add whitespace or supporting panes rather than stretching text |

These labels describe layout capability, not hardware identity. A resized desktop browser at `md` receives the same composition as a tablet-sized viewport. A large tablet at `lg` receives the same layout rules as any other viewport with that space.

## 4. Why `md` is the tablet composition breakpoint

`md` is the repository's default point for a meaningful tablet layout transition because existing code already uses `md:` for common two-column changes and because it leaves the base and `sm` ranges available for robust mobile reflow.

This does not mean every component must change at `md`.

A component should add an `md:` variant only when one of these is true:

- Two related regions become easier to understand side by side.
- A repeated collection can safely increase column count while preserving readable card widths.
- A form can place short, logically related fields in columns without harming completion order.
- A primary action can move from full-width to intrinsic width without reducing touch usability or label clarity.
- A sheet or dialog can adopt a centered tablet presentation while keeping the same accessible interaction contract.
- Supporting information can move beside primary content without changing semantic order.

If none of those conditions apply, keeping the mobile composition through `md` is correct.

## 5. `lg` is not a larger tablet patch

Use `lg` for changes that are genuinely desktop-like, not because a feature ran out of room at `md`.

Typical `lg` changes include:

- persistent desktop navigation that replaces a mobile navigation pattern;
- three or more substantial content columns;
- a permanent supporting inspector or detail pane;
- substantially increased information density;
- desktop-oriented toolbar composition where touch-first stacking is no longer the primary constraint.

If a layout requires `lg:` solely to repair overflow introduced at `md`, the `md` layout is wrong and should be simplified.

## 6. Ownership by UI layer

### Feature surfaces

Feature code owns:

- page and route-level column composition;
- ordering of feature-specific content regions;
- when optional supporting content becomes adjacent to primary content;
- max-width choices for a particular workflow;
- responsive visibility only when content remains available through an equivalent accessible path;
- feature-specific charts, media, maps, and data-density changes.

Feature code must not own:

- hand-rolled focus management for responsive dialogs;
- duplicate keyboard interaction logic for a tablet variant;
- device or user-agent detection for layout;
- a second colour, radius, shadow, or spacing vocabulary.

### Relay primitives

Relay primitives own reusable responsive presentation rules such as:

- mobile full-width versus wider intrinsic action defaults;
- card padding and readable max-width behaviour;
- field and label wrapping;
- empty/loading/error-state spacing;
- standard dialog or sheet presentation variants;
- product-consistent responsive gaps and grouping.

A Relay primitive should not expose generic `isTablet` or `isDesktop` boolean inputs. If callers repeatedly need a meaningful product variation, expose a typed semantic variant and keep its breakpoint implementation inside Relay.

### Spartan Helm and Brain

Spartan owns interaction mechanics that must remain stable while presentation changes:

- focus management;
- Escape and outside-dismiss behaviour;
- selection semantics;
- keyboard navigation;
- disabled and pressed state mechanics;
- overlay interaction contracts.

A viewport transition must not swap a Spartan interaction for a feature-owned imitation.

## 7. Page layout contract

### Narrow/mobile baseline

A route must work as a complete single-column experience before tablet enhancements are added.

Required properties:

- no horizontal document scrolling at the baseline viewport;
- primary content appears before optional supporting content in DOM order;
- actions remain reachable without hover;
- labels and user-generated text can wrap;
- flex and grid children that contain long text can shrink, typically with `min-w-0` where needed;
- media uses bounded width and does not force the page wider than the viewport.

### Tablet enhancement

At `md`, a page may become two columns when the relationship is clear.

Preferred pattern:

```html
<main class="grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
  <section class="min-w-0">
    <!-- Primary workflow -->
  </section>
  <aside class="min-w-0">
    <!-- Supporting information -->
  </aside>
</main>
```

The exact track sizes remain feature-owned. The important invariants are flexible tracks, shrinkable children, logical reading order, and no device assumptions.

Do not use a side pane merely to fill empty tablet space. Side-by-side composition must improve comprehension or task flow.

## 8. Collection and card grids

Repeated cards may increase column count at tablet widths, but card readability has priority over filling every row.

Recommended rules:

- Start with one column.
- Move to two columns at `md` only when each card remains readable with long translated copy and representative user content.
- Delay a third column until `lg` or wider unless cards are intentionally compact.
- Prefer `minmax(0, 1fr)` behaviour over fixed card widths.
- Keep card internals responsive independently from the outer grid.
- Do not hide metadata simply to make an early multi-column layout fit.

Example:

```html
<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  @for (item of items(); track item.id) {
    <app-card class="min-w-0" />
  }
</div>
```

## 9. Forms

Forms remain logically ordered regardless of visual columns.

At tablet widths:

- Short paired fields may share a row.
- Long free-text fields normally remain full width.
- Validation messages stay adjacent to their field and must not alter focus order.
- Submit and destructive actions remain visually distinct.
- Field order in the DOM follows the natural task sequence, not a column-major visual trick.
- A two-column form must reflow to one column at high zoom without losing information.

Preferred pattern:

```html
<form class="grid gap-4 md:grid-cols-2">
  <app-field class="min-w-0" />
  <app-field class="min-w-0" />
  <app-field class="min-w-0 md:col-span-2" />
  <div class="flex flex-col gap-3 md:col-span-2 md:flex-row md:justify-end">
    <!-- Actions -->
  </div>
</form>
```

## 10. Action layout

Mobile-first actions often need full-width stacking. Tablet space can permit an inline row, but only when translated labels remain clear.

Canonical approach:

```html
<div class="flex flex-col gap-3 md:flex-row md:justify-end">
  <button hlmBtn size="touch" class="w-full md:w-auto">...</button>
  <button hlmBtn size="touch" class="w-full md:w-auto">...</button>
</div>
```

Rules:

- Do not reduce touch target size at `md`.
- Do not depend on icon-only controls to make an action row fit unless the action is independently well understood and accessibly named.
- Destructive action placement must remain predictable.
- Button text must be allowed to wrap when necessary.
- A tablet row must fall back cleanly under text zoom and long translations.

## 11. Navigation

Tablet layout must not invent a third unrelated navigation model merely because more width exists.

Preferred progression:

- Base/mobile: current mobile navigation contract.
- `md`: retain mobile navigation unless a tablet-specific enhancement has a clear product reason.
- `lg`: persistent desktop navigation may activate where the existing app shell defines it.

Do not expose both mobile and desktop navigation to assistive technology at the same time if one is visually hidden. Responsive visibility must also maintain correct accessibility visibility and focusability.

## 12. Dialogs, sheets, popovers, and overlays

Spartan interaction semantics remain constant across viewports.

A mobile sheet may become a centered tablet dialog if the product pattern requires it, but:

- the same open state owns both presentations;
- focus trapping stays Spartan-owned;
- Escape dismissal stays Spartan-owned;
- outside interaction stays Spartan-owned;
- accessible title and description relationships do not change;
- the action order does not reverse purely for visual reasons;
- content remains scrollable inside the viewport;
- max height respects viewport and safe-area constraints.

Do not render two independent dialog implementations and switch them with CSS. One interaction tree should adapt presentation wherever practical.

## 13. Tables and dense data

Tablet widths do not justify forcing desktop tables into constrained space.

For data-heavy views:

1. Keep the semantic data model intact.
2. Decide which fields are essential to the current task.
3. Prefer a responsive card/list representation when the tabular relationship is not essential.
4. If a true table is necessary, allow a clearly bounded internal scroll region rather than horizontal scrolling the entire page.
5. Preserve header associations and keyboard access.
6. Never hide essential values only because a column does not fit.

## 14. Charts and visualisations

Charts must respond to their container rather than to a device name.

- Place charts in `min-w-0` containers.
- Use the chart library's responsive sizing rather than fixed viewport pixels where possible.
- Ensure legends can wrap or move to a more suitable position at constrained widths.
- Provide accessible text equivalents for important values.
- Do not communicate a state change only through colour.
- Relay semantic colours or feature-approved semantic chart roles remain theme-aware.

## 15. Media

Images, video, maps, and other media must remain bounded by their layout container.

- Use `max-w-full` or equivalent container-safe sizing.
- Preserve intentional aspect ratios.
- Avoid fixed pixel widths that assume a tablet model.
- Do not crop user content differently at `md` unless the product contract explicitly defines that crop.
- Controls remain reachable by touch and keyboard.
- Captions and metadata remain in logical reading order.

## 16. Typography and localisation

Tablet space must not be used to compensate for brittle text assumptions.

Every tablet layout must tolerate:

- longer translated product strings;
- CJK content without whitespace-dependent wrapping assumptions;
- Arabic and other RTL scripts;
- Devanagari and combining-script shaping;
- long user names;
- long unbroken URLs or identifiers where they are valid content;
- 200% text scaling and 400% browser zoom/reflow where applicable.

Do not reduce font size at `md` just to keep a layout in one line.

Use the platform-native body font contract for user-generated and multilingual content. `font-display` remains limited to guaranteed product copy according to `DESIGN.md` and the Spartan/Relay architecture.

## 17. RTL

Responsive layout and bidirectionality are independent concerns.

Required rules:

- Use logical utilities such as `ps`, `pe`, `ms`, `me`, `border-s`, and `border-e`.
- Use CSS logical properties for custom styles.
- Keep DOM reading order semantically correct in both directions.
- Do not use `md:flex-row-reverse` as a substitute for RTL support.
- Directional icons must reflect semantic direction where required.
- A left/right visual pane name must not leak into the component API. Prefer terms such as primary/supporting, start/end, previous/next, or navigation/content.

The existing `npm run check:rtl-logical` guard remains authoritative for physical directional utility drift.

## 18. Light, dark, and per-user primary accent

Responsive variants must not alter semantic colour ownership.

At every breakpoint:

- surfaces use Relay surface tokens;
- text uses Relay text tokens;
- semantic feedback uses danger/success/warning roles;
- saturated primary actions use `primary` with `on-fill` where appropriate;
- the user's dynamic `primary` accent remains the same semantic role;
- dark mode is an independently designed theme, not a responsive variant;
- viewport width must never choose a hardcoded product colour.

A layout may change columns or spacing at `md`. It may not switch to a separate tablet palette.

## 19. Spacing, radius, elevation, and motion

Tablet responsive work must reuse Relay's existing visual hierarchy.

Do not introduce tablet-specific arbitrary values when current tokens can express the role.

Examples:

- cards keep `rounded-card` rather than gaining a larger radius only on tablet;
- sheets/dialogs keep `rounded-sheet` according to their presentation contract;
- card and lifted overlay shadows keep `shadow-card` and `shadow-lift` roles;
- non-essential motion continues to respect reduced-motion preferences.

Spacing can increase progressively at `md` when it improves scanability, but the increase should be restrained and consistent with adjacent surfaces.

## 20. Content visibility

Responsive hiding is allowed only when it does not remove required functionality or information.

Before applying `hidden md:block`, `md:hidden`, or similar patterns, verify:

- the hidden content is duplicated through an equivalent semantic path, or is genuinely optional decoration;
- no focusable descendant becomes visually hidden but keyboard reachable;
- no accessible name or description references hidden-only content incorrectly;
- analytics and side effects are not duplicated by rendering two active copies of the same control;
- SSR and hydration do not depend on a JavaScript viewport measurement.

Prefer one adaptive component tree over two separately maintained mobile/tablet trees.

## 21. Container queries

Container queries may be introduced for reusable components whose correct layout depends on their allocated container rather than the viewport.

They are not the default replacement for Tailwind viewport breakpoints.

Use a container query only when:

- the same reusable component appears in materially different parent widths at the same viewport size; and
- a viewport rule would therefore produce the wrong composition in at least one valid placement.

If introduced, document the container contract in the Relay primitive and add focused tests/preview coverage. Do not scatter feature-specific arbitrary container thresholds through templates.

## 22. JavaScript viewport APIs

Do not use `window.innerWidth`, user-agent strings, orientation checks, or a global `isTablet` signal for ordinary layout.

JavaScript viewport observation is acceptable only when behaviour cannot be expressed through CSS, for example a non-visual performance policy that genuinely depends on rendered capacity. Such use requires a separate documented product reason and SSR-safe behaviour.

Responsive presentation belongs in CSS.

## 23. Migration examples

### Example A: stacked summary becomes a two-column tablet layout

Before:

```html
<div class="space-y-4">
  <app-card />
  <app-card />
</div>
```

After:

```html
<div class="grid gap-4 md:grid-cols-2">
  <app-card class="min-w-0" />
  <app-card class="min-w-0" />
</div>
```

Use this only when both cards remain useful side by side with realistic translations and user content.

### Example B: action stack gains a tablet row

```html
<div class="flex flex-col gap-3 md:flex-row md:justify-end">
  <app-button-secondary customClass="w-full md:w-auto" />
  <app-button-primary customClass="w-full md:w-auto" />
</div>
```

The semantic action order stays the same.

### Example C: supporting pane without DOM reordering

```html
<div class="grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
  <main class="min-w-0">...</main>
  <aside class="min-w-0">...</aside>
</div>
```

Do not use CSS ordering to make the visual tablet order contradict the reading order.

### Example D: avoid device detection

Prohibited:

```ts
if (navigator.userAgent.includes('iPad')) {
  this.tabletLayout.set(true);
}
```

Use responsive CSS instead.

## 24. Prohibited patterns

The following are prohibited in new or migrated responsive UI unless a documented exception is approved:

- custom global breakpoint values for named devices;
- `isTablet`, `isIPad`, or user-agent-driven layout state;
- JavaScript width checks for ordinary CSS layout;
- fixed page widths that create document-level horizontal scrolling;
- physical-direction spacing or positioning utilities;
- hiding required actions at tablet widths without an equivalent accessible route;
- duplicated active mobile and tablet interaction trees;
- feature-owned focus or keyboard state introduced only for a tablet presentation;
- reducing touch targets to make a row fit;
- reducing text size to force translated content onto one line;
- viewport-specific hardcoded product colours;
- arbitrary breakpoint values such as `min-[820px]:...` when `md`/`lg` or flexible layout solves the need;
- converting presentation-only layout to Spartan Brain merely because it changes at a breakpoint;
- moving Tailwind class strings into translation data;
- making a desktop-style multi-column layout the only usable tablet state.

## 25. Verification contract

### Existing static gates

Responsive implementation changes must continue to pass the repository frontend verification commands:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

The RTL logical-direction guard is especially relevant because breakpoint-prefixed physical utilities are still physical-direction violations.

### Required responsive regression coverage

A changed surface should have focused tests that verify the contract that can be tested deterministically from component output, for example:

- the expected `md:`/`lg:` responsive class ownership;
- no feature-owned interactive semantics were added;
- action controls preserve native or Spartan disabled/focus semantics;
- required regions remain in one semantic DOM order;
- responsive hiding does not leave hidden focusable duplicates.

Do not write unit tests that pretend JSDOM performs real CSS layout.

### Rendered verification

Visual/layout behaviour must be verified in a browser-based preview or E2E path.

For a material tablet layout change, capture at minimum:

- 390px mobile baseline;
- 768px tablet portrait reference;
- 1024px tablet landscape / narrow desktop reference;
- a representative wider desktop state when the surface has a distinct `lg` composition;
- light and dark theme for theme-sensitive surfaces;
- an RTL state for direction-sensitive composition;
- representative long translated copy where labels drive layout.

The exact device emulation profile is not authoritative. The CSS viewport width is.

## 26. Proposed guard for follow-up implementation

The repository should add a rendered responsive-baseline guard rather than a source-code rule that bans legitimate Tailwind patterns.

Recommended follow-up:

1. Extend the existing design-preview/Cypress visual infrastructure.
2. Add canonical viewport presets for 390, 768, 1024, and a wide desktop reference.
3. Capture only mapped representative surfaces, not every route at every width.
4. Fail on document-level horizontal overflow.
5. Assert mapped primary actions remain visible and reachable.
6. Include RTL and long-copy fixtures on selected high-risk surfaces.
7. Keep the viewport list central so individual feature tests do not invent device-specific constants.

A small source guard may additionally flag new arbitrary viewport utilities such as `min-[...]`/`max-[...]` for review, but it must not reject valid component-specific container queries.

## 27. Design-preview and Claude Design contract

When a ticket materially changes tablet composition:

- update the mapped `frontend/design-preview/` surface;
- include a tablet state rather than only mobile and desktop screenshots;
- preserve the same Relay token roles across viewport variants;
- record design-sync reconciliation metadata according to repository policy;
- avoid separate tablet-only component implementations in the design mirror when runtime uses one adaptive component.

The runtime repository remains the source of truth. Design previews demonstrate the responsive contract; they do not define a second breakpoint system.

## 28. Review checklist

For every tablet-responsive migration, reviewers should ask:

- Does the base layout remain complete and usable before any breakpoint variant?
- Is `md` used because the composition improves, not because a device was named?
- Is `lg` reserved for genuinely desktop-like changes?
- Can every grid/flex child containing long content shrink?
- Is document-level horizontal scrolling absent?
- Does semantic DOM order remain logical when columns appear?
- Are touch targets unchanged or improved?
- Do long translations still fit without shrinking text?
- Do RTL and logical direction remain correct?
- Do light/dark and dynamic primary accents retain the same semantic roles?
- Did Spartan remain the interaction owner where applicable?
- Are only optional/decorative regions hidden responsively?
- Does the layout survive high zoom and reflow?
- Is the design preview reconciled for a material visual contract change?

## 29. Rollback

Responsive migrations should be independently reversible.

A rollback may remove a tablet composition enhancement and return to the valid mobile-first single-column layout. It must not:

- reintroduce device detection;
- bypass Relay tokens;
- replace Spartan interaction semantics with feature-owned behaviour;
- restore physical-direction CSS;
- remove required content or accessible semantics.

Because this architecture standard is documentation-only, reverting it has no runtime, API, persistence, analytics, or schema impact.

## 30. Decision summary

The canonical HelloTalk tablet responsive policy is:

1. Keep Tailwind's standard breakpoints.
2. Build a complete mobile-first base layout.
3. Treat `md` as the default tablet composition opportunity, not a mandatory layout switch.
4. Reserve `lg` for genuinely desktop-like composition.
5. Use flexible CSS layout instead of device detection.
6. Keep feature layout, Relay presentation, and Spartan interaction ownership separate.
7. Preserve semantic order, touch size, localisation, RTL, themes, dynamic accent, and high-zoom reflow at every width.
8. Verify material changes at 390, 768, 1024, and a representative wider desktop viewport through the existing browser-based visual infrastructure.

This contract supplies the architecture baseline required by `[Spartan UI 0045]` and gives subsequent conversion tickets a consistent tablet target without introducing a new breakpoint system.
