# 200 percent zoom behaviour

Status: authoritative implementation contract for the Relay + Spartan UI migration.

This document defines the repository-wide contract for browser zoom at 200 percent. It supplements `DESIGN.md`, `docs/spartan-relay-architecture.md`, and `docs/390px-mobile-baseline.md`. It does not create a second responsive system, token system, accessibility layer, or zoom-specific component library.

## 1. Scope

The 200 percent zoom contract applies to every user-facing Angular route, reusable Relay primitive, Spartan composition, dialog, sheet, form, navigation surface, table, list, card, media surface, and state view.

At 200 percent browser zoom, required content and actions must remain available without loss of information or functionality. Layout may reflow, wrap, stack, scroll locally, or change responsive composition, but the product must not depend on the user zooming back out to complete a task.

This standard covers:

- layout and reflow;
- readable text and user-generated content;
- forms and validation;
- touch, keyboard, pointer, and screen-reader interaction;
- dialogs, sheets, popovers, menus, and other overlays;
- fixed and sticky regions;
- tables, grids, media, charts, and canvases;
- light and dark themes;
- per-user primary accents;
- RTL and mixed-direction content;
- long translations and complex scripts;
- loading, empty, error, pending, disabled, and destructive states;
- design-preview and automated verification expectations.

This document does not change APIs, routes, persistence, analytics, or product behaviour by itself.

## 2. Current implementation audit

The repository already establishes the correct architectural direction:

- `docs/spartan-relay-architecture.md` requires required content and actions to remain available at 200 percent and 400 percent zoom/reflow.
- `docs/390px-mobile-baseline.md` treats high zoom as part of responsive behaviour rather than a separate layout mode.
- Tailwind remains mobile-first and the repository does not define a special zoom breakpoint.
- Relay owns reusable product presentation, spacing, typography, surface, radius, shadow, and responsive defaults.
- Spartan Brain and Helm own generic interaction mechanics such as focus management, dialog dismissal, selection, and keyboard state machines.
- Feature code owns product-specific composition and may decide when dense desktop layouts collapse into stacked or simplified compositions.
- Existing UI audits repeatedly require `min-w-0`, safe wrapping, internally scrollable overlays, logical directional utilities, touch-sized actions, and reduced-motion behaviour.

The current architecture is correct in not treating 200 percent zoom as a CSS media-query state. Browser zoom changes the effective CSS viewport and text metrics. Correct responsive composition should naturally adapt without a `@media (zoom: ...)` rule, JavaScript zoom detection, or duplicated templates.

The migration backlog also exposes recurring risks that this standard consolidates:

- fixed inline sizes that overflow once the effective viewport narrows;
- fixed block sizes that clip translated or wrapped text;
- action rows that cannot wrap or stack;
- flex/grid children that omit `min-w-0`;
- `truncate`, `line-clamp-*`, or overflow clipping applied to required information;
- viewport-fixed actions that cover content when the available block size shrinks;
- dialogs whose content or footer becomes unreachable;
- tables whose only usable form assumes a wide desktop viewport;
- focus rings clipped by overflow containers;
- hover-only actions that become impractical as content density changes;
- duplicated desktop/mobile DOM trees that expose both copies to assistive technology;
- visual verification that captures normal scale but never exercises reflow.

## 3. Definition of 200 percent zoom compliance

A surface is compliant when a user can zoom the browser to 200 percent and still:

1. perceive all required content;
2. reach every required control;
3. understand the relationship between labels, controls, errors, and supporting text;
4. complete the same product task without zooming out;
5. navigate by keyboard without focus becoming hidden or trapped by layout;
6. use touch or pointer targets without controls overlapping each other;
7. consume the same semantic reading order with assistive technology;
8. use both light and dark themes and the configured primary accent;
9. use RTL and translated content without introducing physical-direction regressions.

Horizontal scrolling is not permitted for ordinary page content. A locally bounded horizontal scroller is acceptable when horizontal navigation is intrinsic to the content, such as a data table, timeline, or intentionally scrollable pill row, provided the page itself does not overflow and essential actions remain discoverable.

## 4. Zoom is responsive reflow, not a separate product mode

Do not detect browser zoom in Angular to choose a special template.

Do not add code such as:

```ts
const zoom = window.devicePixelRatio;
if (zoom >= 2) {
  this.zoomed = true;
}
```

Do not add a custom Tailwind `zoom200` screen or a one-off media query intended to identify browser zoom.

Instead, build flexible layouts that respond to the effective viewport:

```html
<div class="flex min-w-0 flex-col gap-3 md:flex-row md:items-start">
  <section class="min-w-0 flex-1">...</section>
  <aside class="w-full md:w-80">...</aside>
</div>
```

At normal desktop scale this may be multi-column. When browser zoom reduces the effective viewport, the normal responsive rules collapse the composition.

