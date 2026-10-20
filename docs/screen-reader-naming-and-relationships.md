# Screen-reader naming and relationships

Issue: #5519 (`Spartan UI 0053`)

Status: authoritative screen-reader naming and relationship contract for the Relay + Spartan migration.

This document defines how accessible names, descriptions, groups, status relationships and structural relationships are owned, implemented, reviewed and verified in the Angular frontend. It supplements `DESIGN.md`, `AGENTS.md`, `frontend/AGENTS.md`, `docs/spartan-relay-architecture.md`, `docs/keyboard-interaction-standards.md`, `docs/touch-target-sizing.md` and `docs/translation-safe-component-apis.md`.

The core rule is simple: prefer native HTML relationships first, let Spartan Brain and owned Helm primitives preserve generic ARIA wiring, and make feature code provide product-specific translated names and descriptions without rebuilding accessibility mechanics.

## 1. Goals

The naming and relationship contract exists to ensure that:

- every interactive control has an accessible name that identifies its purpose;
- visible labels are programmatically associated with the controls they describe;
- icon-only controls have translated names without exposing decorative glyphs;
- validation, help, warning and status text is associated with the correct control or region;
- composite widgets expose the relationships required by their interaction pattern;
- overlays are named and described by content inside the overlay rather than unrelated page content;
- repeated controls are distinguishable in context;
- generated and dynamic IDs remain unique when multiple component instances exist;
- translations, RTL, theme changes, high zoom and responsive layout do not change the semantic relationship graph;
- feature code does not duplicate relationship logic already owned by Spartan Brain or Helm;
- screen-reader announcements remain useful without becoming noisy or repetitive.

This contract is about semantics, not visual styling. Relay tokens, light/dark themes and per-user accent colours may change presentation but must not change what assistive technology understands.

## 2. Current implementation audit

The repository already has strong accessibility foundations.

### 2.1 Existing strengths

- `frontend/AGENTS.md` requires WCAG AA, screen-reader support and Spartan Brain ownership for generic accessibility behaviour.
- Owned Helm controls expose ARIA inputs instead of swallowing them. For example, `HlmCheckbox` forwards `aria-label`, `aria-labelledby` and `aria-describedby` to the underlying Brain checkbox and also participates in Spartan Field description wiring through `BrnFieldControlDescribedBy`.
- Migrated forms increasingly use visible `<label for="...">` relationships rather than placeholder-only naming.
- Migrated dialogs increasingly use `aria-labelledby` and `aria-describedby` or the equivalent Spartan Dialog title/description composition.
- Repeated destructive actions increasingly include the affected user or item in their translated accessible name.
- Icon-only buttons increasingly hide decorative icons with `aria-hidden="true"` while placing the name on the button.
- Route navigation increasingly uses native anchors and `aria-current="page"` instead of synthetic button semantics.
- Loading and mutation states increasingly use `aria-busy`, status regions and disabled controls rather than colour-only state.

### 2.2 Current migration debt

The current codebase also contains patterns that must be converged during the Spartan migration.

#### Fixed IDs inside reusable components

Some reusable surfaces use literal IDs such as `trust-safety-title`, `trust-safety-description`, `trust-safety-tab-report` and `trust-safety-panel-report`. The relationships are semantically correct for a single instance, but literal IDs can collide if multiple instances are ever rendered in the same document.

Reusable components should prefer:

- native label nesting when practical;
- Spartan Field relationships when available;
- generated instance-safe IDs when explicit IDREF relationships are required.

#### Hand-built composite relationships

