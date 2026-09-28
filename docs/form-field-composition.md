# Form-field composition standard

Issue: #5539 (`Spartan UI 0073`)

Status: authoritative architecture contract for form-field composition during the Relay + Spartan migration.

This document defines how HelloTalk composes labels, controls, descriptions, validation and submission state in Angular forms. It supplements `DESIGN.md`, `AGENTS.md`, `frontend/AGENTS.md`, `docs/spartan-relay-architecture.md`, `docs/screen-reader-naming-and-relationships.md` and `.claude/skills/spartan/rules/forms.md`.

The core rule is: **feature code owns product meaning and form state; Spartan Field owns reusable field relationships; Helm/native controls own control semantics; Relay tokens own presentation.** A feature must not hand-build a second field accessibility system when the approved Spartan composition can express the same behaviour.

## 1. Goals

The form-field contract exists to ensure that:

- every editable control has a durable programmatic label;
- descriptions, limits and validation messages are associated with the correct control;
- required, invalid, disabled, read-only and pending states are exposed semantically as well as visually;
- keyboard, pointer and assistive-technology behaviour comes from native HTML or Spartan Brain rather than feature-specific state machines;
- form controls remain usable at the 390px mobile baseline and at 200% and 400% zoom;
- light and dark themes use Relay semantic roles and preserve the per-user primary accent;
- RTL uses logical layout properties rather than duplicated templates or physical direction utilities;
- translated labels, descriptions and validation copy can grow without clipping or breaking the relationship graph;
- forms degrade honestly when asynchronous validation or persistence fails;
- reusable field composition is consistent enough to verify mechanically without coupling feature code to Spartan implementation details.

This standard does not change product validation rules, API schemas or persistence behaviour by itself. It defines the contract future form migrations must follow.

## 2. Current implementation audit

### 2.1 Existing strengths

The repository already has several pieces of the target architecture:

- `frontend/AGENTS.md` makes Spartan UI the canonical interaction architecture and explicitly requires Spartan Field composition for forms.
- `.claude/skills/spartan/rules/forms.md` already identifies `hlmField`, `hlmFieldLabel`, `hlmFieldDescription` and `hlm-field-error` as the intended composition.
- Owned Helm controls exist under `frontend/src/app/components/ui/` for input, textarea, native select, select, checkbox, radio group and other control types.
- `HlmInput` already owns the basic input presentation and responds to `aria-invalid`, disabled state and focus-visible state.
- `docs/screen-reader-naming-and-relationships.md` already requires visible labels, stable IDs, local validation messages and explicit name/description relationships.
- Feature migrations increasingly use native labels, Spartan controls and translated copy rather than bespoke div-based controls.
- Relay semantic tokens already provide the product colour, radius, shadow and theme layer needed around controls.

### 2.2 Current migration debt

The current tree does not yet have one consistent field-composition owner.

#### Spartan Field is documented but not installed in the owned Helm tree

At the time of this audit, code search finds the Field selectors in the Spartan guidance but no generated `frontend/src/app/components/ui/field/` implementation on `main`. Feature code therefore cannot yet rely on a repository-owned Field primitive without first adding it through the Spartan CLI and verifying the installed API.

The migration sequence must not work around this by inventing an `app-field` state machine from memory. The implementation ticket that introduces Field must use `@spartan-ng/cli:info --json`, confirm the current installed/available components, generate the official Field Helm component, and inspect the generated selectors before converting callers.

#### Labels and field layout are still hand-composed in features

For example, `ProfileEditComponent` places repeated `<label for="...">` elements beside `hlmInput` and `hlm-native-select` controls. The native relationships are useful and should be preserved, but spacing, label treatment, description/error placement and invalid-state wiring are feature-owned instead of sharing one field composition.

#### Relay `AppInputComponent` combines field and control responsibilities

`frontend/src/app/components/primitives/input/input.component.ts` renders both an optional label and an `hlmInput`. This is convenient for simple cases but it conflates two layers:

- the input primitive should represent the control;
- field composition should represent label, description, error and layout relationships.

It also exposes `customClass`, which lets feature callers bypass the owned control presentation. Existing usages remain compatible during migration, but new form architecture should not expand this pattern.

#### Validation relationships vary by surface

Some forms correctly use `aria-describedby` and local error text, while others display nearby text without a consistent relationship. A toast or page-level error cannot substitute for a local validation message when the failure belongs to one field.

