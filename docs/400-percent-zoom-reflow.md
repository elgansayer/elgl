# 400 percent zoom and reflow behaviour

Status: authoritative implementation contract for the Relay + Spartan UI migration.

This document defines the repository-wide contract for browser zoom and text reflow at 400 percent. It supplements `DESIGN.md`, `docs/spartan-relay-architecture.md`, `docs/390px-mobile-baseline.md`, and `docs/200-percent-zoom-behaviour.md`. It does not create a second breakpoint system, token system, accessibility layer, or zoom-specific component library.

## 1. Scope

The 400 percent contract applies to every user-facing Angular route, reusable Relay primitive, Spartan composition, dialog, sheet, form, navigation surface, table, list, card, media surface, editor, and loading/empty/error state.

At 400 percent browser zoom, required information and controls must remain available without loss of content or functionality. The product may reflow into a substantially narrower composition, but a user must not need to zoom out to read required content, reach an action, dismiss an overlay, or finish a task.

This standard covers:

- extreme narrow-width reflow;
- text and user-generated content;
- forms and validation;
- navigation and multi-pane layouts;
- touch, pointer, keyboard, and screen-reader interaction;
- dialogs, sheets, popovers, menus, and other overlays;
- fixed and sticky regions;
- tables, grids, media, charts, canvases, and editors;
- light and dark themes;
- per-user primary accents;
- RTL and mixed-direction content;
- CJK, Arabic, Devanagari, and other complex scripts;
- loading, empty, unavailable, pending, disabled, and destructive states;
- design-preview and automated migration verification.

This document does not change API, routing, persistence, analytics, or product semantics by itself.

## 2. Relationship to the 200 percent standard

`docs/200-percent-zoom-behaviour.md` remains the general high-zoom contract. The 400 percent standard adds stricter requirements for the point where desktop and tablet density can no longer be assumed.

The same architectural rule applies at both scales: zoom is a responsive-reflow problem, not a separate application mode.

Do not:

- detect `devicePixelRatio` or infer browser zoom in Angular;
- create a `zoom400` Tailwind breakpoint;
- maintain separate 100%, 200%, and 400% templates;
- shrink typography or touch targets to preserve a wide layout;
- hide required content to make a screenshot fit.

At 400 percent, a layout should naturally behave like an extremely narrow effective viewport. A 1280 CSS-pixel desktop viewport viewed at 400 percent is commonly used as the reference case for roughly 320 CSS pixels of available inline space. The repository should therefore remain usable at approximately 320 CSS pixels as well as at its normal 390px mobile verification baseline.

The 320px reference is a verification condition, not a new product breakpoint.

## 3. Current implementation audit

The repository already establishes most of the correct architecture:

- `DESIGN.md` requires a 390px mobile-first composition and accessible responsive behaviour.
- `docs/spartan-relay-architecture.md` requires required content and actions to remain usable at 200 percent and 400 percent zoom.
- `docs/390px-mobile-baseline.md` treats high zoom as part of normal responsive composition rather than a dedicated device mode.
- `docs/200-percent-zoom-behaviour.md` already prohibits zoom detection, zoom-specific breakpoints, duplicated templates, page-level overflow masking, and touch-target reduction.
- Tailwind remains mobile-first with standard breakpoints rather than application-specific zoom screens.
- Relay owns reusable product presentation, semantic surfaces, typography, radii, shadows, spacing, and responsive defaults.
- Spartan Brain and Helm own generic interaction mechanics including focus management, dialog dismissal, selection, and keyboard state machines.
- Feature code owns product-specific information hierarchy and may collapse dense desktop compositions when available width becomes small.
- Existing visual-contract work already includes 200 percent and 400 percent text-scale states on representative surfaces.

The remaining migration risk is consistency. At 400 percent, defects that are survivable at 200 percent become task blockers. Common examples include:

- a two-column layout that never collapses below `md` because a child has a large `min-width`;
- a toolbar whose last action is pushed outside the viewport;
- fixed dialog headers and footers consuming nearly all available block size;
- long translations or user content being truncated where no alternate full value is available;
- horizontal page overflow hidden by `overflow-x-hidden`;
- sticky navigation covering focused fields;
- a desktop table whose local scroller also causes document-level overflow;
- visual reordering that leaves keyboard and screen-reader order behind;
- duplicate mobile/desktop DOM trees that are both exposed to assistive technology;
- controls that retain desktop padding assumptions and collide when labels wrap;
- absolute-positioned adornments or badges covering text after line wrapping;
- icon-only controls losing an accessible name when surrounding visible text disappears;
- physical left/right spacing patches failing in RTL when content wraps to several lines.