Some older components still own `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, roving `tabindex` and Arrow-key behaviour directly. That can be correct, but it duplicates a standard composite-widget relationship graph that should migrate to a suitable Spartan Brain primitive when one exists.

#### Generic repeated names

A repeated control named only `Delete`, `Remove`, `Play`, `Open`, `More` or `Retry` may be technically named but still ambiguous when a screen reader lists controls out of context. Repeated actions should include the target when that distinction is necessary, for example `Delete community {{ name }}`.

#### Placeholder-only fields

A placeholder is not a durable field label. It disappears while editing, can be omitted by assistive technology, and cannot reliably own validation/help relationships. Every user-editable field needs a programmatic label independent of placeholder text.

#### Static IDs tied to translated content

Translated text must never be used directly as an HTML `id`. Translation changes, punctuation, whitespace and duplicate phrases make it an unstable relationship key.

#### Unscoped live regions

A live region that wraps a large changing surface can announce unrelated changes repeatedly. Status announcements should be scoped to the smallest meaningful text node or semantic status region.

#### Visual proximity without semantic relationship

Text placed next to a control is not automatically its name or description. Help text, counters, limits and errors need explicit native or ARIA relationships when their meaning depends on the control.

## 3. Ownership model

Screen-reader semantics follow the existing UI ownership architecture.

### 3.1 Feature surfaces

Feature code owns product-specific meaning:

- the translated visible label;
- the translated accessible name for an icon-only or context-dependent action;
- which item, user, room, deck or message a repeated action refers to;
- product-specific help and consequence text;
- whether an asynchronous result is important enough to announce;
- the semantic heading and landmark structure of the feature;
- feature-specific validation messages;
- deciding which status should be polite versus urgent.

Feature code must not own generic widget relationship mechanics when native HTML or an approved Spartan primitive already provides them.

### 3.2 Relay primitives

Relay owns the product-facing API around shared controls and presentation. A Relay wrapper may standardise:

- a required `label` input;
- optional `description` and `error` inputs;
- translated icon-button naming inputs;
- consistent status/error presentation;
- product-level landmark and heading conventions;
- semantic token and responsive presentation.

Relay must not invent a second accessibility state machine beside Spartan Brain.

### 3.3 Spartan Helm

Owned Helm components bridge Relay/product inputs into Brain/native semantics. Helm is the correct layer for reusable forwarding such as:

- `aria-label`;
- `aria-labelledby`;
- `aria-describedby`;
- disabled and invalid state;
- generated IDs needed by a shared primitive;
- field-control description wiring.

A Helm wrapper must not drop ARIA attributes supplied by a feature or Relay wrapper.

### 3.4 Spartan Brain

Brain owns reusable headless relationship mechanics for supported patterns, including:

- dialog title/description/content relationships;
- combobox trigger, listbox and active-option relationships;
- checkbox/radio/field relationships;
- selection state and active descendants where the primitive uses them;
- overlay focus ownership tied to the semantic widget.

When Brain already supplies the graph, feature code should configure it rather than restating the same roles and IDREFs manually.

## 4. Accessible-name precedence

Accessible names should come from the clearest stable source available.

Preferred order for this project:

1. native visible label associated with the control;
2. visible text content inside a native button or link;
3. `aria-labelledby` when another visible element is the correct name source;
4. translated `aria-label` when there is no useful visible text, especially icon-only controls.

Do not add `aria-label` to every control by default. An `aria-label` overrides visible text in the accessibility tree and can create a mismatch between what sighted and non-sighted users perceive.

### 4.1 Visible text buttons

Good:

```html
<button hlmBtn type="button">
  {{ 'community.create' | t }}
</button>
```

Do not add a second `aria-label` unless the visible text is genuinely insufficient.

### 4.2 Icon-only buttons

Good:

```html
<button
  hlmBtn
  type="button"
  size="icon-touch"
  [attr.aria-label]="'dialog.close' | t"
>
  <ng-icon name="lucideX" aria-hidden="true" />
</button>
```

The translated name belongs on the interactive element. The decorative icon is hidden from the accessibility tree.

### 4.3 Repeated actions

Good:

```html
<button
  hlmBtn
  type="button"
  [attr.aria-label]="'community.deleteAria' | t: { name: community.name }"
>
  {{ 'community.delete' | t }}
</button>
```

The visible action remains concise while the accessible name distinguishes repeated controls.

Do not include private data in an accessible name unless it is already intentionally visible in the same UI context.

## 5. Field naming

### 5.1 Prefer native labels

For native inputs, textareas and native selects, use a visible label associated by `for` and `id`, or wrap the control inside its label when that composition is appropriate.

```html
<label for="profile-bio">{{ 'profile.bioLabel' | t }}</label>
<textarea hlmTextarea id="profile-bio"></textarea>
```

A placeholder may provide an example or hint, but never replaces the label.

### 5.2 Spartan Field composition

When the installed Spartan Field primitive fits the form, prefer its documented label, control, description and error composition. Let the field primitive own the generated description wiring instead of manually concatenating ID strings in every feature.

### 5.3 Required and invalid state

A visible `*` is not enough to communicate that a field is required. Preserve native/Brain required semantics.

Validation state must have:

- a visible error message;
- the primitive's invalid state or `aria-invalid="true"` where appropriate;
- an explicit relationship from the control to the error when the shared field primitive does not already provide it.

Do not put a validation error only in a toast. The field needs a local, persistent relationship to the error.

## 6. Names versus descriptions

A name answers: "What is this control or region?"

A description answers: "What extra information helps me use or understand it?"

Do not put long instructions inside an `aria-label` merely because the text is nearby.

Example:

```html
<label for="password">{{ 'auth.password' | t }}</label>
<input
  hlmInput
  id="password"
  aria-describedby="password-help password-error"
