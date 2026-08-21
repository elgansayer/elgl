# Daily learning tip: Spartan / Relay audit

Issue: #6091
Target: `frontend/src/app/components/daily-learning-tip`

## Purpose

This audit records the current Daily Learning Tip contract before any implementation-stage design-system work. It maps the surface to the authoritative Relay and Spartan ownership model, identifies the existing data and accessibility states, and defines the smallest safe migration boundary.

The key conclusion is that the current surface is presentation-only. It has no interactive control or interaction state machine that needs Spartan Brain or Helm. The existing Relay `AppCardComponent` remains the correct owner for the card surface.

## Source reviewed

- `frontend/src/app/components/daily-learning-tip/daily-learning-tip.component.ts`
- `frontend/src/app/components/daily-learning-tip/daily-learning-tip.component.spec.ts`
- `frontend/src/app/components/primitives/card/card.component.ts`
- `DESIGN.md`
- `docs/spartan-relay-architecture.md`

The implementation ticket must re-check the current host and API contract if either changes after this audit.

## Current feature contract

`DailyLearningTipComponent` is a standalone, read-only information surface. It renders a Relay application card containing:

1. a localised heading (`home.dailyTip.title`);
2. localised loading copy while the resource is pending; and
3. either the fetched daily-tip text or the localised fallback string.

The component creates an Angular resource whose loader:

1. asks `AuthService` for the current access token;
2. rejects if no token is available;
3. performs `GET ${environment.apiUrl}/daily-tip` with `Authorization: Bearer <token>`;
4. rejects non-2xx responses; and
5. expects `{ tip: string }`.

A computed `tip` value converts request errors and missing tip values into `home.dailyTip.fallback` through `I18nService`.

There is no user-triggered mutation, submit action, retry control, menu, dialog, selection model, tooltip, popover, focus trap, keyboard state machine, or navigation action in this component.

## Ownership map

| Element / state        | Owner                                    | Rule                                                                          |
| ---------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| Card shell             | Relay `AppCardComponent`                 | Preserve the non-interactive default card.                                    |
| Heading                | Feature composition + app i18n           | Preserve semantic heading structure.                                          |
| Loading state          | Feature async state + Relay presentation | Preserve visible pending feedback.                                            |
| Resolved tip           | Feature composition                      | Render returned text as content, not as a translation key.                    |
| Error fallback         | Feature data state                       | Preserve localised fallback without exposing transport details.               |
| Missing tip fallback   | Feature data state                       | Preserve as a distinct tested cause even though copy matches the error state. |
| Authentication lookup  | `AuthService`                            | Keep token ownership outside Relay and Spartan.                               |
| Network read           | Feature loader                           | Preserve authenticated GET semantics.                                         |
| Interactive controls   | None                                     | Do not invent controls as part of design-system convergence.                  |
| Dialog / overlay state | None                                     | No Spartan overlay primitive is applicable.                                   |

No current control or async state is intentionally left unclassified.

## Spartan ownership decision

### Brain

No Spartan Brain primitive is required. Brain is for accessible interaction state machines such as dialogs, comboboxes, menus, focus management, and selection behaviour. This surface is static content plus an async read.

### Helm

No direct Helm component is required. Helm should be introduced when a genuine Spartan interaction primitive is needed and no Relay wrapper owns the application-level contract. There is no such interaction here.

### Relay

Relay/application composition owns the current visual surface:

- `AppCardComponent` owns shared card surface, padding, radius, border, and elevation roles;
- the feature owns heading, loading, resolved, and fallback branches;
- Relay semantic text and surface tokens own theme presentation;
- `TranslatePipe` and `I18nService` own application string localisation;
- `AuthService` and the feature loader own the authenticated read contract.

This matches the architecture contract that classifies cards and async presentation states as Relay-owned.

## Card semantics

The Daily Learning Tip uses the default non-interactive card variant. The implementation stage must not switch it to an interactive variant, make the card focusable, or add button semantics without a real activation action.

Any shared-card semantic change must be reviewed across all callers rather than being introduced only to simplify this feature.

## Navigation and side effects

The component has no router dependency, `routerLink`, click navigation, URL parameter, query parameter, or route-owned state. The host owns where the component is mounted.

The only intentional side effect is:

```text
GET ${environment.apiUrl}/daily-tip
Authorization: Bearer <AuthService access token>
```

Expected success shape:

```json
{
  "tip": "..."
}
```

Migration invariants:

- never place the token in markup, logs, telemetry, or error copy;
- do not move token ownership into Relay or Spartan primitives;
- preserve the bearer-header contract while the endpoint remains unchanged;
- do not add writes, analytics, navigation, or persistence as part of this migration.

## Async state machine

```text
resource starts
  -> loading copy
  -> success
       -> fetched tip when present
       -> localised fallback when tip is absent
  -> error
       -> localised fallback
```

Missing token, request failure, and missing tip data currently resolve to the same user-facing fallback. Tests should cover those causes independently.

## Accessibility requirements

- Keep the visible title as a real heading.
- Verify the heading level against the actual host document hierarchy.
- Keep tip, loading, and fallback content as real selectable text.
- Do not make the default card focusable.
- Do not add keyboard state where no interaction exists.
- Inspect the rendered accessibility tree for the shared card region semantics.
- If async announcement is needed after testing, scope it narrowly to a concise status container rather than making the whole card a live region.
- Do not announce raw transport or authentication errors.
- Maintain WCAG AA contrast using Relay semantic tokens.
- Keep content readable and reflowable at 200% and 400% zoom.
- Allow long tip content to wrap without clipping or horizontal scrolling.

## RTL and multilingual requirements

- Continue routing app-owned strings through `TranslatePipe` and `I18nService`.
- Do not treat server-provided tip prose as an application translation key.
- Inherit document direction from the active locale.
- Use logical spacing and positioning only for direction-sensitive layout.
- Do not introduce physical `left`, `right`, `ml`, `mr`, `pl`, or `pr` layout utilities where a logical equivalent exists.
- Test an RTL locale with mixed-direction content.
- Allow translated and server-provided copy to expand vertically without fixed-height clipping.

## Responsive and theme requirements

- Preserve the mobile-first baseline and let the host control width.
- Do not add feature-local fixed dimensions to match one preview.
- Keep card padding, radius, border, and elevation on Relay contracts.
- Verify narrow mobile, tablet, desktop, and 400% zoom reflow.
- Use Relay semantic colour tokens rather than hard-coded values.
- Preserve independently designed light and dark themes.
- Do not create a second Spartan-specific visual token layer.

## Migration risks

### Unnecessary Spartan conversion

Replacing the Relay card with Brain or Helm would increase coupling without transferring any interaction behaviour. Preserve `AppCardComponent` unless the product gains an actual interaction.

### Skipped regression suite

The current component spec is suite-skipped. The implementation ticket must make that suite executable and stable before or alongside any runtime markup or data change. Skipped tests are not passing coverage.

### Request-contract regression

Resource construction changes can alter request timing and frequency. Lock down URL, bearer header, loading, success, error, missing token, and missing-value behaviour before refactoring.

### Shared-card blast radius

Do not alter shared card semantics solely for this surface without auditing all callers.

### Async announcement noise

Do not add a broad live region without evidence. If testing finds an announcement gap, use a narrowly scoped status strategy.

### Backend localisation ambiguity

Preserve returned tip text exactly. Any backend locale contract belongs in a separate product/API change.

### Incidental product behaviour

Retry controls, refresh, navigation, analytics, truncation, animation, or new card variants exceed this audit and require separate acceptance criteria.

## Recommended implementation sequence

1. Reconfirm the current host and API contract.
2. Restore executable unit coverage for the component.
3. Lock the authenticated read and fallback state matrix in tests.
4. Inspect the rendered accessibility tree and heading context.
5. Preserve the Relay default card unless a real interaction requirement has been introduced.
6. Verify RTL, multilingual expansion, mobile reflow, zoom, light theme, and dark theme.
7. Run repository static analysis, unit tests, build, Spartan ownership checks, and design-system convergence checks.

## Required implementation-stage tests

At minimum, executable tests should cover:

- loading state;
- successful tip response;
- request error fallback;
- missing access token fallback;
- missing or empty tip fallback;
- correct GET URL and bearer header;
- no accidental focusable card semantics;
- no raw error details in visible copy.

## Exit criteria

The audit is satisfied when the implementation owner can answer all of the following from current code and tests:

- Who owns every visible state? Relay/application composition.
- Is a Spartan interaction primitive required today? No.
- What network side effect must remain stable? The authenticated daily-tip GET.
- What accessibility risk needs explicit host verification? Heading and region semantics plus async announcement behaviour.
- What existing test debt must be removed before claiming migration coverage? The skipped component suite.

This audit does not itself require runtime UI changes. It establishes the design authority and verification boundary for the follow-up implementation work.
