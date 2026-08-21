# Communities Spartan/Relay audit

Tracks issue #6056 for `frontend/src/app/components/communities/`.

## Scope and current ownership

`CommunitiesComponent` is a standalone Angular feature component for listing communities owned by the current user and creating or deleting them. It already consumes Spartan Helm for both text inputs (`HlmInput`) and buttons (`HlmButton` / `hlmBtn`). It does not import Spartan Brain directly.

The component owns feature orchestration only:

- load the current user's communities through `CommunitiesService.listMine()`
- collect a required community name and optional description
- create a community through `CommunitiesService.create()`
- delete a community through `CommunitiesService.remove()`
- reload the resource after successful create or delete mutations

There is no navigation, overlay, dialog, menu, local persistence or analytics hook in this component.

## Control and state inventory

| Surface              | Current implementation                                                     | Behaviour/state                                             | Spartan/Relay mapping                                | Migration action                                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page heading         | Native `<h1>` with Relay text utilities                                    | Static translated title                                     | Semantic heading + Relay typography tokens           | Keep semantic heading. No interactive primitive is required.                                                                                                |
| Create form          | Native `<form>` with `ngSubmit`                                            | Submits the create mutation                                 | Native form semantics composed with Spartan controls | Keep the form boundary and submit semantics. Do not replace it with pointer-only handlers.                                                                  |
| Community name field | Native `<input hlmInput>` bound to `newName`, `required`, placeholder only | Required create input                                       | Spartan Helm input (`HlmInput`)                      | Keep Helm ownership. Add a persistent accessible label instead of relying on placeholder text as the field name.                                            |
| Description field    | Native `<input hlmInput>` bound to `newDescription`, placeholder only      | Optional create input                                       | Spartan Helm input (`HlmInput`)                      | Keep Helm ownership. Add a persistent accessible label.                                                                                                     |
| Create action        | Native `<button hlmBtn type="submit">`                                     | Creates a community, clears both fields, reloads list       | Spartan Helm button (`HlmButton`)                    | Keep Helm ownership. Preserve native submit behaviour and define pending/disabled feedback in the migration stage.                                          |
| Community collection | Native `<ul>` populated from the resource                                  | Loaded list of owned communities                            | Relay collection composition                         | Keep native list semantics. The collection does not require a bespoke Brain primitive.                                                                      |
| Community item       | Native `<li>` with Relay surface/border/radius utilities                   | Displays user-authored name and optional description        | Relay surface/card composition                       | Keep as a feature-level composition. Do not create a new interaction primitive because the row itself is not actionable.                                    |
| Delete action        | Native `<button hlmBtn>` inside each item                                  | Immediately deletes the selected community and reloads list | Spartan Helm button, destructive treatment           | Keep Helm ownership. Use the approved destructive presentation contract rather than feature-specific danger styling once that wrapper/variant is available. |
| Empty state          | Translated `<p>` emitted by the `@empty` branch                            | Displayed when computed list is empty                       | Relay empty-state composition                        | Preserve the state, but render valid list markup and distinguish a genuinely empty loaded result from loading/error where practical.                        |
| Loading state        | No explicit UI                                                             | Resource may not yet have resolved                          | Relay async-state recipe                             | Add an explicit non-blocking loading representation during the migration stage instead of presenting loading as empty.                                      |
| Error state          | No explicit UI                                                             | Resource/create/delete failures are not surfaced locally    | Relay error/feedback recipe                          | Add an accessible error path during the migration stage without changing service contracts.                                                                 |

## Data and side-effect contract

`CommunitiesService` owns all HTTP operations. The component must continue to use that service rather than moving API calls into presentation primitives.

Current side effects are:

1. Initial resource load calls `CommunitiesService.listMine()`.
2. Create trims the name and returns early if the trimmed value is empty.
3. Create trims the description and omits it from the payload when empty.
4. A successful create clears both form signals and reloads the communities resource.
5. Delete calls `CommunitiesService.remove(id)` and reloads the communities resource after success.

There is no current route contract to preserve. No action in this component calls `Router` or renders a router link.

A Spartan/Relay conversion must not move mutations into shared UI primitives. Shared primitives receive state and emit intent; this feature component remains responsible for calling `CommunitiesService`.

## Spartan and Relay ownership

The existing Helm integration is the correct dependency direction. Feature code consumes Helm presentation directives and does not reach into Spartan Brain internals.

### Keep as Spartan-owned controls

- `HlmInput` for both text fields
- `HlmButton` / `hlmBtn` for Create and Delete

The migration must not replace those controls with custom clickable containers or duplicate input/button interaction logic in the feature.

### Keep as Relay feature composition

The community row, collection, page layout and async feedback are compositions rather than new low-level controls. They should be built from semantic HTML plus Relay tokens and any approved shared wrappers already present in the registry.

No new Brain primitive is justified by this surface.

### Extension-slot assessment

No permanent custom interactive widget exemption is required. The community item is currently display-only content with a nested Spartan Delete button. If a reusable Relay card/collection recipe becomes canonical later, this component can adopt it without changing its data or mutation contracts.

The empty, loading and error presentations should likewise consume a shared Relay state recipe if one exists at implementation time. If no shared recipe exists, keep them as small feature compositions rather than introducing a one-screen primitive.

## Accessibility requirements

The remaining migration work must address the following concrete gaps while preserving existing behaviour:

1. **Give both inputs persistent accessible names.** Placeholder text is not a substitute for a `<label>`. Associate translated labels with each control using `for`/`id` or an equivalent accessible labelling relationship.
2. **Preserve native form submission.** The Create action must remain a real submit button so keyboard and assistive-technology activation work without custom key handlers.
3. **Expose mutation progress.** While create or delete is pending, prevent accidental duplicate mutation where appropriate and expose meaningful busy/status feedback without trapping focus.
4. **Expose failures.** Resource and mutation failures need an accessible error message or alert path. A failure must not silently resemble an empty list.
5. **Keep destructive controls unambiguous.** Each Delete button must have an accessible name that identifies its purpose in context. If repeated visible text remains only `Delete`, add contextual labelling that includes the community name without changing the visible copy unnecessarily.
6. **Preserve visible focus.** Do not remove Spartan's focus treatment with feature CSS. Any additional classes must retain a clear keyboard focus indicator in light, dark and forced-colour modes.
7. **Keep list markup valid.** The current `@empty` branch emits a `<p>` directly under `<ul>`. Move empty-state content outside the list or render it in valid list structure so semantics remain predictable.
8. **Do not announce static content as live.** Loading, success and error announcements should be scoped to genuine state transitions rather than applying `aria-live` broadly to the whole page.

A confirmation dialog is not part of the current delete contract. Do not add one solely as part of primitive conversion. If product requirements later introduce confirmation, use the approved Spartan dialog path and test focus restoration separately.

## RTL and multilingual requirements

- All product-authored strings remain translated through `TranslatePipe` using the current `| t` contract.
- Community names and descriptions are user-authored content and must not be passed through translation lookup.
- Keep layout spacing direction-neutral or use CSS logical properties / `ps`, `pe`, `ms`, `me`, `border-s`, `border-e` utilities when a directional rule is required.
- The current `gap`, `mb`, `mt`, padding, centred text fields and `justify-between` layout do not encode left/right assumptions.
- Do not introduce directional icons without defining their RTL mirroring behaviour.
- Labels, errors and status copy must tolerate text expansion and multiline scripts without clipping controls at mobile width.
- Retain the platform/system body font for translated and user-generated content according to `DESIGN.md`; do not apply a Latin-focused display face to community names or descriptions.

## Theme and token requirements

The component already uses Relay semantic colour tokens such as `text-text-primary`, `text-text-secondary`, `border-surface-100`, `bg-surface-300`, `bg-primary`, `text-on-fill` and `text-danger`. Continue using semantic tokens so both light and dark themes and the per-user primary accent remain first-class.

Migration work must not replace these with hardcoded hex, palette-specific Tailwind colours or fixed white text on saturated fills. The Create action correctly pairs the dynamic primary fill with `text-on-fill`; preserve that semantic pairing.

Where a Spartan/Relay wrapper already owns radius, border, focus or state styling, prefer the wrapper contract over restating the same presentation in feature classes. Feature classes may still own page layout and genuinely feature-specific composition.

## Migration risks and failing-state notes

1. **Loading currently aliases to empty.** `communities` computes `resource.value() ?? []`, so an unresolved value can render the empty branch. A visual migration can accidentally cement this ambiguity unless loading is represented explicitly.
2. **Errors are not rendered.** Rejected list/create/delete operations currently have no local feedback path. Migration tests should cover this rather than only the happy path.
3. **Duplicate submissions are possible.** The form has no explicit pending/disabled state around asynchronous create. Preserve one mutation per deliberate submission when pending UI is introduced.
4. **Delete is immediate.** Do not accidentally change the product flow while replacing visual styling. Any confirmation behaviour belongs in a separately reviewed product change.
5. **The empty branch is semantically misplaced.** A `<p>` directly beneath `<ul>` is invalid list content and should be corrected when the surface is converted.
6. **Input labels are missing.** Placeholder-only naming is an accessibility gap that must not survive the migration.
7. **Delete context is weak for repeated controls.** Multiple identical `Delete` labels require contextual accessible naming so screen-reader users can distinguish targets.
8. **No focused component spec exists at the conventional `communities.component.spec.ts` path on `main`.** The implementation stage should add focused coverage before relying only on broad frontend gates.

## Required regression coverage for the migration stage

Add or preserve focused tests for:

- initial owned-community load
- successful create payload after trimming name and description
- omission of an empty description
- input reset and resource reload after successful create
- delete with the selected community id and resource reload after success
- empty loaded state
- distinct loading and failure feedback once implemented
- persistent accessible labels for both inputs
- contextual accessible names for repeated Delete actions
- keyboard submission through the native form
- valid collection/list semantics
- light/dark semantic-token ownership, RTL-safe layout and high-zoom text wrapping through the repository's existing design checks

Tests must mock `CommunitiesService`; they must not depend on a live backend.

## Verification

This audit is documentation-only. The follow-on implementation should run the focused component test plus the normal frontend gates that exist in `frontend/package.json`:

```bash
cd frontend
npm test -- --include='src/app/components/communities/communities.component.spec.ts'
npm run lint:check
npm run check:spartan-health
npm run build
```

If the Angular test runner in the current workspace does not support `--include`, run `npm test` instead.

## Audit result

**Mapped and ready for the remaining migration stages.** The current form controls already use Spartan Helm and no feature code directly consumes Spartan Brain. The remaining work is primarily Relay composition, async-state clarity and accessibility hardening: persistent labels, valid list semantics, contextual destructive-action naming, explicit loading/error feedback and regression coverage. No custom interactive primitive exemption is required.
