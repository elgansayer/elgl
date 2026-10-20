# Desktop responsive breakpoint architecture

Status: authoritative implementation contract for `[Spartan UI 0047]`.

This document defines how HelloTalk surfaces progress from the mobile and tablet contracts into desktop layouts while preserving Relay visual ownership, Spartan interaction ownership, accessibility, localisation, themes, and per-user accent behaviour.

It supplements `docs/390px-mobile-baseline.md`, `docs/tablet-responsive-breakpoints.md`, and `docs/spartan-relay-architecture.md`. It does not create a second responsive system or replace Tailwind's default breakpoint scale.

## 1. Outcome

Desktop layouts must use additional width to improve task flow, information density, and persistent navigation without stretching mobile content across the viewport or creating a separate desktop application.

The repository contract is:

- Base styles own the mobile layout.
- `md` remains the primary tablet composition breakpoint.
- `lg` is the default boundary for genuinely desktop-like composition, including persistent secondary navigation and wider multi-pane workflows.
- `xl` and `2xl` are wide-desktop refinement breakpoints. They normally constrain readable content, add supporting whitespace, or permit optional secondary panes rather than making primary text indefinitely wider.
- Tailwind's standard breakpoints remain the default responsive vocabulary. Do not create product-specific device breakpoints when flexible layout can solve the problem.
- Desktop layout decisions are driven by available CSS viewport or container space, not device names, user agents, pointer type, operating system, or screen pixel ratio.
- Feature code owns route and workflow composition. Relay owns reusable responsive presentation defaults. Spartan owns interaction mechanics, not desktop layout policy.
- Light and dark themes, RTL, translated content, dynamic primary accent colours, keyboard access, touch access, and zoom/reflow remain first-class requirements at desktop widths.

Desktop is a progressive enhancement of the same semantic component tree wherever practical. It is not permission to duplicate an independent mobile and desktop implementation.

## 2. Current implementation audit

The repository already has the correct foundations for a coherent desktop contract:

1. `frontend/tailwind.config.js` extends Relay colours, radii, shadows, typography, and motion but does not override Tailwind's breakpoint scale.
2. `docs/spartan-relay-architecture.md` requires a 390px mobile-first baseline plus intentional tablet and desktop layouts.
3. `docs/tablet-responsive-breakpoints.md` establishes `md` as the normal tablet composition opportunity and reserves `lg` for desktop-like changes.
4. `DesktopSidebarComponent` currently activates at `lg` with `hidden lg:flex`, demonstrating that persistent desktop navigation already uses CSS breakpoint capability instead of JavaScript device detection.
5. The desktop sidebar uses logical `border-e` and semantic Relay surface/text roles, so the current shell already demonstrates the intended RTL and theme ownership model.
6. Relay semantic colours are CSS-variable-driven and therefore remain valid at every viewport width.
7. The user's `primary` accent is dynamic through the existing theme system. A desktop variant must not replace it with a hard-coded colour.
8. Spartan migration rules already keep focus, keyboard, selection, and overlay mechanics separate from feature layout composition.

The main gap is policy consistency. Individual screens can still choose independently when to add sidebars, multi-column layouts, permanent inspectors, denser tables, larger action rows, or wide dialogs. Without a shared desktop contract, several regressions become likely:

- readable text grows into excessively long line lengths;
- a tablet two-column layout simply expands without a deliberate desktop information hierarchy;
- three or four columns are introduced only because they fit mathematically, even when cards become difficult to scan;
- a persistent navigation or inspector appears visually while duplicated mobile controls remain focusable or exposed to assistive technology;
- desktop-only hover affordances become the only way to discover or operate an action;
- action bars assume short English labels and collapse under translation or text zoom;
- fixed widths make layouts brittle between `lg`, `xl`, browser zoom, and split-screen window sizes;
- overlays gain a desktop visual shell but lose Spartan-owned focus, Escape, dismissal, or accessible-name behaviour;
- wide pages introduce hard-coded product colours, spacing, radii, or shadows instead of reusing Relay roles;
- viewport-specific JavaScript creates SSR or hydration differences that CSS could avoid.

This standard closes those policy gaps.

## 3. Canonical desktop breakpoint model

HelloTalk uses Tailwind's standard responsive scale as layout capability ranges, not hardware categories.