This document consolidates the expected solution rather than creating feature-specific workarounds.

## 4. Definition of compliance

A user at 400 percent zoom must be able to:

1. perceive every required piece of information;
2. reach every required control;
3. complete the same task without reducing zoom;
4. understand labels, descriptions, errors, status, and control relationships;
5. navigate by keyboard in a predictable order;
6. see focused controls without them being clipped or permanently covered;
7. use touch/pointer controls without overlapping targets;
8. operate dialogs, sheets, menus, popovers, and other overlays;
9. use light and dark themes with the configured primary accent;
10. use RTL and translated content without physical-direction regressions;
11. receive equivalent screen-reader semantics after responsive reflow.

Normal page content must not require two-dimensional scrolling. Horizontal scrolling is permitted only inside a deliberately bounded region where horizontal navigation is intrinsic to the content, such as a data table, timeline, code sample, or intentionally scrollable chip row.

A local horizontal scroller is compliant only when:

- the document itself does not overflow horizontally;
- the scroller has a clear boundary;
- keyboard focus can bring off-screen controls/content into view;
- essential task actions are not hidden only at the far end of the scroller;
- screen-reader relationships remain meaningful.

## 5. Effective-width contract

### 5.1 No new 320px breakpoint

Approximately 320 CSS pixels is a required verification width for 400 percent reflow, not a Tailwind screen.

Preferred:

```html
<section class="w-full min-w-0 ps-3 pe-3 sm:ps-4 sm:pe-4">
  ...
</section>
```

Prohibited solely for zoom compliance:

```html
<section class="max-[320px]:...">
  ...
</section>
```

and:

```js
screens: {
  zoom400: '320px',
}
```

If a layout fails below 390px, fix the base flexible composition rather than targeting one exact width.

### 5.2 Base layout must survive below the normal mobile baseline

The repository designs mobile-first at 390px, but high zoom can create a narrower effective viewport. Base styles therefore need enough flexibility to remain usable below 390px.

This does not mean every screen must be visually identical at 320px and 390px. It means:

- content can wrap;
- actions can stack;
- grids can become one column;
- optional decoration can reduce according to an existing responsive/content-priority contract;
- required information and controls remain present.

## 6. Layout and containment

### 6.1 Inline-size rules

Every normal content container must be able to shrink to the available inline size.

Use as appropriate:

- `w-full`;
- `max-w-full`;
- `min-w-0` on flex/grid children that contain text, controls, or nested layouts;
- `flex-wrap` for action/metadata rows;
- single-column base grids;
- `break-words` for untrusted long tokens;
- `overflow-wrap: anywhere` only where product content can otherwise create unavoidable overflow;
- local `overflow-x-auto` for genuinely horizontal data.

Avoid:

- large fixed widths;
- large `min-width` values on ordinary content;
- `whitespace-nowrap` on required labels or values unless horizontal scrolling is the deliberate interaction;
- absolute positioning that assumes one-line text;
- page-level `overflow-x-hidden` used to conceal defects.

### 6.2 Block-size rules

At 400 percent, text wrapping can multiply component height. User-facing containers should grow naturally.

Avoid fixed heights on:

- cards with descriptions;
- form rows with validation/help text;
- alerts and banners;
- navigation labels;
- empty/error/loading states;
- dialog content;
- translated headings;
- user-generated content.

When a viewport-bound surface needs a maximum height, use a deliberate internal scrolling region and keep dismissal/completion actions reachable.

### 6.3 Multi-column and multi-pane layouts

Dense desktop layouts must collapse before they become unusable.

At 400 percent:

- multi-column forms normally become one column;
- card grids normally become one column;
- master/detail layouts may stack, route to detail, or use an approved sheet pattern;
- persistent desktop sidebars should yield to the repository's compact/mobile navigation pattern when normal responsive rules require it;
- secondary inspector panes must not leave the primary task narrower than its usable minimum.

Do not preserve a desktop composition by shrinking content, typography, or controls.

## 7. Text and language reflow

Required text must remain readable in full unless the product explicitly defines it as a preview with an accessible route to the complete value.

At 400 percent verify:

- long translated labels and headings;
- long usernames and display names;
- user-authored paragraphs;
- URLs and unbroken identifiers;
- CJK content;
- Arabic/Persian/Hebrew and mixed-direction text;
- Devanagari and other combining/complex scripts;
- dates, prices, counts, and dynamic status text;
- inline error messages;
- status badges and chips that can wrap.

Required information must not be made to fit using:

- `truncate`;
- `line-clamp-*`;
- fixed-height clipping;
- tiny type variants;
- an ellipsis without an accessible full value.

A preview may remain truncated when the same task exposes the full content through an obvious, keyboard-accessible interaction.

Do not split grapheme clusters or complex-script shaping to force wrapping. Browser text shaping and language-aware segmentation remain authoritative.

## 8. Forms and validation

Forms must remain complete at 400 percent.

Required behaviour:

- every input keeps its accessible name;
- descriptions and errors remain associated with the corresponding control;
- inputs, textareas, selects, and composite controls fit their containers;
- horizontal field groups stack when labels or values no longer fit;
- action rows wrap or stack;
- pending state remains programmatically exposed;
- disabled controls remain visibly and semantically disabled;
- focused controls can scroll into view above virtual keyboards/sticky regions;
- validation text can grow without overlapping the next field;
- the only submit/cancel action cannot become unreachable.

Do not move validation into hover-only tooltips to save vertical space.

## 9. Actions and touch targets

400 percent zoom does not relax touch-target requirements.

Controls must retain the repository's shared touch sizing where applicable. A wrapped label can make a button taller; it must not make the target smaller.

Preferred narrow composition:

```html
<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
  <button hlmBtn variant="outline" size="touch">...</button>
  <button hlmBtn size="touch">...</button>
</div>
```

For icon-only controls:

- retain the shared icon-touch target;
- keep a translated accessible name;
- avoid absolute positioning that overlaps adjacent content after reflow.

Do not turn important actions into gestures-only interactions to save space.

## 10. Navigation

High zoom may change the navigation presentation, not the available destinations or permissions.

At 400 percent:

- required destinations remain reachable;
- native navigation remains a link rather than becoming a generic click target;
- responsive mobile/desktop variants do not both remain focusable or exposed to assistive technology;
- unread badges and status indicators do not obscure navigation labels;
- active-route semantics remain programmatically available;
- keyboard order follows the meaningful navigation order.

A collapsed menu, sheet, or bottom navigation may be used only if it is already an approved responsive product pattern.

## 11. Keyboard and focus

Reflow must preserve deterministic focus behaviour.

At 400 percent:

- focus order follows semantic task order;
- visible focus is never clipped by overflow containment;
- focused controls scroll into view;
- hidden responsive variants are removed from focus order;
- visual CSS ordering does not create a contradictory semantic order;
- native controls keep native keyboard semantics;
- Spartan-owned roving focus, dialog trapping, combobox/listbox/menu behaviour remains authoritative;
- Escape/dismiss behaviour does not change only because the layout is narrow.

Do not add feature-specific arrow/Enter/Space handlers to compensate for a poor high-zoom layout.

## 12. Screen-reader relationships

Responsive reflow must preserve the accessibility tree.

Requirements:

- headings maintain a meaningful hierarchy;
- landmarks retain accessible names where needed;
- `label`/control and `aria-labelledby`/`aria-describedby` relationships remain valid;
- loading, unavailable, error, success, and pending states remain announced according to the feature contract;
- responsive duplicate DOM trees must not expose duplicate controls or content;
- icon-only actions keep translated accessible names;
- content hidden only for visual density must not contain information required by non-visual users.

Do not solve high-zoom layout by removing the visible label while leaving only a vague icon name such as "Action" or "More" where context is required.

## 13. Dialogs and sheets

Dialogs and sheets are high-risk at 400 percent because both inline and block space become constrained.

Use approved Spartan interaction primitives. The responsive shell must:

- fit within the visual viewport;
- use `w-full` plus an appropriate maximum width rather than a fixed desktop width;
- allow headings/descriptions/form errors to wrap;
- provide an internally scrollable body when content exceeds available block size;
- keep required footer actions reachable;
- allow footer actions to wrap or stack;
- preserve focus trap, Escape handling, backdrop semantics, and focus restoration;
- account for virtual keyboards when the dialog contains inputs.

Avoid a layout in which both the header and footer are fixed while the remaining body becomes too small to reveal the active field.

