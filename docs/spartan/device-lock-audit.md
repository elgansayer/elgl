# Device lock Spartan / Relay audit

Issue: #6113 (`Spartan UI 0331`)

Target: `frontend/src/app/components/device-lock`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for migrating and maintaining the device-lock surface under the repository's Spartan Brain / Spartan Helm / Relay architecture.

The audit covers every interactive control, visible state, navigation contract, service side effect, accessibility requirement, styling concern and migration risk in `DeviceLockComponent`. It intentionally does not redesign WebAuthn, authentication, route policy or the app-lock product rules.

The current surface is small and already uses Spartan Button behaviour. The follow-up implementation should therefore preserve the working Button primitive, move presentation onto Relay semantic roles where needed, and add missing state and regression coverage rather than creating another lock-screen abstraction.

## Current surface

`DeviceLockComponent` is a standalone route component rendered at `/lock`.

It injects:

- `AppLockService`, which owns biometric lock state and the WebAuthn unlock attempt;
- Angular `Router`, which owns successful navigation.

It renders:

1. one full-height centered page surface;
2. one translated heading;
3. one translated explanatory paragraph;
4. one native `button` enhanced with Spartan `hlmBtn` and `size="touch"`;
5. no form field, menu, tooltip, popover, dialog, sheet, toast or other overlay.

The component has no inputs or outputs and owns no persistent state of its own.

## Existing implementation inventory

| Element / behaviour        | Current implementation                      | State owner                    | Target owner                        | Audit action                           |
| -------------------------- | ------------------------------------------- | ------------------------------ | ----------------------------------- | -------------------------------------- |
| Page shell                 | `div` with centered flex layout             | Feature surface                | Relay / app composition             | Keep layout role, retoken visual roles |
| Heading                    | translated `h1`                             | Feature content                | Native semantics + Relay typography | Keep                                   |
| Supporting copy            | translated `p`                              | Feature content                | Native semantics + Relay text role  | Keep, replace white alpha styling      |
| Unlock control             | native `button` + `hlmBtn` + `size="touch"` | Spartan Button                 | Spartan Helm Button                 | Keep                                   |
| Unlock activation          | `(click)="unlock()"`                        | Feature component              | Feature behaviour                   | Keep                                   |
| Biometric assertion        | `AppLockService.unlock()`                   | AppLockService                 | Service boundary                    | Keep outside UI primitives             |
| Successful redirect        | `router.navigate(['/home'])`                | Feature component              | Angular Router / route contract     | Preserve                               |
| Failed or cancelled unlock | no visible state change                     | AppLockService returns `false` | Feature feedback composition        | Gap to address deliberately            |
| Page background            | `bg-surface-900`                            | Feature styling                | Relay semantic surface              | Replace dark-only assumption           |
| Primary text               | `text-white`                                | Feature styling                | Relay semantic text token           | Replace                                |
| Secondary text             | `text-white/60`                             | Feature styling                | Relay semantic text token           | Replace                                |
| Width constraint           | `max-w-sm`                                  | Feature layout                 | Relay / app composition             | Keep if validated at zoom              |
| Text alignment             | `text-center`                               | Feature layout                 | Relay / app composition             | Keep, direction-neutral                |

## Spartan ownership

### Spartan Brain / Helm

The unlock action is a standard button interaction. The current native `<button hlmBtn>` is the correct interaction primitive and already preserves native keyboard activation, focus semantics and button role while using the repository's Spartan Button styling layer.

No additional Spartan Brain primitive is required by the current surface. There is no dialog, menu, combobox, select, tooltip, popover or roving-focus interaction to migrate.

Do not add Brain solely to increase Spartan usage. The architecture explicitly keeps presentation-only containers in Relay / app composition.

The repository also contains owned Button Helm code under `frontend/src/app/components/ui/button`. A future programme-wide Button import consolidation may choose a single import boundary. This audit does not require a one-off import rewrite unless the active Button migration standard explicitly mandates it.

