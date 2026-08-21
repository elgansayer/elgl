# Daily login modal Spartan / Relay audit

Issue: #6096 (`Spartan UI 0316`)

Target: `frontend/src/app/components/daily-login-modal`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for migrating and maintaining the daily-login modal under the repository's Spartan Brain / Spartan Helm / Relay architecture.

The audit covers every interactive element, state, overlay, presentation utility and externally observable contract in `DailyLoginModalComponent`. It intentionally does not redesign the reward flow or add product behaviour that the component does not currently own.

The current implementation is already substantially converged on Spartan Helm. The implementation phase should therefore preserve and harden the existing primitive ownership rather than replacing working Spartan primitives with bespoke equivalents.

## Current surface

`DailyLoginModalComponent` is a standalone presentation component with three public signals:

- `coins = input(0)` supplies the reward amount displayed to the user.
- `open = input(true)` is the parent-owned visibility contract.
- `closed = output<void>()` asks the parent to dismiss the modal.

The component does not inject a service, mutate application state, navigate, call an API, or emit analytics itself. The host owns those responsibilities.

The rendered surface contains:

1. one Spartan Dialog overlay and content panel;
2. one decorative gift emoji;
3. one translated heading;
4. one translated reward/body message;
5. one Spartan Button CTA that emits `closed`;
6. no secondary action, form field, menu, tooltip, popover, toast or nested overlay.

The built-in dialog close button is intentionally disabled with `[showCloseButton]="false"`, so the CTA is the only explicitly rendered button in this component.

## Existing implementation inventory

| Element / behaviour             | Current implementation                                       | State owner                           | Target owner                              | Action                                                    |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------------- | ----------------------------------------- | --------------------------------------------------------- |
| Modal overlay and panel         | `hlm-dialog`, `hlm-dialog-content`, `*hlmDialogPortal`       | Spartan Dialog                        | Spartan Brain + Helm Dialog               | Keep                                                      |
| Controlled open state           | `computed<HlmDialogState>(() => open() ? 'open' : 'closed')` | Parent input + component adapter      | App composition feeding Spartan Dialog    | Keep controlled contract                                  |
| Dialog-originated dismiss       | `(stateChanged)="onDialogStateChanged($event)"`              | Spartan Dialog                        | Spartan Dialog + component output adapter | Keep and regression-test                                  |
| CTA                             | `<button hlmBtn size="touch">`                               | Spartan Button                        | Spartan Helm Button                       | Keep                                                      |
| CTA activation                  | `(click)="closed.emit()"`                                    | Component output                      | App composition                           | Keep                                                      |
| Dialog title                    | semantic `h3` with generated ID                              | Native semantics + Dialog association | Native semantics / Spartan Dialog         | Keep; review ID generation                                |
| Dialog labelling                | `[attr.aria-labelledby]="dialogTitleId"`                     | Component                             | Spartan Dialog composition                | Keep                                                      |
| Reward/body copy                | translated paragraph                                         | App content                           | Relay/app composition                     | Keep                                                      |
| Body live region                | `aria-live="polite"`                                         | Native accessibility                  | App accessibility policy                  | Preserve unless product intent changes                    |
| CTA accessible name             | translated CTA plus translated reward body                   | Component                             | App accessibility policy                  | Preserve during migration; evaluate redundancy separately |
| Gift graphic                    | literal `🎁`, `aria-hidden="true"`                           | App presentation                      | Relay/app composition                     | Keep decorative                                           |
| Surface/layout classes          | Tailwind utilities + semantic surface/text classes           | Relay/app composition                 | Relay                                     | Keep token ownership                                      |
| Responsive width                | `w-full max-w-sm`, `max-h-[90vh]`, scrolling                 | Relay/app composition                 | Relay                                     | Keep                                                      |
| Rounded/border/shadow treatment | Tailwind + semantic surface classes                          | Relay/app composition                 | Relay                                     | Keep                                                      |

## Spartan ownership

### Spartan Brain / Helm

The existing Dialog is the correct primitive for the overlay. It already owns the interaction semantics that must not be recreated locally, including the dialog state model, portal rendering and the primitive's focus/dismiss behaviour.

The existing `hlmBtn` CTA is also the correct button primitive. `size="touch"` preserves the repository's touch-target convention and should remain the default unless the shared Button API changes globally.

