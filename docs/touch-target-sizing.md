# Touch target sizing

Status: authoritative interaction sizing contract for the Relay + Spartan UI migration.

This document defines the repository standard for pointer and touch target sizing. It supplements `DESIGN.md`, `docs/spartan-relay-architecture.md`, `docs/390px-mobile-baseline.md`, and the existing density standards. It does not create a new component layer or a second spacing scale.

## 1. Scope

This contract applies to every user-facing interactive target in the Angular application, including:

- buttons and button-like actions;
- navigation links and icon navigation;
- menu, listbox, combobox and select triggers;
- checkboxes, radios, switches and their labels;
- tabs, chips and segmented controls;
- disclosure and accordion triggers;
- dialog, sheet and popover actions;
- media controls;
- calendar/date controls;
- drag handles and resize affordances where pointer activation is required;
- custom canvas or gesture interactions that expose a pointer target;
- repeated actions inside cards, tables, lists and toolbars.

The standard applies at the 390px mobile baseline and continues to apply on tablet and desktop. A wide viewport or mouse pointer is not permission to make essential controls difficult to touch.

## 2. Current implementation audit

The repository already has a strong foundation for touch-safe controls.

### 2.1 Spartan Button owns touch sizing

`frontend/src/app/components/ui/button/src/lib/hlm-button.ts` exposes dedicated touch variants:

```text
size="touch"      -> min-h-11
size="icon-touch" -> size-11
```

With the repository Tailwind spacing scale, `11` represents 44 CSS pixels. These variants also retain Spartan Brain button semantics, focus handling, disabled behaviour and Relay-compatible visual variants.

The same button primitive still exposes compact sizes such as `xs`, `sm`, `default`, `lg`, `icon`, `icon-xs`, `icon-sm` and `icon-lg`. Those variants are useful for deliberately dense contexts, but feature code must not assume that a compact visual size is automatically a suitable primary touch target.

### 2.2 The 390px mobile contract already requires touch-safe actions

`docs/390px-mobile-baseline.md` requires interactive controls to use the repository's approved touch-size primitive or variant where available. It also requires adequate separation between adjacent targets and an accessible non-gesture path for important actions.

### 2.3 Existing migrations already use the touch variants

Converted surfaces already use `size="touch"` and `size="icon-touch"` for primary actions, destructive actions, dialog controls and mobile navigation affordances. This is the correct direction because target sizing remains owned by shared primitives rather than copied feature CSS.

### 2.4 Current risk areas

The migration backlog still contains repeated target-size risks:

- default or compact Spartan button sizes used for primary mobile actions;
- icon-only actions with a visual glyph smaller than the required hit area;
- custom `div` or `span` click targets whose hit area follows the text or icon only;
- adjacent compact actions with insufficient separation;
- checkboxes/radios whose visible control is small and whose label is not part of the clickable target;
- dense toolbars copied directly from desktop into mobile layouts;
- absolute-positioned overlay controls with a small hit area;
- custom media/canvas controls that have no shared target-size contract;
- touch sizing recreated with feature-local `h-*`, `w-*`, padding or pseudo-elements instead of a Relay/Spartan primitive;
- responsive rules that shrink the hit target to make more actions fit in one row.

The goal of this standard is to remove those decisions from individual feature implementations.

## 3. Canonical target-size contract

### 3.1 Repository baseline

The default product target for an important standalone interactive control is at least **44 by 44 CSS pixels**.

This is the repository product baseline, not a claim that every visual glyph must be 44 pixels. A 16px or 20px icon may sit inside a 44px interaction box.

For Spartan buttons:

```html
<button hlmBtn size="touch">Save</button>
<button hlmBtn size="icon-touch" aria-label="Close">...</button>
```

Feature code should prefer those variants over reconstructing equivalent padding or dimensions.

### 3.2 Hit area and visual size are different concepts

The interactive box may be larger than the visible icon, checkbox, radio or decorative shape.

Good:

```html
<button hlmBtn size="icon-touch" variant="ghost" aria-label="More options">
  <ng-icon ... />
</button>
```

Bad:

```html
<ng-icon class="size-5 cursor-pointer" (click)="openMenu()" />
```

The second example has no native button semantics and exposes only the glyph area as the pointer target.

### 3.3 Do not infer input modality from viewport width

Touch-safe sizing is not limited to `sm` or mobile breakpoints. Tablets, touch laptops, hybrid devices and accessibility tools can use touch at desktop widths.

Do not write target-size rules based on user-agent detection, device models or assumptions such as "desktop means mouse".

Responsive composition may change, but the target remains usable.

## 4. Ownership

### 4.1 Spartan Brain / Helm own

Spartan owns generic interactive behaviour and, where the repository Helm wrapper provides it, the canonical target-size variant.