### Relay / app composition

Relay owns the visual and responsive composition around the Button:

- page surface role;
- heading and supporting text colour roles;
- spacing;
- width and reflow behaviour;
- light and dark theme parity;
- per-user primary accent behaviour inherited through Button tokens;
- high-zoom layout;
- forced-colour compatibility where shared primitives expose it.

The current `bg-surface-900 text-white` and `text-white/60` combination behaves like a fixed dark presentation. It conflicts with the programme requirement that light and dark are both first-class and that product text should use semantic Relay text roles.

A follow-up visual conversion should prefer the repository's semantic surface and text tokens, for example the same page/surface role used by neighbouring route surfaces plus `text-text-primary` and `text-text-secondary`, rather than replacing the current classes with another raw palette combination.

## State model

The visible component currently exposes only two meaningful interaction outcomes, while `AppLockService` contains the underlying lock state.

| State                           | Trigger                                   | Current user-visible result                 | Required ownership                           |
| ------------------------------- | ----------------------------------------- | ------------------------------------------- | -------------------------------------------- |
| Locked idle                     | `/lock` route renders                     | Title, message and Unlock button visible    | Feature + Relay                              |
| Unlock attempt in progress      | user activates Unlock                     | No distinct busy state                      | Feature should own UI feedback if introduced |
| Unlock succeeds                 | `AppLockService.unlock()` resolves `true` | navigate to `/home`                         | Service + Router                             |
| Unlock fails                    | WebAuthn assertion fails or errors        | remains on page with no feedback            | Feature feedback gap                         |
| Unlock cancelled                | platform authenticator flow is cancelled  | service returns `false`; no feedback        | Feature feedback gap                         |
| Unlock times out                | WebAuthn request errors/times out         | service returns `false`; no feedback        | Feature feedback gap                         |
| Biometric lock already disabled | service detects disabled state            | service returns `true`; navigate to `/home` | Existing service contract                    |
| Stored credential missing       | service clears stale lock settings        | service returns `true`; navigate to `/home` | Existing recovery contract                   |

### Busy-state contract

`unlock()` is asynchronous. The current component does not disable the Button or expose an in-progress state while awaiting the platform credential prompt.

That means repeated activation can start overlapping calls at the feature layer. The implementation ticket should add a small signal-owned pending guard if product behaviour permits it:

- ignore duplicate activation while one unlock attempt is active;
- disable the Button while pending;
- expose an accessible busy/status indication without replacing the native Button semantics;
- always clear pending state on success, failure and thrown errors.

This is feature state, not Spartan Brain state.

### Failure-state contract

`AppLockService.unlock()` currently normalises authenticator rejection, cancellation and other assertion failures into `false`. The component therefore cannot reliably present different error reasons.

A behaviour-preserving conversion should not invent specific messages such as "fingerprint rejected" or "credential expired" when the service does not provide that distinction.

A generic translated retry message may be appropriate in the implementation stage. If product requirements need specific causes, change the service contract in a separate, tested feature decision rather than inferring cause from the UI.

## AppLockService and WebAuthn contract

`DeviceLockComponent` must remain a thin orchestration layer. WebAuthn details belong to `AppLockService`.

Current service behaviour relevant to this surface:

- biometric lock configuration is persisted in `localStorage`;
- the credential identifier is persisted separately from the enable flag;
- `unlock()` immediately succeeds when biometric lock is disabled;
- a missing stored credential is treated as recoverable stale state and clears the local lock;
- an enabled lock with a stored credential calls `navigator.credentials.get()` through the service;
- user verification is required by the WebAuthn request;
- successful assertion clears the service's `appLocked` signal;
- failed assertion returns `false` and leaves the app locked;
- the credential request has a 60-second timeout;
- exceptions are currently normalised to `false` rather than exposed to the route component.

The UI migration must not copy WebAuthn logic, credential identifiers, `localStorage` access or platform-authenticator calls into the component or a UI primitive.

