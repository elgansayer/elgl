# Keyboard interaction standards

Issue: #5517 (`Spartan UI 0051`)

Status: authoritative keyboard interaction contract for the Relay + Spartan migration.

This document defines how keyboard interaction is owned, implemented, reviewed and verified in the Angular frontend. It supplements `DESIGN.md`, `AGENTS.md`, `docs/spartan-relay-architecture.md` and `docs/focus-ring-architecture.md`.

The core rule is simple: use native HTML keyboard behaviour when native semantics fit, use Spartan Brain for reusable composite interaction state machines, and keep feature code focused on product behaviour rather than recreating keyboard mechanics.

## 1. Goals

The keyboard contract exists to ensure that:

- every interactive feature is usable without a pointer;
- focus order is deterministic and follows the visual and reading order;
- keyboard behaviour remains consistent between feature surfaces;
- screen-reader users receive the native or ARIA semantics associated with the interaction pattern;
- focus remains visible through the Relay focus-ring contract;
- interaction does not depend on colour, hover, pointer gestures or drag alone;
- RTL, translated content, high zoom, forced colours and reduced motion do not alter the interaction model;
- IME composition and text editing are not broken by feature-level shortcuts;
- reusable interaction state machines are owned by Spartan Brain rather than copied into feature code.

## 2. Current implementation audit

The repository already has several strong foundations:

- `frontend/src/styles.scss` and `docs/focus-ring-architecture.md` define a global `:focus-visible` contract using the Relay primary token.
- `frontend/src/app/components/ui/` contains owned Spartan Helm implementations for button, checkbox, combobox, dialog, native select, popover, radio group, input and other approved primitives.
- `docs/spartan-relay-architecture.md` already assigns generic focus, overlay, selection and keyboard mechanics to Spartan Brain.
- Native buttons and anchors are increasingly used directly instead of synthetic `role="button"` elements.
- Several migrated dialogs now rely on Spartan Dialog for focus trapping, Escape dismissal and focus restoration.

There is also migration debt:

- `frontend/src/app/components/primitives/a11y-clickable.ts` creates synthetic buttons by adding `role="button"`, `tabindex="0"`, Enter handling and Space handling to arbitrary elements. It remains a compatibility helper, not the target architecture.
- Existing features still contain local `(keydown.escape)` handlers and other feature-owned keyboard handlers around hand-built overlays.
- Some older surfaces use feature-owned Enter/Space handling instead of native controls.
- The repository has a focus-ring verification script, but there is not yet a dedicated keyboard-interaction migration guard.

The migration target is not to remove every keyboard event listener. Text editors, canvases, specialised media controls and feature-specific shortcuts may need local keyboard logic. The target is to remove duplicated generic interaction state machines when native HTML or an approved Spartan primitive already owns the behaviour.

## 3. Ownership model

Keyboard behaviour follows the existing four-layer UI architecture.

### Feature surfaces

Feature components own:

- product actions;
- routing;
- data mutations;
- feature-specific shortcut intent;
- deciding whether a dialog is dismissible;
- deciding whether selection is automatic or requires confirmation when the shared primitive exposes that policy.

Feature components must not own:

- generic button Enter/Space emulation;
- generic radio-group arrow navigation;
- generic combobox or listbox navigation;
- generic dialog focus traps;
- generic Escape/backdrop dismissal mechanics;
- roving tabindex for a standard composite widget;
- focus restoration for an approved overlay primitive.

### Relay primitives

Relay owns the stable product-facing API and presentation policy around interactive primitives. Relay may decide:

- product variants;
- translated accessible labels;
- layout and responsive defaults;
- semantic token mapping;
- which Spartan behaviour is exposed to feature code.

Relay must not fork Brain keyboard mechanics unless there is a documented capability gap.

### Spartan Helm

Owned Helm components bridge product styling and Spartan Brain semantics. Generated or upstream-derived keyboard mechanics should remain close to the Spartan implementation so upgrades stay reviewable.

### Spartan Brain