No new Brain primitive is required for this component. There is no bespoke state machine whose behaviour belongs in a reusable headless primitive. The only local adapter translates the parent-owned boolean `open` signal into `HlmDialogState` and translates a Dialog close transition back into the `closed` output.

### Relay / app composition

Relay owns the visual composition around the primitives:

- panel width and viewport containment;
- spacing and alignment;
- semantic surface and text tokens;
- border radius and shadow;
- decorative gift treatment;
- typography hierarchy;
- responsive behaviour;
- light/dark-theme rendering;
- per-user accent behaviour inherited through the shared Button/theme token contract.

The migration must not introduce local hardcoded product colours for any of these concerns when a Relay semantic token already exists.

## State model

The component has a deliberately small state space.

| State                     | `open()`                  | Dialog state                    | User-visible result      | Allowed action                                            |
| ------------------------- | ------------------------- | ------------------------------- | ------------------------ | --------------------------------------------------------- |
| Parent-hidden             | `false`                   | `closed`                        | No active dialog         | None                                                      |
| Open                      | `true`                    | `open`                          | Reward modal visible     | Activate CTA or use a Dialog-supported dismiss path       |
| Close requested by CTA    | still parent-owned        | unchanged until parent responds | CTA emits `closed`       | Parent is expected to set `open` false / remove component |
| Close requested by Dialog | `true` when event arrives | `closed` event                  | Component emits `closed` | Parent is expected to synchronize its open state          |
| Parent closes             | `false`                   | `closed`                        | Dialog closes            | None                                                      |

There is no loading, success, failure, retry, disabled or optimistic mutation state inside this component.

### Controlled-state contract

`open` is authoritative application state. The component must not silently create a second independent visibility source.

`dialogState` is a pure projection:

```text
open = true  -> Spartan state = open
open = false -> Spartan state = closed
```

When Spartan reports `closed` while `open()` is still true, `onDialogStateChanged` emits `closed`. This is an intent event, not local ownership of the parent's boolean.

Any follow-up refactor must preserve this one-way controlled-state model and avoid a feedback loop in which Dialog events repeatedly re-open or re-close the surface.

## Behavioural contracts

### CTA contract

The CTA does exactly one thing: emit `closed`.

It does not:

- claim a reward;
- call an HTTP endpoint;
- mutate a wallet/store;
- navigate;
- record analytics;
- disable itself;
- show a loading spinner;
- wait for asynchronous work.

If a host performs any of those tasks after receiving `closed`, that remains a host-level contract and must not be pulled into this component as part of a primitive migration.

### Dialog dismiss contract

A Dialog-generated transition to `closed` emits the same `closed` output only when the parent input still says the modal is open. This guard is important because it avoids treating an already-synchronized parent close as a fresh dismissal request.

The implementation phase should verify the exact dismiss paths exposed by the installed Spartan Dialog version (for example Escape and outside interaction) instead of adding parallel document listeners or bespoke overlay click handlers.

### Coins contract

`coins` defaults to `0` and is interpolated into `dailyLoginModal.body` through `TranslatePipe`.

The component performs no numeric formatting or validation. A follow-up implementation must not silently change that contract without a product/i18n decision.

## Navigation, API, mutation and analytics contracts

There are no direct navigation, API, mutation or analytics hooks in `DailyLoginModalComponent`.

Specifically, the component contains no Router call, anchor, HTTP client, store mutation, service invocation or telemetry call. Its integration boundary consists only of `coins`, `open` and `closed`.

This absence is part of the migration contract: Spartan/Relay conversion must remain behaviour-neutral and must not invent side effects simply because the surface represents a daily-login reward.

If host-level telemetry or reward mutation exists elsewhere, it should remain attached to the host event boundary unless a separate product ticket explicitly changes ownership.

## Accessibility audit

### Existing strengths

The current implementation already provides several important accessibility properties:

- the surface uses Spartan Dialog rather than a hand-rolled overlay;
- dialog content is associated with a visible heading through `aria-labelledby`;
- the decorative gift emoji is hidden from assistive technology;
- the CTA is a native `button` enhanced by `hlmBtn`;
- the CTA uses the shared `touch` size;
- visible text remains present on the CTA;
- the reward/body message is translated;
- the CTA receives a translated accessible label that includes the reward/body text.

### Focus and dismiss behaviour

Focus trapping, initial focus, Escape handling and focus return should stay with Spartan Dialog. Do not add local `document` key handlers, manual tabindex loops or custom focus restoration unless a verified gap in the installed primitive requires it.

