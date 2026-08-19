# Document viewer Spartan / Relay audit

Issue: #6148  
Target: `frontend/src/app/components/document-viewer`  
Follow-ups: #6149, #6150, #6151, #6152

## Scope

This audit records the current interaction, state, semantic, navigation, presentation, and integration contracts for `DocumentViewerComponent` before the Spartan UI / Relay conversion stages.

The component is a small, synchronous document-outline renderer. It accepts a required `sections` input, flattens nested sections into numbered entries, renders a table of contents, and projects caller-owned `TemplateRef` content into matching document sections.

The component currently owns no network requests, persistence, analytics, application routing, dialog state, loading state, or mutation state.

## Current UI inventory

| Element / state            | Current implementation                                | Behaviour owner             | Intended ownership                       |
| -------------------------- | ----------------------------------------------------- | --------------------------- | ---------------------------------------- |
| Viewer shell               | `.toc-shell.surface-panel` wrapper                    | Relay/app CSS               | Relay presentation                       |
| Table-of-contents landmark | Native `<nav>`                                        | Browser semantics           | Native HTML, presented by Relay          |
| Table-of-contents list     | Native `<ol>` with flattened `<li>` entries           | Browser semantics           | Native HTML                              |
| Section links              | Native `<a href="#section-id">`                       | Browser fragment navigation | Native HTML; Relay owns appearance       |
| Section number             | Computed decimal string such as `1`, `1.1`, `2`       | `DocumentViewerComponent`   | Feature/app logic                        |
| Document content landmark  | Native `<main>`                                       | Browser semantics           | Native HTML, subject to embedding review |
| Section container          | Native `<section id="…">`                             | Browser semantics           | Native HTML                              |
| Section heading            | Native `<h2 id="…-heading">`                          | Browser semantics           | Native HTML + Relay typography           |
| Section relationship       | `aria-labelledby` from section to heading             | Component template          | Native accessibility contract            |
| Section body               | `NgTemplateOutlet` / caller `TemplateRef`             | Caller                      | Caller-owned content                     |
| Nested section input       | Recursive `children` model                            | Component                   | Feature/app data contract                |
| Flattened section state    | `computed()` from required `sections` input           | Angular signals             | Feature/app state                        |
| Empty input                | Empty TOC and empty content landmarks remain rendered | Component                   | Explicitly decide during follow-up       |

There are no buttons, form controls, menus, tabs, popovers, tooltips, dialogs, drawers, overlays, toasts, pending indicators, disabled controls, or error controls in this component.

## Spartan / Relay ownership map

### Spartan Brain

No Spartan Brain primitive is currently justified.

The only interactive elements are ordinary same-document fragment links. Native anchor semantics already provide activation, keyboard behaviour, focusability, URL-fragment updates, browser history integration, touch activation, context-menu support, link copying, and assistive-technology semantics. Replacing them with a button, custom click handler, or Brain primitive would reduce semantics rather than improve them.

If a future product requirement introduces disclosure, tabs, command navigation, roving focus, or another interaction state machine, that new behaviour should be evaluated independently instead of being inferred from the current viewer.

### Spartan Helm

No Helm control is required for the current feature contract. The viewer has no button/input/select/dialog control for Helm to own.

Do not wrap the TOC links in `hlmBtn` merely to satisfy a primitive-count goal. They are document-navigation links, not command buttons.

### Relay

Relay owns the presentation layer:

- viewer/card/surface treatment;
- semantic background, border, shadow, and text roles;
- link appearance and visible focus treatment;
- heading typography;
- spacing and responsive layout;
- light/dark theme parity;
- per-user primary-accent behaviour where the design intentionally uses the primary role.

The current `surface-panel`, `text-primary`, spacing, list, and hover classes must be checked against the canonical Relay token contract in #6150 rather than copied forward automatically.

### Native HTML

Native HTML should remain authoritative for:

- `<nav>` landmark semantics;
- ordered-list semantics;
- `<a href="#…">` same-document navigation;
- `<section>` semantics;
- heading semantics;
- fragment identifier targeting;
- keyboard and touch activation for anchors.

### Caller-owned projected content

The viewer does not own the controls rendered inside a supplied `TemplateRef`. Any buttons, forms, links, asynchronous states, analytics, or API mutations inside a section template remain the responsibility of that caller and must be audited with the surface that owns them.

The document viewer should not attempt to introspect, restyle, disable, or mediate arbitrary projected controls.

## State model

The state model is synchronous and input-derived:

1. The parent supplies `DocumentSection[]` through required input `sections`.
2. `flattenedSections` recursively walks the current tree.
3. Top-level sections receive `1`, `2`, … numbering.
4. Child sections receive hierarchical decimal numbers such as `1.1` and `1.2`.
5. The same flattened collection feeds the TOC and the rendered content sequence.
6. When the input changes, Angular recomputes the flattened list.

There is no local mutable signal, subscription, timer, request, loading flag, optimistic state, error state, retry state, or persistence state.

### Empty state

An empty `sections` array currently leaves an empty `<nav><ol>` and empty `<main>` inside the shell. This is stable current behaviour, but #6149/#6151 should explicitly decide whether empty landmarks are desirable. If they are removed, that is a semantic change that requires a regression test.

### Identity and tracking

Both loops track entries by `section.id`. Therefore IDs are not only fragment targets but Angular identity keys. Duplicate IDs can produce both invalid document identifiers and unstable rendering/ARIA relationships.

## Navigation contract

The component does not inject Angular `Router` and does not own any application route.

Its only navigation contract is native same-document fragment navigation:

```text
<a href="#example"> -> element id="example"
```

Activating a TOC entry is expected to:

- update the document fragment according to browser behaviour;
- scroll the matching section target into view;
- retain native link features such as open/copy/context-menu behaviour where applicable.

Do not convert these links to imperative `Router.navigate()` or click handlers in #6149. Application route behaviour belongs to the embedding page, not this reusable component.

No analytics event is emitted for TOC navigation today. Adding analytics would be a separate product decision, not part of the Spartan conversion.

## API, storage, and side-effect contract

`DocumentViewerComponent` has no injected services and performs no:

- HTTP/API requests;
- database mutations;
- local/session storage writes;
- authentication checks;
- clipboard writes;
- downloads;
- telemetry/analytics calls;
- global state/store writes.

The only observable browser side effect is native fragment navigation after a TOC link is activated.

## Accessibility baseline

### Semantics already worth preserving

- TOC entries are native links rather than synthetic buttons.
- The TOC is an ordered list.
- Each rendered document entry is a semantic `<section>`.
- Each section is labelled by its associated heading with `aria-labelledby`.
- Heading text and TOC text are generated from the same title data.
- The TOC is before the content in DOM/focus order.

### Required follow-up: name the navigation landmark

The current `<nav>` has no accessible name. A page may contain multiple navigation landmarks, so #6151 should provide an unambiguous localized name such as a visible heading or a translated `aria-label`/`aria-labelledby` contract.

Do not introduce hard-coded English solely for the accessible name.

### Required follow-up: review nested `main` landmarks

The reusable component currently emits `<main>`. If it is embedded inside a page that already owns the page-level `<main>`, the result is invalid/ambiguous landmark structure. Before changing it, inspect every consumer.

Preferred ownership rule: the route/page shell owns the page-level `main`; a reusable document viewer normally owns a neutral document-content wrapper plus sections. If all current consumers intentionally use this component as the sole main landmark, preserve that contract explicitly and test it.

### Fragment focus behaviour

Native fragment navigation reliably scrolls to the target, but browser focus movement is not identical across engines and assistive technologies. The conversion must not add ad-hoc focus code without a tested requirement.

#6151 should verify:

- keyboard activation of a TOC link;
- visible focus on the link before/after activation;
- target section/heading discoverability by screen reader;
- browser Back/Forward behaviour for fragment history;
- whether focus should remain on the link or intentionally move to a focusable heading.

If product requirements mandate focus transfer, implement it deliberately and without making headings permanently tabbable unless required.

### Heading hierarchy

Every flattened section currently renders as `<h2>`, including nested `children` numbered `1.1`, `1.1.1`, and so on. The visual numbering expresses hierarchy but the heading level does not.

This is a migration risk, not permission to generate arbitrary heading levels blindly. The embedding document may have its own heading structure, and HTML only supports `h1` through `h6`. #6151 should decide whether nested sections need semantic heading depth or whether the input contract intentionally represents flat document sections with hierarchical numbering.

### ID safety

`section.id` is trusted directly in:

- `href="#${section.id}"`;
- section `id`;
- heading `id="${section.id}-heading"`;
- Angular `track section.id`.

Callers must provide IDs that are unique within the rendered document and suitable as fragment identifiers. Regression coverage should include duplicate-ID prevention/expectations and punctuation/non-ASCII IDs if they are supported by callers.

A future normalization helper must preserve deep links; silently rewriting existing IDs can break external fragment URLs.

## Keyboard, pointer, and touch contract

Keep native anchor behaviour:

- Tab moves through TOC links in DOM order.
- Enter activates the focused link.
- Pointer/touch activation follows browser link behaviour.
- No custom `keydown`, `click`, `role`, or `tabindex` is needed.
- Do not make the surrounding `<li>` clickable.
- Do not use `preventDefault()` unless a future tested requirement requires custom navigation.

Visible focus treatment belongs to the Relay presentation layer and must remain perceivable in both themes and against user-selected primary accents.

There are no drag, swipe, long-press, hover-only, or pointer-capture interactions.

## RTL and bidirectional text

The current list indentation uses `ms-4`, a logical start-side utility. Preserve logical-direction utilities/properties throughout #6150/#6151.

Verify at minimum:

- TOC indentation mirrors correctly under `dir="rtl"`;
- long Arabic/Hebrew section titles wrap without clipping;
- mixed RTL titles with Latin numbers/URLs remain understandable;
- link underline/focus styling does not depend on physical left/right edges;
- projected section content remains caller-owned and is not forcibly assigned a direction by the viewer.

The generated section number is currently an ASCII decimal string. Treat that as the current product contract. Localized numeral shaping or locale-specific outline numbering would be a separate i18n change and must not be smuggled into the primitive migration.

## Multilingual text and expansion

The viewer does not translate titles itself. It renders the `title` strings supplied by its parent.

This ownership must remain explicit:

- parent/caller owns translation and interpolation;
- viewer must not call a translation service for arbitrary document titles;
- accessible TOC text must remain identical in meaning to the visible title;
- any new viewer-owned accessible label must use the repository translation system;
- long German/Finnish strings, CJK text without spaces, and mixed-script headings must wrap safely.

No fixed-height or truncation treatment should make document titles unavailable at 200%/400% zoom.

## Responsive and zoom contract

The component has no explicit fixed width in its template and should continue to reflow within the parent container.

#6150/#6151 should verify:

- 390px mobile baseline;
- tablet width;
- desktop/wide container;
- 200% browser zoom;
- 400% browser zoom/reflow;
- long nested TOC titles;
- deeply numbered entries such as `10.12.3`;
- no horizontal scrolling introduced by viewer-owned presentation unless document content itself requires it.

TOC links are text targets rather than compact icon controls, so do not invent fixed 44px boxes around each line. Touch usability should come from adequate line height/spacing while preserving readable document-outline density.

## Theme and user-accent contract

The surface must remain first-class in both light and dark themes.

The conversion must:

- use Relay semantic surface/text/border/shadow roles rather than hard-coded colours;
- verify link and focus contrast in both themes;
- verify primary/accent usage with user-selected accent colours;
- avoid using celebratory/accent colours as generic text where the Relay contract reserves them for other semantics;
- preserve text-on-fill rules if any filled treatment is introduced later.

The current `text-primary` on both links and headings needs semantic review in #6150: the class name alone does not prove that both usages should be the user-accent primary role. Follow `DESIGN.md` and canonical Relay tokens rather than preserving a potentially ambiguous class by inertia.

## CSS and custom behaviour targeted for removal

There is very little hand-rolled interaction behaviour to remove.

Do remove or replace only styling that #6150 confirms is outside the Relay contract. In particular, review:

- `toc-shell` if it duplicates a shared Relay surface composition;
- `surface-panel` against the current canonical surface primitive/token;
- direct hover colour manipulation on links;
- generic spacing/typography where a shared document composition exists.

Do **not** remove native anchor behaviour simply because #6149 is named “Convert controls and interactions to Spartan UI.” The correct conversion outcome may be to retain native HTML and add tests proving that no Spartan control is needed.

## Migration risks

1. **Replacing anchors with buttons.** This would lose native link semantics, URL fragments, copy-link behaviour, and browser history expectations.
2. **Imperative routing.** Injecting Angular Router for same-document navigation would add unnecessary application coupling.
3. **Nested main landmarks.** Leaving `<main>` inside a reusable component may conflict with route-level shells; changing it without consumer inspection can also remove the only main landmark.
4. **Duplicate section IDs.** Duplicate IDs break fragments, ARIA labelling, and Angular tracking.
5. **Deep-link compatibility.** Normalizing or regenerating IDs can break bookmarked/shared `#fragment` links.
6. **Heading hierarchy mismatch.** Nested data is rendered as flat `h2` headings today.
7. **Flattened-list semantics.** Numbering communicates hierarchy while one flat `<ol>` does not structurally nest children.
8. **Focus regression.** Adding custom focus movement could create double announcements or unexpected keyboard position.
9. **Theme/accent contrast.** Treating all `text-primary` uses as accent may fail contrast for some allowed accent choices.
10. **Projected-content overreach.** Styling/querying arbitrary `TemplateRef` descendants would violate caller ownership.
11. **Empty viewer semantics.** Rendering or removing empty landmarks changes the accessibility tree.
12. **CSS/design-sync drift.** Visual-token changes in #6150 must be reflected in the mapped design preview under repository governance.