Do not replace a Spartan dialog with a feature-owned full-screen overlay only for high zoom.

## 14. Popovers, menus, comboboxes, and tooltips

At 400 percent there may be little space around a trigger.

Requirements:

- use primitive-owned collision/placement logic;
- do not assume placement to the physical right or below;
- option text can wrap when the component contract permits it;
- long translated options remain understandable;
- keyboard navigation remains primitive-owned;
- the popup remains within the visual viewport;
- required information is not available only in a pointer-hover tooltip.

If a tooltip contains information required to complete a task, it should be redesigned as persistent help or an appropriate accessible disclosure instead.

## 15. Sticky and fixed regions

Viewport-attached UI needs explicit 400 percent review.

At this scale:

- sticky/fixed regions must not cover required content;
- multiple stacked sticky bars must not consume most of the viewport;
- the document or scroll container provides enough scroll padding for focused content;
- floating actions cannot obscure form fields, validation, or the only navigation path;
- bottom actions account for safe areas and the virtual keyboard;
- a sticky toolbar may wrap, simplify, or become normal-flow content under the established responsive contract.

Do not use `position: fixed` as a way to keep every desktop control simultaneously visible.

## 16. Tables and dense data

A table can retain a local horizontal scroller when column relationships are essential.

The page must still reflow around that scroller.

Required behaviour:

- the table's scroll container is `max-w-full`/locally bounded;
- the document itself does not overflow;
- column headers remain semantically associated;
- keyboard focus can scroll cells and row actions into view;
- important row actions are not hover-only;
- sticky columns/headers do not cover most of the usable region;
- an alternate card/list representation is permitted when it is the established product contract and does not create duplicate contradictory semantics.

Do not reduce data-table type below the normal typography contract to preserve desktop density.

## 17. Media, charts, canvases, and editors

Media surfaces must remain bounded by the available inline size.

At 400 percent:

- images/video use responsive dimensions;
- controls overlaying media remain reachable and named;
- crop/doodle/editor shells must not force document overflow;
- canvas tools may provide local pan/zoom when that is intrinsic to the editor, but surrounding product controls still reflow;
- meaningful chart data has an accessible textual/table representation where required;
- the only Save, Cancel, Close, Replay, or Send action cannot be clipped off-screen.

A specialised interaction can remain feature/library-owned while its shell, buttons, dialog, and product styling remain Relay/Spartan-compliant.

## 18. RTL and mixed-direction content

The same 400 percent contract applies in both directions.

Directional layout uses logical properties/utilities:

- `ps-*` / `pe-*`;
- `ms-*` / `me-*`;
- `start-*` / `end-*`;
- `border-s-*` / `border-e-*`;
- logical CSS such as `margin-inline`, `padding-inline`, and `inset-inline`.

Do not add `left`, `right`, `ml-*`, `mr-*`, `pl-*`, `pr-*`, `border-l-*`, or `border-r-*` as high-zoom fixes.

400 percent verification should include an RTL state because wrapping frequently exposes assumptions that are invisible in a one-line desktop row.

User-authored mixed-direction content should use the repository's existing language/direction boundaries rather than force the whole product row into one content direction.

## 19. Theme and primary-accent parity

High zoom does not create a different visual system.

At 400 percent:

- light and dark themes remain independently valid;
- per-user primary accent colours continue to work;
- saturated primary surfaces use the Relay `on-fill` text/icon role;
- surfaces, borders, radii, shadows, typography, and semantic state colours remain Relay-owned;
- high-zoom responsive variants do not introduce hard-coded product colours;
- focus treatment remains visible in both themes.

The same semantic DOM state should work under both themes without changing product meaning.

## 20. Reduced motion

Zoom and reduced motion must compose correctly.

Responsive collapse should not introduce new animated rearrangement. Existing non-essential animation continues to honour `prefers-reduced-motion`.

At 400 percent especially, avoid large transform-based entrance/exit animations that can move the only actionable control through or beyond a tiny effective viewport.

## 21. Performance and rendering

Do not solve 400 percent reflow by rendering duplicate desktop, tablet, mobile, and zoom DOM trees simultaneously.

Prefer:

- one semantic source with CSS responsive composition;
- lazy-loaded feature boundaries already used by Angular;
- bounded virtualised or paginated datasets where applicable;
- local overflow only where intrinsic to the content.