Regression tests should prove the user-observable focus/dismiss contract rather than reimplementing the primitive internally.

### Dynamic title ID

`dialogTitleId` is generated with `Math.random()` per component instance. This avoids duplicate IDs between simultaneous client-rendered instances, but it is nondeterministic.

If this application renders the component through SSR/hydration, a random ID can become a hydration-risk because server and client output may differ. The implementation ticket should confirm the application's rendering path and, if necessary, use the repository's deterministic/SSR-safe unique-ID mechanism. Do not replace it with one global static ID, which would reintroduce duplicate-ID problems.

### Live-region behaviour

The body uses `aria-live="polite"`. Because `coins` is an input, changing the reward amount while the modal is mounted may trigger an announcement.

That may be desirable, but it is an application accessibility choice rather than a Dialog requirement. A behaviour-neutral migration should preserve it. A separate accessibility change may remove or narrow the live region only after confirming whether the reward can update while open and whether that update needs announcement.

### CTA accessible name

The CTA's accessible name concatenates the translated CTA label and the translated body/reward string. This gives assistive-technology users reward context but can duplicate nearby visible content.

Do not simplify this during the primitive migration without testing the resulting accessible name. If the repository standard prefers visible-label-only names plus `aria-describedby`, that should be handled as a focused accessibility follow-up.

## Internationalisation and RTL

All user-facing text in the component uses `TranslatePipe`; no English UI sentence is hardcoded in the component.

The migration must preserve:

- `dailyLoginModal.title`;
- `dailyLoginModal.body` with the `{ coins }` interpolation;
- `dailyLoginModal.cta`;
- text expansion for longer translations;
- language-direction inheritance from the application shell.

The current template contains no physical left/right spacing utilities. Layout is centered and therefore direction-neutral. Any future edge positioning must use logical utilities/properties (`start`/`end`, inline/block equivalents) rather than physical left/right declarations.

The reward line and CTA must be tested with long translations and RTL locales. Do not assume the interpolated number and surrounding translated text share an English ordering.

## Responsive and zoom behaviour

The panel currently uses:

- `w-full max-w-sm` for its main width constraint;
- `max-h-[90vh] overflow-y-auto` to prevent viewport clipping;
- `p-6` and vertically stacked content;
- `sm:rounded-3xl` with a smaller base radius;
- a full-width CTA.

These choices should continue to work at narrow widths and browser zoom. Regression coverage should ensure:

- no horizontal clipping at small mobile widths;
- the CTA remains reachable when vertical space is constrained;
- content remains usable at 200% and 400% zoom where applicable;
- long translated strings wrap rather than overflow;
- dialog scrolling does not make the CTA unreachable.

## Theme and token contract

The current surface uses repository semantic classes such as:

- `border-surface-100`;
- `bg-surface-200`;
- `text-text-primary`;
- `text-text-secondary`.

The shared `hlmBtn` primitive owns its Button-state styling and should continue to inherit the application's accent/theme configuration.

The implementation phase must preserve first-class light and dark themes and per-user primary accent behaviour. New raw hex/RGB/HSL product colours are not justified by this surface.

The literal gift emoji is content/decorative imagery rather than a product-colour token and does not need to be converted into a semantic colour primitive merely for consistency.

## Migration risks

### 1. Redundant primitive replacement

The largest architectural risk is treating this ticket as permission to rebuild a Dialog that is already using Spartan Dialog. Replacing `hlm-dialog`, `hlm-dialog-content` or `hlmBtn` with local wrappers or native-only substitutes would move the code away from the target architecture.

### 2. Controlled-state feedback loops

A refactor that writes local state in `stateChanged` while also consuming parent `open` can produce duplicate close notifications or an open/close loop. Keep `open` parent-owned and keep `closed` as intent.

### 3. Accidental side-effect ownership

The component name can encourage an implementer to add a reward-claim API call. The current component does not own that action. Do not add HTTP, navigation, wallet mutation or analytics in a visual migration.

### 4. Dismiss-path regressions

Disabling `[showCloseButton]` is intentional in the current presentation. Enabling Spartan's default close control changes the interaction contract and visual design. Preserve the single visible CTA unless a separate design decision says otherwise.

At the same time, preserve any keyboard/outside-dismiss behaviour intentionally provided by the Spartan Dialog primitive and verify it with the installed version.

### 5. Accessibility-name drift

Changing translation keys, removing the reward context from the CTA's accessible name, or breaking the title association would be a user-visible accessibility regression even if screenshots look unchanged.

