# Device transfer Spartan / Relay audit

Issue: #6118 (`Spartan UI 0336`)

Target: `frontend/src/app/components/device-transfer`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for migrating and maintaining the device-transfer surface under the repository's Spartan Brain / Spartan Helm / Relay architecture.

The audit covers every current control, visible and async state, overlay, service/API side effect, route contract, accessibility requirement, RTL/i18n concern, theme/responsive requirement and migration risk in `DeviceTransferComponent`. It does not redesign the authentication protocol, transfer-token lifetime, API endpoints or product flow.

The current component is already substantially aligned with the target UI architecture: standard actions use Spartan Button, the overlay uses Spartan Dialog, page composition uses `AppCardComponent`, and the transfer link and QR image retain appropriate native semantics. Follow-up work should therefore harden state modelling, feedback, accessibility and regression coverage rather than replacing working primitives merely to increase Spartan usage.

## Current surface

`DeviceTransferComponent` is a standalone route component rendered at `/device-transfer`.

It injects:

- `AuthService`, which generates the temporary device-transfer link;
- Angular `Router`, which redirects unauthenticated browser users to `/login`;
- `I18nService`, which owns all visible translated copy;
- `DomSanitizer`, which marks the locally-created QR object URL safe for image rendering;
- `PLATFORM_ID`, which separates browser-only local-storage, Blob URL and QR behaviour from SSR execution.

It renders:

1. one `AppCardComponent` presentation surface;
2. one translated `h2` heading;
3. one translated explanatory paragraph;
4. one native launch `button` enhanced with Spartan `hlmBtn`;
5. one Spartan Dialog overlay when a transfer link has been generated;
6. one translated modal heading and explanatory paragraph;
7. one native `img` containing the generated QR code when running in the browser;
8. one native external `a` containing the generated transfer URL;
9. one native cancel `button` enhanced with Spartan `hlmBtn`;
10. no menu, select, combobox, tooltip, popover, form field, toast or app-specific custom keyboard interaction.

The component owns short-lived UI state only. It does not persist the transfer response into application state or browser storage.

## Existing implementation inventory

| Element / behaviour           | Current implementation                                 | State owner                    | Target owner                                  | Audit action                                    |
| ----------------------------- | ------------------------------------------------------ | ------------------------------ | --------------------------------------------- | ----------------------------------------------- |
| Page/content shell            | `app-card` with column layout                          | Feature composition            | Relay / app composition                       | Keep                                            |
| Page heading                  | translated native `h2`                                 | Feature content                | Native semantics + Relay typography           | Keep                                            |
| Supporting copy               | translated `p` + semantic text token                   | Feature content                | Relay text role                               | Keep                                            |
| Generate-transfer action      | native `button` + `hlmBtn`                             | Spartan Button                 | Spartan Helm / approved Relay Button boundary | Keep                                            |
| Generate API call             | `AuthService.generateDeviceLink()`                     | Auth service                   | Service/API boundary                          | Preserve outside UI primitives                  |
| Dialog open/close             | `hlm-dialog`, `hlm-dialog-content`, `brnDialogContent` | Spartan Dialog + feature state | Spartan Brain/Helm Dialog                     | Keep; harden state owner                        |
| Dialog title                  | translated `h3` with fixed ID                          | Feature content                | Native semantics + Dialog labelling contract  | Keep content; verify relationship and ID safety |
| QR rendering                  | `QRCode.toBlob()` + native `img`                       | Feature/browser integration    | Native image + feature integration            | Keep                                            |
| QR Blob URL lifetime          | `URL.createObjectURL` / `URL.revokeObjectURL`          | Feature lifecycle              | Feature/browser integration                   | Preserve and test                               |
| Transfer link                 | native external `a`                                    | Browser/native navigation      | Native anchor + Relay presentation            | Keep native anchor                              |
| Cancel action                 | native `button` + `hlmBtn` outline variant             | Spartan Button                 | Spartan Helm / approved Relay Button boundary | Keep                                            |
| Unauthenticated redirect      | `router.navigateByUrl('/login')`                       | Feature route guard fallback   | Angular Router / auth route contract          | Preserve                                        |
| Request pending               | no explicit visual state                               | Feature async flow             | Feature state + Relay feedback                | Gap                                             |
| Request failure               | service returns `null`; no feedback                    | Service + feature              | Feature feedback composition                  | Gap                                             |
| QR generation pending/failure | no explicit visual state or recovery                   | Feature/browser integration    | Feature state + Relay feedback                | Gap                                             |
| Dialog cancellation           | `cancelTransfer()` resets local transfer state         | Feature lifecycle              | Feature + Spartan close lifecycle             | Keep                                            |
| Component teardown            | revokes Blob URL and clears state                      | Feature lifecycle              | Feature                                       | Keep                                            |
| Analytics                     | none in component                                      | N/A                            | N/A                                           | Do not invent during migration                  |

