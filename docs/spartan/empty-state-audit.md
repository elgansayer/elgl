# Empty state primitive: Spartan / Relay audit

Issue: #5552
Target: `frontend/src/app/components/primitives/empty-state`

## Purpose

This audit records the current `AppEmptyStateComponent` contract before the implementation-stage Spartan UI tickets modify the primitive. It inventories every rendered state and control, maps ownership to Spartan and Relay, records current side-effect boundaries, and defines the smallest safe migration path.

The key conclusion is that `app-empty-state` is primarily a Relay presentation primitive with one optional action slot. The optional action is already correctly owned by Spartan Helm through `hlmBtn`. There is no component-owned interaction state machine that requires a new Spartan Brain primitive.

The implementation stage should therefore preserve the public primitive, keep the action on Spartan Button, and focus on accessibility, translation ownership, caller consistency, responsive behaviour, and regression coverage rather than rebuilding the component around a more complex interaction abstraction.

## Sources reviewed

- `frontend/src/app/components/primitives/empty-state/empty-state.component.ts`
- current repository `app-empty-state` call sites
- `DESIGN.md`
- `docs/design-redesign-audit.md`
- `docs/spartan-relay-architecture.md`
- `docs/translation-safe-component-apis.md`
- `AGENTS.md`
- `frontend/AGENTS.md`
- existing Spartan audits for neighbouring Relay primitives

Program dependency #5462 is completed and defines the ownership model used by this audit.

## Current public API

`AppEmptyStateComponent` exposes six signal inputs and one output.

| API | Type | Default | Contract |
| --- | --- | --- | --- |
| `illustration` | `string` | empty string | Optional decorative illustration URL. When present it replaces the emoji icon. |
| `icon` | `string` | `📭` | Decorative fallback icon when no illustration is supplied. |
| `title` | `string` | empty string | Optional visible heading and current accessible region name. |
| `description` | `string` | empty string | Optional supporting text. |
| `actionLabel` | `string` | empty string | When non-empty, renders the optional primary action. |
| `customClass` | `string` | empty string | Appends caller-provided classes to the Relay container. |
| `actionClicked` | `output<void>` | n/a | Emitted when the optional action button is activated. |

The component does not translate any input itself. That is appropriate for a shared presentation primitive. Application copy must be translated by callers before it reaches the primitive, while user-generated and server-provided content must remain ordinary content rather than being interpreted as translation keys.

## Rendered structure

The component host is a full-width block and exposes `role="region"`.

The inner container is a centred Relay surface with:

- flex-column layout;
- `rounded-card`;
- dashed `border-surface-100`;
- `bg-surface-300`;
- `p-6` spacing;
- centred text; and
- `empty-state-fade-in` motion styling.

The content order is:

1. illustration, when supplied, otherwise decorative icon;
2. title, when supplied;
3. description, when supplied;
4. optional Spartan action button, when `actionLabel` is supplied; and
5. projected content.

No overlay, menu, tooltip, dialog, popover, form control, selection model, or asynchronous state is created by this primitive.

## Complete state inventory

The complete component-owned state is the product of the following inputs.

### Illustration state

- illustration absent: show the decorative emoji icon;
- illustration present: show the decorative image and suppress the emoji icon.

Both forms are currently hidden from assistive technology. The image uses empty `alt` text and its wrapper uses `aria-hidden="true"`. That is correct only when the image is decorative and the visible title/description carries the actual meaning.

### Title state

- title absent: no heading is rendered;
- title present: render an `h3` and use the title as the region accessible name.

### Description state

- description absent: no supporting paragraph;
- description present: render secondary explanatory text.

### Action state

- action label absent: no action control;
- action label present: render a native `button` enhanced by Spartan Helm `hlmBtn`, `type="button"`, and `size="touch"`.

Activation delegates to native/Spartan button semantics and emits `actionClicked` exactly once per button activation.

### Projected-content state

Projected content is always placed after the built-in content. It can contain additional feature-owned controls, links, explanatory content, or status content. Those projected controls are not owned by `AppEmptyStateComponent` and must retain their own correct semantic primitive and accessibility contract.

### Caller class extension

`customClass` is appended after primitive-owned classes. It can therefore alter layout, spacing, border, surface, size, or other presentation. This is a compatibility escape hatch and is also a consistency risk.

No current state or control is intentionally left unclassified.

## Ownership map