| Range | Canonical interpretation | Default composition intent |
| --- | --- | --- |
| Base, below `sm` | narrow/mobile | single-column, touch-first, no horizontal page overflow |
| `sm` and above | roomy mobile | small spacing or action-row refinements only when safe |
| `md` and above | tablet-capable | deliberate tablet composition, commonly up to two substantial regions |
| `lg` and above | desktop-capable | persistent desktop navigation, denser toolbars, wider multi-pane workflows may begin |
| `xl` and above | wide desktop | improve hierarchy and whitespace; add supporting panes only when useful |
| `2xl` and above | very wide desktop | constrain primary reading width; avoid stretching the core workflow simply to fill space |

These labels describe available layout capacity. A desktop browser narrowed to `md` receives the tablet composition. A large tablet or split-screen window that reaches `lg` receives the desktop-capable composition. The UI must not infer hardware identity from the breakpoint.

## 4. `lg` is the default desktop composition boundary

Use `lg` for changes that alter the information architecture or shell in a desktop-like way.

Typical `lg` changes include:

- activating persistent desktop navigation;
- placing a supporting pane beside a primary workflow;
- moving from two to three substantial collection columns when card readability remains strong;
- exposing a persistent contextual inspector or detail region;
- converting a compact mobile/tablet action layout into a wider toolbar while preserving native/Spartan semantics;
- allowing a data view to show additional useful columns without making the page horizontally scroll;
- increasing page gutters or content max width to create a deliberate desktop canvas.

A component does not need a `lg:` rule merely because the viewport crosses `lg`. If its mobile or tablet composition remains optimal, keeping that composition is correct.

Do not use `lg` as a repair layer for a broken `md` layout. If a tablet layout overflows or compresses controls, fix the tablet layout rather than waiting for desktop width.

## 5. `xl` and `2xl` are refinement ranges

Wide desktop does not mean unlimited content width.

At `xl` and `2xl`, prefer these refinements:

- increase outer whitespace while keeping readable content bounded;
- add an optional supporting pane when it improves the workflow;
- increase card grid columns only when cards remain comfortably readable;
- keep long-form text within a readable measure;
- preserve primary action proximity to the content it affects;
- avoid turning every route into a dashboard solely because more width is available.

A wide viewport should feel intentional, not empty, but filling every pixel is not a design goal.

## 6. Ownership by UI layer

### Feature surfaces own

Feature and route code owns:

- route-level page composition;
- when a workflow becomes multi-pane;
- which feature-specific content is primary, supporting, or contextual;
- semantic ordering of regions;
- feature-specific max-width choices;
- table/chart/media density decisions;
- whether optional supporting content becomes persistent at desktop width;
- desktop-only visual placement when the same functionality remains available at narrower widths.

Feature code must not own:

- duplicate desktop focus management;
- desktop-specific Escape or outside-click handlers for dialogs;
- custom roving tabindex or menu/listbox keyboard mechanics;
- user-agent or device-name checks for layout;
- a desktop-only colour/token vocabulary;
- two independently stateful mobile and desktop copies of the same action when one adaptive tree can work.

### Relay primitives own

Relay owns reusable product presentation, including:

- shared max-width and spacing defaults;
- semantic surface, border, radius, shadow, and typography roles;
- responsive full-width versus intrinsic action sizing where the pattern is reusable;
- shared card, field, empty/loading/error-state, and overlay presentation behaviour;
- translated product-facing labels and stable public component APIs;
- typed semantic variants when multiple callers genuinely need the same wider-screen presentation.

Relay primitives should not expose generic inputs such as `desktop=true`, `isTablet`, or raw breakpoint names merely to leak CSS decisions to features. Expose a meaningful product variant if one is required repeatedly.

### Spartan Helm and Brain own

Spartan interaction mechanics remain invariant across viewport changes:

- focus management;
- Escape and outside-dismiss behaviour;
- dialog and popover relationships;
- menu, select, combobox, radio, and other selection semantics;
- disabled, pressed, and expanded state mechanics;
- keyboard navigation;
- reusable accessible interaction state machines.

A desktop composition may reposition or resize an interaction. It must not replace a Spartan-owned state machine with a feature-owned imitation.

## 7. Page shell contract

### 7.1 Keep one semantic application shell

Responsive shell changes should use CSS composition and the existing Angular tree wherever practical.

A desktop sidebar can become visible at `lg` while a mobile navigation pattern becomes hidden, but only one active navigation representation should be exposed to keyboard and assistive technology for a given layout.