Brain owns reusable accessible interaction state machines such as:

- dialog focus management and dismissal;
- combobox navigation and selection;
- radio-group selection movement;
- popover focus/anchor behaviour where applicable;
- other installed composite-widget keyboard patterns.

When a suitable Brain primitive exists, feature code must not build a second implementation beside it.

## 4. Native HTML first

Use a native element whenever its semantics match the product action.

### Buttons

Use `<button type="button">` or `<button type="submit">` for commands.

Native behaviour provides:

- Tab focus;
- Enter activation;
- Space activation;
- disabled semantics;
- accessible button role;
- predictable browser and assistive-technology behaviour.

Do not replace a native button with a `div`, `span`, card or list row plus `role="button"` and keyboard handlers for styling convenience.

### Links

Use `<a href>` or Angular `routerLink` anchors for navigation.

Native links provide:

- Tab focus;
- Enter activation;
- link semantics;
- standard browser context actions;
- expected open-in-new-tab behaviour where relevant.

A navigation action should not become a command button only to call `Router.navigate()` imperatively when a semantic link can express the destination.

### Inputs and textareas

Use native editing behaviour. Feature code must not intercept common editing keys unless the product requirement explicitly needs it.

Do not steal:

- Arrow keys used for caret movement;
- Home/End used for text navigation;
- Backspace/Delete used for editing;
- Enter inside multiline text unless submission behaviour is explicitly documented;
- composition keystrokes from IME input.

### Checkboxes

Use native checkbox semantics or the approved Spartan checkbox primitive.

Space toggles the control. Feature code must not add a competing Enter/Space state machine.

### Native select

Use the approved native-select boundary when the browser control is the intended interaction. Browser keyboard behaviour remains authoritative.

### Range controls

Where a native `<input type="range">` is the approved control, preserve browser keyboard behaviour including Arrow keys, Home, End, Page Up and Page Down where supported. Do not recreate the slider state machine in a generic `div`.

## 5. Synthetic controls are an exception

A non-interactive element may only receive interactive semantics when a native element cannot represent the interaction without breaking required markup or behaviour.

Before creating or retaining a synthetic control:

1. check for a native element;
2. check for an existing Relay primitive;
3. check the owned Helm catalogue;
4. check whether Spartan Brain supplies the pattern;
5. document why the native or Spartan option is unsuitable.

`appA11yClickable` is transitional compatibility debt. New feature code should not use it as the default way to make arbitrary containers clickable.

A migration should normally replace:

```html
<div appA11yClickable (click)="openProfile()">...</div>
```

with a semantic control such as:

```html
<a [routerLink]="['/profile', userId]">...</a>
```

or:

```html
<button type="button" (click)="openAction()">...</button>
```

when those semantics match the product behaviour.

## 6. Global key-event rules

### Use `KeyboardEvent.key`

Use semantic key names such as `Enter`, `Escape`, `ArrowDown` and `Home`. Do not use deprecated `keyCode` or numeric key values.

### Prevent default only when the widget owns the key

Call `preventDefault()` only when the active interaction pattern explicitly claims that key. Do not globally prevent Arrow, Space or Enter events and then rebuild browser behaviour manually.

### Stop propagation sparingly

Do not use `stopPropagation()` as a substitute for correct interaction ownership. It is appropriate only when a nested widget deliberately owns a key that a parent composite also listens for.

### Respect IME composition

Keyboard shortcuts that can fire while a user is typing must ignore composing events:

```ts
if (event.isComposing) {
  return;
}
```

Do not submit, navigate, close, tokenise or trigger shortcuts from composition keystrokes.

### Avoid document-level listeners for local widgets

Local keyboard behaviour belongs on the owning control or primitive. Global listeners are reserved for true application-level shortcuts and third-party integrations that cannot be scoped locally.

### Do not duplicate pointer actions with unrelated key semantics

Keyboard activation must trigger the same product action as pointer activation. Do not create a keyboard-only hidden state transition or a pointer-only shortcut that changes the core result.

## 7. Focus order