Every current app-specific visual or interactive control is therefore classified. No bespoke interaction state machine remains that requires a new Spartan primitive.

## Spartan ownership

### Dialog: Spartan Brain and Helm

The transfer overlay already uses the correct interaction family:

- `BrnDialogContentDirective` provides Spartan Brain's accessible dialog behaviour;
- `HlmDialogComponent` and `HlmDialogContentComponent` provide Helm presentation;
- the feature controls when transfer content exists and when local state must be cleared.

Spartan should continue to own generic overlay mechanics such as focus containment, Escape dismissal, backdrop dismissal and focus restoration. Feature code should not add document-level keyboard listeners, hand-rolled focus traps, click-propagation guards or custom `tabindex` state to duplicate Dialog behaviour.

The component should preserve the existing `(closed)="cancelTransfer()"` lifecycle so all Dialog-originated dismissal paths clear the temporary local transfer state.

### Buttons: Spartan Helm / approved Relay boundary

Both actions are native `<button>` elements enhanced with `hlmBtn`:

- the primary launch action uses the default Button presentation;
- the cancel action uses the outline variant;
- both specify `type="button"`;
- both use `min-h-11`, preserving an approximately 44px minimum touch target.

No app-specific button state machine is justified. If the programme consolidates feature usage behind an owned Relay Button wrapper, migration should use that shared boundary. Until then, the existing Spartan Button usage is preferable to recreating button styling or focus behaviour locally.

### Native transfer link

The generated transfer URL is navigation, not a button action. The native `<a>` is the correct semantic primitive and must remain keyboard- and browser-native.

Do not convert the transfer link to a Button solely for visual consistency. Styling belongs to Relay tokens/composition, while the browser owns link semantics, open-in-new-tab behaviour and standard link interaction.

The existing `target="_blank"` with `rel="noopener noreferrer"` prevents the opened page from receiving an opener reference and avoids referrer disclosure through this link.

### Native QR image

The QR code is content, not an interaction state machine. A native `<img>` with a translated alternative remains appropriate.

Spartan Brain is not required for the QR image. Any future QR presentation wrapper would be a Relay/app composition concern unless it introduces reusable interactive behaviour.

### Relay / app composition

Relay owns the product presentation around the interaction primitives:

- `AppCardComponent` surface composition;
- semantic text, background, border and shadow roles;
- spacing and width constraints;
- responsive reflow;
- light/dark parity;
- high-zoom and forced-colour behaviour;
- any reusable loading/error/status presentation introduced by follow-up work.

The migration must not move authentication, transfer generation, Blob lifecycle or Router behaviour into Relay primitives.

## State model

The component has more meaningful states than the current UI exposes.

| State                      | Trigger                                      | Current user-visible result                        | Required ownership          |
| -------------------------- | -------------------------------------------- | -------------------------------------------------- | --------------------------- |
| Unauthenticated browser    | route initializes without `accessToken`      | navigate to `/login`                               | Feature + Router            |
| Idle authenticated         | route renders                                | card, description and launch button                | Feature + Relay             |
| Generate request pending   | user activates launch button                 | no explicit busy state; button remains activatable | Feature async state gap     |
| Generate request fails     | service catches error and returns `null`     | remains idle with no visible explanation           | Feature feedback gap        |
| Generate response succeeds | API returns link/token/expiry                | QR generation begins in browser                    | Service + feature           |
| QR generation pending      | `QRCode.toBlob()` is awaiting completion     | no intermediate status                             | Feature/browser state gap   |
| Dialog ready in browser    | transfer link + QR Blob URL available        | Dialog opens with QR, raw link and cancel          | Feature + Spartan Dialog    |
| Dialog ready during SSR    | response exists but browser APIs are skipped | Dialog state can be set without a QR image         | Feature/SSR contract        |
| User cancels               | cancel button activated                      | local link/QR cleared, Dialog closes               | Feature + Spartan lifecycle |
| Dialog dismisses           | Escape/backdrop/other Spartan close path     | `(closed)` calls cancellation/reset                | Spartan + feature lifecycle |
| Component destroyed        | Angular teardown                             | Blob URL revoked and local state cleared           | Feature lifecycle           |