When two renderings are unavoidable:

- hidden content must be removed from the accessibility and focus order as well as visually hidden;
- duplicated controls must not run duplicated effects, analytics, subscriptions, or API calls;
- route state and active-page semantics must remain consistent;
- the duplicated representations must share one source of navigation data rather than drifting separately.

### 7.2 Bound the primary canvas

The application shell may span the viewport, but the primary workflow usually needs a deliberate max width.

Preferred concept:

```html
<div class="min-w-0 flex-1">
  <main class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
    ...
  </main>
</div>
```

The exact maximum width remains feature or shell-owned. Do not copy this exact value into every route. The invariant is a bounded, flexible canvas rather than an unbounded line length.

### 7.3 Persistent navigation must not shrink content below usability

When persistent navigation appears at `lg`:

- its width must be part of the shell layout rather than an overlay covering page content;
- the content region must use `min-w-0` so long text can shrink and wrap;
- page-level horizontal scrolling must not be introduced;
- focus indicators must remain visible;
- logical borders and spacing must mirror in RTL;
- mobile navigation must no longer remain keyboard-reachable if visually hidden.

## 8. Multi-pane workflows

Desktop width can support a primary region plus one or more supporting regions, but each pane needs a semantic purpose.

Preferred two-pane pattern:

```html
<main class="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
  <section class="min-w-0">
    <!-- Primary workflow -->
  </section>
  <aside class="min-w-0">
    <!-- Supporting context -->
  </aside>
</main>
```

For a three-pane workflow, first verify that the third pane is genuinely persistent and useful. A narrow inspector, navigation rail, or metadata pane may be appropriate. Three equal primary columns usually are not.

Rules:

- use flexible `minmax(0, ...)` tracks rather than fixed widths where practical;
- preserve semantic DOM order so high zoom and narrow windows reflow correctly;
- avoid CSS `order` changes that make visual and reading order disagree;
- supporting panes must not contain the only path to a required action if they disappear at narrower widths;
- do not duplicate business state in separate mobile/tablet/desktop components.

## 9. Collections and card grids

Collection density should increase only when individual items remain understandable.

Recommended progression:

- mobile: one column;
- tablet: one or two columns depending on card complexity;
- desktop: two or three substantial columns where useful;
- wide desktop: a fourth column only for intentionally compact cards and after long-copy testing.

Example:

```html
<section class="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  @for (item of items(); track item.id) {
    <app-card class="min-w-0" />
  }
</section>
```

This example is not a mandate for four columns. The correct count depends on the card's minimum readable content width.

Do not:

- hide useful metadata solely to add another column;
- reduce touch targets or font size to increase density;
- use a fixed card width that leaves unusable gaps at intermediate sizes;
- make the entire page horizontally scroll to preserve a desktop grid.

## 10. Forms

Desktop forms may use multiple columns when the task sequence remains obvious.

Suitable desktop grouping includes:

- short, related fields side by side;
- address or profile fields with clear relationships;
- settings groups where each group remains independently labelled;
- a primary form beside a supporting summary or preview.

Long free-text, explanation, upload, and validation-heavy fields normally remain full width.

Rules:

- DOM order follows the logical task order;
- labels remain visible and associated with controls;
- validation remains adjacent to the corresponding field;
- required, disabled, pending, and error states are not communicated by colour alone;
- keyboard order follows the semantic task order, not a visually convenient column-major pattern;
- desktop columns must collapse under zoom/reflow without losing relationships;
- do not reduce control height below the approved touch target simply because a mouse is likely.

Preferred action layout:

```html
<div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
  <button hlmBtn size="touch" class="w-full sm:w-auto">Cancel</button>
  <button hlmBtn size="touch" class="w-full sm:w-auto">Save</button>
</div>
```

A desktop viewport does not require a new action implementation. It may only change the composition around the existing controls.

## 11. Navigation

The intended responsive progression is:

- mobile/base: mobile navigation contract;
- tablet/`md`: retain the mobile navigation unless a documented tablet enhancement is beneficial;
- desktop/`lg`: persistent desktop navigation may activate;
- wide desktop: increase shell whitespace or supporting context rather than adding another unrelated navigation system.

Native route navigation remains native links/RouterLink semantics. Do not convert links into command buttons for desktop styling.