## 5. Layout contract

### 5.1 Inline sizing

Normal content must remain within the available inline size.

Preferred tools include:

- `w-full` and `max-w-full`;
- `min-w-0` on flex/grid children containing text or controls;
- `flex-wrap` where actions may wrap;
- responsive stacking for multi-column layouts;
- `break-words` or another safe wrapping strategy for untrusted long text;
- `overflow-x-auto` only on a deliberately local horizontal region.

Avoid large fixed widths and minimum widths for ordinary application content.

Do not hide layout defects with a page-level `overflow-x-hidden`. That can make focused controls, translated text, and off-screen content unreachable.

### 5.2 Block sizing

User-facing content should normally grow with its text.

Avoid fixed heights on:

- cards containing translated descriptions;
- form fields plus validation/help text;
- alerts and banners;
- navigation items with labels;
- dialog bodies;
- empty/error/loading state containers.

Where a block size must be bounded, provide a deliberate internal scrolling region and ensure keyboard focus can scroll into view.

### 5.3 Grids and multi-pane layouts

Dense desktop grids should collapse as available width decreases.

At 200 percent zoom:

- two or three columns may become one column;
- master/detail panes may stack or use an existing route/sheet pattern;
- fixed sidebars may become the repository's normal compact navigation composition;
- card grids should not preserve a desktop column count by shrinking content below usable dimensions.

Feature code owns the product composition. Relay primitives own reusable responsive defaults. Spartan does not own feature breakpoint policy.

## 6. Text and content reflow

Text must reflow without loss.

Required content must not be hidden with:

- `truncate`;
- `line-clamp-*`;
- fixed-height clipping;
- `overflow-hidden` used solely to force a desktop visual height.

Those patterns remain acceptable for explicitly preview-only content when the complete value is available through the same task flow and the truncation is part of the product contract.

At 200 percent zoom, verify:

- long translations;
- long usernames;
- URLs and unbroken user-generated tokens;
- CJK content;
- Arabic, Persian, Hebrew, and mixed-direction text;
- Devanagari and other complex scripts;
- dynamic dates, counts, prices, and status labels.

Do not reduce font size to make a desktop layout fit. Reflow the layout instead.

## 7. Forms

Forms must remain operable at 200 percent zoom.

Required behaviour:

- visible labels remain associated with their controls;
- help and validation text remains readable and associated;
- inputs and textareas fit their containers;
- grouped fields may stack when horizontal composition becomes cramped;
- action groups may wrap or stack;
- pending and disabled states remain programmatically exposed;
- the focused field can be scrolled into view;
- the only submit/cancel action cannot be covered by a sticky region or overlay.

Validation errors must not depend on a fixed position next to the field. Inline error content should be allowed to wrap.

## 8. Action groups and touch targets

Zoom does not reduce the repository's touch-target requirement.

Controls must retain the shared touch-size contract where applicable. If labels wrap, controls may grow in block size rather than becoming smaller.

Preferred narrow composition:

```html
<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
  <button hlmBtn variant="outline" size="touch">...</button>
  <button hlmBtn size="touch">...</button>
</div>
```

Do not force multiple labelled actions onto one line by reducing padding, font size, or target dimensions.

## 9. Keyboard and focus

Responsive reflow must preserve deterministic keyboard operation.

At 200 percent zoom:

- focus order follows the meaningful product order;
- visible focus is not clipped by local overflow containers;
- focused controls are scrollable into view;
- responsive visual reordering must not produce a confusing semantic order;
- hidden desktop/mobile duplicates must not both remain focusable;
- native links and buttons retain native keyboard behaviour;
- Spartan-owned roving focus, listbox, menu, dialog, and combobox behaviour remains authoritative.

Do not add feature-owned keyboard handlers merely because layout changes at high zoom.

## 10. Screen-reader semantics

Zoom-driven responsive changes must not change the accessibility tree into a contradictory structure.

If the visual composition replaces or hides a region:

- use one semantic source where practical;
- if duplicate renderings are unavoidable, ensure only the active copy is exposed to assistive technology and focus;
- preserve accessible names and relationships across responsive states;
- keep loading, error, success, and pending announcements intact.

A control that remains visually available but loses its label or description at the narrower effective viewport is not compliant.

## 11. Dialogs, sheets, popovers, and menus

Overlays must remain fully operable at 200 percent zoom.

### Dialogs and sheets

- use approved Spartan Dialog/Sheet interaction mechanics;
- constrain the shell to the visual viewport;
- allow the content region to scroll internally when necessary;
- allow long headings, descriptions, and validation text to wrap;
- keep required actions reachable;
- avoid fixed desktop widths without `w-full`/`max-w-*` containment;
- avoid fixed desktop heights that can move the footer off-screen;
- keep focus trapping, Escape handling, and restoration owned by Spartan.

