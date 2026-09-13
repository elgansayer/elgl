# Fluency Indicator Spartan / Relay audit

Issue: #5557 (`Spartan UI 0651`)

Target: `frontend/src/app/components/primitives/fluency-indicator`

Program dependency: #5462 (`Spartan UI 0001`)

## Scope

This document is the implementation baseline for migrating and maintaining `FluencyIndicatorComponent` under the repository's Spartan Brain, Spartan Helm, and Relay architecture.

The audit covers the component implementation, its current unit coverage, its product usage in Discovery, and its representation in the Relay design preview. The component is intentionally small and presentation-only. It currently has no user-operable control, overlay, menu, form field, route ownership, network request, analytics event, or mutable local interaction state.

That absence of interaction is an important ownership decision: adding a Spartan Brain or Helm dependency solely to increase framework coverage would make the primitive less correct. The current surface should remain a lightweight Relay presentation primitive unless a later product requirement makes part of it interactive.

## Current implementation summary

`FluencyIndicatorComponent` is a standalone, `OnPush` Angular component with two required signal inputs:

- `nativeLanguages: { code: string; level?: number }[]`
- `targetLanguages: { code: string; level?: number }[]`

It renders each language as:

- a decorative flag emoji returned by the shared `getLanguageFlag()` helper;
- the language code in uppercase presentation;
- decorative separators between multiple languages;
- a decorative bidirectional exchange marker between native and target groups.

The full visual unit is exposed to assistive technology as a single `role="img"` with a computed English accessible label in the form `Speaks en; learning es`.

The optional `level` values are accepted by the public input contract but are not rendered or announced.

The only current product consumer found by repository search is the partner card in `DiscoveryComponent`. The design-preview catalogue also contains a fluency-indicator representation in `frontend/design-preview/components/primitives/indicators-media.html`.

## Control and interaction inventory

There are no interactive controls in the target.

| Element | Current behaviour | Interaction owner | Target owner | Migration action |
| --- | --- | --- | --- | --- |
| Root language-pair indicator | Read-only visual summary | Native HTML semantics | Relay presentation | Keep non-interactive |
| Native-language group | Renders zero or more language codes and decorative flags | Angular template | Relay presentation | Keep presentation-only |
| Native-language separators | Decorative `|` characters | Angular template | Relay presentation | Keep `aria-hidden` |
| Exchange marker | Decorative `⇌` glyph | Angular template | Relay presentation | Keep `aria-hidden` |
| Target-language group | Renders zero or more language codes and decorative flags | Angular template | Relay presentation | Keep presentation-only |
| Target-language separators | Decorative `|` characters | Angular template | Relay presentation | Keep `aria-hidden` |
| Accessible summary | Computed `aria-label` on the root | Feature primitive | Relay accessibility contract | Localise and harden in follow-up work |

No keyboard event handler, pointer handler, click target, focusable descendant, disabled state, pending state, error state, dialog, popover, tooltip, combobox, menu, radio group, checkbox, switch, slider, or focus trap exists in this component.

### Spartan Brain decision

No Spartan Brain primitive is appropriate for the current feature contract.

Brain is intended to own reusable interaction state machines. This component has no interaction state machine. Introducing Radio, Tooltip, Hover Card, Popover, or another Brain primitive would invent behaviour that does not exist in the product and would violate the issue requirement to preserve existing behaviour.

### Spartan Helm decision

No Spartan Helm primitive is needed for the current feature contract.

There is no button, input, select, checkbox, badge control, or other interactive element that Helm should style. Presentation should remain ordinary semantic HTML composed with Relay tokens.

### Relay decision

`FluencyIndicatorComponent` itself is the approved Relay/application presentation primitive for this language-pair summary. It should continue to own:

- visual grouping of native and target languages;
- language flag decoration through the shared language helper;
- compact typography and spacing;
- semantic colour roles;
- the single accessible summary for the composite visual.

Consumers should not duplicate this markup or reimplement the language-pair display locally.

## Inputs, outputs, and state contract

### Inputs

Both inputs are required and currently accept mutable arrays of small language records. The component does not mutate them.

`code` is treated as display data and is interpolated through Angular text binding, so it is text-escaped by Angular. It is also passed to `getLanguageFlag()`.

`level` is currently ignored. This should be documented rather than silently repurposed by a migration ticket. If proficiency is later shown, its meaning and scale need a dedicated product contract because current call sites pass synthetic numeric levels in some contexts.

### Outputs

There are no outputs.

### Local state

There is no mutable local state. `fluencyLabel` is a `computed()` value derived solely from the current inputs.

### Lifecycle

There is no explicit lifecycle hook and no manual cleanup obligation. This is appropriate for the current primitive.