#### Control selection is inconsistent

The repository contains native inputs/selects, Helm controls and Relay wrappers side by side. This is expected during migration, but future work needs one decision rule so feature code does not choose a control based on whichever API is most convenient in that file.

## 3. Ownership model

### 3.1 Feature surface

Feature code owns:

- the product field meaning;
- translated label, description, hint and validation keys;
- the Angular form model and product validation rules;
- when a field is required, disabled, read-only or pending;
- submission orchestration and server-error mapping;
- whether a server failure belongs to one field, the whole form, or both;
- feature-level layout around groups of fields;
- analytics attached to product actions, never generic focus/keystroke behaviour.

Feature code must not own generic label/error ID wiring, focus-ring styling, checkbox/radio keyboard state, combobox selection mechanics or other behaviour already provided by the approved primitive.

### 3.2 Spartan Field

Spartan Field is the canonical reusable composition owner for a field when its documented API fits the use case.

Field owns:

- the structural relationship between label, control, description and error;
- reusable invalid/disabled state propagation supported by the current Spartan API;
- field layout primitives and fieldset composition supplied by Spartan;
- generic relationship IDs or described-by wiring supplied by Brain/Helm.

Field does **not** own product validation rules, translated copy, API errors or feature submission state.

### 3.3 Helm control

The appropriate owned Helm primitive owns the actual control presentation and generic semantics:

- `hlmInput` / `hlmTextarea` for free text;
- native select or Spartan Select for list selection, according to interaction needs;
- Combobox/Autocomplete for searchable larger collections;
- Checkbox/Switch for boolean choices with the correct product semantics;
- Radio Group or Toggle Group for small fixed choices;
- Slider for bounded numeric ranges;
- Input OTP for one-time codes;
- native `<fieldset>`/`<legend>` plus Spartan fieldset directives for related control groups.

Generated Helm code should stay close to upstream. Product-specific copy and validation do not belong in generated Helm files.

### 3.4 Relay presentation

Relay owns the product visual roles around the field:

- semantic surfaces and borders;
- `text-primary`, `text-secondary` and `text-muted` hierarchy;
- `danger`, `success`, `warning` and `on-fill` states;
- the dynamic `primary` accent rather than a hardcoded brand colour;
- application radii, spacing, focus visibility and responsive layout conventions.

A field may use Helm directly while the migration is in progress. If a repeated product-level field pattern emerges, create a narrow Relay wrapper around documented Spartan composition rather than duplicating the same template across features.

## 4. Canonical field anatomy

For a normal editable field, the semantic order is:

1. label;
2. control;
3. optional description/help text;
4. optional validation error.

Visual layout may vary, but DOM order should remain logical at high zoom and in RTL.

Once Spartan Field is installed and its current API is verified, the preferred shape is conceptually:

```html
<div hlmField>
  <label hlmFieldLabel for="profile-display-name">
    {{ 'profileEdit.displayName' | t }}
  </label>

  <input
    hlmInput
    id="profile-display-name"
    [value]="displayName()"
    [attr.aria-invalid]="displayNameError() ? 'true' : null"
    (input)="onDisplayNameInput($event)"
  />

  <p hlmFieldDescription>
    {{ 'profileEdit.displayNameHelp' | t }}
  </p>

  @if (displayNameError()) {
    <hlm-field-error>
      {{ displayNameError() | t }}
    </hlm-field-error>
  }
</div>
```

The exact selectors/imports must be confirmed from the installed Spartan version before implementation. This document describes ownership and relationships, not permission to guess an unverified API.

If Field is unavailable for a migration in progress, preserve native HTML relationships rather than introducing a bespoke pseudo-Field abstraction:

```html
<div class="grid gap-2">
  <label for="profile-display-name" class="text-sm font-medium text-text-secondary">
    {{ 'profileEdit.displayName' | t }}
  </label>
  <input
    hlmInput
    id="profile-display-name"
    [attr.aria-describedby]="displayNameError() ? 'profile-display-name-error' : null"
    [attr.aria-invalid]="displayNameError() ? 'true' : null"
  />
  @if (displayNameError()) {
    <p id="profile-display-name-error" class="text-sm text-danger">
      {{ displayNameError() | t }}
    </p>
  }
</div>
```

This compatibility pattern is temporary. Do not build a new shared field library around it while the approved Spartan Field component is available to install.