## Security boundary

The device lock is a client-side application privacy control. It must not be described or treated as a replacement for server-side authentication or authorisation.

The migration must preserve these boundaries:

- no credential material is rendered into the DOM;
- no credential identifiers are logged or added to analytics;
- the Button receives no secret or raw WebAuthn response;
- app-lock state changes stay inside `AppLockService`;
- server API authorisation remains independent of this route;
- issue-controlled or translated content must never influence WebAuthn request construction.

The current component does not call an API directly and does not expose secrets.

## Navigation contract

The route table lazy-loads `DeviceLockComponent` at `/lock`.

On a successful `unlock()` result, the component navigates to `/home`.

The Spartan / Relay conversion must preserve both contracts unless a separate routing ticket intentionally changes them.

Do not replace the successful redirect with history-based navigation, `/`, `/dashboard` or another destination as an incidental visual change.

There is no secondary link or cancel navigation in the current surface.

## API, mutation and analytics contracts

`DeviceLockComponent` has no direct HTTP/API call, store write or analytics hook.

The only feature side effects are:

1. calling `AppLockService.unlock()`;
2. navigating to `/home` after a `true` result.

The service may update local lock state as part of the unlock flow. That remains a service responsibility.

No analytics event should be invented by this migration. If security/product telemetry is added later, it must avoid biometric or credential details and follow the repository's sanitisation policy.

## Accessibility audit

### Existing strengths

The current implementation already has several useful properties:

- the unlock action is a native `button`;
- Spartan `hlmBtn` supplies the shared Button behaviour/styling contract;
- `size="touch"` preserves the repository's mobile touch target convention;
- the heading uses a real `h1`;
- visible UI copy is translated;
- no click-only non-button element is used;
- no physical direction utility is present;
- no custom keyboard state machine is present.

### Landmark and page semantics

The route surface currently starts with nested `div` elements. A standalone route should expose an appropriate page landmark, normally a semantic `main` owned by the route shell if the application shell does not already provide one.

Before adding a local `main`, confirm whether the surrounding app shell already renders the route outlet inside a `main` landmark. Nested `main` landmarks would be incorrect. The implementation test should inspect the rendered route in its real shell rather than assuming the component is isolated.

### Accessible name

The Unlock button receives its accessible name from its visible translated label. No additional `aria-label` is needed while the visible label remains sufficient.

Do not duplicate the label with a hard-coded English ARIA string.

### Pending state

If a pending guard is introduced, the busy state must be exposed without removing the Button's accessible name. Appropriate behaviour may include:

- `disabled` while the request is active;
- an `aria-busy` state on the relevant action or status container where useful;
- translated pending text only if the product design calls for it.

A decorative spinner alone is not an accessible status message.

### Failure feedback

A failed unlock currently produces no announced or visible feedback. This is the main accessibility gap because a keyboard or screen-reader user can activate the Button, return from the platform prompt and receive no explanation that the app remains locked.

If generic failure feedback is added, it should:

- be visible, not colour-only;
- use a translated string;
- use an appropriate status/alert announcement policy without repeatedly spamming assistive technology;
- keep focus in a predictable location for retry;
- avoid exposing security-sensitive failure detail.

### Focus behaviour

There is no overlay owned by this component, so no focus trap or manual focus restoration is required.

The browser/platform WebAuthn prompt is external to the Angular DOM. The feature should not add a custom document-level focus trap around it.

After an unsuccessful attempt, the existing Unlock control should remain reachable and visibly focusable.

## Internationalisation and RTL

All three user-facing strings currently use `TranslatePipe`:

- `deviceLock.title`;
- `deviceLock.message`;
- `deviceLock.unlock`.

A follow-up failure or pending message must also use translation keys and must not hard-code English in TypeScript or the template.

The current centered layout contains no left/right assumptions and is naturally direction-neutral. Any future edge spacing or icon placement must use logical Tailwind utilities and logical CSS properties.