### DOM order is authoritative

Interactive controls should appear in DOM order matching the reading and visual order.

Do not use positive tabindex values such as `tabindex="1"` or `tabindex="2"` to repair layout order. Fix the DOM/layout instead.

### `tabindex="0"`

Use `tabindex="0"` only when an element legitimately participates in sequential focus and no native focusable element can express the interaction.

### `tabindex="-1"`

Use `tabindex="-1"` for programmatic focus targets that should not enter normal Tab order, such as an error summary or a heading that receives focus after a route/state transition.

### Roving tabindex

Roving tabindex is a composite-widget state machine. It belongs to Spartan Brain or another approved shared primitive. Feature code must not independently maintain which child has `tabindex="0"` when the pattern is a standard radio group, menu, tabs, listbox or similar composite.

## 8. Focus movement

Do not move focus merely because state changed.

Move focus when the interaction model requires it, for example:

- opening a dialog;
- closing a dialog and returning to its trigger;
- navigating within a composite widget according to its keyboard pattern;
- moving to a validation summary or first invalid field after an explicit failed submission when the feature contract calls for it;
- restoring focus after an item is removed when otherwise the user would lose their place.

Do not move focus:

- after ordinary asynchronous data refreshes;
- after every successful mutation;
- because a hover/pointer state changed;
- to a toast or passive status message;
- to a newly-rendered result unless the user action and interaction pattern require it.

Spartan overlay primitives remain responsible for their own initial-focus, trap and return-focus mechanics.

## 9. Disabled and busy states

### Native disabled controls

Use native `disabled` for buttons, inputs, checkboxes and other controls that support it.

A disabled control must not remain activatable through custom key handlers.

### `aria-disabled`

Use `aria-disabled="true"` when the element must remain focusable for discoverability or when the semantic element does not support `disabled`. In that case, the handler must also prevent the action. ARIA alone does not disable behaviour.

### Busy operations

For asynchronous commands:

- prevent duplicate activation while the operation is pending;
- expose `aria-busy` on the appropriate control or region when useful;
- keep focus stable unless the operation changes navigation/context;
- preserve retry capability after failure;
- do not replace a focused button with an unrelated element during the request if that would strand focus.

## 10. Standard key contracts

The table below is the product-level contract. Installed Spartan/native primitives remain the implementation authority for exact browser and assistive-technology behaviour.

| Pattern | Expected keyboard behaviour | Owner |
| --- | --- | --- |
| Button | Tab to focus; Enter or Space activates | Native / Spartan Button |
| Link | Tab to focus; Enter navigates | Native anchor / RouterLink |
| Checkbox | Tab to focus; Space toggles | Native / Spartan Checkbox |
| Radio group | Tab enters the group; Arrow keys move selection/focus according to the primitive; Space selects where applicable | Spartan Radio Group |
| Native select | Browser-native open/navigation/selection keys | Native Select |
| Combobox | Typing edits/filter text; Arrow keys navigate options; Enter selects; Escape closes without inventing feature-level state | Spartan Combobox |
| Dialog | Focus enters dialog; Tab and Shift+Tab remain within it; Escape dismisses when dismissible; focus returns to trigger | Spartan Dialog |
| Popover | Trigger uses native button/link semantics; open/close and focus behaviour follows the primitive | Spartan Popover |
| Text input | Native editing keys remain available; Enter submits only where form semantics require it | Native / Spartan Input |
| Textarea | Native multiline editing; Enter inserts a newline unless the product explicitly defines another shortcut | Native / Spartan Textarea |
| Range | Native Arrow/Home/End/Page keys | Native range or future approved Slider |

## 11. Radio groups and single-selection controls

Mutually exclusive choices should use a radio-group interaction rather than a row of unrelated buttons with feature-owned selected state when the choices are conceptually one field.

Requirements:

- one accessible group name;
- one selected value at a time;
- keyboard movement delegated to Spartan;
- selected state exposed semantically, not only by colour;
- feature code reacts to the resulting value rather than interpreting raw key events.