Active destinations must expose appropriate current-page semantics. Keyboard focus must remain visible. Hover may enhance visual feedback but must never be the only state or affordance.

## 12. Toolbars and action regions

Desktop width often permits actions to move inline, but the interaction contract stays unchanged.

Rules:

- preserve native or Spartan-owned semantics;
- retain an adequate touch target even on pointer-rich devices;
- allow translated labels to wrap or give the toolbar enough flexible width;
- use `min-w-0` on text-bearing children;
- prefer grouping related actions over placing every secondary action in one horizontal row;
- destructive actions remain visually and semantically distinct;
- overflow menus are appropriate only when the product interaction is genuinely a menu and an approved primitive owns it;
- hover-only actions need a keyboard/touch-accessible equivalent and an accessible name.

## 13. Dialogs, sheets, popovers, and overlays

Desktop presentation may differ visually while the interaction tree remains the same.

A bottom sheet or near-full-width mobile dialog may become a centered desktop dialog, but Spartan still owns:

- focus trapping;
- Escape dismissal;
- outside interaction;
- open/closed state mechanics;
- accessible title/description relationships where provided by the primitive.

Relay/feature composition owns:

- max width;
- responsive padding;
- mobile sheet versus centered-dialog presentation where the shared pattern supports it;
- content scrolling and action layout;
- theme-aware surface, radius, and elevation tokens.

Desktop overlay requirements:

- max width must reflect the task, not a device preset;
- max height must respect the viewport;
- long translated headings/descriptions must wrap;
- large forms or documents require an internal scroll region without trapping required actions off-screen;
- zoom and text scaling must reflow rather than clip content;
- no parallel desktop-only focus implementation is allowed.

## 14. Tables and dense data

Desktop width can support more table columns, but semantic and responsive behaviour remain required.

For true tabular data:

- preserve semantic table structure and header associations;
- use the desktop width to show additional useful columns, not decorative density;
- keep essential actions discoverable without hover-only behaviour;
- constrain the table inside its content region;
- if horizontal scrolling is still required, bound it to the table region rather than the whole page;
- preserve a usable tablet/mobile representation;
- do not hide required values solely because a column is inconvenient;
- ensure keyboard focus can scroll into view inside any bounded scroller.

For content that is not inherently tabular, prefer cards/lists rather than forcing a desktop table because the viewport is wide.

## 15. Detail inspectors and secondary panes

A persistent detail or inspector pane is appropriate when users benefit from comparing or editing context without leaving the primary collection.

Requirements:

- selection state remains feature-owned and typed;
- the inspector is supplementary, not the only source of essential information;
- close/collapse controls use approved primitives;
- the selected item remains programmatically identifiable;
- focus movement is deliberate when opening, closing, or replacing inspector content;
- the inspector collapses back into the tablet/mobile flow without creating a second business-state model;
- stale asynchronous results must not populate a newly selected item.

## 16. Charts, maps, and visualisations

Desktop charts may gain room for legends, comparison series, or adjacent controls, but they still respond to their container.

- Use responsive chart sizing rather than fixed viewport pixel dimensions where possible.
- Keep chart containers `min-w-0`.
- Bound maps and canvases to the available region.
- Ensure legends and controls remain usable at high zoom.
- Provide accessible text equivalents for important data.
- Use semantic Relay or feature-approved data colours; do not create a desktop-only colour palette.
- Do not rely on hover tooltips as the only way to read important values.

## 17. Media

Images, video, audio controls, canvases, and other media remain container-bounded at desktop widths.

Desktop may permit larger media, but avoid upscaling beyond useful resolution merely to fill space.

- preserve aspect ratio where semantically required;
- keep captions and metadata in logical reading order;
- make media controls keyboard and touch accessible;
- do not crop user content differently at `lg` without a documented product reason;
- use a supporting pane for metadata only when it improves the task;
- keep source/download/share actions close to the media they affect.

## 18. Typography and readable measure

Wide desktop layouts must actively protect readability.

For long-form text, help content, legal content, lesson prose, chat-like reading surfaces, and detailed descriptions:

- use a deliberate max width or readable column measure;
- do not stretch paragraphs across the full remaining application shell;
- do not reduce font size merely to increase density;
- translated and user-generated content remains on the platform-native body font stack;
- `font-display` remains limited to guaranteed product copy according to `DESIGN.md`;
- long URLs, identifiers, CJK, Arabic, Devanagari, and other supported scripts must wrap without forcing horizontal page overflow.