| Element or behaviour | Owner | Migration rule |
| --- | --- | --- |
| Empty-state surface | Relay `AppEmptyStateComponent` | Keep as the product-facing presentation primitive. |
| Surface colour, border and radius | Relay tokens | Preserve semantic surface/border/card tokens. |
| Illustration and fallback icon | Relay composition | Keep decorative by default; callers own semantic meaning through title/description. |
| Title and description | Caller + Relay | Caller owns translated/content-safe strings; Relay owns typography and layout. |
| Optional action | Spartan Helm Button | Preserve native button semantics, `type="button"`, touch sizing, focus and disabled behaviour. |
| Action event | Feature caller | Primitive emits intent only; caller owns navigation, API calls, analytics and mutations. |
| Projected controls | Projected feature content | Use their own correct Spartan/Relay/native primitive. |
| Region semantics | Relay primitive | Keep or improve the region naming contract without inventing interaction semantics. |
| Loading/error state machine | Feature caller | Empty state should not become a generic async-state controller. |
| Navigation | Feature caller | Do not inject Router into the primitive. |
| Analytics | Feature caller | Do not add generic empty-state telemetry inside the primitive. |
| Network/storage side effects | Feature caller | Keep the primitive side-effect free. |

## Spartan ownership decision

### Brain

No dedicated Spartan Brain primitive is needed for the empty-state surface. The component does not own a selection model, disclosure state, modal lifecycle, focus trap, menu roving tabindex, listbox interaction, or other behavioural state machine.

Adding Brain only to increase Spartan usage would create unnecessary coupling and would blur the existing architecture boundary between interaction mechanics and product presentation.

### Helm

The optional action already uses the correct Helm ownership:

```html
<button hlmBtn type="button" size="touch" (click)="onAction()">
  {{ actionLabel() }}
</button>
```

This should remain the canonical action implementation unless product requirements change the action semantics to navigation. If a specific caller needs a navigation action, that caller should use an appropriate native/router link composition rather than making every empty-state action pretend to be a command button.

### Relay

Relay remains the correct owner for:

- the stable `app-empty-state` API;
- surface hierarchy;
- border and radius tokens;
- layout and spacing;
- typography;
- illustration/icon presentation;
- light/dark parity;
- responsive behaviour;
- user-accent compatibility; and
- the composition boundary for projected feature content.

## Interaction inventory

The primitive itself contains exactly one possible interactive element: the optional action button.

That action has:

- native button semantics;
- no synthetic `role="button"`;
- no manual `tabindex`;
- no custom Enter/Space handler;
- explicit `type="button"`, preventing accidental form submission when the primitive is projected inside a form;
- Spartan `hlmBtn` interaction/focus ownership; and
- Spartan `size="touch"` sizing.

No bespoke pointer, touch, keyboard, focus, drag, swipe, or hover interaction should be added to the outer empty-state surface.

Projected content may add additional interactions. Those are deliberately outside this primitive's state machine and must be audited in their owning feature.

## Navigation, analytics and side effects

`AppEmptyStateComponent` has no:

- Router or RouterLink dependency;
- route/query parameter contract;
- service injection;
- HTTP/API request;
- store mutation;
- local/session storage access;
- analytics event;
- logging;
- timer;
- browser-global side effect; or
- subscription lifecycle.

`onAction()` emits an intent only. The consumer decides whether that intent resets filters, retries a request, navigates, opens another surface, starts onboarding, or performs a mutation.

Migration must preserve this side-effect-free boundary.

## Current production usage

Repository search finds `app-empty-state` in multiple production contexts, including:

- admin block management;
- block management;
- moderation panel/dashboard/queue;
- admin user management and admin portal surfaces;
- reading engine;
- escrow detail;
- chat list;
- sticker store;
- events calendar;
- classrooms marketplace;
- Discovery;
- subscription surfaces;
- Moments feed;
- flashcard review; and
- split-screen video.

This is a high-fan-out shared primitive. Runtime changes must therefore be backwards compatible and should avoid introducing feature assumptions such as routing, loading state, telemetry, or destructive-action semantics.

The broad consumer set also means `customClass` and projected content need special care: a change that looks harmless in one screen can affect unrelated admin, social, learning, commerce, and discovery surfaces.

## Accessibility contract

### Region naming

The host currently always exposes `role="region"` and computes its `aria-label` as:

```text
title when non-empty
otherwise "Empty state"
```

Using the visible title as the region name is sensible. The fallback literal `"Empty state"` is not translation-safe and creates an English-only accessible name when callers omit the title.

The implementation stage should remove that hard-coded fallback. Preferred options, in order:

1. require/provide a meaningful translated title for user-facing states;
2. add an explicit translated `ariaLabel` input when a visible title is intentionally absent; or
3. omit the region label/role when the surface has no meaningful accessible name.

Do not silently keep English accessibility copy inside a shared primitive.

### Heading level

The primitive always renders `h3`. A shared empty state can appear at different document depths, so a fixed heading level can create skipped or incorrect heading hierarchy in some consumers.

