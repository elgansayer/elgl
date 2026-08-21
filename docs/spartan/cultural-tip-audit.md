# Cultural tip Spartan/Relay audit (#6086)

## Context

| Item                      | Current implementation                                                          |
| ------------------------- | ------------------------------------------------------------------------------- |
| Component                 | `frontend/src/app/components/cultural-tip/cultural-tip.component.ts`            |
| Service                   | `frontend/src/app/services/cultural-guide.service.ts`                           |
| Tests                     | `frontend/src/app/components/cultural-tip/cultural-tip.component.spec.ts`       |
| Route ownership           | None. The host decides where the component is placed.                           |
| Interaction model         | Read-only informational callout. There are no controls or focus targets.        |
| Data source               | `CulturalGuideService.guide(language)` via Angular `resource()`                 |
| Existing Spartan usage    | None required by the current interaction model.                                 |
| Relay ownership           | Surface, border, spacing, typography, theme tokens and responsive presentation. |
| Architecture prerequisite | #5462, completed.                                                               |

## Executive mapping

The component is a static informational surface, not an interactive card. It does not need a
Spartan Brain behavior primitive merely to satisfy the migration programme. Its correct target is a
Relay-owned composition that uses the approved semantic token system and preserves native heading
and paragraph semantics.

| Surface/state   | Current behavior                                                  | Target owner                   | Migration decision                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tip container   | Conditional `<div role="region">` with an accent start border     | Relay/app composition          | Keep a non-interactive informational surface. Use `AppCardComponent` only if its visual contract is intentionally desired; otherwise keep a dedicated Relay callout composition. |
| Region label    | `aria-labelledby="cultural-tip-heading"`                          | Native accessibility semantics | Preserve an accessible name if the region landmark remains, but remove the fixed-ID collision risk.                                                                              |
| Heading         | Translated `h3` using `text-heading`                              | Native HTML + Relay typography | Preserve translation and semantic heading intent; do not introduce a Spartan primitive.                                                                                          |
| Guide body      | Server-provided text in a `p` using `text-body`                   | Native HTML + Relay typography | Preserve as readable body copy. Do not translate it a second time in the client.                                                                                                 |
| Loading         | Nothing is rendered                                               | Angular resource state         | Preserve unless product requirements explicitly introduce a loading affordance.                                                                                                  |
| Empty           | `null` guide produces no UI                                       | Service/resource contract      | Preserve.                                                                                                                                                                        |
| Error           | Service converts request failures to `null`, so no UI is rendered | Service contract               | Preserve unless a separate issue intentionally changes error UX.                                                                                                                 |
| Language change | Resource parameters change and the guide is fetched again         | Angular resource + service     | Preserve reactive refetch behavior.                                                                                                                                              |
| Overlay         | None                                                              | N/A                            | Do not add one.                                                                                                                                                                  |
| Navigation      | None                                                              | N/A                            | Do not add one.                                                                                                                                                                  |
| Analytics       | None                                                              | N/A                            | Do not add one as part of primitive conversion.                                                                                                                                  |

## Current component inventory

### Inputs and data flow

`CulturalTipComponent` has one required input:

- `language: input.required<string>()`

The input is the sole parameter for `guideResource`. When it changes, Angular recomputes the
resource parameters and calls `CulturalGuideService.guide(language)` again. The existing unit suite
already verifies the `en` to `fr` refetch path.

`CulturalGuideService.guide()` performs:

```text
GET <environment.api>/cultural-guides/<language>
```

The service returns the response `guide` string. Any HTTP or observable failure is caught by the
service and normalized to `null`. There is no mutation, storage write, navigation, telemetry call or
other side effect in the component.

### Render states

The template has only two visible states:

1. `guideResource.value()` is a truthy guide string: render the labelled informational region.
2. No value is available: render nothing.

The second branch currently covers initial loading, an empty `null` result and a request failure.
Those states are intentionally indistinguishable in the present UI.

There is no explicit spinner, skeleton, retry control, dismiss action, menu, tooltip, popover,
dialog, toast or status message.

### Visible elements

When a guide is available, the rendered tree is:

1. one informational container;
2. one translated heading (`culturalTip.title`);
3. one paragraph containing the guide returned by the backend.

There are no buttons, links, form fields or other user-operable controls.

## Primitive ownership decision

### No Spartan Brain primitive is required

The Spartan/Relay architecture assigns behavior and accessibility contracts for interactive
patterns to Spartan Brain while Relay owns product visual language. This component has no
interactive pattern to delegate. Adding a button, disclosure, dialog or interactive card primitive
would create semantics and keyboard behavior that the feature does not have today.