Excess duplicate DOM creates performance, focus-order, screen-reader, and state-synchronisation risks.

## 22. Migration examples

### Example A: desktop action row

Before:

```html
<div class="flex items-center justify-between gap-4 whitespace-nowrap">
  <p>{{ longStatusText }}</p>
  <div class="flex gap-2">...</div>
</div>
```

After:

```html
<div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
  <p class="min-w-0 break-words">{{ longStatusText }}</p>
  <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">...</div>
</div>
```

The base composition survives an extremely narrow effective viewport without detecting zoom.

### Example B: fixed dialog shell

Before:

```html
<div class="h-[640px] w-[720px] overflow-hidden">...</div>
```

After:

Use the approved Spartan Dialog with a mobile-safe `w-full max-w-*` Relay shell. Bound the shell to the dynamic viewport and make the content region scroll internally when necessary. Let footer actions stack rather than moving them outside the viewport.

### Example C: required text truncation

Before:

```html
<p class="truncate">{{ validationMessage }}</p>
```

After:

```html
<p class="min-w-0 break-words">{{ validationMessage }}</p>
```

Validation is required content, so it reflows rather than truncating.

### Example D: desktop grid

Before:

```html
<div class="grid min-w-[56rem] grid-cols-3 gap-6">...</div>
```

After:

```html
<div class="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">...</div>
```

Normal responsive rules naturally collapse the grid as zoom reduces effective width.

### Example E: physical-direction layout fix

Before:

```html
<div class="ml-3 right-0 border-l-2">...</div>
```

After:

```html
<div class="ms-3 end-0 border-s-2">...</div>
```

The reflow fix remains valid under RTL.

### Example F: viewport-attached submit action

Before:

```html
<button class="fixed bottom-0 right-0">Save</button>
```

After:

Keep the action in normal flow where practical. If the product requires a sticky action region, use the shared responsive shell, logical inset rules, safe-area treatment, enough scroll padding, and a layout that does not cover the active field or validation message.

## 23. Prohibited patterns

The following are prohibited in new or migrated UI unless a documented product requirement justifies a narrowly scoped exception:

- browser-zoom detection in application code;
- zoom-specific JavaScript state;
- `@media` rules intended to identify a 400 percent zoom factor;
- custom `zoom400` or `mobile320` Tailwind screens solely for this requirement;
- duplicate 100/200/400 percent templates;
- fixed page/container widths wider than the available inline size;
- large minimum widths on normal application content;
- page-level `overflow-x-hidden` used to conceal overflow;
- shrinking typography to retain a desktop layout;
- shrinking touch targets to retain a desktop action row;
- required content hidden by `truncate`, line clamp, or fixed-height clipping;
- required actions available only on hover or gesture;
- desktop/mobile duplicates simultaneously exposed to focus or assistive technology;
- feature-owned dialog focus traps or menu keyboard state machines;
- physical-direction CSS/Tailwind utilities added as a high-zoom patch;
- fixed overlay heights that make required controls unreachable;
- sticky/fixed UI that permanently covers focused or required content;
- rendering an entirely separate high-zoom product shell.

## 24. Exception policy

Some content is inherently two-dimensional or fixed-aspect, for example:

- complex data tables;
- timelines;
- code samples;
- maps;
- image crop canvases;
- doodle/canvas editors;
- certain charts.

An exception must be local to the content and must document:

1. why one-dimensional reflow would destroy essential meaning or interaction;
2. the bounded local scrolling/panning mechanism;
3. keyboard and screen-reader access;
4. how surrounding page content avoids horizontal overflow;
5. how close/save/cancel/navigation actions remain reachable;
6. light/dark, RTL, and 400 percent verification coverage.

The existence of a local exception does not permit page-level horizontal scrolling.

## 25. Design-preview contract

A visual-contract change affecting layout/reflow should include representative design-preview states when the surface is mapped by the repository design-sync manifest.

For migration verification, representative high-risk surfaces should cover:

- light theme at the 400 percent reflow state;
- dark theme at the 400 percent reflow state;
- an RTL 400 percent state;
- long translated or user-generated content where relevant;
- loading/error/pending states where those can change layout materially.

Documentation-only architecture work does not require a preview update because it changes no mapped visual surface.

## 26. Automated verification contract

Follow-up issue #5524 should implement the smallest effective migration-safe guard for this standard.