## 5. Labels and accessible names

Every user-editable field requires a durable programmatic name.

Preferred order:

1. visible `<label>` associated with a native/Helm control;
2. Spartan Field Label using the documented relationship model;
3. `aria-labelledby` only when the visible naming element cannot be represented by the first two;
4. translated `aria-label` only when there is intentionally no visible label.

Rules:

- a placeholder is a hint, not a label;
- translated text must not be used as an HTML ID;
- reusable components must not use fixed IDs that can collide across instances;
- IDs must not contain emails, message text, access tokens or unnecessary personal data;
- an `aria-label` must not override a useful visible label with different wording;
- repeated controls need context-specific names when their visible labels are otherwise ambiguous.

## 6. Description, help and limits

Descriptions explain how to use a field; they do not replace its label.

Use the Field description primitive when available. Otherwise associate help text with `aria-describedby` using an instance-safe ID.

Character limits, formatting hints and consequences should be associated only when they materially help users operate the field. Do not concatenate large blocks of prose into an accessible name.

Dynamic counters should not become noisy live regions on every keystroke unless the product genuinely requires continuous announcement. Prefer a stable description and announce only important threshold/status changes.

## 7. Validation and error contract

### 7.1 Client validation

Client validation may improve responsiveness but does not replace backend validation. Product constraints should be represented consistently in the Angular form state and mapped into the local field error.

When a field is invalid:

- display a local translated error;
- expose the control as invalid using the primitive-supported state or `aria-invalid`;
- ensure the error is programmatically described by the control if Spartan Field does not already wire it;
- preserve user input so correction is possible;
- do not communicate failure by colour alone.

### 7.2 Server validation

Server validation remains authoritative. Map known field-level failures back to the relevant field without reflecting raw provider/database errors into the UI.

Unknown or cross-field failures belong in a form-level error region. A form-level error does not remove the need for local field errors when the server identifies a specific field.

### 7.3 Error announcement

Avoid making every validation message an assertive `role="alert"`. Use the semantics supplied by Field where appropriate and reserve assertive announcements for failures that require immediate attention. Submission failures should remain visible and retryable.

### 7.4 Validation timing

Do not validate destructively on every keystroke when that creates distracting error churn. Prefer validation on a meaningful state transition such as blur, submit or a completed structured selection unless the product requirement calls for live validation.

## 8. Required, optional, disabled and read-only state

- Required fields must expose native/primitive required semantics. A visual asterisk alone is insufficient.
- Optional labelling is product copy and must be translated.
- Disabled controls must be genuinely non-interactive through the native/Brain disabled state, not only dimmed with CSS.
- Read-only fields remain focusable/readable when their content needs to be copied or reviewed and should use the native read-only contract where supported.
- Do not use `aria-disabled="true"` on an otherwise active control as a substitute for disabling its action.
- A pending server mutation may temporarily disable the affected control/action, but the UI must expose a useful busy/status state and must not silently discard edits on failure.

## 9. Async validation and submission

Form state must distinguish at least:

- idle/ready;
- validating or submitting;
- field validation failure;
- form/server failure;
- success.

Rules:

- suppress duplicate submissions while an equivalent request is in flight;
- keep entered data after retryable failures;
- apply server-confirmed state only after the mutation succeeds;
- prevent stale async completions from overwriting newer user input or a newer request;
- do not expose provider/database error text to the user;
- status copy is translated and scoped to the smallest meaningful region;
- focus recovery after a failed submit should move only when it materially helps the user, normally to a form-level error summary or the first invalid field after an explicit submit.

## 10. Control selection

Choose the control by semantics, not by visual appearance.

| Product need | Preferred control |
| --- | --- |
| Free text | Input or Textarea |
| Password/email/URL/number | Native semantic input type through the owned input control |
| Short fixed single choice | Radio Group or Toggle Group when semantics match |
| Long single-choice list | Select or searchable Combobox/Autocomplete |
| Boolean acknowledgement | Checkbox |
| Immediate boolean setting | Switch |
| Bounded numeric range | Slider |
| One-time code | Input OTP |
| Related controls | Native fieldset/legend with Spartan fieldset composition |

Do not use a styled div to imitate a native control. Do not use a Select for a searchable language catalogue when Combobox is the intended interaction. Do not use free-text fields for discovery filters that are intentionally list-driven.