### 6. Nondeterministic ID generation

`Math.random()` should not be copied into additional IDs. Confirm SSR/hydration requirements before retaining or replacing it.

### 7. Token drift

Do not exchange semantic `surface-*` / `text-*` classes for raw palette utilities or product colours. Relay remains the visual-token authority.

### 8. Test false confidence

The existing RTL test inspects rendered HTML for physical Tailwind utility names, which is useful but does not prove focus lifecycle, Dialog-originated close events, long-text layout or semantic labelling. The implementation ticket should add targeted behavioural coverage rather than assuming the current suite fully covers the contract.

## Existing test coverage

`daily-login-modal.component.spec.ts` currently covers:

- component creation;
- absence of common physical-direction Tailwind utility names in rendered HTML;
- default `0 coins` body rendering;
- visible title rendering;
- CTA rendering;
- `closed` emission when the CTA is clicked.

This is a useful baseline, but it does not yet cover all migration-sensitive behaviour.

## Required regression matrix for implementation

The conversion / hardening ticket should cover at least:

1. `open=true` maps to the Dialog `open` state.
2. `open=false` maps to the Dialog `closed` state.
3. CTA activation emits `closed` exactly once.
4. a Dialog-originated `closed` transition while `open=true` emits `closed` exactly once.
5. a Dialog `closed` event when `open=false` does not create a redundant close request.
6. non-default `coins` values render through the translation interpolation.
7. the Dialog has an accessible name associated with the generated title ID.
8. decorative gift content remains hidden from assistive technology.
9. CTA accessible naming contains translated action and reward context, or the approved replacement semantics if changed separately.
10. keyboard focus/dismiss behaviour remains provided by Spartan Dialog.
11. long translated title/body/CTA strings wrap at narrow widths.
12. RTL rendering introduces no physical left/right assumptions.
13. semantic surface/text tokens remain valid in light and dark themes.
14. touch-size CTA remains full-width and reachable under constrained height/zoom.
15. multiple simultaneously rendered instances do not share a dialog-title ID.
16. SSR/hydration, if used for this surface, does not produce an ID mismatch.

## Primitive prerequisites

No missing Spartan primitive blocks this component.

The required primitive capabilities are already present in the repository:

- Dialog;
- Button.

No specialized Card, Alert, Spinner, Input, Tooltip, Popover or Menu primitive is required by the current surface.

The only prerequisite question for a follow-up implementation is whether the repository has an approved deterministic unique-ID helper for SSR-safe dialog labelling. If not, that can remain a small app-level utility decision and does not justify a new Spartan Brain primitive.

## Recommended implementation sequence

1. Preserve the existing Spartan Dialog and Button primitives.
2. Add regression tests for controlled open/close synchronization and Dialog-originated dismiss.
3. Add explicit accessibility assertions for title association and CTA naming.
4. Verify the installed Dialog's keyboard/focus-return behaviour without duplicating it locally.
5. Confirm whether `Math.random()` is safe for the application's rendering mode; migrate to an approved unique-ID helper only if needed.
6. Exercise long translations, RTL, light/dark themes and constrained viewport/zoom states.
7. Keep visual composition in Relay semantic tokens and app-level Tailwind classes.
8. Update the design-preview / Claude Design artifact only if the implementation actually changes the visual contract.

## Definition of done for the follow-up implementation

The daily-login modal is considered converged when:

- Dialog behaviour remains Spartan-owned;
- the CTA remains Spartan Button-owned;
- the parent remains authoritative for `open`;
- all close paths preserve the `closed` output contract;
- no reward/API/navigation/analytics side effects are accidentally introduced;
- title and CTA accessibility contracts are verified;
- RTL uses direction-neutral/logical layout;
- light/dark and user-accent behaviour remain token-driven;
- narrow viewport, zoom and long-translation layouts remain usable;
- no duplicate primitive or local dialog state machine is introduced;
- the focused frontend regression suite passes.

## Audit conclusion

`DailyLoginModalComponent` is already on the correct Spartan foundation. Its overlay is Spartan Dialog, its only interactive control is Spartan Button, and its remaining layout/visual treatment belongs to Relay/app composition.

The safest implementation is therefore a preservation-and-hardening pass, not a rewrite: keep the existing primitives, prove the controlled close contract, strengthen accessibility and responsive/RTL regression coverage, and avoid moving host-owned reward side effects into the modal.
