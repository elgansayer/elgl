# Pill primitive: Spartan / Relay audit

Issue: #5587
Target: `frontend/src/app/components/primitives/pill`

## Purpose

This audit records the current `AppPillComponent` contract before the implementation-stage Spartan UI tickets modify the primitive. It inventories every public input and rendered state, maps ownership to Relay and Spartan, records current production consumers, and defines the smallest safe migration boundary.

The key conclusion is that `app-pill` is a static presentation primitive. It has no interaction state machine, focus behaviour, selection model, overlay, mutation, navigation, analytics hook, or network side effect. It therefore belongs in Relay and does not need Spartan Brain or Helm simply to increase Spartan usage.

If a caller needs an interactive chip, filter, toggle, radio option, button, or link, that caller must use the corresponding interactive primitive instead of making `app-pill` itself interactive through `customClass` or event handlers.

## Sources reviewed

- `frontend/src/app/components/primitives/pill/pill.component.ts`
- `frontend/src/app/components/primitives/pill/pill.component.spec.ts`
- `frontend/design-preview/components/primitives/chip-pill-badges.html`
- current production `app-pill` call sites returned by repository search
- `DESIGN.md`
- `docs/design-redesign-audit.md`
- `docs/spartan-relay-architecture.md`
- `AGENTS.md`
- `frontend/AGENTS.md`

Program dependency #5462 is completed and defines the Relay / Spartan ownership contract used here.

## Current public API

`AppPillComponent` exposes four signal inputs and no outputs.

| Input         | Type                                                         | Default      | Contract                                                            |
| ------------- | ------------------------------------------------------------ | ------------ | ------------------------------------------------------------------- |
| `label`       | `string`                                                     | empty string | When non-empty, renders the label and suppresses projected content. |
| `colour`      | `primary \| success \| warning \| danger \| info \| neutral` | `neutral`    | Selects the semantic Relay colour treatment.                        |
| `size`        | `sm \| md`                                                   | `md`         | Selects compact or default logical padding and text size.           |
| `customClass` | `string`                                                     | empty string | Appends caller classes after the primitive-owned classes.           |

Content precedence is deterministic:

```text
label is non-empty
  -> render label
label is empty
  -> render projected content
```

There is no implicit translation step. That is correct for a shared presentation primitive: app-owned copy must be translated by the caller before it reaches `label` or projected content, while user-generated and server-provided content must remain content rather than being treated as translation keys.

## Rendered structure

The component host contributes only `inline-block`. The rendered child is a native, non-focusable `<span>`.

The base visual contract is:

```text
inline-flex
items-center
justify-center
font-extrabold
rounded-pill
```

Size variants are:

| Size | Classes                    |
| ---- | -------------------------- |
| `sm` | `ps-2 pe-2 py-0.5 text-xs` |
| `md` | `ps-3 pe-3 py-1 text-sm`   |

The component uses logical inline padding (`ps` / `pe`), so the primitive itself is RTL-safe.

## Colour state inventory

| `colour`  | Relay mapping    | Text treatment      | Current hover class     |
| --------- | ---------------- | ------------------- | ----------------------- |
| `primary` | `bg-primary`     | `text-on-fill`      | `hover:bg-primary/90`   |
| `success` | `bg-success`     | `text-on-fill`      | `hover:bg-success/90`   |
| `warning` | `bg-warning`     | `text-on-fill`      | `hover:bg-warning/90`   |
| `danger`  | `bg-danger`      | `text-on-fill`      | `hover:bg-danger/90`    |
| `info`    | `bg-secondary`   | `text-on-fill`      | `hover:bg-secondary/90` |
| `neutral` | `bg-surface-100` | `text-text-primary` | `hover:bg-surface-50`   |

All current colours use Relay semantic tokens. Saturated fills pair with `text-on-fill`, preserving the light/dark contrast strategy and the user-configurable primary accent.

`info` intentionally maps to the Relay `secondary` / Tide role rather than creating a separate colour system.

### Existing interaction-looking styling

Every colour variant currently includes a hover background class even though the primitive is a non-interactive `<span>`. This is a presentation mismatch. A static status pill should not visually suggest that hovering or tapping will activate it.

The implementation-stage ticket should remove interaction-only hover affordances from the static pill unless a documented non-interactive hover requirement exists. It should not solve that mismatch by making the pill focusable or clickable.

## Complete state matrix

The primitive has no hidden asynchronous or behavioural states. Its complete state space is the product of:

- content source: `label` or projected content;
- colour: six semantic variants;
- size: two variants; and
- optional caller class extension.

There is no:

- selected state;
- pressed state;
- checked state;
- disabled state;
- loading state;
- error state;
- expanded state;
- open/closed state;
- focus state owned by the component;
- keyboard state machine;
- pointer gesture state;
- overlay;
- tooltip;
- menu;
- dialog;
- form participation; or
- validation state.

No current state or control is intentionally left unclassified.

## Ownership map

| Element / behaviour        | Owner                      | Migration rule                                                                            |
| -------------------------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| Static pill container      | Relay `AppPillComponent`   | Keep as presentation-only.                                                                |
| Semantic colour variants   | Relay tokens               | Preserve `primary`, `secondary`, semantic status colours, surfaces, and `on-fill`.        |
| Radius                     | Relay `rounded-pill` token | Preserve the pill semantic radius.                                                        |
| Size and spacing           | Relay primitive            | Keep mobile-safe logical padding and avoid physical-direction utilities.                  |
| Label / projected content  | Caller + Relay composition | Caller owns localisation and content semantics.                                           |
| Selection                  | Not owned by `app-pill`    | Use a radio, toggle, chip, segmented control, or other appropriate interactive primitive. |
| Activation                 | Not owned by `app-pill`    | Use a native link/button or Relay/Spartan control.                                        |
| Keyboard / focus mechanics | None                       | Do not invent focusability for static content.                                            |
| Dialog / popover / menu    | None                       | No Spartan overlay primitive applies.                                                     |
| Feature state              | Caller                     | Keep business state outside Relay.                                                        |
| Analytics / navigation     | Caller                     | `app-pill` must remain free of route and telemetry side effects.                          |

## Spartan ownership decision

### Brain

No Spartan Brain primitive is required for the current contract. The architecture explicitly classifies static chips, pills, and badges as Relay presentation unless interactive semantics require Brain.

Adding Brain to a non-focusable status label would add dependency and behavioural surface without transferring any actual interaction state machine.

### Helm

No direct Helm wrapper is required. Spartan Helm components are appropriate when the product needs an actual button, selection, menu, tooltip, dialog, or other accessible interaction primitive.

The follow-up conversion ticket #5588 should therefore verify that `app-pill` remains static rather than mechanically replacing its `<span>` with a button-like Helm primitive.

### Relay

Relay remains the correct owner for:

- the stable `app-pill` product-facing API;
- semantic colour mapping;
- size variants;
- pill radius;
- theme parity;
- user primary-accent propagation;
- RTL-safe spacing; and
- static status/tag presentation.

## Production consumer inventory

Repository search currently finds production `app-pill` usage in these surfaces:

1. `components/leaderboard/leaderboard.component.ts`
2. `components/hobby-tags/hobby-tags.component.ts`
3. `components/admin-portal/admin-portal.component.html`
4. `components/sticker-store/sticker-store.component.ts`
5. `pages/escrow/escrow.component.ts`
6. `pages/escrow-detail/escrow-detail.component.ts`
7. `pages/subscription/subscription-page.component.ts`
8. `pages/my-subscription/my-subscription.component.html`
9. `pages/vip/vip.component.html`

The unit-test host in `pill.component.spec.ts` is the other direct component occurrence.

### Observed usage patterns

The production consumers primarily use the primitive for status, tier, streak, plan, entitlement, or metadata presentation. For example, leaderboard uses `success` for a serious-learner status and `info` for streak days, while escrow uses semantic status colours inside a separately interactive transaction link.

These are appropriate static-pill usages because activation remains owned by the surrounding control or surface.

### Hobby-tags migration risk

`HobbyTagsComponent` currently appends `cursor-pointer hover:ring-2 hover:ring-primary` through `customClass` to a pill even though the pill itself has no click, keyboard, focus, or output contract. That gives static content an interactive-looking affordance.

The implementation stage should reconcile that caller explicitly:

- if the hobby pill is truly informational, remove the pointer/hover affordance;
- if the product requires clicking the hobby pill to select proficiency, use an accessible interactive primitive and keep the static `app-pill` contract unchanged.

Do not add generic click semantics to every pill to accommodate one ambiguous caller.

## Navigation, analytics, storage, and side effects

`AppPillComponent` itself has no:

- `Router` or `RouterLink` dependency;
- route or query-parameter contract;
- HTTP/API request;
- service injection;
- store mutation;
- local/session storage use;
- analytics event;
- logging;
- timer;
- browser-global side effect; or
- output event.

Any surrounding clickable card, link, button, filter, or mutation remains owned by its feature caller. Migration must not move those behaviours into the primitive.

## Accessibility contract

The current static `<span>` is appropriate when a pill is supplementary text or status content.

Implementation invariants:

- do not add `role="button"`, `tabindex`, `aria-pressed`, or key handlers to a static pill;
- do not make status labels focusable solely because they are visually pill-shaped;
- keep text available to the accessibility tree rather than using colour alone;
- callers must provide meaningful visible text for semantic statuses;
- caller-provided icons or decorative symbols should be hidden from assistive technology when their adjacent text already conveys the meaning;
- preserve WCAG AA colour contrast through Relay semantic tokens;
- verify status pills remain readable in forced-colour modes;
- allow long translated labels to grow instead of clipping or relying on a fixed width;
- verify 200% and 400% zoom/reflow in representative consumers; and
- where a status genuinely requires programmatic status semantics, that semantic role belongs to the feature context, not automatically to every pill.

The primitive currently owns no accessible name because it owns no interactive control. Its text content is its accessible content.

## RTL and multilingual requirements

- Keep logical `ps` and `pe` padding.
- Do not introduce `left`, `right`, `ml`, `mr`, `pl`, or `pr` utilities in the primitive.
- Caller-owned translated labels must pass through the app translation layer before they reach the pill.
- User-generated and backend content must not be treated as translation keys.
- Test long German-like expansion, CJK, Arabic/RTL, Cyrillic, and mixed-direction content in representative consumers.
- Avoid fixed widths that would truncate translated status labels.
- Do not apply the display font to arbitrary translated or user-provided pill content.

## Theme and token requirements

The current token mapping is already substantially aligned with Relay:

- `primary` preserves per-user accent colour;
- `info` uses `secondary`;
- `success`, `warning`, and `danger` use semantic status tokens;
- saturated fills use `on-fill` rather than hard-coded white;
- neutral uses surface and primary-text tokens; and
- radius uses `rounded-pill`.

The old i18n-smuggled colour-class implementation described in older redesign documentation is no longer present in current code. Implementation work must use the current source as truth and should reconcile stale documentation rather than reintroducing the obsolete translation lookup.

No new hard-coded product colour, RGB value, hex value, shadow, radius, or second Spartan-specific visual token system is needed.

## Responsive requirements

A pill is intrinsically content-sized, so the host surface owns grid or row layout. The primitive should remain safe at the 390px mobile baseline without introducing viewport assumptions.

Implementation checks should verify:

- small and medium pills fit naturally in wrapping layouts;
- long labels wrap or otherwise remain available without horizontal page overflow;
- surrounding flex/grid containers can wrap where required;
- text remains legible at high zoom; and
- touch-target rules are applied to the actual interactive parent/control, not inflated onto a static pill merely because it appears near an action.

## `customClass` boundary

`customClass` is the broadest part of the public API. Because appended classes come after primitive-owned classes, a caller can override colours, spacing, cursor treatment, border, display, or other visual semantics.

That flexibility is useful during migration but weakens product consistency. The implementation stage should audit current `customClass` consumers and prefer documented semantic variants for recurring product requirements.

Do not remove `customClass` abruptly while production callers depend on it. Any narrowing should be a backwards-compatible migration with callers converted first.

## Design-preview parity

`frontend/design-preview/components/primitives/chip-pill-badges.html` already includes:

- all six colour variants;
- both supported sizes;
- light/dark token definitions; and
- prose recording the removal of the old i18n-based colour lookup.

No visual contract changes in this audit require a design-preview update.

There is, however, existing mirror drift to reconcile in an implementation or regression-sync ticket: the preview examples use `rounded-full`, while runtime `AppPillComponent` uses the semantic `rounded-pill` class. The preview also intentionally cannot encode caller-level `customClass` combinations. The runtime component and Relay token contract remain authoritative.

## Existing unit coverage

`pill.component.spec.ts` currently verifies:

- component creation;
- label rendering;
- projected-content fallback;
- label precedence over projected content;
- host `inline-block` class;
- core flex/alignment/radius classes;
- primary, success, warning, danger, info, and neutral token mappings;
- small and medium logical size classes;
- custom-class composition; and
- a non-empty computed class list.

This is meaningful coverage of the present static API. Because this audit changes documentation only, it does not require modifying or weakening the executable suite.

## Required implementation-stage regression coverage

Before changing the runtime primitive, keep or add tests for:

- all six colour variants;
- both size variants;
- per-user-primary token usage by class contract;
- `text-on-fill` on saturated colours;
- neutral surface/text pairing;
- `rounded-pill` ownership;
- logical inline padding only;
- label versus projected-content precedence;
- `customClass` compatibility;
- no synthetic button role or tabindex for a static pill;
- no click/keyboard output contract on the static primitive;
- long-label rendering without fixed-width clipping; and
- representative RTL and theme rendering in design/visual coverage.

If an interactive variant is ever proposed, test it as a separate semantic primitive or explicit mode with the correct Brain/Helm/native behaviour. Do not silently change every existing `app-pill` consumer into an interactive control.