The migration should therefore not manufacture Spartan usage for its own sake.

### Relay/app composition is the approved target

The surface should remain an app-level Relay composition using semantic theme tokens, logical
spacing/border utilities and native semantic HTML.

`AppCardComponent` exists in `frontend/src/app/components/primitives/card/` and is an approved
app-level composite, but it should not be adopted mechanically. Its default appearance includes a
full border, rounded-xl corners and shadow that are materially different from the current compact
accent-edge callout. Its `interactive` mode must not be enabled for a cultural tip because the tip
has no action and must not become keyboard-focusable.

Implementation therefore has two acceptable paths:

- use the non-interactive `AppCardComponent` only when the intended Relay design is the standard
  card treatment; or
- keep/extract a small Relay informational-callout composition when the accent-edge treatment is a
  deliberate product pattern.

There is no missing Spartan capability. Any reusable visual variant belongs to Relay/app
composition ownership, not a new Brain primitive.

## Accessibility contract

### Landmark naming

The current surface uses:

```html
role="region" aria-labelledby="cultural-tip-heading"
```

and the heading uses the fixed ID `cultural-tip-heading`. That gives a single instance an accessible
name, but the fixed ID can collide if more than one `app-cultural-tip` is present in the same
document.

Before or during conversion, choose one of these explicit contracts:

1. keep `role="region"` and provide a per-instance unique labelled-by relationship; or
2. if the host context already provides sufficient structure and the tip does not warrant an
   additional landmark, use semantic section/card markup without creating a redundant region.

Do not retain a globally repeated fixed ID.

### Heading level

The current title is an `h3`. The visible hierarchy must remain meaningful in every host. A primitive
migration must not replace it with a styled `div` or `span`. If the component is used under different
heading depths, the implementation stage should confirm whether a configurable heading level or
host-provided label is preferable to hard-coding a document-outline assumption.

### Dynamic content

Changing `language` can replace the rendered guide asynchronously. Today that update is silent to
assistive technology because the component has no live region. Preserve that behavior unless a
separate accessibility/product decision determines that an announcement is necessary. Do not add
an assertive `aria-live` region merely as part of the Spartan conversion.

If an announcement is added later, it should be scoped and polite so a language refresh does not
interrupt the user unexpectedly.

### Focus and keyboard behavior

There are no focusable controls and no keyboard interaction. The conversion must preserve that.
Specifically:

- do not set `tabindex="0"` on the tip;
- do not enable `AppCardComponent.interactive`;
- do not add click-only behavior to the surface;
- do not represent the informational surface as a button.

### Text and zoom

The guide and translated title must remain normal document text so browser zoom, user font settings
and text selection continue to work. Long localized copy must wrap without clipping or forcing a
horizontal viewport scroll.

## Internationalisation contract

The two text sources have different ownership:

- `culturalTip.title` is UI chrome and continues through `TranslatePipe`.
- `guide` is backend-provided content selected by the requested `language`; it must not be passed
  through the translation pipe again.

The component must continue to refetch when the `language` input changes. Conversion must not
cache the first guide indefinitely or detach the resource from the input signal.

Loading/error copy should not be introduced in this migration unless corresponding translation keys
are added deliberately.

## RTL contract

The current callout already uses logical-direction utilities:

- `border-s-4` places the emphasis edge on the logical start side;
- `rounded-e-lg` rounds the logical end edge.

These choices are direction-safe and should be preserved in any equivalent Relay composition.
Avoid replacing them with physical `border-l-*`, `border-r-*`, `rounded-l-*` or `rounded-r-*`
utilities.

The component has no directional icons or ordered controls. Backend guide content may contain RTL,
LTR or mixed-direction text, so the layout must allow browser bidi handling rather than forcing a
text direction locally without a product requirement.

## Theme and token contract

Current presentation uses semantic-looking utilities rather than raw colors:

- `border-accent`
- `bg-surface-2`
- `text-heading`
- `text-body`

The implementation pass must validate `bg-surface-2` against the current Relay token inventory.
`DESIGN.md` documents the canonical surface hierarchy with `surface-100`, `surface-200` and
`surface-accent`; if `surface-2` is a legacy alias or drift, migrate it to the approved equivalent
rather than preserving an obsolete token name.

The accent edge should also remain semantically intentional. A cultural hint is informational, so
conversion must not substitute success, warning or destructive semantic colors solely for visual
similarity.

No hard-coded hex/RGB colors should be introduced. Light/dark/high-contrast behavior remains owned
by the Relay semantic token layer.

## Navigation, overlays and analytics

Audit result:

- **Navigation:** none.
- **Overlay behavior:** none.
- **Analytics/telemetry:** none.
- **Mutations:** none.
- **Focus restoration:** not applicable.
- **Dismissal/cancellation:** not applicable.

Primitive conversion must not accidentally add any of these behaviors.

## Migration risks

| Risk                                  | Why it matters                                                                                                 | Required guard                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Duplicate heading IDs                 | Multiple tips can produce invalid repeated `cultural-tip-heading` IDs and ambiguous `aria-labelledby` targets. | Use unique IDs or a different accessible-name strategy before relying on the landmark contract. |
| Accidental interactive card semantics | A card helper can add `role="button"`, tabindex and pressed state that do not belong here.                     | Keep the target composition non-interactive.                                                    |
| Visual over-migration                 | Standard card shadow/border/padding can materially change the compact callout.                                 | Compare intended Relay treatment before swapping to `AppCardComponent`.                         |
| Lost logical-direction styling        | Physical left/right utilities regress RTL.                                                                     | Retain start/end logical utilities.                                                             |
| Resource refetch regression           | Flattening the resource into one-time initialization would leave stale language content.                       | Keep the input-driven resource contract and its existing refetch test.                          |
| Error-state behavior drift            | The service deliberately normalizes request errors to `null`.                                                  | Do not invent an error panel/retry flow in this conversion.                                     |
| Loading announcement noise            | Adding a generic live region can create repeated announcements on language changes.                            | Preserve silent loading unless a separate UX decision changes it.                               |
| Translation ownership confusion       | Translating the backend guide as a frontend key would display wrong/missing text.                              | Translate the title only; render the guide as content.                                          |
| Token drift                           | `bg-surface-2` may not match the canonical current surface ramp.                                               | Validate and replace with the supported semantic Relay token if necessary.                      |
| Heading hierarchy mismatch            | Hard-coded `h3` may be wrong in some host contexts.                                                            | Verify usages before final conversion and preserve a coherent document outline.                 |

## Existing test coverage

`cultural-tip.component.spec.ts` currently covers the behavior most likely to be broken by a visual
migration:

- a guide renders with the translated title;
- the service receives the current language;
- a `null` guide leaves the host blank;
- changing the language refetches and replaces the guide.

No production behavior is changed by this audit, so no runtime test change is necessary in this
documentation-only PR.

Before the conversion PR changes markup, add or preserve focused regression coverage for:

1. accessible naming when `role="region"` is retained;
2. no duplicate IDs when multiple instances can coexist;
3. no focusable/interactive semantics on the static callout;
4. blank rendering for the existing null/error-normalized state;
5. language changes continuing to trigger a refetch and visible update;
6. correct title translation ownership versus backend guide content.

RTL and theme-token correctness should additionally be checked by the repository's normal static
analysis/design-preview workflow if the conversion changes visible styling.

## Implementation checklist for follow-up conversion

- [ ] Inspect all hosts of `CulturalTipComponent` and confirm whether `h3` and `role="region"` are
      appropriate in each context.
- [ ] Remove the fixed-ID collision risk if the labelled region is retained.
- [ ] Keep the component non-interactive and out of the tab order.
- [ ] Preserve the input-driven `resource()` refetch behavior.
- [ ] Preserve null/error-as-no-content behavior unless separately approved.
- [ ] Keep `culturalTip.title` translated and the backend guide unmodified.
- [ ] Preserve logical start/end border and corner behavior for RTL.
- [ ] Validate `bg-surface-2` against the current Relay surface-token contract.
- [ ] Decide explicitly between the standard non-interactive app card and a dedicated Relay
      informational-callout composition based on intended visual design.
- [ ] Do not add Spartan Brain behavior where no interaction exists.
- [ ] Run the focused cultural-tip unit tests, frontend lint/static analysis and frontend build.
- [ ] If visible markup/style changes, update the design-preview/snapshot contract required by the
      repository UI workflow.

## Acceptance-criteria trace

- **Every control/state mapped:** there are no controls; visible, loading, null/error and
  language-refresh states are mapped above.
- **Approved primitive or Relay composition:** the feature is explicitly assigned to a
  non-interactive Relay/app composition, with `AppCardComponent` considered only where its visual
  contract fits.
- **Overlay/navigation/analytics side effects documented:** all are absent; the only external effect
  is the read-only cultural-guide GET request.
- **Missing capability recorded with an owner:** no Spartan capability is missing. Any reusable
  informational-callout visual variant is owned by Relay/app composition.
- **Accessibility, RTL and theming implications captured:** contracts and migration risks are
  enumerated above.
- **Sufficient for implementation without rediscovery:** current data flow, state semantics,
  primitive ownership, service behavior, regression risks and validation steps are all recorded.