## Product behaviour contract

The component currently communicates two facts:

1. languages the profile is represented as speaking natively;
2. languages the profile is represented as learning.

The arrow is decorative and should not be interpreted as an action or navigation affordance.

The component does not:

- change a user's language preferences;
- open a profile;
- filter Discovery;
- start a chat;
- infer language proficiency from the optional numeric `level`;
- perform translation;
- fetch user data;
- emit analytics.

Those responsibilities remain with the consuming feature and service layers.

## Current usage and route contracts

The current product usage is inside Discovery partner cards. `DiscoveryComponent` maps profile language codes into `nativeLangs` and `targetLangs` and passes those arrays to `app-fluency-indicator`.

The primitive itself has no `RouterLink`, injected router, URL construction, or route callback. Therefore it has no route contract of its own.

Any future request to make a language code clickable must be treated as a new interaction contract. It should not be folded into the visual conversion implicitly because doing so would add focus order, navigation semantics, and potentially nested-interactive-element conflicts inside parent cards.

## Service, analytics, and side-effect boundaries

The target imports only Angular component primitives and the shared `getLanguageFlag()` helper.

| Boundary | Current operation | Ownership rule |
| --- | --- | --- |
| Angular signal inputs | Receive language records | Consumer owns source data |
| `computed()` | Builds accessibility summary | Fluency indicator owns derived presentation |
| `getLanguageFlag()` | Converts language code to flag decoration | Shared language helper owns mapping |
| Angular interpolation | Escapes rendered text | Framework rendering boundary |

No service is injected. No HTTP request, database access, browser storage, timer, media API, telemetry API, toast, or error reporter is invoked.

No product analytics hook was found in the component or its unit test. The migration must not invent analytics solely for primitive conversion.

## Accessibility audit

### Composite semantics

The root currently uses `role="img"` and hides the visual punctuation/flag decoration from assistive technology. This gives screen readers one concise description instead of reading emoji, separators, and the exchange glyph separately.

That is a defensible composite semantic model for a compact visual indicator. Follow-up work should compare it with a plain text/group semantic under the repository accessibility conventions, but it should not make individual language tokens focusable because they are not actions.

### Accessible-name localisation

The largest current accessibility defect is that the accessible name is hard-coded in English:

`Speaks ${native}; learning ${target}`

Visible UI is intended to support first-class localisation, and accessible-only copy is part of the UI. The accessibility pass should derive the name from the translation layer rather than hard-code an English sentence.

The migration must avoid interpolating unbounded translated HTML. The label should remain plain text.

### Empty input states

Both inputs are required structurally, but an empty array is valid at runtime. With one or both arrays empty, the current label can become grammatically incomplete, such as `Speaks ; learning es` or `Speaks en; learning `.

The visual output also retains the exchange marker even when one side is absent.

A follow-up implementation should define explicit empty-state semantics rather than silently inventing a language. Recommended contract:

- both sides populated: announce both roles;
- native only: announce only native languages;
- target only: announce only learning languages;
- both empty: render no misleading language claim and expose no empty `role="img"` announcement.

This is a presentation/accessibility correction, not a data fallback. The primitive must not default missing profile language data to English or Japanese.

### Language-code pronunciation

Raw ISO-like codes such as `en`, `es`, or `ja` may be pronounced unpredictably by screen readers. The current component has no language-name lookup and no i18n service.

The accessibility pass should prefer localised language names in the accessible summary while retaining compact codes visually if that remains the visual contract. The shared language catalogue should be the source of truth rather than a second mapping inside this component.

### Colour independence

Native and target languages are differentiated by placement and the exchange relationship, not solely by colour, which is good. Target codes currently also use a violet colour, but a user can still understand the pair without perceiving that colour.

### Focus and keyboard

There are no focusable controls, so the component correctly contributes no tab stop. No key handlers are required.

A future implementation must not add `tabindex`, `role="button"`, click handlers, or arrow-key handling unless product behaviour genuinely changes.

## RTL and bidirectional-content audit

The component uses flex layout and no physical left/right margin or padding except `mx`, which is direction-neutral. There are no directional borders.

However, language codes and the English accessible sentence are not explicitly protected against mixed-direction content. The visible language code is user/profile-derived data and should be treated as potentially mixed-direction text even if normal values are short language codes.

Follow-up verification should cover:

- an RTL application document;
- native and target arrays containing Arabic/Hebrew-script identifiers or unexpected mixed-direction text;
- visual ordering of native side, exchange marker, and target side;
- `dir="auto"` or an equivalent bounded strategy where appropriate;
- ensuring the semantic meaning of native-to-target grouping is preserved without relying on physical left/right language.