The preferred strategy is to extend the repository's existing visual-contract system rather than create a second high-zoom harness.

The guard should verify representative migrated screens at a 400 percent reflow state and fail when:

- the document exceeds the test viewport's inline size;
- required actions move outside the reachable viewport/scroll flow;
- a mapped 400 percent light/dark state is removed;
- required RTL coverage is removed;
- the harness stops applying the intended high-zoom/text-scale state;
- an approved local scroller leaks overflow to the document.

Where browser automation cannot set native browser zoom consistently, the repository may use its established high text-scale/effective-width simulation, provided the test documents what it approximates and separately retains narrow-viewport overflow checks.

A useful verification matrix is:

| State | Purpose |
| --- | --- |
| approximately 320px effective width, light | extreme narrow-width reflow |
| approximately 320px effective width, dark | theme parity |
| approximately 320px effective width, RTL | direction/wrapping parity |
| 390px mobile with 400% text scale | text growth and action stacking |
| overlay/form state at 400% | block-size scrolling and focus reachability |

The verification gate must remain read-only. It must not rewrite product code, snapshots, or design metadata during CI.

## 27. Manual verification checklist

Before declaring a migrated surface complete at 400 percent:

- zoom to 400 percent in a supported desktop browser;
- verify around 320 CSS pixels of effective inline space where practical;
- complete the primary task without zooming out;
- confirm no document-level horizontal scroll for normal content;
- tab through every interactive control;
- confirm focus remains visible and scrollable into view;
- open every relevant dialog/sheet/menu/popover;
- verify long translated/user content;
- verify light and dark themes;
- verify a non-default primary accent where the surface uses primary styling;
- verify RTL layout;
- verify loading, error, pending, and empty states where applicable;
- confirm touch-size actions have not been reduced;
- confirm fixed/sticky regions do not cover required content.

## 28. Migration sequence

For an individual feature migration:

1. inventory fixed widths/heights, minimum widths, truncation, local overflow, sticky/fixed regions, and responsive duplicates;
2. establish semantic/native/Spartan interaction ownership before changing layout;
3. make the base mobile composition shrink-safe with `min-w-0`, wrapping, and bounded media;
4. remove feature-owned geometry that belongs in Relay/shared primitives;
5. make action groups stack/wrap without reducing target size;
6. make overlays viewport-bounded and internally scrollable;
7. replace physical-direction patches with logical layout;
8. test long translations and user-generated content;
9. verify light/dark and primary-accent parity;
10. run 390px, 200 percent, and 400 percent verification;
11. reconcile mapped design-preview metadata if the visual contract changed;
12. add focused regression coverage for the failure mode being fixed.

## 29. Rollback

A rollback may restore the previous feature layout while a regression is investigated, but it must not intentionally restore:

- inaccessible required content;
- document-level overflow masked by clipping;
- substandard touch targets;
- invalid focus order;
- feature-owned replacements for Spartan interaction primitives;
- LTR-only physical-direction fixes;
- hard-coded theme colours that bypass Relay tokens.

If a 400 percent regression cannot be fixed safely in the current PR, isolate the risky visual change rather than weakening the repository-wide standard.

## 30. Definition of done for a migrated surface

A migrated surface satisfies this architecture standard when:

- required content and actions remain usable at 400 percent without zooming out;
- normal content has no document-level horizontal overflow;
- approximately 320px effective-width reflow is usable;
- labels, errors, and user content wrap without clipping;
- dialogs and other overlays keep required actions reachable;
- keyboard focus remains deterministic and visible;
- screen-reader names/relationships remain correct;
- shared touch-target sizing is preserved;
- RTL uses logical layout;
- light/dark and primary-accent behaviour remains semantic-token based;
- relevant loading/error/pending/empty states remain operable;
- no zoom-specific product mode or duplicated template was introduced;
- focused tests and the frontend verification gate pass;
- mapped design-preview states are reconciled when the visual contract changed.

## 31. Ownership summary

Feature code owns product-specific responsive composition and information priority.

Relay owns reusable product presentation, spacing, typography, surfaces, radii, shadows, responsive defaults, and semantic theme roles.

Spartan Helm/Brain owns reusable interaction mechanics, focus management, selection, dialog/menu/combobox state machines, and keyboard semantics.

The browser owns text shaping, zoom, and layout calculation.

No layer should attempt to infer a 400 percent zoom mode and replace the responsibilities of the other layers.