## 11. Angular form-state contract

New forms should follow the signal-first rules in `frontend/AGENTS.md`:

- prefer Signal Forms where the current Angular stable API fits the feature;
- otherwise use reactive forms for complex forms;
- use component signals for genuinely local field state;
- derive validation/presentation state with `computed()` rather than duplicating it;
- do not introduce `Subject`/`BehaviorSubject` form state;
- do not use `.subscribe()` as a component state-management mechanism;
- use `resource()` for async reads and explicit Promise-based mutation methods for writes where existing repository patterns require them.

Migration work does not need to rewrite an otherwise correct form API solely to adopt Field. Separate interaction/presentation migration from business-state rewrites unless the current implementation is itself defective.

## 12. Styling and token contract

Field presentation must use Relay semantic roles.

Allowed examples:

- `text-text-primary`, `text-text-secondary`, `text-text-muted`;
- `border-surface-*` and `bg-surface-*` roles where the owned Helm component does not already provide the surface;
- `text-danger`/`border-danger` for invalid state;
- `primary` for the per-user accent and `on-fill` for text on saturated primary fills;
- Relay radius/shadow roles where a field container genuinely needs them.

Prohibited:

- new hardcoded hex/rgb/hsl product colours;
- raw Tailwind palette classes for product state where a Relay role exists;
- assuming white is valid text on `primary` in both themes;
- feature-level restyling that duplicates the full `hlmInput`, checkbox, select or other owned Helm class list;
- storing Tailwind classes in translation dictionaries.

Feature classes should normally be limited to layout, width and context-specific spacing. Product-wide control styling belongs in Relay tokens or the owned Helm component.

## 13. Responsive, zoom and RTL contract

### 13.1 Mobile and zoom

At 390px and at 200%/400% zoom:

- labels, descriptions and errors may wrap;
- required controls and actions remain reachable without two-dimensional page scrolling unless the control itself inherently requires it;
- no fixed-height field wrapper clips translated text or validation content;
- form actions may stack rather than compress below useful touch sizes;
- a field must not rely on placeholder truncation to communicate its meaning.

### 13.2 RTL

Use logical properties (`ps`, `pe`, `ms`, `me`, `start`, `end`, `border-s`, `border-e`, `text-start`, `text-end`) for directional layout.

Do not mirror field DOM order manually for RTL. Native/Spartan control semantics and logical layout should carry directionality. User-entered text with unknown direction may use `dir="auto"` when appropriate for that product field.

### 13.3 Theme and forced colours

Light and dark themes are equally supported. Invalid/disabled/selected states must remain understandable in forced-colours/high-contrast environments and cannot depend only on background colour.

## 14. Grouped fields

Use a semantic group when several controls answer one question.

- Checkbox/radio families should use native `<fieldset>` and `<legend>` with Spartan fieldset directives where appropriate.
- A group-level description belongs to the group, not duplicated on every child control.
- Child validation belongs to the child when the error is specific; cross-field validation belongs to the group/form.
- Do not use a `<div role="group">` when a native fieldset expresses the same relationship.

## 15. Migration examples

### 15.1 Hand-built field to canonical field

Before:

```html
<div class="mb-4">
  <label for="website">{{ 'profile.website' | t }}</label>
  <input
    hlmInput
    id="website"
    class="w-full rounded-lg border border-surface-100 bg-surface-200 px-4 py-2"
  />
  @if (websiteError()) {
    <p class="text-danger">{{ websiteError() | t }}</p>
  }
</div>
```

Migration:

1. Keep the product field model and validation rule unchanged.
2. Confirm the current Field component API from installed Spartan tooling.
3. Move label/control/description/error structure to the approved Field composition.
4. Remove feature classes that duplicate Helm control presentation.
5. Preserve only feature layout classes not owned by Field/Helm.
6. Verify invalid/description relationships in the component test.
7. Verify light/dark, RTL, 390px and high-zoom behaviour.

### 15.2 Placeholder-only field

Prohibited:

```html
<input hlmInput [placeholder]="'search.placeholder' | t" />
```

Required direction:

```html
<label for="search-query" class="sr-only">{{ 'search.label' | t }}</label>
<input hlmInput id="search-query" [placeholder]="'search.placeholder' | t" />
```

Use a visible label unless the product intentionally calls for a visually hidden label.

### 15.3 Error only in a toast

Prohibited:

```ts
if (!emailIsValid()) {
  this.toast.error('settings.invalidEmail');
  return;
}
```

Required direction: set translated field-validation state and render it beside/through the field; a toast may additionally summarise a failed explicit submission but must not be the only relationship.

### 15.4 Feature-owned control skin

Prohibited:

```html
<input
  hlmInput
  class="rounded-lg border border-surface-100 bg-surface-200 px-4 py-2 text-text-primary focus:ring-2 focus:ring-primary"
/>
```

when those classes merely recreate the owned input presentation. Keep only layout classes the field genuinely needs, for example `class="w-full"`, and change shared control styling at the Helm/Relay layer.

## 16. Prohibited patterns

New or migrated forms must not introduce:

- placeholder-only accessible names;
- visual text next to a control without a programmatic label relationship;
- translated text used as an element ID;
- fixed IDs inside reusable form components when multiple instances can render;
- field errors shown only by colour, tooltip or toast;
- direct `@spartan-ng/brain` imports in feature code when an owned Helm/Relay primitive exists;
- hand-built keyboard/focus state for Select, Combobox, Radio Group, Checkbox, Switch or Slider where Spartan owns the interaction;
- raw palette colours or hardcoded product colours for field state;
- physical left/right margin, padding, border or positioning utilities;
- feature-level class strings that duplicate the complete Helm control skin;
- generic `customClass` escape hatches in new field abstractions;
- disabled-looking controls that remain actionable;
- mutation success state before server confirmation;
- clearing user input after a retryable persistence failure;
- raw server/provider error messages rendered into field copy;
- unbounded translated descriptions/errors inside fixed-height containers;
- a new local `app-field` implementation that competes with an available Spartan Field primitive.

## 17. Required verification guard

Issue #5540 is the follow-up migration verification gate for this standard. It should implement the smallest useful static/runtime checks without trying to infer every form rule from text alone.

The recommended guard has two layers.

### 17.1 Static repository checks

A dependency-free scanner should inspect Angular feature templates and report new/migrated field patterns that:

- use an editable native `<input>`, `<textarea>` or `<select>` without an approved Helm/Relay control, except narrowly documented cases such as hidden/file inputs;
- introduce placeholder-only named editable controls;
- introduce physical direction utilities in field composition;
- add raw palette/hardcoded product-colour classes around field state;
- import Spartan Brain directly from feature code when an owned Helm/Relay control exists;
- introduce a second shared field primitive while the approved Spartan Field path exists.

The scanner needs an explicit, reviewed allow-list for intentional native cases. It must fail with the file and rule name so migration failures are actionable.

### 17.2 Focused component tests

Static checks cannot prove relationship correctness. Migrated form components should have focused Angular tests for the applicable contract:

- visible label points to the correct control;
- description/error relationship is present;
- invalid/required/disabled/read-only state reaches the actual control;
- duplicate component instances do not create duplicate IDs;
- async failures preserve user-entered values;
- duplicate submissions are suppressed where relevant;
- RTL/high-zoom-safe classes and translated-copy states are represented where the component has special layout behaviour.

If #5540 introduces a shared Field wrapper, that primitive needs its own complete public-contract test before feature migrations depend on it.

## 18. Verification commands

This architecture-only change does not alter runtime Angular behaviour, so it does not require a new visual preview or component test by itself. Implementation PRs governed by this standard must run the frontend completion gate:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

When a mapped visual contract changes, also run the repository design-sync check from the repository root. Broad Spartan migrations or package upgrades additionally run the Spartan healthcheck required by `frontend/AGENTS.md`.

The expected failure mode for the future #5540 gate is a non-zero exit with the offending file and violated form-field rule. Component tests should fail on the specific semantic/state regression rather than relying on screenshots alone.

## 19. Rollout and rollback

This issue establishes architecture only. It introduces no API, schema, persistence, authentication or runtime UI change, so rollout is the normal documentation merge.

Subsequent migrations should be incremental:

1. install/verify Spartan Field through the CLI;
2. add the #5540 verification gate;
3. migrate shared field/control primitives;
4. migrate feature forms in bounded batches;
5. update tests and design previews for changed visual/interaction contracts;
6. keep each migration independently revertible.

If a migrated field regresses accessibility or product behaviour, revert that migration rather than weakening the standard or shipping a parallel ad hoc field abstraction. No data rollback is required for this architecture document.