The follow-up implementation should either document `h3` as a strict composition requirement or provide a safe semantic strategy that lets the owning feature determine heading hierarchy without exposing arbitrary unsafe markup.

### Decorative media

The illustration and emoji/icon are currently decorative. This is correct when title/description communicates the state. Do not add duplicate spoken alt text that merely repeats the adjacent title.

If a future caller has semantically meaningful imagery, that should use an explicit API rather than overloading a decorative URL field.

### Action

The existing Spartan button provides the correct native semantics and touch target. The label must be meaningful in context and translated by the caller.

For repeated empty states on one page, generic labels such as "Retry" are acceptable only when the surrounding named region makes the target unambiguous.

### Projected content

The primitive must not hide projected content from the accessibility tree. Callers adding links, buttons, status messages, or forms remain responsible for accessible naming and keyboard semantics.

### Required checks

Implementation/regression work should verify:

- meaningful region naming;
- no untranslated fallback accessible name;
- sensible heading hierarchy in representative consumers;
- decorative illustration/icon behaviour;
- keyboard activation of the optional action;
- visible focus from the Spartan button;
- 44px-equivalent touch sizing through the existing `touch` size;
- no colour-only meaning;
- long translated title/description/action copy;
- 200% and 400% zoom/reflow; and
- forced-colour/high-contrast usability.

## RTL and multilingual requirements

The primitive itself does not use physical `left` or `right` positioning. Its centred flex layout is direction-neutral.

Migration invariants:

- preserve direction-neutral layout;
- do not add `ml`, `mr`, `pl`, `pr`, `left`, or `right` where logical alternatives are required;
- allow titles, descriptions and action labels to expand naturally;
- do not use fixed widths for text;
- keep user-generated/server content separate from translation keys;
- require caller translation before application copy reaches the primitive;
- verify Arabic/Hebrew mixed-direction text;
- verify CJK and long German-like expansion; and
- do not use the display font for arbitrary user/server content.

## Theme and token requirements

The current surface is substantially aligned with Relay:

- `rounded-card` owns semantic radius;
- `border-surface-100` owns the border colour;
- `bg-surface-300` owns the surface;
- `text-text-primary` owns title text;
- `text-text-secondary` owns description text; and
- the optional action delegates its colour/focus/disabled state to Spartan Button.

No hard-coded RGB/hex product colour is required.

The implementation stage should preserve light/dark theme parity and avoid replacing semantic tokens with direct Tailwind palette colours.

The component itself has no accent fill. The optional Spartan action can therefore continue to inherit the configured product/user primary treatment through the shared button primitive.

## Responsive and zoom requirements

The current container uses `p-6`, centred content and a maximum description width of `max-w-sm`. The illustration is capped at `w-48` and remains height-auto.

The primitive should remain safe at the repository's 390px mobile baseline.

Checks should cover:

- no horizontal page overflow at 390px;
- long translated title/action copy wrapping rather than clipping;
- the description remaining readable at 200% and 400% zoom;
- illustration scaling without distortion;
- projected controls wrapping rather than escaping the surface; and
- caller-provided `customClass` not being required for baseline mobile correctness.

## Motion

The container applies `empty-state-fade-in`.

Because this is a shared primitive, the implementation stage must verify that the animation respects the repository reduced-motion policy. If the global utility already disables or reduces the transition under `prefers-reduced-motion`, preserve that contract. Otherwise the follow-up should add the reduced-motion treatment in the shared motion layer rather than adding per-consumer workarounds.

The audit does not change the visual contract, so it does not modify the design preview.

## `customClass` boundary

`customClass` is the broadest compatibility surface. Appending arbitrary caller classes can override:

- padding;
- background;
- border;
- radius;
- width;
- alignment;
- display;
- animation; and
- text treatment.

Do not remove it abruptly because this primitive has many consumers. Instead:

1. inventory recurring overrides;
2. promote legitimate recurring needs into explicit semantic variants where justified;
3. migrate consumers; and
4. only then consider narrowing the escape hatch.

Avoid adding one-off semantic variants simply to encode feature-specific presentation inside the shared primitive.

## Empty state versus error/loading state

An empty state represents a successful state with no relevant content, or a feature-defined absence condition.

It should not automatically become the generic owner for:

- loading;
- network errors;
- authorization failures;
- destructive confirmations;
- validation failures; or
- background operation progress.

Features may visually compose an empty-state presentation for a retryable error, but the feature still owns the async/error state machine and must provide correct `status` or `alert` semantics where needed.

This distinction prevents a presentation primitive from accumulating unrelated async/business logic.

## Design-preview parity