/>
<p id="password-help">{{ 'auth.passwordHelp' | t }}</p>
@if (passwordError()) {
  <p id="password-error">{{ passwordError() }}</p>
}
```

If IDs are feature-owned, they must be instance-safe and stable for the lifetime of that component instance.

## 7. ID and IDREF rules

ARIA relationships such as `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-owns` and `aria-activedescendant` depend on valid element IDs.

### 7.1 IDs must be unique

A reusable component must not assume only one instance can exist. Literal IDs are acceptable for true singleton page structure, but component-local relationships should be instance-safe.

### 7.2 IDs must be stable

Do not regenerate the ID on every change-detection pass. The value should remain stable while the relationship exists.

### 7.3 IDs must not expose private data

Do not build DOM IDs from raw email addresses, message text, access tokens, full user-generated content or other unnecessary personal data.

### 7.4 IDs must not depend on translated text

Use internal stable keys or generated instance identifiers, not the translated visible label.

### 7.5 Prefer primitive ownership

If Spartan Field, Dialog, Combobox or another Brain primitive already creates and maintains the relevant IDs, do not create parallel feature IDs.

## 8. Groups and composite widgets

### 8.1 Radio groups

A radio group needs one group name and correctly related options. Use Spartan Radio Group rather than manually applying `role="radio"`, `aria-checked` and Arrow-key movement to unrelated elements.

The visible group heading should be programmatically associated through the primitive's documented API or a native fieldset/legend when that composition fits.

### 8.2 Tabs

Tabs require a complete relationship graph:

- one tablist label;
- each tab has selected state;
- each tab controls one panel;
- each panel is labelled by its tab;
- keyboard/focus behaviour follows the tabs pattern.

Do not implement only the ARIA roles while omitting the keyboard model. Prefer a verified Spartan tabs primitive when available.

### 8.3 Comboboxes and listboxes

Combobox naming belongs to the input/trigger, not the popup list alone. Brain should own active option, expanded state and popup relationships.

Feature code owns the translated field label and the product meaning of options.

### 8.4 Menus

A menu trigger must be named as the action that opens the menu. The popup relationship and item keyboard mechanics belong to the shared primitive. A generic visible ellipsis icon needs a contextual name such as `More actions for {{ name }}` when repeated.

## 9. Dialogs and sheets

Every modal dialog or sheet must expose a useful name.

Preferred composition:

- visible dialog title through the Spartan Dialog title primitive;
- optional visible description through the Dialog description primitive;
- close controls with their own translated accessible name;
- product consequence text inside the dialog rather than buried in the close/action label.

Do not name a dialog only `Dialog`, `Modal`, `Confirm` or `Warning` when a specific visible title is available.

### 9.1 Avoid duplicate fixed IDs

Do not copy a pattern such as:

```html
<h2 id="dialog-title">...</h2>
<div aria-labelledby="dialog-title">...</div>
```

into a reusable component unless the component can guarantee uniqueness. Prefer the Spartan title composition or an instance-safe generated ID.

### 9.2 Focus and names are separate concerns

Dialog focus trapping and restoration belong to the dialog primitive. Naming the dialog correctly does not justify hand-building focus management, and using Spartan Dialog does not remove the feature's responsibility to provide meaningful translated title/description content.

## 10. Landmarks and page structure

Use native landmarks before adding ARIA roles.

- `<main>` for the primary page content;
- `<nav>` for navigation groups;
- `<header>` and `<footer>` where structurally appropriate;
- `<form>` for form submission regions.

When more than one landmark of the same type exists, give each a distinguishable accessible name where users need to tell them apart.

A feature should normally expose one primary `main` landmark. Nested components should not each add another `main` merely to obtain semantics.

Headings must describe structure, not styling. Do not use an `aria-label` as a substitute for a missing heading hierarchy.

## 11. Status, loading and live regions

### 11.1 `aria-busy`

Use `aria-busy="true"` on the smallest region whose content is genuinely being refreshed. It communicates in-progress state but does not by itself provide a useful status message.

### 11.2 `role="status"`

Use polite status announcements for important non-urgent outcomes such as:

- saved successfully;
- results updated;
- loading completed when completion needs announcement;
- retry succeeded.

Keep the status text concise and translated.

### 11.3 `role="alert"`

Use assertive alerts sparingly for failures or urgent consequences that require immediate attention. Do not mark ordinary helper text or every validation message as an alert by default.

### 11.4 Avoid broad `aria-live`

Do not put `aria-live` on an entire page, list or chat transcript merely because some child content updates. That can create repeated or overwhelming announcements.

### 11.5 Do not duplicate announcements

If a primitive already announces a state transition through appropriate semantics, do not add an extra live region that repeats the same message.

## 12. Dynamic collections

Lists that add, remove or reorder items need stable semantics.

- use native list markup for actual lists;
- give repeated controls contextual names;
- preserve focus after the operated item disappears;
- do not announce every background refresh;
- announce an explicit user-triggered result when it is important;
- keep `aria-setsize`/`aria-posinset` out of ordinary native lists unless a virtualised pattern genuinely requires them.

Virtualisation must preserve meaningful item names and relationships even when only a subset of DOM nodes exists.

## 13. Images, icons and media

### 13.1 Decorative icons

Decorative icons inside a named control use `aria-hidden="true"` unless the icon itself provides necessary standalone content.

Do not let both an icon name and a button label produce duplicate speech.

### 13.2 User images

Avatar alternative text should identify the visible user only when the image conveys that identity and the same information is not already adjacent in a way that would create needless repetition. Decorative avatars may use empty alternative text.

### 13.3 Media controls

Play, Pause, Mute, Unmute, playback speed and similar controls need state-aware names. Do not leave a control named `Play` while it is currently the Pause action.

### 13.4 Generated content

AI or user-generated text must be rendered as content, not interpolated into ARIA attribute names unless the product intentionally exposes the same text for that purpose. Bound and sanitise any dynamic label inputs just as other untrusted UI data is bounded.

## 14. Translation and language rules

All product-authored accessible names and descriptions are user-facing text.

Therefore:

- use `TranslatePipe` in templates;
- use `I18nService` for programmatic names;
- never hardcode English-only `aria-label` text in production feature templates;
- preserve interpolation parameters in every locale;
- test long translated labels;
- do not assume translated strings remain short enough for a fixed visual control;
- keep accessible-name semantics stable when the locale changes;
- set language boundaries for content that differs from the UI locale when required by the multilingual typography contract.

An icon-only button that visually contains no text still has user-facing copy through its accessible name and therefore follows the same translation rules.

## 15. RTL rules

ARIA relationships use IDs and semantic roles, not physical direction, so they should remain stable between LTR and RTL.

Do not change a control's semantic name merely because its visual side changes.

Directional actions are the exception. If an icon changes meaning with direction, the translated accessible name must describe the semantic action such as `Next page` or `Previous month`, not `Right arrow` or `Left arrow`.

Relationship order should follow DOM/reading order. Do not reorder described-by IDs to mirror visual left/right placement.

## 16. Responsive layout and high zoom

Responsive composition may move or stack visible labels, descriptions and controls, but must not break their semantic associations.

At 390px, tablet, desktop, 200% zoom and 400% zoom:

- labels remain associated with the same control;
- descriptions remain reachable through their IDREF relationship;
- repeated actions retain distinct names;
- no relationship depends on visual side-by-side proximity;
- hidden responsive duplicates are not simultaneously exposed to assistive technology;
- a desktop and mobile representation of the same navigation is named clearly if both can coexist during a breakpoint transition.

If a responsive layout renders two copies of a component, duplicate fixed IDs become especially dangerous. Prefer one semantic instance with CSS layout changes whenever practical.

## 17. Disabled, unavailable and pending state

The accessible name should normally remain stable while a control becomes disabled or busy.

Use state semantics for state, not rewritten labels such as `Disabled Save button`.

For an asynchronous command:

- keep the action name understandable;
- expose disabled/busy state through the native/primitive contract;
- optionally expose concise translated status text;
- do not make the accessible name oscillate every animation frame;
- restore the actionable state after retryable failure.

If a control is unavailable because the user lacks permission or entitlement, explain that consequence in nearby described text or the product flow rather than encoding a long policy paragraph into `aria-label`.

## 18. Error relationships

Error handling must distinguish field errors from operation errors.

### Field validation

Associate the error with the invalid control. Keep the visible error in the DOM while it is relevant.

### Operation failure

Use an error/status region near the operation and a clearly named Retry action. Do not attach an entire server error response to `aria-describedby`.

### Privacy

Never expose raw provider/database error text, tokens, private URLs or hidden identifiers through an ARIA attribute. Accessibility text is user-visible information and should receive the same privacy review as visible copy.

## 19. Native semantics versus ARIA

Follow the first rule of ARIA: do not add ARIA that duplicates or conflicts with native semantics.

Avoid:

- `role="button"` on `<button>`;
- `role="link"` on `<a href>`;
- `aria-disabled` without real interaction suppression when native `disabled` is available;
- `aria-checked` on a native checkbox when the native checked state is already authoritative;
- `tabindex="0"` on already-focusable native controls;
- `aria-label` that contradicts visible control text;
- `aria-hidden="true"` on a focusable element or an ancestor containing focusable content.

ARIA repairs semantics. It must not create a second, contradictory model beside HTML or Spartan Brain.

## 20. Component API contract

A reusable component that contains an interaction must make naming requirements explicit.

Good APIs tend to use one of these forms:

```ts
readonly label = input.required<string>();
readonly description = input<string | null>(null);
```

or rely on projected visible label/title content through a primitive that owns the relationship.

Avoid APIs where:

- naming is optional even though the control can render icon-only;
- callers pass raw generated IDs for ordinary field composition;
- callers must know internal DOM IDs to create a relationship;
- a generic `aria` object is passed untyped through several wrapper layers;
- a component silently invents an English fallback label such as `Button` or `Close`.

If a wrapper exposes ARIA attributes, keep them typed and forward them to the actual interactive element rather than the wrapper host when the host is not the semantic control.

## 21. Migration examples

### 21.1 Placeholder-only field

Before:

```html
<input hlmInput [placeholder]="'profile.searchPlaceholder' | t" />
```

After:

```html
<label for="profile-search">{{ 'profile.searchLabel' | t }}</label>
<input
  hlmInput
  id="profile-search"
  [placeholder]="'profile.searchPlaceholder' | t"