### Current open-state representation

`showDialog` is currently a function field initialised as `() => false` and reassigned to new closures returning `true` or `false`.

This works with the current template expression, but it is not an idiomatic reactive state holder and makes the open/closed contract harder to reason about and test. A follow-up implementation should use a small explicit signal/boolean state model consistent with the repository's Angular conventions, without moving product state into Spartan itself.

The feature owns whether transfer content exists. Spartan owns the generic Dialog interaction once that state is open.

### Duplicate-request risk

`openTransfer()` is asynchronous and the launch Button remains enabled throughout both the API request and QR generation.

Repeated activation can therefore start overlapping transfer-generation requests and Blob-generation work. A follow-up should add a bounded pending guard if the product contract permits it:

- ignore or disable duplicate activation while one generation flow is active;
- expose a visible and accessible pending state;
- clear pending state on success, service failure and QR-generation failure;
- ensure a stale earlier request cannot overwrite a newer flow if concurrency is otherwise allowed.

This is feature state, not a new Spartan primitive.

### Failure contract

`AuthService.generateDeviceLink()` catches request errors, logs the error and returns `null`. The component currently treats `null` as a silent no-op.

A migration should not invent a detailed server failure cause that the service does not expose. If feedback is added without changing the service contract, use a generic translated retry message.

QR generation can also reject independently after the API succeeds. The current `openTransfer()` does not catch that rejection. Follow-up implementation and tests should ensure a QR failure does not strand pending state, leak a previous object URL or surface an unhandled promise rejection.

## Authentication, API and mutation contract

### Route and authentication behaviour

The route table lazy-loads `DeviceTransferComponent` at `/device-transfer` with the title `Device Transfer - HelloTalk`.

On browser initialisation, `isLoggedIn()` checks `localStorage.getItem('accessToken')`. When no access token exists, the component navigates to `/login`.

On non-browser/SSR execution, `isLoggedIn()` returns `true` to avoid browser-storage access.

The UI migration must preserve these behaviours unless a separate authentication/route ticket intentionally replaces the local guard with a shared route guard.

### Transfer generation

`AuthService.generateDeviceLink()` performs a POST to `/auth/transfer/generate` and returns a response shaped as:

- `link`;
- `transferToken`;
- `expiresAt`.

`DeviceTransferComponent` uses the returned `link`. It does not persist `transferToken` or `expiresAt` locally.

Generating a transfer link is a real server-side side effect because it creates an ephemeral credential that another device can exchange. It must remain behind the Auth service/API boundary and must not be triggered by presentation primitives, render cycles or design-preview code.

### Token exchange boundary

`AuthService` separately exposes `swapDeviceToken(transferToken)`, which POSTs the transfer token to `/auth/transfer/swap` and installs the returned authenticated session through the service.

`DeviceTransferComponent` does not call the swap endpoint. Its responsibility is only to generate and present the link/QR for use on another device.

Do not merge generation and swap responsibilities into this component during a Spartan migration.

### Cancellation versus revocation

`cancelTransfer()` clears local presentation state and revokes the local QR Blob URL. It does not call a server revocation endpoint.

Therefore "Cancel" currently means close/reset this UI, not revoke the server-generated transfer credential. Follow-up UI work must not claim that cancellation invalidates the link unless the backend contract explicitly guarantees or implements that behaviour.

The response includes `expiresAt`, but the component does not display expiry or countdown state. Adding expiry UX would be a product/behaviour change and should be deliberate and tested rather than smuggled into a primitive conversion.

### Analytics

No analytics hook is present in `DeviceTransferComponent`.