A wide viewport should usually add whitespace or supporting context before it lengthens primary reading lines.

## 19. Localisation and RTL

Desktop width does not reduce localisation requirements.

Every desktop composition must tolerate:

- long translated labels and headings;
- CJK content without whitespace-dependent assumptions;
- Arabic and other RTL scripts;
- mixed-direction usernames, URLs, and numbers;
- Devanagari and combining-script shaping;
- long user-generated strings;
- locale-specific date/number expansion.

Directional layout must use logical utilities and properties:

- `ps-*` / `pe-*`;
- `ms-*` / `me-*`;
- `start-*` / `end-*`;
- `border-s-*` / `border-e-*`;
- CSS logical properties for custom styles.

Do not name product APIs `leftPane` and `rightPane` when the semantic concepts are primary/supporting, navigation/content, previous/next, or start/end.

Do not use `lg:flex-row-reverse` as a substitute for real RTL support.

## 20. Light, dark, and dynamic primary accent

Responsive width never changes semantic colour ownership.

At every desktop breakpoint:

- surfaces use Relay surface roles;
- text uses Relay text roles;
- borders use semantic surface/border roles;
- feedback uses danger/success/warning roles;
- primary actions use the dynamic `primary` role;
- saturated fills use `on-fill` where appropriate;
- the user's primary accent remains the same semantic role;
- light and dark are independent themes, not viewport modes;
- desktop variants must not introduce hard-coded product colours.

The same rule applies to radius, shadow, and motion. Use Relay's existing hierarchy rather than desktop-specific arbitrary values.

## 21. Pointer, touch, and hover

Desktop-capable width does not imply a mouse.

Large tablets, touch laptops, accessibility devices, and resized browser windows can all reach `lg`.

Therefore:

- required actions cannot depend on hover;
- touch target sizing remains valid at desktop width;
- pointer hover may supplement focus/selected/pressed states but never replace them;
- menus, tooltips, and popovers need keyboard semantics from approved primitives;
- drag-and-drop needs a non-drag alternative when the operation is required;
- keyboard shortcuts may be progressive enhancements but cannot be the only path to a core action.

Do not branch interaction behaviour on `window.matchMedia('(pointer: fine)')` unless the feature explicitly needs pointer capability detection and an equivalent interaction remains available.

## 22. Zoom, text scaling, and window resizing

Desktop responsive work must survive browser zoom and non-maximised windows.

At 200% and 400% zoom:

- multi-column layouts may collapse naturally;
- action rows may wrap or stack;
- persistent sidebars or inspectors must not cover the only way to continue;
- text must reflow rather than clip;
- overlays must remain scrollable inside the visual viewport;
- focus targets must remain reachable and scrollable into view;
- the page must not require two-dimensional scrolling for ordinary content.

Do not build desktop behaviour around one full-screen monitor resolution. A desktop user may have a narrow split-screen window or high zoom that effectively returns the layout to tablet/mobile composition.

## 23. Responsive visibility

Before adding `hidden lg:block`, `lg:hidden`, or similar visibility switches, verify all of the following:

- the hidden content is optional or available through an equivalent semantic path;
- focusable descendants are not keyboard-reachable while visually hidden;
- hidden copies do not remain exposed to assistive technology;
- duplicated controls do not perform duplicate API calls, subscriptions, timers, analytics, or mutations;
- accessible names/descriptions do not point to a hidden-only node;
- server rendering and hydration do not depend on a client-only viewport measurement;
- route permissions and feature flags remain identical between representations.

Prefer one adaptive component tree over duplicate desktop/mobile trees.

## 24. Container queries

Container queries are appropriate when a reusable component's correct composition depends on its allocated parent width rather than the viewport.

Use a container query only when:

- the component can appear in significantly different parent widths at the same viewport;
- viewport breakpoints would make the component behave incorrectly in sidebars, inspectors, or nested grids;
- the component itself, not the route, owns the responsive presentation decision.

Do not replace the repository's viewport breakpoint model wholesale with container queries. Route and shell composition still uses the established Tailwind responsive scale by default.

## 25. SSR and hydration

Desktop composition should be CSS-first so server and client render the same semantic tree.

Avoid:

```ts
const desktop = window.innerWidth >= 1024;
```