/>
```

### 21.2 Icon-only repeated action

Before:

```html
<button hlmBtn size="icon-touch">
  <ng-icon name="lucideTrash" />
</button>
```

After:

```html
<button
  hlmBtn
  type="button"
  size="icon-touch"
  [attr.aria-label]="'community.deleteAria' | t: { name: community.name }"
>
  <ng-icon name="lucideTrash" aria-hidden="true" />
</button>
```

### 21.3 Reusable dialog fixed ID

Before:

```html
<hlm-dialog-content aria-labelledby="confirm-title">
  <h2 id="confirm-title">{{ title() }}</h2>
</hlm-dialog-content>
```

After:

```html
<hlm-dialog-content>
  <h2 hlmDialogTitle>{{ title() }}</h2>
</hlm-dialog-content>
```

Use the installed Dialog API verified in the repository rather than guessing selectors in new code.

### 21.4 Helper and error text

Before:

```html
<label for="bio">{{ 'profile.bio' | t }}</label>
<textarea id="bio" hlmTextarea></textarea>
<p>{{ 'profile.bioHelp' | t }}</p>
```

After:

```html
<label for="bio">{{ 'profile.bio' | t }}</label>
<textarea
  id="bio"
  hlmTextarea
  aria-describedby="bio-help bio-error"