The exchange marker is symmetric and does not need mirroring.

## Responsive, zoom, and reflow audit

The current root uses `flex items-center` without wrapping. Each side is another non-wrapping flex row. This is compact for the usual one-language-per-side case but can overflow when:

- either input contains multiple languages;
- browser text is enlarged;
- the component is embedded in a narrow Discovery card;
- users run at 200% or 400% zoom;
- future localisation replaces codes with longer language names visually.

Issue #5560 must verify 200% and 400% zoom and should allow safe wrapping rather than clipping required information.

The component has no minimum-width contract and should not force a parent card wider than the viewport. Follow-up visual work should preserve the compact single-line form when space permits while allowing logical, readable wrapping under constrained width.

## Theme and Relay token audit

### Current compliant tokens

The component uses:

- `text-text-primary` for the overall text role;
- `text-text-muted` for separators.

These are Relay semantic tokens and support independent light/dark values.

### Current off-policy token

Target-language codes use `text-neon-violet`.

`DESIGN.md` defines the neon palette as decorative-only and explicitly says it is not for text because those colours are not guaranteed to meet text contrast rules. Therefore `text-neon-violet` is the key visual debt in this primitive even though it is technically a named token rather than a raw hex value.

Issue #5559 should replace that text colour with an approved semantic role. The Relay duet makes `secondary` the natural candidate for an exchange partner/target-language role, but contrast must be verified at the rendered `text-xs` size in both themes before the implementation is finalized. If the secondary token is not suitable for small text on the surrounding surface, use an approved text token and keep the relationship visible through structure.

### Primary accent behaviour

The component currently does not use `primary`, so per-user accent changes do not affect it. That is acceptable. The primitive should not introduce `primary` simply to demonstrate accent support.

If a later design uses primary/secondary duet styling, the dynamic primary CSS token must be consumed rather than a fixed Ember value.

### Hard-coded product colours

No raw hex/rgb product colour exists in the Angular component. The only colour concern is semantic misuse of the neon token described above.

## Typography audit

`text-xs` and `font-bold` are suitable system-font utility classes for compact UI. The component does not use `font-display`, which is correct because language codes are profile/user-derived content and the repository reserves the display font for product-authored display contexts.

The `uppercase` utility is presentation-only. Angular interpolation leaves the underlying accessible label in the original input case. Follow-up tests should decide whether canonical language-code normalization belongs upstream or in the shared language model rather than silently changing arbitrary input here.

## Flag-decoration audit

Flags are generated by the same `getLanguageFlag()` helper used by the shared language picker and are marked `aria-hidden="true"`.

That is correct for the current semantics because the accessible summary should communicate language names/codes, not emoji descriptions.

Migration work must not treat flags as country-of-origin data. Language and nationality are not equivalent, and the primitive should retain the flag only as a decorative product convention defined by the shared helper.

## Privacy and security audit

The component displays profile language metadata already supplied by its parent. It does not expand the visibility scope of that data and does not persist, transmit, cache, log, or analyse it.

Security characteristics:

- language codes are rendered through Angular text interpolation rather than raw HTML;
- the component does not use `[innerHTML]`;
- there are no URLs, media sources, or navigation destinations;
- there is no privileged action or authorization decision;
- there is no client-side trust decision based on `level`.

The primitive must remain a presentation boundary. Privacy/authorization rules deciding whether language metadata may be shown belong to the profile/discovery data layer before these inputs are constructed.

## Performance audit

The component is `OnPush` and derives its accessible label through `computed()`, which is appropriate for a small reusable primitive.

The render cost scales linearly with the total number of supplied language records. Current product data is expected to be small, but the primitive itself has no input bound. A later shared type/data-boundary ticket may choose to cap or validate profile language arrays upstream. The presentation component should not silently truncate data unless product requirements specify a maximum and an accessible way to communicate omitted items.

There is no animation, timer, subscription, DOM observer, network request, or asset preload in this target.

## Failure and degraded-state audit

The component has no asynchronous failure state. Its meaningful degraded inputs are malformed or empty language data supplied by a consumer.

Current behaviour:

- empty arrays produce incomplete visual/accessible structure;
- unknown codes are passed to `getLanguageFlag()` and rendered as text;
- duplicate codes render duplicates;
- optional `level` is ignored;
- very large arrays may overflow narrow containers.

Ownership recommendation:

- validate canonical profile data in the data/service layer;
- keep the primitive resilient to empty/unknown input without throwing;
- do not fabricate replacement languages;
- keep presentation bounded by layout rather than by destructive data mutation.

## Existing test coverage

`fluency-indicator.component.spec.ts` is active and currently verifies:

- component creation through a host;
- the composite accessible label for one native and one target language;
- one rendered code per supplied language;
- the current target-language colour token;
- reactive signal updates with multiple languages;
- decorative elements remaining hidden from assistive technology.

This means `DESIGN.md`'s older statement that `app-fluency-indicator` is missing a spec file is stale relative to the current repository. The final regression/design-sync ticket should reconcile that documentation rather than recreating a duplicate spec.

## Missing regression coverage

Follow-up test coverage should include:

- no native languages;
- no target languages;
- both arrays empty;
- unknown language codes;
- duplicate language entries, if duplicates remain an accepted input;
- localised accessible language names/phrasing;
- mixed RTL/LTR input;
- semantic Relay colour roles in light and dark themes;
- wrapping/reflow-safe classes for narrow width and high zoom;
- confirmation that the component remains non-focusable and has no synthetic interaction role.

Because #5557 is an audit-only change and does not alter runtime behaviour, no Angular test was changed by this issue. The behavior-changing follow-ups #5558 through #5561 own the corresponding test updates.

## Design-preview audit

`frontend/design-preview/components/primitives/indicators-media.html` already includes the fluency indicator in the shared Indicators & Media design-system card.

This audit does not change the visual contract, so it should not alter that preview. Issue #5561 is the authoritative ticket for syncing the final converted component into light/dark and responsive design-preview states after the Relay/a11y work lands.

The final preview should cover at minimum:

- light theme, compact one-native/one-target state;
- dark theme equivalent;
- multiple languages;
- narrow/mobile wrapping state;
- an RTL/mixed-direction state if the preview framework supports document direction.

## Migration risks

### 1. Adding interaction where none exists

The highest architectural risk is over-conversion: introducing a Spartan interaction primitive simply because the migration program is named Spartan UI. This component has no interaction to delegate. Keep it presentation-only.

### 2. Treating decorative neon as semantic text colour

The current violet target code conflicts with the design-system rule that neon colours are decorative-only. Replacing it needs contrast verification and should happen under #5559.

### 3. Accessible copy remaining English-only

The current hard-coded label bypasses the translation system. A visual-only refactor could leave the most important screen-reader content untranslated.

### 4. Empty arrays creating false/incomplete claims

Required input bindings do not guarantee non-empty arrays. The converted primitive needs explicit semantics for one-sided and empty data.

### 5. Breaking compact parent layouts

Discovery embeds this primitive in a dense partner card. Adding labels, wrappers, minimum widths, or fixed gaps can create overflow at the 390px baseline and high zoom.

### 6. Repurposing `level` without a product definition

The public input records include optional numeric levels, and Discovery currently constructs numeric values. Rendering those values as proficiency without a canonical scale could make incorrect learner claims.

### 7. Duplicating language metadata tables

Language names, codes, and flags should come from shared language infrastructure. A local lookup table would drift and increase i18n maintenance.

## Required follow-up sequence

### #5558 - interaction conversion

Expected result: no new Brain/Helm interaction dependency unless the product contract has changed since this audit. Confirm that the primitive remains non-interactive, remove any unnecessary synthetic interaction semantics if the accessibility review supports a simpler semantic container, and keep feature code free of duplicated control behavior.

### #5559 - Relay tokens and responsive/theme parity

Replace the decorative neon text usage with an approved semantic role, verify both themes, and make multi-language content safe at 390px and constrained parent widths without forcing horizontal overflow.

### #5560 - accessibility, RTL, zoom, and input methods

Localise the accessible summary, define empty/one-sided semantics, verify language-name pronunciation strategy, mixed-direction handling, 200%/400% zoom, and the intentional absence of focusable controls.

### #5561 - regression tests and design sync

Lock the final behavior in active Angular tests, update the Indicators & Media design preview with representative light/dark/responsive states, and reconcile stale `DESIGN.md`/redesign-audit status.

## Definition of done for this audit

- Every rendered element is accounted for above.
- The component is explicitly classified as presentation-only, with no omitted interaction.
- Spartan Brain and Helm non-ownership is documented rather than inferred.
- Relay presentation ownership is defined.
- Existing inputs, outputs, lifecycle, service, analytics, route, and side-effect boundaries are recorded.
- Accessibility, RTL, zoom/reflow, theme, privacy, security, performance, and degraded-input risks are identified.
- Existing tests and design-preview coverage are recorded.
- The implementation sequence and prerequisite decisions for #5558 through #5561 are explicit.

## Rollback

This issue changes documentation only. Rollback is a single-file revert of `docs/spartan/fluency-indicator-audit.md`; there is no runtime, schema, API, analytics, routing, persistence, or visual state to unwind.