## Migration risks

### Accidental interactivity

The largest risk is converting a static status label into a generic clickable pill because some callers visually style it like one. That would add unwanted tab stops, ambiguous keyboard behaviour, and incorrect semantics to status-only surfaces.

### Hover affordance on static content

The primitive's built-in hover backgrounds imply interactivity. Remove or justify them during the visual/token pass rather than adding fake activation behaviour.

### `customClass` semantic drift

Caller classes can override the primitive contract. Audit and migrate recurring overrides before narrowing the API.

### Stale design documentation

`DESIGN.md` and the Phase 0 redesign audit still describe the old `I18nService.translate('pill.colour_' + colour)` implementation, while current source is already token-driven. Future work must not use those historical notes as an instruction to rebuild behaviour that has already been corrected.

### Design-preview radius drift

The preview says it mirrors component classes but uses `rounded-full` in pill examples while runtime uses `rounded-pill`. Reconcile this in the regression/design-sync stage.

### Consumer context

Some pills sit inside links or cards. Do not duplicate the parent's activation semantics onto the nested pill.

### Angular housekeeping

The component explicitly sets `ChangeDetectionStrategy.OnPush`, while current Angular 22 project guidance says the default is sufficient. Removing that redundant metadata is a safe housekeeping candidate only when touching the runtime component and should not be confused with a Spartan interaction requirement.

## Prerequisite primitive work

No new Spartan primitive is required for the current static contract.

Before any caller converts a static pill into an interactive concept, choose the correct existing capability based on semantics:

- one-off action: native/Spartan button;
- navigation: native anchor or router link with the approved link/button presentation;
- mutually exclusive selection: radio group or approved selection primitive;
- multi-select filter: appropriate checkbox/toggle/chip selection primitive;
- removable item: an interactive chip pattern with a separately named remove control when needed.

`AppPillComponent` should not become a universal substitute for these controls.

## Recommended implementation sequence

1. Reconfirm current `app-pill` consumers before changing the runtime component.
2. Preserve the static Relay ownership boundary and do not introduce Brain/Helm without a real interaction requirement.
3. Remove misleading built-in hover affordances from static variants, subject to visual review.
4. Resolve the `HobbyTagsComponent` pointer/hover ambiguity at the caller boundary.
5. Reconcile stale `DESIGN.md` / redesign-audit wording with the current token-driven implementation.
6. Reconcile `rounded-full` versus runtime `rounded-pill` in the design preview.
7. Preserve all six semantic colour variants and both public sizes unless a separately reviewed API migration is justified.
8. Keep existing unit coverage green and add semantic/non-interactivity regressions before runtime changes.
9. Verify light/dark themes, user accent, RTL, forced colours, long translations, mobile layout, and 200%/400% zoom.
10. Run the repository frontend verification and Spartan/design-system gates.

## Follow-up ticket boundaries

For the numbered pill sequence after this audit:

- **#5588, Spartan conversion:** should confirm that no Brain/Helm interaction replacement is needed for the static primitive, and should prevent callers from manufacturing fake interaction through the pill.
- **visual/token stage:** should preserve the current Relay semantic palette and address static hover affordances without changing product meaning.
- **accessibility stage:** should verify status semantics in representative host contexts, RTL, zoom, forced colours, long labels, and non-focusability.
- **regression/design-sync stage:** should lock the public API and reconcile preview radius drift.

Each stage should remain independently revertible and must not absorb unrelated feature behaviour.

## Verification commands for implementation work

For runtime frontend changes, use the repository's current frontend gate:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

Also run the repository's Spartan ownership/convergence and design-sync checks required by CI when the relevant files change.

For this audit-only change, CI remains authoritative for documentation/governance validation. No runtime source, test, route, API, or visual contract is modified by this document.

## Exit criteria

This audit is complete when an implementation owner can answer the following without re-discovering the primitive contract:

- **What is `app-pill`?** A static Relay presentation primitive.
- **Does it need Spartan Brain today?** No.
- **What are its states?** Label/projected content, six semantic colours, two sizes, and optional caller classes.
- **What does it own?** Static presentation, Relay token mapping, pill radius, and logical spacing.
- **What does it not own?** Selection, activation, focus, keyboard behaviour, navigation, analytics, mutation, overlays, or feature state.
- **What is the main migration risk?** Accidentally turning status labels into generic interactive controls.
- **What current caller needs explicit review?** Hobby tags, because it gives the static pill pointer/hover styling without an activation contract.
- **What documentation drift exists?** Historical i18n colour notes and a design-preview radius mismatch.

The audit itself intentionally makes no runtime or visual change. It establishes the implementation and verification boundary for the remaining pill migration tickets.