></textarea>
<p id="bio-help">{{ 'profile.bioHelp' | t }}</p>
@if (bioError()) {
  <p id="bio-error">{{ bioError() }}</p>
}
```

Prefer Spartan Field composition when it already provides this wiring.

## 22. Prohibited patterns

Do not introduce:

- placeholder-only form naming;
- hardcoded English `aria-label` strings;
- generic fallback labels such as `button`, `icon`, `modal` or `text input`;
- duplicate fixed IDs inside reusable components;
- IDs derived from translated text or sensitive user content;
- ARIA roles that duplicate native semantics;
- manual composite-widget IDREF graphs when an approved Spartan primitive owns the pattern;
- `aria-describedby` pointing to elements that may not exist in the same rendered state;
- `aria-labelledby` pointing to hidden or removed labels;
- focusable descendants inside an `aria-hidden="true"` subtree;
- whole-page `aria-live` regions;
- raw exception/provider text in an accessible description;
- state communicated only by colour, position or icon shape;
- two simultaneous responsive copies with colliding IDs;
- accessibility text that bypasses the translation workflow;
- tests that assert only that an ARIA attribute exists without checking that its referenced element exists and carries the expected meaning.

## 23. Verification contract

Issue #5520 should add the smallest effective automated migration gate for this standard.

The guard should not attempt to prove complete accessibility through static text matching. It should combine cheap repository checks with focused component tests.

### 23.1 Static guard candidates

A future `scripts/verify-screen-reader-naming.mjs` should detect high-confidence regressions such as:

- hardcoded English string literals in `aria-label` attributes in production Angular templates;
- obvious generic labels such as `aria-label="button"`, `aria-label="text input"`, `aria-label="icon"` and `aria-label="modal"`;
- positive `tabindex` values;
- focusable elements placed directly under an `aria-hidden="true"` pattern where statically detectable;
- duplicate literal IDs within one inline/external component template;
- `aria-labelledby`/`aria-describedby` literal references whose target literal ID is absent from the same static template where no primitive owns it.

The guard must allow:

- translated bindings such as `[attr.aria-label]="'key' | t"`;
- dynamic instance-safe IDs;
- Brain/Helm-generated relationships;
- test fixtures that intentionally demonstrate invalid markup;
- static singleton document IDs when they are scoped appropriately.

### 23.2 Component test expectations

Focused tests should verify meaning, not only syntax.

Examples:

- `getByRole('button', { name: ... })` finds an icon-only action by translated name;
- a label's `for` matches the rendered control ID;
- every ID referenced by `aria-describedby` exists in the active state;
- repeated Delete actions have distinct names;
- a dialog's accessible name resolves from its visible title;
- a radio group has a group name and correctly named options;
- loading/error states remain announced without duplicating the primary label;
- a responsive render does not create duplicate IDs.

Where Testing Library queries are unavailable, use DOM assertions that resolve the relationship target rather than checking the raw attribute alone.

### 23.3 Browser accessibility checks

Existing AXE/browser accessibility coverage remains valuable for invalid ARIA, missing names and duplicate IDs. Static and unit guards complement, rather than replace, browser checks.

### 23.4 Verification commands

For changes that implement this contract, run the relevant frontend verification gates:

```bash
cd frontend
npm run check:control-flow
npm run check:rtl-logical
npm run lint
npm run build
npm test -- --watch=false
```

From the repository root, also run:

```bash
npm run check:design-sync
```

when a mapped visual contract changes.

The follow-up #5520 guard should expose one focused command suitable for CI, for example:

```bash
npm run check:screen-reader-naming
```

Expected failure messages should identify the file, pattern and remediation rather than only returning a non-zero exit code.

## 24. Review checklist

Before approving a screen-reader naming or relationship change, confirm:

- [ ] Every interactive control has a meaningful name.
- [ ] Visible field labels are programmatically associated.
- [ ] Icon-only controls use translated names and decorative icons are hidden.
- [ ] Repeated actions are distinguishable where needed.
- [ ] Help/error text is related to the correct field or region.
- [ ] IDs are stable, unique and free of sensitive data.
- [ ] No translated text is used as an ID.
- [ ] Native semantics are not contradicted by redundant ARIA.
- [ ] Composite-widget relationships are owned by native HTML or Spartan Brain where possible.
- [ ] Dialogs and sheets have a meaningful visible name.
- [ ] Live regions are scoped and do not duplicate announcements.
- [ ] Loading, disabled and error states preserve naming.
- [ ] RTL does not change the semantic meaning of directional actions.
- [ ] 390px, tablet, desktop and high zoom do not break relationships.
- [ ] Light/dark theme changes do not alter semantics.
- [ ] Tests resolve relationship targets instead of checking attributes in isolation.
- [ ] No private or provider error data is exposed through accessibility text.

## 25. Definition of done for migrations

A migrated surface satisfies this architecture only when:

1. native HTML provides naming/relationship semantics wherever it fits;
2. Spartan Brain/Helm owns reusable widget relationship mechanics;
3. feature code supplies translated product meaning without duplicating primitive behaviour;
4. visible labels and descriptions are programmatically related to their controls;
5. repeated and icon-only actions are distinguishable;
6. dynamic IDs are stable and unique;
7. validation, loading and operation failures are exposed without noisy announcements;
8. RTL, responsive layout, theme changes and high zoom preserve the same semantic graph;
9. focused tests cover the important names and relationships;
10. the frontend verification gate is green.

The migration target is not "more ARIA". The target is a smaller, stable and correct accessibility relationship graph whose ownership is explicit across native HTML, Relay, Spartan Helm and Spartan Brain.