Do not add telemetry merely as part of the UI migration. If product analytics are introduced later, the temporary URL, transfer token, QR contents and authentication details must never be included in event payloads.

## QR and Blob lifecycle

In a browser, a successful API response is converted into a QR code using `QRCode.toBlob(response.link, { margin: 1, width: 224 })`.

The resulting Blob receives a local object URL, which is then wrapped with `DomSanitizer.bypassSecurityTrustUrl()` for the image source. The sanitizer bypass applies to the locally-created Blob URL, not to the backend-provided external anchor URL.

Lifecycle rules to preserve:

1. revoke a previous object URL before replacing it;
2. retain only the current object URL reference;
3. revoke it on explicit cancellation;
4. revoke it on Dialog-originated dismissal through the cancellation path;
5. revoke it on component destruction;
6. never persist the Blob URL or transfer link into local storage;
7. do not log the QR payload or generated transfer URL.

Regression tests should mock the browser URL APIs so object-URL creation/revocation is deterministic and does not rely on the test environment's native Blob implementation.

## Security and privacy boundary

The generated URL and its QR representation should be treated as bearer-like temporary credential material. Anyone who can use a still-valid transfer link may be able to exchange the associated token according to the backend protocol.

The UI migration must preserve these boundaries:

- do not log `link`, `transferToken` or QR payload contents;
- do not add them to analytics, error breadcrumbs or design-preview fixtures;
- do not persist them to local storage, session storage or a long-lived app store;
- do not render `transferToken` separately;
- keep the generation call behind the authenticated Auth service boundary;
- keep new-tab link protection (`noopener noreferrer`);
- do not concatenate the transfer URL into executable HTML or shell/string templates;
- clear local presentation state when the Dialog closes or component is destroyed;
- preserve server-side expiry/replay protections rather than attempting to recreate them in UI code.

`AuthService.generateDeviceLink()` currently logs the caught HTTP error object when generation fails. It does not intentionally log the successful transfer response, but follow-up security hardening should ensure server error objects cannot contain sensitive transfer details before retaining broad console diagnostics in production.

This audit does not change the API or claim that local cancellation revokes a generated server credential.

## Accessibility audit

### Existing strengths

The component already has useful semantic foundations:

- both actions are native `button` elements;
- the transfer URL is a native `a` rather than a click-only container;
- the QR is a native `img` with translated alternative text;
- Spartan Dialog owns generic overlay interaction;
- all visible labels and explanatory strings are supplied through `I18nService`;
- buttons use a mobile-sized minimum height;
- there are no manual keyboard event handlers or fake button roles;
- layout utilities are direction-neutral.

### Dialog accessible name and description

The Dialog contains a translated `h3` with the fixed ID `device-transfer-title`, but the template does not explicitly show an `aria-labelledby` relationship on `hlm-dialog-content`.

The implementation stage must verify the rendered Spartan Dialog accessibility tree and ensure the content has a deterministic accessible name. Prefer the Dialog primitive's supported title/description composition where available rather than inventing parallel ARIA wiring.

The fixed title ID is also unsafe if more than one component instance can appear in the DOM. If an explicit ID remains necessary, use an instance-safe mechanism or the shared Dialog title primitive so duplicate IDs cannot occur.

The explanatory paragraph should be associated as a Dialog description if the primitive supports that relationship and doing so accurately represents the content.

### Focus lifecycle

Spartan Dialog should retain ownership of:

- initial focus placement;
- Tab/Shift+Tab containment while modal;
- Escape dismissal;
- backdrop dismissal according to the current product contract;
- focus restoration to the launch control after close.

Regression coverage must verify these outcomes through public behaviour. Do not replace them with custom document listeners.

If the launch control becomes disabled while generation is pending, ensure it is enabled before Dialog close attempts to restore focus to it, or intentionally choose another stable restoration target through supported primitive APIs.

### Pending status

Neither the network request nor QR generation is currently announced.

If a pending guard is added:

- the launch Button should remain correctly named;
- duplicate activation should be prevented;
- visual pending feedback must not rely on animation alone;
- use an appropriate status/busy semantic if the wait is exposed to assistive technology;
- do not create a modal spinner for a short in-place request unless product requirements justify it.

### Failure feedback