Examples:

- Button and icon button interaction boxes;
- dialog close/confirm/cancel controls;
- menu/select/combobox triggers;
- tabs and other Brain-backed interaction state machines.

Feature code must not duplicate keyboard, focus or disabled behaviour merely to enlarge a target.

### 4.2 Relay owns

Relay owns reusable product presentation around Spartan interactions, including:

- product-specific button wrappers;
- shared spacing between adjacent controls;
- reusable card/list row compositions;
- semantic radius and colour roles;
- mobile/full-width action compositions;
- translated accessible labels exposed by Relay wrappers.

If multiple features need the same touch-safe composition, improve the Relay primitive rather than copy the fix into each feature.

### 4.3 Feature surfaces own

Features own composition and business meaning:

- which actions are present;
- action priority;
- whether actions stack, wrap or move into an approved menu at narrow widths;
- feature-specific gesture alternatives;
- business disabled/pending state.

Features do not own a new generic target-size system.

## 5. Buttons and action links

### 5.1 Primary, destructive and repeated mobile actions

Use `size="touch"` for standalone labelled actions when touch is a normal input path.

Examples include:

- Save, Continue, Submit and Retry;
- destructive confirmation actions;
- Load more;
- Follow/Unfollow;
- Send message;
- mobile dialog actions;
- repeated list-row actions where accidental activation has meaningful consequences.

### 5.2 Icon-only actions

Use `size="icon-touch"` for normal icon-only actions.

The icon itself should remain visually appropriate. Do not scale a glyph to 44px merely to satisfy the hit target.

Every icon-only action needs an accessible name independent of the icon.

### 5.3 Native navigation links

A navigation destination should remain an anchor even when it is styled like a button:

```html
<a routerLink="/dashboard" hlmBtn size="touch">Back to dashboard</a>
```

Do not replace a semantic link with a command button to gain touch sizing.

### 5.4 Inline text links

Links embedded in running prose are an intentional exception to the 44px standalone-control baseline. They should retain normal text-flow semantics rather than gaining large block padding that damages readability.

This exception does not apply to navigation links that merely look like inline text but function as standalone controls, list actions or toolbar actions.

## 6. Checkboxes, radios, switches and labels

The visible indicator may be smaller than 44px when the associated label participates in the activation target.

Required:

- use a real `<label>` association or the approved Spartan/Relay field composition;
- make the full label/control row comfortably activatable where the product design allows it;
- preserve visible keyboard focus on the actual interactive control;
- do not use a detached text label that cannot activate the control;
- do not simulate checkbox/radio semantics with generic elements.

A small native/Spartan checkbox with a correctly associated, adequately spaced label can provide a larger practical target without distorting the visual indicator.

## 7. Tabs, chips and segmented controls

Interactive tabs/chips must not become sub-touch targets simply because several items share a row.

At narrow widths, prefer one of:

1. wrapping when the interaction model supports it;
2. a locally scrollable tab/chip row with keyboard access;
3. a different approved selection primitive when the product design explicitly calls for it.

Do not shrink text, padding or hit areas below the repository touch baseline merely to force every option onto one line.

Static badges and pills are not targets and must not gain pointer affordances or tab stops solely to resemble interactive chips.

## 8. Dense desktop interfaces

Compact variants may be used in genuinely dense desktop contexts when all of the following are true:

- the context is intentionally dense, such as an expert data grid or compact toolbar;
- the compact control is not the only practical way to perform a critical action on a touch-capable layout;
- the layout has an explicit mobile/tablet composition that restores touch-safe controls where needed;
- adjacent targets remain distinguishable and do not create accidental activation risk;
- keyboard focus remains visible and unobscured;
- the choice is documented in the component audit/test rather than happening accidentally through the default size.

Do not use the dense-interface exception for ordinary page actions, dialog actions, navigation or settings controls.

## 9. Spacing between targets

Target size alone is insufficient when adjacent controls visually or physically collide.

Use the repository spacing scale and Relay composition to keep related controls distinct. Destructive and non-destructive actions in particular need enough separation to reduce accidental activation.

Do not create transparent overlapping hit areas. An enlarged target must not intercept clicks intended for a neighbouring control.

For repeated rows, keep each row's action within that row's semantic and visual boundary.

## 10. Gestures and custom interactions

Swipe, drag, long-press, crop and canvas interactions can remain specialised when appropriate, but important actions need a discoverable non-gesture path.

Examples:

- swipe-to-delete also exposes a button/menu action;
- image crop handles can remain specialised, while Cancel/Save use touch-sized Spartan controls;
- a canvas drawing surface can remain canvas-owned, while colour, brush, clear and send actions use standard controls;
- media scrub/drag interactions should coexist with accessible play/pause and other essential controls.