## Shared primitive dependencies and sequencing

Program dependency #5462 is complete.

Recommended sequence:

1. **#6148 (this issue):** establish this ownership and behaviour baseline.
2. **#6149:** preserve native fragment-link interaction unless consumer inspection reveals a real state machine; address semantic ownership issues that belong to the interaction layer.
3. **#6150:** reconcile shell/link/heading presentation with canonical Relay tokens and verify 390px/tablet/desktop states.
4. **#6151:** perform the dedicated accessibility, RTL, touch, reduced-motion, screen-reader and 200%/400% zoom pass; resolve nav naming, landmark ownership, heading semantics and focus expectations.
5. **#6152:** add/complete unit/integration regression coverage and synchronize the Claude Design/design-preview representation.

No new Spartan Brain or Helm primitive should be created as a prerequisite for the current viewer.

If a reusable Relay “document navigation” composition is introduced, it should remain presentation-focused and preserve native anchor semantics.

## Required regression coverage

The follow-up test stage should cover at least:

1. required `sections` input renders all top-level sections;
2. nested children flatten in deterministic depth-first order;
3. numbering is stable (`1`, `1.1`, `1.2`, `2`, …);
4. each TOC href exactly matches its section ID;
5. each section `aria-labelledby` exactly matches its rendered heading ID;
6. supplied templates render in the corresponding section;
7. TOC entries remain native anchors with no synthetic button role/tabindex;
8. DOM/focus order follows flattened document order;
9. changing the `sections` input recomputes the viewer without stale entries;
10. empty-input behaviour is explicitly asserted after the semantic decision;
11. localized/long titles remain fully available;
12. RTL uses logical layout and preserves link order;
13. duplicate-ID policy is tested/documented;
14. application Router is not required for fragment navigation;
15. no viewer-owned API/analytics side effects occur during navigation;
16. light and dark theme snapshots/visual assertions cover surface and link states;
17. user-accent variants keep link/focus contrast readable;
18. 390px/mobile, tablet, and desktop layouts do not clip the outline;
19. 200% and 400% reflow retain all TOC and section content;
20. projected interactive content remains operable and outside viewer ownership.

## Design-preview / screenshot coverage

#6152 should represent the visual contract with, at minimum:

- light theme at the 390px mobile baseline with long/nested titles;
- dark theme at a wider desktop/tablet width;
- visible focused TOC link;
- nested numbering (`1.1`, `1.2`) and multiple sections;
- sufficiently long translated text to exercise wrapping;
- RTL state if the design-preview harness supports direction variants.

High-zoom and screen-reader semantics are better enforced through accessibility/regression tests than static screenshots, but the preview must not encode fixed dimensions that contradict reflow requirements.

## Migration checklist

- [ ] Preserve native `<a href="#…">` navigation.
- [ ] Do not introduce a Brain/Helm control without a real interaction requirement.
- [ ] Inspect all consumers before changing the reusable `<main>` landmark.
- [ ] Give the TOC navigation landmark an unambiguous localized name.
- [ ] Decide and test heading-depth semantics for nested sections.
- [ ] Define/enforce the caller contract for unique fragment-safe IDs.
- [ ] Preserve existing fragment IDs to avoid deep-link breakage.
- [ ] Keep projected template controls caller-owned.
- [ ] Reconcile shell/text/link styling with Relay semantic roles.
- [ ] Verify light/dark and user-accent contrast.
- [ ] Preserve logical RTL utilities/properties.
- [ ] Verify long multilingual titles and mixed-direction text.
- [ ] Verify 390px, tablet, desktop, 200%, and 400% reflow.
- [ ] Add the regression matrix above.
- [ ] Synchronize mapped Claude Design/design-preview states when the visual contract changes.

## Audit conclusion

`DocumentViewerComponent` is already structurally close to the desired ownership model. It does not contain a custom interaction state machine that should be replaced by Spartan. Its TOC links should remain native document-navigation anchors, while Relay owns visual presentation and the caller owns projected section content.

The highest-value conversion work is therefore semantic and presentational hardening: resolve reusable landmark ownership, name the TOC landmark, define nested-heading/ID contracts, verify fragment focus behaviour, align visual roles to Relay tokens, and lock the result with RTL/theme/zoom/regression coverage. Introducing a synthetic Spartan control for the existing links would be a regression rather than a migration improvement.