when CSS responsive utilities can express the layout.

If JavaScript needs viewport information for a behaviour that cannot be expressed in CSS:

- access browser APIs through the repository's SSR-safe patterns;
- keep the server fallback deterministic;
- do not change authentication, permissions, or data ownership based on viewport width;
- avoid rendering structurally incompatible server/client trees that cause hydration mismatches.

## 26. Performance contract

Desktop width can tempt features to render more at once. Additional visible space is not permission to load unbounded data.

Required rules:

- collection pagination/windowing limits stay in force;
- adding a desktop pane must not introduce N+1 requests;
- hidden responsive copies must not independently subscribe or fetch;
- expensive visualisations should load according to product need, not merely because they fit;
- route lazy-loading conventions remain unchanged;
- reusable Spartan/Relay imports remain scoped so responsive work does not pull unrelated primitives into initial bundles.

## 27. Migration examples

### Example A: stretched tablet content

Before:

```html
<main class="grid gap-6 md:grid-cols-2">
  <section>...</section>
  <section>...</section>
</main>
```

After, when desktop benefits from a primary/supporting hierarchy:

```html
<main class="mx-auto grid w-full max-w-7xl min-w-0 gap-6 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]">
  <section class="min-w-0">...</section>
  <aside class="min-w-0">...</aside>
</main>
```

The desktop layout adds hierarchy and a bounded canvas instead of stretching two equal columns indefinitely.

### Example B: duplicated desktop action

Before:

```html
<button class="md:hidden" (click)="save()">Save</button>
<button class="hidden lg:block" (click)="save()">Save</button>
```

After:

```html
<button hlmBtn size="touch" class="w-full sm:w-auto">Save</button>
```

The same action adapts presentation without duplicating state, analytics, or mutations.

### Example C: desktop-only hover action

Before:

```html
<div class="group">
  <button class="invisible group-hover:visible">Delete</button>
</div>
```

After:

Use an always-discoverable action, or an approved accessible menu/control whose trigger is keyboard and touch reachable. Hover may change visual emphasis but cannot be the only path.

### Example D: fixed pane widths

Before:

```html
<div class="flex">
  <aside class="w-[340px]">...</aside>
  <main class="w-[900px]">...</main>
</div>
```

After:

```html
<div class="grid min-w-0 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
  <aside class="min-w-0">...</aside>
  <main class="min-w-0">...</main>
</div>
```

Flexible tracks survive resizing and zoom.

### Example E: physical pane direction

Before:

```html
<aside class="border-r pr-4 mr-4">...</aside>
```

After:

```html
<aside class="border-e pe-4 me-4">...</aside>
```

Logical utilities preserve the same semantic composition in RTL.

### Example F: unbounded reading width

Before:

```html
<article class="w-full">...</article>
```

After:

```html
<article class="w-full max-w-prose">...</article>
```

Use the repository's appropriate readable-width convention for the real surface. The principle is to bound long-form text, not to require `max-w-prose` universally.

## 28. Prohibited patterns

The following patterns are prohibited in new or migrated desktop UI unless a documented product requirement justifies an exception:

- redefining Tailwind's global breakpoints to match device models;
- JavaScript user-agent/device-name layout branching;
- assuming `lg` means mouse/hover input;
- fixed page or pane widths that break intermediate window sizes or zoom;
- unbounded long-form reading widths;
- adding columns only to fill available space;
- hiding essential data to increase desktop density;
- duplicate mobile/desktop controls with independent business state or side effects;
- hover-only required actions;
- focusable elements left active inside visually hidden responsive regions;
- desktop-specific focus traps, Escape handlers, roving tabindex, listbox, menu, or selection state already owned by Spartan;
- physical directional utilities such as `left-*`, `right-*`, `ml-*`, `mr-*`, `pl-*`, `pr-*`, `border-l-*`, or `border-r-*` in migrated directional layout;
- hard-coded desktop product colours, radii, shadows, or typography that bypass Relay;
- viewport-width permission or authentication differences;
- loading unbounded data because more rows or cards fit on screen;
- server/client tree divergence caused by direct `window.innerWidth` rendering decisions when CSS would suffice;
- page-level horizontal scrolling used to preserve a wide desktop layout.

## 29. Required verification and future guard

The existing frontend verification gate remains authoritative for implementation changes:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

Desktop migration work should additionally use the visual-regression contract at representative wider viewports.