Visual segmented controls may still present as pills or buttons, but the interaction semantics must remain the correct single-selection model.

## 12. Comboboxes and listboxes

Combobox/listbox keyboard state is not feature code.

Feature responsibilities are limited to:

- providing options;
- filtering/data loading;
- rendering product-specific option content;
- reacting to the selected value;
- deciding disabled/loading/error product states.

Spartan owns:

- active option management;
- option focus/navigation;
- selection key behaviour;
- open/close interaction;
- ARIA relationships.

Do not attach a second `(keydown.arrowdown)` or `(keydown.enter)` handler to a Spartan combobox to duplicate its state machine.

## 13. Dialogs and overlays

Dialogs must use the approved Spartan Dialog boundary unless a documented capability gap exists.

Feature code owns whether a dialog may close. Spartan owns the mechanics of:

- focus entry;
- focus trap;
- Tab and Shift+Tab cycling;
- Escape dismissal when enabled;
- outside-pointer/backdrop dismissal when enabled;
- focus return to the trigger.

Do not add a parallel document Escape listener to a Spartan dialog.

A non-modal popover must not be turned into a modal focus trap. Use the semantics of the actual pattern.

## 14. Menus, tabs and other composites

When a standard composite is needed but the required primitive is not currently installed in the owned Helm catalogue:

1. verify Spartan supports the interaction;
2. add the primitive through the normal Spartan ownership process;
3. expose it through Relay if repeated product use warrants a stable wrapper;
4. add representative keyboard tests;
5. update `frontend/src/app/components/ui/README.md` and the design-preview contract where the shared surface changes.

Do not hand-roll a temporary roving-tabindex/menu/tabs implementation in feature code simply because the Helm primitive is not checked in yet.

If a short-lived native implementation can satisfy the product semantics, prefer that until the shared primitive is available.

## 15. Text entry and IME

HelloTalk supports languages that depend heavily on input methods. Keyboard handling around text entry must therefore be composition-safe.

Feature shortcuts must not trigger while `KeyboardEvent.isComposing` is true.

This particularly applies to:

- Enter-to-send chat messages;
- Enter-to-submit search forms;
- Escape shortcuts around editable fields;
- token/flashcard shortcuts;
- autocomplete selection;
- global command shortcuts.

Do not infer text boundaries from raw key presses. Text tokenisation continues to use `Intl.Segmenter` after composition has committed.

## 16. Enter-to-submit

Prefer native `<form>` submission semantics for forms.

Rules:

- primary submit actions use `<button type="submit">`;
- secondary actions inside forms use `<button type="button">`;
- do not add duplicate `(keydown.enter)` handlers to every input;
- multiline fields must not submit merely because Enter was pressed unless an explicitly documented shortcut exists;
- IME composition must complete before submission shortcuts can fire;
- duplicate in-flight submissions must be suppressed by product state.

## 17. Escape semantics

Escape means "leave the transient interaction" only where the active interaction pattern defines that behaviour.

Appropriate uses include:

- dismissing an approved dismissible dialog;
- closing a combobox/listbox/popup;
- cancelling a transient drag/edit state when that behaviour is documented.

Escape must not:

- navigate away from an ordinary page;
- clear persistent data without confirmation;
- trigger multiple nested dismissals from duplicate listeners;
- override a Spartan primitive already handling the same overlay.

## 18. Arrow-key semantics and RTL

Feature code must not manually invert Spartan or native Arrow-key behaviour for RTL.

The installed primitive or browser remains authoritative for standard controls. Product code uses logical start/end concepts for layout, but raw physical keyboard keys are interpreted by the control's interaction pattern.

For a feature-specific spatial control not covered by a standard primitive:

- document whether ArrowLeft/ArrowRight represent physical movement or logical previous/next;
- test both LTR and RTL;
- keep the decision inside one shared interaction boundary rather than duplicating it across feature screens.

## 19. Keyboard shortcuts

Application-level shortcuts are optional enhancements, never the only path to a feature.

A shortcut must:

- have an equivalent visible control;
- avoid common browser and assistive-technology shortcuts;
- ignore IME composition;
- ignore editable elements unless the shortcut is explicitly designed for editing;
- be discoverable in UI/help where non-obvious;
- be scoped to the active feature when possible;
- be removable without breaking the product action.

Do not register single-letter global shortcuts while a user may be typing.

## 20. Focus visibility

This standard does not redefine focus styling. `docs/focus-ring-architecture.md` remains authoritative.

Keyboard migrations must preserve:

- the global `:focus-visible` ring;
- Relay primary-token colour ownership;
- surface-aware ring offset;
- forced-colours behaviour;
- direction-neutral styling.

A component-specific style may strengthen focus presentation, but must not hide the global keyboard focus indicator.

## 21. High zoom, reflow and responsive layouts

Keyboard order must remain logical at 390px, tablet, desktop, 200% zoom and 400% zoom.

Responsive visual reordering must not make keyboard traversal appear to jump unpredictably around the screen.

If CSS grid/flex `order` would create a material mismatch between DOM order and visual order, change the composition instead of trying to repair keyboard order with tabindex.

Overlays must remain reachable and scrollable when zoomed. Focused controls must not be permanently obscured by fixed headers, sheets or virtual keyboards.

## 22. Themes, user accent and forced colours

Keyboard behaviour is theme-independent.

The same interaction contract applies to:

- light theme;
- dark theme;
- any valid user primary accent;
- forced-colours/high-contrast mode.

Do not change which keys work based on theme or accent. Do not use colour alone to indicate focus, selected state, expanded state or disabled state.

## 23. Translation and accessible names

Keyboard controls must keep meaningful translated accessible names.

Requirements:

- visible labels should normally provide the accessible name;
- icon-only controls require a translated accessible name;
- repeated actions require contextual names when the visible symbol/text is ambiguous;
- keyboard instructions should not duplicate standard semantics unless the interaction is non-standard;
- long translations must wrap without hiding focus or actions.

## 24. Migration examples

### Navigation card

Avoid:

```html
<div
  role="button"
  tabindex="0"
  (click)="openProfile()"
  (keydown.enter)="openProfile()"
  (keydown.space)="openProfile()"
>
  ...
</div>
```

Prefer:

```html
<a [routerLink]="['/profile', profile.id]">
  ...
</a>
```

### Command card

Avoid:

```html
<div appA11yClickable (click)="retry()">...</div>
```

Prefer:

```html
<button type="button" hlmBtn (click)="retry()">...</button>
```

### Dialog

Avoid a hand-built overlay with custom Tab cycling and document Escape listeners.

Prefer the owned Spartan Dialog composition and keep only product-specific close policy in the feature component.

### Single selection

Avoid several command buttons plus manual Arrow-key handlers for a single-choice field.

Prefer Spartan Radio Group with Relay presentation around the options.

### Form submission

Avoid:

```html
<input (keydown.enter)="save()" />
<button type="button" (click)="save()">Save</button>
```

Prefer a real form with a submit button and one submit handler.

## 25. Prohibited patterns

New code must not introduce:

- positive tabindex values;
- generic `div`/`span` buttons when native buttons or links fit;
- new uses of `appA11yClickable` without a documented exception;
- duplicated Enter/Space emulation for native or Spartan buttons;
- feature-owned roving tabindex for standard composites;
- feature-owned radio-group Arrow navigation when Spartan Radio Group is available;
- feature-owned combobox/listbox keyboard state when Spartan Combobox is available;
- document-level Escape handlers around Spartan Dialog;
- `keyCode`, `which` or numeric keyboard codes;
- keyboard shortcuts that fire during IME composition;
- `preventDefault()` on broad keyboard events without a claimed interaction key;
- pointer-only core actions;
- focus movement used as passive notification;
- CSS visual reordering that materially disagrees with DOM/Tab order;
- translated copy containing CSS or keyboard implementation decisions.

## 26. Allowed exceptions

A local keyboard handler is acceptable when all of the following are true:

- the behaviour is feature-specific rather than a standard widget state machine;
- no native semantic element owns the interaction;
- no approved Spartan/Relay primitive owns the interaction;
- pointer and keyboard behaviour remain equivalent where appropriate;
- IME/text-entry conflicts have been considered;
- tests cover the claimed keys and focus outcome;
- the implementation does not create a second focus trap or roving-tabindex system.

Examples may include a drawing canvas, specialised media timeline, game interaction, or domain-specific editor.

## 27. Testing contract

### Component/unit tests

Focused component tests should verify product contracts such as:

- semantic native element or approved Spartan primitive is used;
- native `disabled`/`type`/`href` semantics are preserved;
- the feature does not add synthetic role/tabindex handlers unnecessarily;
- pending state suppresses duplicate activation;
- close/selection outputs occur once;
- focus-sensitive product state remains stable after failures.

Do not write tests that reimplement browser behaviour by manually calling component methods and then claim keyboard accessibility is proven.

### Browser tests

Representative browser-level tests should exercise actual Tab/Shift+Tab and key presses for shared interaction classes. Highest-value paths include:

- opening and dismissing a dialog, including focus return;
- traversing a primary form and submitting it;
- operating a radio group;
- operating a combobox;
- traversing primary responsive navigation;
- completing a critical flow without pointer input.

### Accessibility states

Keyboard verification must include relevant coverage for:

- light and dark themes;
- LTR and RTL where Arrow/spatial behaviour matters;
- visible focus;
- disabled/busy state;
- error/retry state;
- long translated labels;
- high zoom/reflow for critical interactions;
- IME composition for Enter-based text actions.

## 28. Verification guard for #5518

Issue #5518 should implement the smallest effective executable migration guard rather than a broad regex ban that blocks legitimate keyboard code.

Recommended guard structure:

1. **Static migration scan**
   - flag new positive `tabindex` values;
   - flag new `role="button"` plus local Enter/Space emulation in feature templates;
   - flag new uses of `appA11yClickable` outside an explicit transitional allow-list;
   - flag new `keyCode`/`which` usage;
   - flag obvious local roving-tabindex implementations outside owned primitives;
   - report, but do not blindly ban, `(keydown.escape)` so legitimate feature-specific cases can be reviewed.

2. **Representative browser contract**
   - one native command/navigation flow;
   - one Spartan Dialog flow with focus return;
   - one Spartan single-selection flow;
   - one Spartan Combobox flow;
   - run keyboard-only assertions against both light and dark theme states;
   - include at least one RTL state for a composite where direction can matter.

3. **Expected failure mode**
   - fail with the file/path, pattern and migration guidance;
   - tell contributors which native/Relay/Spartan primitive should replace the violation;
   - permit narrowly documented allow-list entries for specialised controls.

The guard should be exposed through a root command such as `npm run check:keyboard-interaction-contract` and wired into the repository verification workflow by #5518.

## 29. Review checklist

Before approving an interaction migration, confirm:

- Is this a command, navigation, form control or composite widget?
- Can native HTML own the semantics?
- Does Relay already expose the interaction?
- Is the matching Helm/Brain primitive installed?
- Did the feature add any unnecessary role/tabindex/key handlers?
- Does Tab order match reading/visual order?
- Is visible focus preserved?
- Does disabled/busy state suppress duplicate activation?
- Is focus restored after transient overlays?
- Are text-entry shortcuts IME-safe?
- Are RTL and long translations safe?
- Does high zoom preserve focus visibility and action reachability?
- Are keyboard paths tested at the right layer?

## 30. Rollout and rollback

This issue changes architecture documentation only. It does not alter runtime key handling.

Follow-up migrations should remain small and independently revertible. Replacing a hand-built interaction with a native or Spartan primitive must preserve the feature's public inputs, outputs, route contracts and product side effects so the migration can be reverted without reverting unrelated business logic.

The verification guard belongs to #5518. Until that guard lands, this document is the canonical review contract for keyboard interaction work.