A failed generation currently produces no visible or announced result. A keyboard or screen-reader user can activate the action and receive no explanation when nothing opens.

Generic failure feedback, if added, should be translated, visible, non-colour-only and announced with an appropriate status/alert policy. It must not expose backend diagnostic details or transfer secrets.

### QR alternative

The existing translated QR `alt` is preferable to an unlabeled image. The implementation stage should verify that the translation describes the QR's purpose rather than merely its visual form.

Because the same transfer URL is also available as a text link, assistive-technology users should have an equivalent actionable path without needing to interpret the QR image.

Do not place the raw transfer credential into `aria-label` or hidden explanatory content solely to make the QR "accessible"; the visible native link already provides the alternative action.

### External-link behaviour

The link has a visible translated label and a browser-native target. If repository content conventions require users to be warned that it opens a new tab/window, make that warning translated and user-visible or otherwise consistently announced across the product. Do not add a one-off hard-coded English ARIA suffix.

### Heading and landmark semantics

The current surface uses an `h2`. Whether that is the correct level depends on its host route shell. Follow-up tests should inspect the real composed page outline before changing it to `h1` or another level.

Similarly, do not add a nested `main` landmark if the application shell already wraps the router outlet in `main`.

## Keyboard, pointer and touch behaviour

Expected behaviour after migration:

- Tab reaches the launch action in normal document order;
- Enter/Space activation remains native on buttons;
- the transfer link retains native keyboard activation and context-menu behaviour;
- Dialog keyboard/focus behaviour remains owned by Spartan;
- the cancel action remains reachable without pointer input;
- no drag, hover or pointer-only gesture is required;
- both Button actions retain an appropriate touch target;
- visible focus is distinguishable in light, dark and forced-colour modes.

No custom keyboard implementation is required by the current feature.

## Internationalisation and RTL

All current user-facing strings are translated through `I18nService`:

- `device_transfer.title`;
- `device_transfer.description`;
- `device_transfer.action`;
- `device_transfer.modal_title`;
- `device_transfer.modal_body`;
- `device_transfer.qr_alt`;
- `device_transfer.open_link`;
- `common.cancel`.

The generated URL is backend data and must not be translated.

The current layout uses direction-neutral utilities (`space-y-*`, `mx-auto`, `w-full`, `max-w-*`) and contains no physical left/right spacing classes. Preserve that property.

The raw URL may contain LTR-oriented punctuation inside an RTL document. Do not globally force the Dialog to LTR. If mixed-direction usability testing shows the URL becomes ambiguous, isolate only the URL value with an appropriate bidirectional-text treatment while leaving translated surrounding UI in document direction.

Regression coverage should exercise:

- `dir="rtl"`;
- a long translated page heading and description;
- a long translated Dialog title/body;
- long launch/cancel/link labels;
- CJK and other supported scripts;
- the raw URL adjacent to RTL content without layout breakage.

## Theme and token audit

The current component is largely semantic-token based:

- `text-foreground` for the page heading;
- `text-muted-foreground` for supporting text;
- `border-border` and `bg-card` for the Dialog shell;
- `text-foreground` inside the Dialog;
- `text-primary` for the transfer link;
- `shadow-shadow-lg` for elevation;
- Spartan Button variants for action presentation.

No raw hex/RGB/HSL colour is present in the component, and no `dark:` branch is required for the current semantic classes.

Follow-up implementation should verify `shadow-shadow-lg` against the repository's canonical Relay elevation hierarchy and should not replace existing semantic roles with stock Tailwind palette colours.

The launch action must continue to inherit the shared `primary` accent contract rather than hard-coding the default Ember colour, because primary is user-configurable.

Light and dark theme testing remains required even when no explicit theme branch appears in the template. Semantic aliases can still regress if a wrapper introduces fixed surfaces or text colours.

## Responsive, zoom and forced-colour behaviour

The Dialog uses `w-full max-w-md`; the QR is explicitly 224 by 224 CSS/image pixels; the transfer link uses `break-all`; and the cancel Button fills the Dialog width.

The implementation stage should verify:

- the card and launch action at the 390px mobile baseline;
- Dialog inline padding leaves the 224px QR fully visible at narrow widths;
- long transfer URLs wrap without horizontal scrolling;
- long translated content reflows without clipping;
- the complete transfer action remains usable at 200% and 400% zoom/reflow;
- the Dialog does not exceed the viewport after browser chrome/soft-keyboard changes;
- Button and link focus indicators remain visible in forced-colour mode;
- QR contrast remains scannable in both light and dark themes without applying theme filters to the generated image.

Do not scale the QR using a transform that can blur module boundaries. If smaller QR dimensions become necessary for narrow layouts, regenerate/render it at an appropriate explicit size and verify scan reliability.

## Primitive prerequisites

No missing Spartan primitive blocks this component.

Required capability already present:

- Button;
- Dialog.

Relay/app capability already present:

- `AppCardComponent`.

Native semantics intentionally retained:

- external anchor;
- image;
- headings and paragraphs.

Not required by the current surface:

- Combobox;
- Select;
- Menu;
- Popover;
- Tooltip;
- Input;
- Textarea;
- Tabs.

Loading and error feedback can remain feature/Relay composition unless an approved repository-wide feedback primitive already owns the exact pattern. Do not introduce another overlay solely to report request progress or failure.

## Migration risks

### 1. Replacing already-correct primitives

The main actions and overlay are already Spartan-owned. Rebuilding them behind bespoke feature code would regress shared accessibility and increase upgrade cost.

### 2. Treating transfer material as ordinary display data

The transfer URL/QR is credential-like. Logging it, persisting it, adding it to analytics or placing it in design fixtures would create a security/privacy regression.

### 3. Duplicate transfer generation

The asynchronous launch action has no pending guard. Rapid activation can create multiple server-side transfer links and overlapping QR work.

### 4. QR-generation rejection

The API may succeed before `QRCode.toBlob()` fails. Without a bounded error path, the feature can surface an unhandled rejection or inconsistent local state.

### 5. Blob URL leaks

Changing Dialog or state lifecycle without preserving all `revokeObjectURL` paths can leak browser resources or retain stale QR data.

### 6. Cancellation semantics drift

UI cancellation currently clears local state but does not explicitly revoke the server credential. Copy or tests must not claim server invalidation unless backend behaviour changes.

### 7. Dialog labelling drift

The fixed title ID and currently implicit relationship need verification. An incidental visual refactor could leave the Dialog unnamed or create duplicate IDs.

### 8. Focus restoration versus disabled launch action

If the trigger is disabled during generation and remains disabled when the Dialog closes, focus restoration can become unreliable. Pending-state sequencing must be tested with the actual Spartan Dialog implementation.

### 9. SSR/browser divergence

Local storage, URL object APIs and QR Blob creation are browser-only. Moving these calls outside existing platform guards can break SSR/tests.

### 10. Authentication redesign by accident

The component performs a local browser access-token check as a route-level fallback. A UI ticket should not silently replace the authentication model or change `/login` routing.

### 11. Test gap

There is no adjacent `device-transfer.component.spec.ts` on `main`. Follow-up interaction changes need focused component tests instead of relying on visual review or full-suite smoke coverage.

### 12. Expiry behaviour drift

The API returns `expiresAt`, but the component does not display or schedule against it. Introducing countdowns, auto-close or refresh behaviour is a product change and requires explicit tests and server-contract confirmation.

## Required regression matrix for implementation

The follow-up conversion/hardening stage should cover at least:

1. the component creates with mocked AuthService, Router, I18n and platform dependencies;
2. unauthenticated browser initialisation navigates exactly to `/login`;
3. authenticated browser initialisation stays on `/device-transfer`;
4. server/SSR initialisation does not access `localStorage`;
5. translated title, description and launch action render;
6. launch and cancel actions remain native Buttons enhanced by the approved Spartan Button boundary;
7. one launch activation calls `generateDeviceLink()` once;
8. duplicate activation is prevented if a pending guard is introduced;
9. a `null` generation result does not open the Dialog;
10. generic failure feedback, if introduced, is visible, translated and appropriately announced;
11. a successful browser response generates a QR from the exact returned link;
12. the QR uses a local Blob object URL and translated alternative text;
13. the external anchor points to the exact generated link and preserves `_blank` + `noopener noreferrer`;
14. successful generation opens the Spartan Dialog;
15. the Dialog has a deterministic accessible name and description;
16. Tab/Shift+Tab, Escape and focus restoration remain owned by Spartan Dialog;
17. explicit Cancel closes the Dialog and clears the link/QR;
18. Dialog-originated dismissal also clears the link/QR;
19. replacing an existing QR revokes the previous object URL;
20. cancellation revokes the current object URL once;
21. component destruction revokes any remaining object URL once;
22. QR-generation rejection clears pending state and does not open a broken Dialog;
23. no transfer token, generated URL or QR payload is intentionally written to logs, analytics or browser storage by the component;
24. RTL rendering introduces no physical-direction assumptions;
25. long translations and long URLs wrap at narrow widths;
26. light and dark themes use semantic Relay roles;
27. the QR remains visible/scannable on the 390px baseline and at supported zoom levels;
28. all controls remain keyboard reachable and visibly focused;
29. server/SSR success does not call browser-only URL/QR APIs;
30. route/title and `/login` redirect contracts remain unchanged unless a dedicated route ticket changes them.

If transfer expiry/revocation behaviour or `AuthService` error contracts change, add focused service/API tests for those changes rather than encoding assumptions only in the component spec.

## Recommended implementation sequence

1. Add a focused `device-transfer.component.spec.ts` around the current behaviour before changing state.
2. Preserve `AuthService` as the transfer-generation/swap boundary and preserve `/device-transfer` plus `/login` route contracts.
3. Keep native anchor/image semantics and the existing Spartan Button/Dialog families.
4. Replace the function-reassignment `showDialog` model with explicit local reactive state consistent with repository Angular conventions.
5. Add bounded pending state to prevent duplicate generation if accepted by the feature contract.
6. Add generic translated failure handling for API and QR-generation failure without exposing diagnostics.
7. Verify Dialog title/description semantics and use instance-safe/shared Dialog labelling.
8. Preserve Blob URL cleanup on replacement, dismissal and destruction.
9. Verify keyboard focus lifecycle, touch targets, RTL, long translation, light/dark, forced colour, 390px layout and high zoom.
10. Update design-preview / Claude Design only if the implementation changes the mapped visual or interaction contract.
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

- `frontend/src/app/components/device-transfer/device-transfer.component.ts`;
- `frontend/src/app/services/auth.service.ts`;
- `frontend/src/app/app.routes.ts`;
- `docs/spartan-relay-architecture.md`;
- `docs/design-redesign-audit.md`;
- `DESIGN.md`;
- `AGENTS.md`;
- `frontend/AGENTS.md`;
- the installed Button and Dialog capabilities used by the component.

No runtime, interaction or visual contract is changed by this audit, so component tests and design-preview output are intentionally not modified in this ticket.

## Acceptance checklist

- [x] Every current interactive element is inventoried and assigned an owner.
- [x] Every current visible/async state and overlay path is recorded.
- [x] Spartan Brain, Spartan Helm, Relay/app and native-semantic ownership is explicitly mapped.
- [x] Transfer-generation and swap API boundaries are documented without moving them into UI primitives.
- [x] `/device-transfer` and unauthenticated `/login` navigation contracts are recorded.
- [x] The absence of analytics hooks is recorded.
- [x] Credential-like transfer URL/QR security constraints are recorded.
- [x] Blob/QR lifecycle and SSR/browser boundaries are recorded.
- [x] Accessibility, keyboard, focus, RTL, i18n, mobile/desktop, zoom and theme requirements are recorded.
- [x] Existing semantic-token usage and future token verification are recorded.
- [x] Migration risks and primitive prerequisites are identified.
- [x] Missing adjacent component regression coverage is recorded as an implementation risk.
- [x] A concrete regression matrix and verification gate are provided.

## Source files reviewed

- `frontend/src/app/components/device-transfer/device-transfer.component.ts`
- `frontend/src/app/services/auth.service.ts`
- `frontend/src/app/app.routes.ts`
- `docs/spartan-relay-architecture.md`
- `docs/design-redesign-audit.md`
- `DESIGN.md`
- `AGENTS.md`
- `frontend/AGENTS.md`
- `frontend/src/app/components/ui/button/`
- `frontend/src/app/components/ui/dialog/`