### Popovers and menus

- do not assume enough space exists below or to the physical right of the trigger;
- use the primitive's placement/collision behaviour;
- ensure menu items and options remain touch/keyboard usable;
- use logical layout for directional content.

A feature must not switch to a hand-built overlay at high zoom to work around a layout issue.

## 12. Sticky and fixed regions

Sticky headers, bottom navigation, floating actions, and other viewport-attached UI need explicit reflow review.

At 200 percent zoom:

- fixed regions must not permanently cover required content;
- the document must provide sufficient scroll padding/space for obscured edges where necessary;
- sticky toolbars may wrap or simplify according to the normal responsive contract;
- essential controls must not become unreachable behind browser chrome or another application layer.

Avoid multiple stacked sticky regions whose combined block size consumes most of the viewport.

## 13. Tables and dense data

Tables may use a local horizontal scrolling container when preserving column relationships is necessary.

The contract is:

- the table scroller is locally bounded;
- the document does not horizontally overflow;
- keyboard focus can reach cells/controls and scroll them into view;
- row actions remain operable;
- headers remain semantically associated;
- critical information is not available only through hover;
- a responsive card/list alternative may be used when it is the established product representation, but must not duplicate contradictory semantics.

Do not shrink table text below the normal typography contract to avoid scrolling.

## 14. Media, charts, canvases, and editors

Visual media must stay within the available inline size.

At 200 percent zoom:

- images and video use bounded responsive dimensions;
- canvas/editor shells do not force page overflow;
- overlaid controls preserve touch/focus targets;
- meaningful chart data has an accessible textual or tabular representation where required by the feature contract;
- specialised tools such as image crop or doodle interactions can retain feature/library ownership while their surrounding controls and overlays follow Relay/Spartan.

Zooming must not crop away the only control for closing, saving, replaying, or cancelling a media interaction.

## 15. RTL and localisation

The same reflow contract applies in both directions.

Directional layout must use logical utilities and properties:

- `ps-*` / `pe-*`;
- `ms-*` / `me-*`;
- `start-*` / `end-*`;
- `border-s-*` / `border-e-*`;
- `inset-inline-*`, `margin-inline-*`, and equivalent logical CSS.

Do not add LTR-only high-zoom patches with physical `left`, `right`, `margin-left`, `padding-right`, or equivalent Tailwind utilities.

High zoom is especially likely to expose direction bugs because formerly inline content starts wrapping. Verify Arabic/RTL layouts after action groups stack or text wraps onto multiple lines.

## 16. Theme and token parity

Zoom must not introduce a separate visual system.

At 200 percent:

- light and dark themes remain independently valid;
- dynamic `primary` accents remain valid;
- text on saturated fills uses the Relay `on-fill` role;
- surfaces, borders, radii, shadows, typography, and semantic states continue using Relay roles;
- responsive variants must not introduce hard-coded product colours or theme-specific geometry.

The same DOM state should be able to render correctly under both themes without changing product semantics.

## 17. Reduced motion

Zoom and reduced motion are independent accessibility requirements and must compose correctly.

When layout changes due to the effective viewport:

- do not add non-essential animated rearrangement just to smooth the transition;
- existing non-essential motion must continue honouring `prefers-reduced-motion`;
- loading skeletons and state transitions should follow the repository motion token/primitive contract.

## 18. Migration examples

### Example A: fixed card width

Before:

```html
<article class="w-[42rem] rounded-xl p-6">...</article>
```

After:

```html
<article class="w-full min-w-0 rounded-card p-4 sm:p-6">...</article>
```

The card now responds to the effective viewport without detecting zoom.

### Example B: fixed two-column form

Before:

```html
<div class="grid grid-cols-2 gap-4">...</div>
```

After:

```html
<div class="grid grid-cols-1 gap-4 md:grid-cols-2">...</div>
```

Browser zoom naturally crosses the normal responsive boundary when the effective viewport narrows.

### Example C: clipped flex content

Before:

```html
<div class="flex items-center gap-3">
  <p class="truncate">{{ description }}</p>
  <button hlmBtn>...</button>
</div>
```

After:

```html
<div class="flex items-start gap-3">
  <p class="min-w-0 flex-1 break-words">{{ description }}</p>
  <button hlmBtn size="touch">...</button>
</div>
```

Required text reflows while the action remains usable.

### Example D: fixed dialog

Before:

```html
<div class="h-[640px] w-[720px] overflow-hidden">...</div>
```

After:

Use the approved Spartan Dialog with a `w-full max-w-*` Relay shell and an internally scrollable content region bounded by the dynamic viewport. Keep footer actions in normal document flow or a deliberate dialog layout that remains reachable.

### Example E: physical-direction patch

Before:

```html
<div class="ml-4 right-0">...</div>
```

After:

```html
<div class="ms-4 end-0">...</div>
```

The reflow fix remains valid for RTL.

## 19. Prohibited patterns

The following are prohibited in new or migrated UI unless a documented product requirement justifies a narrowly scoped exception:

- detecting browser zoom in application code;
- `@media` rules intended to identify a zoom factor;
- a custom Tailwind `zoom200` breakpoint;
- duplicate 100-percent and 200-percent templates;
- fixed page widths that exceed the available inline size;
- large minimum widths on normal content;
- fixed heights that clip required translated/user content;
- page-level `overflow-x-hidden` used to conceal overflow bugs;
- shrinking typography or touch targets to retain desktop density;
- required actions available only on hover;
- truncating required information solely to make a row fit;
- physical-direction utilities added as high-zoom fixes;
- feature-owned focus traps, menu keyboard logic, or dialog dismissal introduced for zoom handling;
- hard-coded product colours or a separate high-zoom theme;
- visual-only high-zoom verification with no interaction/reflow assertions.

## 20. Exceptions

Some product content is intrinsically two-dimensional or wider than the viewport. Examples include data tables, timelines, maps, code blocks, and some editing surfaces.

An exception is acceptable only when:

1. scrolling is local to that content region;
2. the document itself does not overflow;
3. essential application actions remain outside or safely reachable within the scroller;
4. keyboard and assistive-technology access remains usable;
5. the exception is documented in the component/feature contract;
6. a more accessible alternate representation is provided where the content semantics require it.

Exceptions must not become a general justification for desktop-only layout.

## 21. Verification contract

Issue #5522 should add the smallest effective automated migration gate based on this standard.

The preferred verification layers are:

### Structural checks

A repository guard should detect newly introduced high-risk patterns in changed frontend UI, including:

- large fixed/minimum inline sizes on normal feature containers;
- new physical directional utilities;
- page-level overflow suppression used as a workaround;
- feature-owned zoom detection;
- fixed dialog dimensions without responsive containment.

The guard should be migration-safe: existing debt can be baselined, while newly introduced violations fail the PR.

### Rendered browser checks

Representative visual-contract screens should be exercised at a 200-percent text/zoom-equivalent state in both light and dark themes. At minimum, the browser check should assert:

- no document-level horizontal overflow;
- required state/actions remain present;
- the expected theme and direction are active;
- text scaling/reflow is actually applied;
- representative dialogs or dense layouts retain reachable content when included in the state matrix.

The existing visual-contract framework is the preferred home for this coverage rather than a new screenshot system.

### Focused component tests

When a component is migrated, tests should lock its own high-zoom contract where useful, especially for:

- action wrapping/stacking;
- internal dialog scrolling;
- `min-w-0` and long-content wrapping;
- responsive control sizing;
- semantic hiding of alternate responsive presentations.

### Required implementation verification

For frontend implementation changes, continue to run the canonical frontend gate documented by `docs/spartan-relay-architecture.md`:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

Issue #5522 should document its additional zoom-specific command and stable failure messages once the gate exists.

## 22. Design preview and Claude Design

This architecture document does not itself change a visual contract, so it does not require a new design-preview screenshot.

When a later implementation changes responsive composition to satisfy this standard:

- update the mapped design-preview state;
- preserve light and dark examples;
- include the relevant narrow/high-zoom state when the change is material;
- keep repository code as runtime source of truth and Claude Design/design-preview as the visual contract mirror.

## 23. Rollout and rollback

This standard is documentation-only and has no runtime rollout risk.

Implementation PRs that follow it should remain independently revertible. A rollback may restore the previous composition while a regression is investigated, but it must not intentionally restore inaccessible clipping, unreachable actions, physical-direction layout, or feature-owned interaction mechanics that violate the repository architecture.

Verification gates introduced by #5522 should be migration-safe and narrowly scoped so rollback does not require disabling unrelated accessibility checks.

## 24. Definition of done for migrated surfaces

A surface is complete for the 200 percent zoom contract when:

- required content reflows without loss;
- required actions remain reachable and operable;
- the document does not horizontally overflow for ordinary content;
- local horizontal scrollers are deliberate and bounded;
- forms, labels, errors, and help relationships remain intact;
- focus order and visible focus remain usable;
- overlays remain within the visual viewport and required actions are reachable;
- touch targets are not reduced to preserve density;
- RTL and long translations remain valid after wrapping/stacking;
- light/dark themes and dynamic accent behaviour remain valid;
- no zoom detection or duplicate zoom-specific template was introduced;
- focused tests and visual-contract coverage are updated where the surface changed materially;
- canonical frontend verification passes.

This contract resolves the architecture work in `[Spartan UI 0055]` and defines the implementation target for `[Spartan UI 0056]`.