Do not make a small draggable handle the only way to perform a critical action when a standard control can provide an accessible alternative.

## 11. Responsive composition

### 11.1 390px mobile

At the mobile baseline:

- primary actions commonly use `size="touch"`;
- icon actions commonly use `size="icon-touch"`;
- action groups stack or wrap before individual targets are compressed;
- full-width actions are acceptable when they improve usability and hierarchy;
- touch targets must not force horizontal page scrolling.

### 11.2 Tablet

Tablet layouts may introduce side-by-side controls, but target sizing remains touch-safe because tablets are commonly touch-operated.

### 11.3 Desktop

Desktop can increase information density without assuming touch has disappeared. Essential actions should remain comfortably activatable. Compact exceptions must be deliberate, tested and limited to dense contexts.

## 12. RTL and localisation

Target sizing must work independently of language and direction.

Required:

- use logical spacing (`ps`, `pe`, `ms`, `me`, `start`, `end`) rather than physical left/right utilities;
- let translated labels wrap or allow action groups to stack rather than reducing the hit target;
- keep icon-only accessible names translated where they are product-facing;
- mirror directional icons only when the action itself is directional;
- verify Arabic/Hebrew mixed-direction labels without changing the interaction box;
- verify long translations at 390px and high zoom.

A control must not become smaller because a translated label is longer.

## 13. Themes and per-user accent

Touch sizing is independent of colour/theme.

At the same target size, verify:

- light theme;
- dark theme;
- dynamic `primary` accent;
- destructive and disabled variants;
- `on-fill` text/icon treatment on saturated fills;
- forced-colour/high-contrast behaviour where applicable.

Do not add theme-specific padding or dimensions that alter the hit box.

## 14. Keyboard and screen-reader requirements

A larger pointer target must not weaken non-pointer interaction.

Every touch-sized control must retain:

- correct native or Spartan role/semantics;
- deterministic keyboard focus order;
- visible focus treatment;
- Enter/Space behaviour appropriate to the native/Spartan primitive;
- programmatic disabled/pending state;
- accessible naming and relationships;
- no duplicate focusable wrapper around the same action.

Do not wrap a real button in a second clickable container to create a larger target. Enlarge or use the shared button primitive instead.

## 15. Zoom and reflow

At 200% and 400% zoom:

- target dimensions must not be reduced to keep a desktop row intact;
- action groups may wrap or stack;
- target labels may wrap when necessary;
- focused controls must remain scrollable into view;
- fixed/sticky controls must not cover other required targets;
- overlay actions must remain reachable through internal scrolling if viewport height is constrained.

A target that is 44px at normal zoom but clipped or overlapped at high zoom is not compliant.

## 16. Migration examples

### Example A: compact primary action

Before:

```html
<button hlmBtn (click)="save()">Save</button>
```

After:

```html
<button hlmBtn size="touch" type="button" (click)="save()">Save</button>
```

The shared primitive owns the hit area and interaction mechanics.

### Example B: icon click handler

Before:

```html
<ng-icon class="size-5 cursor-pointer" (click)="close()" />
```

After:

```html
<button
  hlmBtn
  size="icon-touch"
  variant="ghost"
  type="button"
  [attr.aria-label]="'COMMON.CLOSE' | translate"
  (click)="close()"
>
  <ng-icon class="size-5" ... />
</button>
```

### Example C: cramped mobile action row

Before:

```html
<div class="flex gap-1">
  <button hlmBtn size="sm">Cancel</button>
  <button hlmBtn size="sm">Save</button>
</div>
```

After:

```html
<div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
  <button hlmBtn size="touch" variant="secondary">Cancel</button>
  <button hlmBtn size="touch">Save</button>
</div>
```

Composition changes before target size is sacrificed.

### Example D: small checkbox target

Before:

```html
<input id="notify" type="checkbox" />
<span>Notify me</span>
```

After:

```html
<label class="flex min-h-11 items-center gap-3" for="notify">
  <input id="notify" type="checkbox" />
  <span>Notify me</span>
</label>
```

Prefer the approved Spartan/Relay field primitive where one exists. The example demonstrates that the associated label can contribute to a practical target without enlarging the checkbox glyph itself.

### Example E: native navigation preserved

Before:

```html
<button hlmBtn (click)="router.navigate(['/settings'])">Settings</button>
```

After:

```html
<a routerLink="/settings" hlmBtn size="touch">Settings</a>
```

The destination remains a link and gains the shared touch target.

## 17. Prohibited patterns

The following are prohibited in new or migrated user-facing UI unless a documented product requirement justifies an exception:

- click handlers directly on icons, images or generic text spans for actions;
- generic `div role="button"` elements where a native/Spartan button is available;
- feature-local copies of `min-h-11`, `size-11` or equivalent solely to imitate the shared button variants;
- shrinking target dimensions at mobile breakpoints to make a row fit;
- relying on hover as the only way to expose an important action;
- transparent hit areas that overlap neighbouring controls;
- detached checkbox/radio labels that do not activate their controls;
- nested interactive targets for the same action;
- device or user-agent detection to decide whether controls should be touch-safe;
- arbitrary one-off pixel sizing when the existing Spartan/Relay variants already express the requirement;
- replacing semantic anchors with command buttons merely for styling;
- making a gesture the only way to complete an important action;
- using colour alone to distinguish adjacent destructive/safe actions.

## 18. Exceptions

An exception is acceptable only when the product semantics require it and the decision is documented and tested.

Common legitimate exceptions include:

- links embedded in running prose;
- native browser controls whose practical associated label/row supplies the larger activation target;
- specialised drawing/cropping handles where a standard 44px handle would materially obstruct the task and an accessible alternative action exists;
- deliberately dense desktop-only expert tooling with a separate touch-safe responsive composition.

An exception must not be inferred merely because an existing component is small.

## 19. Verification contract

Follow-up issue #5516 should implement the smallest maintainable automated guard for this standard.

The recommended verification has two layers.

### 19.1 Static ownership checks

Extend the existing UI contract scripts to detect high-confidence regressions such as:

- direct `(click)` handlers on standalone `ng-icon` or non-interactive elements;
- newly introduced feature-local button sizing that duplicates the canonical touch variants;
- known migrated primary/dialog actions using compact sizes without an explicit audited exception.

The guard must avoid blanket rules that reject legitimate inline links or specialised controls.

### 19.2 Rendered interaction checks

Use focused component/Cypress coverage for representative surfaces at minimum:

- 390px light theme;
- 390px dark theme;
- RTL;
- 200% text/zoom equivalent state where the visual harness supports it;
- representative tablet/desktop width;
- keyboard focus on the same controls.

Rendered checks should assert that required controls are not clipped, overlapping or made unreachable. Where browser geometry is stable enough, representative target boxes should be at least 44 by 44 CSS pixels.

### 19.3 Current verification commands

For a component migration that changes interaction sizing, run the relevant focused test plus the repository frontend gates:

```bash
cd frontend
npm test
npm run lint:check
npm run build
```

When the mapped visual contract changes, also run:

```bash
cd frontend
npm run visual:capture:ci
```

The repository CI and design-sync/Spartan ownership checks remain authoritative for pull requests.

### 19.4 Expected failure mode

The future #5516 guard should fail with the exact file/control and a remediation that points developers to the approved shared size, for example:

```text
Touch target contract violation: src/app/.../example.component.ts
Standalone Spartan action uses size="sm" in a touch-required context.
Use size="touch", size="icon-touch", or document an audited exception.
```

Do not make the check silently rewrite application code.

## 20. Review checklist

Before approving a migrated interactive surface, verify:

- every standalone important action has a touch-safe hit area;
- icon glyph size is independent from hit-area size;
- action groups wrap/stack instead of shrinking controls;
- checkbox/radio labels participate in activation where appropriate;
- links remain links and buttons remain buttons;
- touch sizing comes from Spartan/Relay rather than copied feature CSS;
- adjacent targets do not overlap and have understandable separation;
- keyboard focus and disabled/pending state remain correct;
- 390px mobile, tablet and desktop compositions remain usable;
- RTL and long translations do not reduce or hide targets;
- light/dark/accent variants keep the same interaction geometry;
- 200% and 400% zoom/reflow keep all required actions reachable;
- specialised gesture interactions have accessible alternatives where required;
- any compact/dense exception is explicit and covered by tests.

## 21. Rollback

This architecture standard changes no runtime behaviour by itself. Rollback is a documentation revert.

Implementation PRs adopting the standard must be independently revertible and must not require API, schema or persistence rollback solely because target sizing changed.

Do not roll back a touch-target migration by restoring generic click handlers, removing native semantics or weakening keyboard/accessibility behaviour. Prefer reverting only the problematic composition while retaining the approved interaction primitive.

## 22. Definition of done for migrations

A migrated surface satisfies this standard when:

1. target sizing is owned by the correct Spartan/Relay primitive where available;
2. important standalone actions meet the 44 by 44 CSS pixel repository baseline;
3. compact exceptions are deliberate, documented and tested;
4. native element semantics and Spartan interaction behaviour are preserved;
5. mobile layout adapts before targets are compressed;
6. RTL, localisation, themes, user accent, keyboard and high-zoom states remain correct;
7. focused regression coverage locks the changed behaviour;
8. mapped visual states are updated when the visible contract changes;
9. the frontend verification gates pass;
10. the pull request records any deliberate exception and its rationale.