No runtime visual contract changes are made by this audit, so there is no mandatory preview update in this ticket.

The regression/design-sync follow-up should ensure the shared component-system preview includes representative empty-state compositions for:

- icon-only fallback plus title/description;
- illustration plus title/description;
- optional primary action;
- projected secondary content;
- light and dark themes;
- 390px mobile width;
- wide desktop placement;
- long translated copy; and
- RTL text.

The runtime Relay tokens remain authoritative if an older design artefact shows hard-coded colours or radii.

## Existing automated coverage

No colocated `empty-state.component.spec.ts` is currently returned by repository search. Given the primitive's fan-out, this is the main implementation-stage testing gap.

This documentation-only audit does not create speculative runtime tests before the intended conversion ticket, but the next implementation/regression stage should add a focused unit suite.

## Required implementation-stage regression coverage

Add or preserve tests for:

1. component creation;
2. default icon when no illustration is supplied;
3. illustration suppressing the icon;
4. decorative image semantics (`alt=""`);
5. optional title rendering;
6. optional description rendering;
7. optional action rendering only when `actionLabel` is non-empty;
8. action button native semantics;
9. explicit `type="button"`;
10. Spartan button ownership;
11. `size="touch"` ownership;
12. exactly one `actionClicked` emission per activation;
13. projected content rendering;
14. region accessible naming from a supplied title;
15. translation-safe behaviour when title is absent;
16. Relay token classes for surface, border, radius and text;
17. `customClass` compatibility;
18. no synthetic role/tabindex/key handlers on the action;
19. long-copy wrapping and 390px-safe layout; and
20. representative RTL/theme visual coverage.

## Migration risks

### High fan-out

This primitive is used across many unrelated product surfaces. Avoid feature-specific state or route assumptions.

### Hard-coded accessible fallback

`"Empty state"` is currently embedded in the primitive and is not translation-safe. Fixing it must not leave unnamed regions unintentionally, so consumers without titles need an explicit accessible naming strategy.

### Fixed heading level

Always rendering `h3` can be semantically incorrect depending on surrounding page structure. Resolve deliberately rather than replacing it with a non-heading styled div.

### Action semantics

The built-in action is a command button. Some callers may actually want navigation. Do not overload one API with ambiguous command/link semantics without auditing callers first.

### Projected interactive content

Projected controls are feature-owned. Do not add focus traps, roving tabindex, or broad keyboard handlers to the empty-state container.

### `customClass` drift

Arbitrary caller classes can bypass Relay consistency. Narrow only through a staged caller migration.

### Motion preference

Verify `empty-state-fade-in` honours reduced motion before extending the animation.

### Illustration trust boundary

`illustration` is a URL. The primitive should remain a renderer, not a network policy layer, but callers must continue to supply approved/safe asset URLs. Do not add HTML or SVG string injection to support illustrations.

## Prerequisite primitive work

No new Spartan primitive is required for the current empty-state contract.

The existing Helm Button is sufficient for the optional command action.

If a future design requires additional actions:

- command action: Spartan/native button;
- navigation: semantic native/router link with the appropriate product wrapper;
- menu/disclosure: use the corresponding Spartan Brain/Helm primitive;
- retry/loading/error state: keep state ownership in the feature and compose presentation here.

Do not turn the entire empty-state surface into a clickable card merely to support one caller.

## Recommended implementation sequence

1. Add focused `AppEmptyStateComponent` unit coverage for the current public contract.
2. Replace the hard-coded English accessible fallback with an explicit translation-safe naming strategy.
3. Audit consumers that omit `title` before changing region semantics.
4. Verify/fix reduced-motion handling for `empty-state-fade-in`.
5. Audit `customClass` consumers and document recurring semantic variants, if any.
6. Verify representative consumers at 390px, 200%/400% zoom, RTL, light and dark themes.
7. Sync the shared component-system preview in the dedicated regression/design stage if it does not already cover the state matrix.

## Acceptance criteria assessment

- Every component-owned interactive element is mapped: the optional action is Spartan Helm Button-owned.
- All presentation states are inventoried: illustration/icon, title, description, action, projected content and caller class extension.
- Behaviour is recorded: action emission only, with feature callers retaining side effects.
- Navigation, analytics, API, storage and mutation contracts are explicitly confirmed as absent from the primitive.
- Migration risks are identified, including accessibility fallback copy, fixed heading level, high fan-out, projected controls, motion and `customClass` drift.
- Prerequisite primitive work is identified: no new Brain/Helm primitive is needed for the current contract.

## Rollback

This ticket changes documentation only. Rollback is a normal revert of `docs/spartan/empty-state-audit.md`; there is no runtime, API, route, schema, persistence or visual-state rollback.