A dedicated follow-up verification gate should enforce the smallest high-value desktop invariants without pretending static analysis can prove visual quality. `[Spartan UI 0048]` should cover at least:

1. a fixed desktop viewport at `1024px` or slightly wider to verify the `lg` transition;
2. a wide desktop viewport such as `1280px` or `1440px` for `xl` hierarchy/readable-width behaviour;
3. light and dark theme coverage;
4. RTL coverage on a representative shell/screen;
5. 200% text or browser zoom/reflow coverage where the existing harness can represent it;
6. a horizontal document-overflow assertion at desktop viewport sizes;
7. verification that persistent desktop navigation is not simultaneously focusable with its hidden mobile equivalent;
8. representative long-translation content so toolbar, navigation, and action-row layouts do not rely on short English labels.

Expected failure modes for the future gate should clearly identify the violated contract, for example:

```text
Desktop responsive contract failed: horizontal document overflow at 1024px
Desktop responsive contract failed: hidden mobile navigation contains focusable content at lg
Desktop responsive contract failed: required desktop visual state missing for dark + RTL
```

Do not create a brittle repository-wide regex that bans every fixed width or every `hidden lg:*` usage. Some fixed dimensions and responsive visibility are legitimate. The verification gate should combine targeted static checks with rendered representative states.

## 30. Design-preview and Claude Design parity

When a desktop visual contract changes:

- update the mapped Relay + Spartan design preview;
- include the mobile/tablet state when necessary to explain the responsive transition;
- include a desktop state at the breakpoint where composition materially changes;
- include wide-desktop only when it has a distinct contract rather than a larger screenshot of the same state;
- capture light and dark states for theme-sensitive work;
- include RTL when pane/navigation direction or logical spacing changes;
- keep the runtime implementation as the source of truth and the design preview as the visual contract mirror.

A documentation-only architecture ticket does not itself require a preview update because it does not change runtime presentation.

## 31. Accessibility review checklist

Before declaring a desktop migration complete, verify:

- semantic reading order still matches the visual hierarchy;
- keyboard order remains deterministic across responsive transitions;
- visible focus is not clipped by panes or bounded scrollers;
- hidden responsive content is not focusable or exposed incorrectly;
- persistent navigation has a useful accessible name and current-page semantics;
- hover is never the only way to reveal a required action;
- dialogs/menus/selects retain Spartan-owned keyboard and focus behaviour;
- important statuses do not depend on colour alone;
- long translated text and user content can wrap;
- high zoom can collapse columns without hiding required content or actions;
- bounded horizontal table scrollers keep focused cells/actions scrollable into view;
- duplicated responsive representations do not duplicate live-region announcements.

## 32. Rollout and rollback

This architecture standard changes no runtime behaviour by itself.

For subsequent desktop migrations:

- keep each surface independently revertible;
- preserve existing inputs, outputs, routes, API contracts, analytics, and permissions unless a separate product issue intentionally changes them;
- update one responsive composition at a time where practical;
- preserve mobile and tablet behaviour while adding desktop enhancements;
- if a desktop migration cannot meet accessibility or responsive verification in its PR, revert the desktop enhancement rather than shipping a partially inaccessible duplicate layout.

Rollback of this documentation consists of reverting the standard. Runtime rollback for later migrations remains surface-specific.

## 33. Definition of done for desktop breakpoint work

A surface is desktop-compliant when:

- its mobile and tablet contracts remain valid;
- its `lg` change, if any, represents a genuine desktop information-architecture improvement;
- `xl`/`2xl` refinements improve hierarchy/readability rather than stretching content;
- the primary canvas and long-form text are intentionally bounded;
- multi-pane layouts use flexible, shrinkable tracks;
- responsive hidden content does not remain incorrectly interactive;
- interaction mechanics stay native or Spartan-owned;
- Relay tokens remain authoritative across light/dark and dynamic accents;
- RTL uses logical layout;
- translated and user-generated content survives wide and zoomed layouts;
- touch, keyboard, and assistive-technology paths remain complete;
- ordinary page content does not require horizontal document scrolling;
- data fetching remains bounded and does not duplicate across responsive representations;
- relevant design-preview and automated verification states are updated for runtime changes.

This document completes the architecture definition requested by `[Spartan UI 0047]` and provides the implementation contract for the follow-up `[Spartan UI 0048]` verification gate.