Regression coverage should exercise:

- an RTL document direction;
- a long translated heading;
- a long translated body;
- a long translated Button label;
- scripts whose glyph coverage differs from Latin.

Do not apply a display font to translated copy unless its script coverage is guaranteed by the design system.

## Theme and token audit

### Current token-compatible behaviour

`bg-surface-900` uses a Relay surface token name, and the Button inherits its shared Spartan/Relay theme behaviour.

### Current token drift

The page explicitly forces:

- `text-white` for primary content;
- `text-white/60` for supporting content.

These are presentation assumptions rather than semantic text roles. They can lose contrast or visual hierarchy when the light theme is active and make the route behave like a dark-only exception.

The implementation stage should move text onto Relay semantic roles. It should also confirm that the selected page background role is appropriate in both light and dark themes rather than assuming the darkest surface step is always the route background.

No new raw hex, RGB, HSL or stock Tailwind product colour is justified for this surface.

### Per-user accent

The Unlock control should continue to inherit the shared Button's primary/accent behaviour. Do not hard-code the default Ember colour locally because `primary` is user-configurable.

## Responsive, zoom and forced-colour behaviour

The current content column is constrained with `max-w-sm`, but it has no explicit inline page padding.

The implementation stage should verify:

- comfortable inline spacing on a 390px mobile viewport;
- no text clipping at 200% and 400% zoom/reflow;
- long translations wrap instead of forcing horizontal scrolling;
- the touch-sized Button remains fully visible and reachable;
- viewport height changes caused by browser chrome do not hide the action;
- visible focus remains distinguishable in light, dark and forced-colour modes.

If page padding is added, use logical or direction-neutral spacing.

## Primitive prerequisites

No missing Spartan primitive blocks this component.

Required capability already present:

- Button.

Not required by the current surface:

- Dialog;
- Select;
- Combobox;
- Menu;
- Popover;
- Tooltip;
- Input;
- Textarea;
- Tabs;
- Toast.

Feedback for a failed unlock can remain simple feature/Relay status composition unless a repository-wide feedback primitive already owns that exact pattern. Do not add an overlay solely to report a failed biometric attempt.

## Migration risks

### 1. Turning a small page into an unnecessary primitive stack

The surface has one standard button and presentation-only text/layout. Adding Brain wrappers, cards, dialogs or bespoke lock primitives would increase complexity without owning a reusable interaction state machine.

### 2. Dark-only token preservation

Treating `text-white` and `text-white/60` as intentional can preserve a route-level dark-only exception and violate first-class light-theme requirements.

### 3. Duplicate unlock attempts

Because `unlock()` is asynchronous and the Button is not disabled while pending, rapid activation may cause overlapping platform credential requests. Any pending guard must be bounded and tested.

### 4. Invented failure causes

The service reduces multiple WebAuthn failure modes to `false`. The UI must not claim a specific rejection cause that the service cannot prove.

### 5. Weakening security boundaries

Moving WebAuthn or local credential storage into a component, logging credential identifiers, or treating app lock as server authorisation would be architectural regressions.

### 6. Navigation drift

Changing the successful destination away from `/home` as part of a visual migration would alter feature behaviour outside this ticket.

### 7. Test gap

There is no adjacent `device-lock.component.spec.ts` in the target directory on `main`. The implementation phase must add focused component coverage rather than relying only on visual review.

There is also no adjacent `app-lock.service.spec.ts` at the conventional service path. If the implementation changes service behaviour, it must add service tests in the same PR.

### 8. Shell landmark assumptions

Adding a `main` landmark without checking the host shell can create invalid or confusing nested landmarks. Test the route composition before changing semantics.

## Required regression matrix for implementation

The follow-up conversion / hardening ticket should cover at least:

1. the component creates with mocked `AppLockService` and Router dependencies;
2. the translated title, message and action are rendered;
3. the unlock action is a native Button enhanced by the approved Spartan Button directive;
4. the touch-size Button contract is preserved;
5. one activation calls `AppLockService.unlock()` once;
6. a `true` unlock result navigates exactly to `/home`;
7. a `false` unlock result does not navigate;
8. a failed result leaves a retry control available;
9. duplicate activation is prevented if a pending guard is introduced;
10. pending state is cleared after a failed attempt;
11. pending state is cleared if the service throws unexpectedly;
12. generic failure feedback, if introduced, is visible and announced appropriately;
13. the Button keeps a translated accessible name in idle and pending states;
14. keyboard activation remains native and no custom key handler is introduced;
15. RTL rendering introduces no physical direction assumptions;
16. long translated strings wrap at a narrow viewport;
17. light and dark themes use semantic surface/text roles;
18. per-user primary accent continues through the shared Button contract;
19. high zoom does not clip the action or supporting text;
20. no credential identifier or WebAuthn response is exposed in rendered output or diagnostics.

If service behaviour is changed, add focused `AppLockService` coverage for stale credential recovery, failed assertion, successful assertion and lock-signal transitions.

## Recommended implementation sequence

1. Add a focused `device-lock.component.spec.ts` before changing behaviour.
2. Preserve `AppLockService` as the sole WebAuthn / local lock-state owner.
3. Preserve `/lock` and successful `/home` navigation contracts.
4. Keep the existing Spartan Button primitive and `touch` size.
5. Replace white text assumptions with Relay semantic text roles and validate the page surface role in both themes.
6. Add direction-neutral mobile padding if narrow/high-zoom testing shows the current shell needs it.
7. Add a bounded pending guard to prevent duplicate unlock attempts if accepted as part of hardening.
8. Add generic translated failure feedback without inventing a biometric failure cause.
9. Verify focus, keyboard, RTL, long-translation, light/dark, forced-colour and high-zoom behaviour.
10. Update design-preview / Claude Design only if the implementation changes the mapped visual contract.
11. Run the complete frontend verification gate before merge.

## Verification gate

For implementation changes, use the repository's current frontend gate:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

If the visual contract changes, also run the root design-sync validation required by repository policy.

For this audit-only document, validation consists of checking the audit against:

- `frontend/src/app/components/device-lock/device-lock.component.ts`;
- `frontend/src/app/services/app-lock.service.ts`;
- `frontend/src/app/app.routes.ts`;
- `DESIGN.md`;
- `AGENTS.md`;
- `frontend/AGENTS.md`;
- `docs/spartan-relay-architecture.md`;
- `docs/design-redesign-audit.md`;
- the installed Button Helm inventory under `frontend/src/app/components/ui/button`.

No runtime, interaction or visual contract is changed by this audit, so component tests and design-preview output are not modified in this ticket.

## Acceptance checklist

- [x] Every current interactive element is inventoried.
- [x] Every current visible state and service outcome relevant to the surface is recorded.
- [x] The unlock service boundary is documented.
- [x] The `/lock` route and successful `/home` navigation contract are documented.
- [x] The absence of direct API and analytics hooks is recorded.
- [x] Spartan ownership is identified without introducing unnecessary Brain usage.
- [x] Relay token and theme gaps are identified.
- [x] Accessibility, RTL, i18n, zoom and responsive requirements are recorded.
- [x] Migration risks and primitive prerequisites are identified.
- [x] Missing adjacent component/service tests are recorded as implementation risks.
- [x] A concrete regression matrix and verification gate are provided.

## Source files reviewed

- `frontend/src/app/components/device-lock/device-lock.component.ts`
- `frontend/src/app/services/app-lock.service.ts`
- `frontend/src/app/app.routes.ts`
- `frontend/src/app/components/ui/button/`
- `DESIGN.md`
- `AGENTS.md`
- `frontend/AGENTS.md`
- `docs/spartan-relay-architecture.md`
- `docs/design-redesign-audit.md`
