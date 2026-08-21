# Confirm dialog Spartan/Relay audit

Tracks issue #6061 for `frontend/src/app/components/confirm-dialog/`.

## Scope and current ownership

`ConfirmDialogComponent` is a standalone global confirmation surface backed by `ConfirmService`. It already uses Spartan Helm for the complete interactive surface: `HlmDialogImports` owns the modal/dialog behaviour and `HlmButtonImports` / `hlmBtn` owns both actions. The feature does not import Spartan Brain directly and does not contain a bespoke interactive widget that needs a new primitive.

The component's responsibilities are deliberately narrow:

- derive the controlled dialog state from `ConfirmService.confirmState()`
- display the active confirmation message
- resolve the pending confirmation with `false` from Cancel
- resolve the pending confirmation with `true` from Confirm
- treat a dialog transition to `closed` as cancellation while a confirmation is still pending

There is no router navigation, HTTP call, local persistence or analytics hook in this component. `ConfirmService` is the side-effect boundary: `confirm(message)` stores a pending resolver and `dismiss(result)` resolves that promise before clearing the signal.

## Control, overlay and state inventory

| Surface                | Current implementation                                            | Behaviour/state                                                                          | Spartan/Relay mapping                             | Migration action                                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dialog controller      | `<hlm-dialog [state]="dialogState()" (stateChanged)="...">`       | Controlled `open` state while `confirmState()` exists, otherwise `closed`                | Spartan Helm dialog                               | Keep. Do not replace with feature-owned focus, keyboard or overlay logic.                                                                                                                   |
| Portal/overlay content | `<hlm-dialog-content *hlmDialogPortal>`                           | Mounted only while a confirmation state exists                                           | Spartan Helm dialog content/portal                | Keep Helm ownership of modal semantics, focus management and overlay lifecycle.                                                                                                             |
| Built-in close action  | `[showCloseButton]="false"`                                       | No visible close icon                                                                    | Spartan Helm dialog configuration                 | Preserve. Cancel remains the explicit non-destructive action.                                                                                                                               |
| Confirmation message   | Native `<p id="confirm-message">` referenced by `aria-labelledby` | Displays `state.message` supplied by the caller                                          | Semantic content + Relay typography               | Keep semantic text. Reassess whether title or description semantics are the clearest dialog labelling contract during conversion, but preserve an accessible name/description relationship. |
| Action row             | Native `<div class="flex justify-end gap-3">`                     | Groups the two decisions at the end of the dialog                                        | Relay layout composition                          | Keep feature-level layout. No new primitive is required.                                                                                                                                    |
| Cancel action          | `<button hlmBtn type="button" variant="secondary" size="touch">`  | Calls `dismiss(false)`                                                                   | Spartan Helm button                               | Keep. Preserve translated label, touch target and explicit button type.                                                                                                                     |
| Confirm action         | `<button hlmBtn type="button" size="touch">`                      | Calls `dismiss(true)`                                                                    | Spartan Helm button                               | Keep. Preserve translated label, touch target and explicit button type. Destructive styling must be selected by the caller/product contract rather than assumed for every confirmation.     |
| Closed-state handling  | `onDialogStateChanged()`                                          | If Spartan reports `closed` while a confirmation is still active, resolves it as `false` | Feature orchestration around Spartan dialog state | Keep. This is the cancellation safety contract for non-Confirm closure paths.                                                                                                               |
| Inactive state         | `confirmState() === null`                                         | Dialog state is `closed`; portal content is not rendered                                 | Spartan controlled state + Angular `@if`          | Keep. No empty-state UI is needed.                                                                                                                                                          |

Every current interactive element is therefore already owned by Spartan Helm. There is no custom click target, custom focus trap, custom backdrop or feature-level keyboard listener to migrate.

## Data, result and side-effect contract

`ConfirmService` exposes a promise-based API. The existing contract must remain stable through any visual migration:

1. A caller invokes `confirm(message)` and receives a `Promise<boolean>`.
2. The service stores exactly one active `ConfirmState` containing the message and resolver.
3. The component opens whenever that state is non-null.
4. Confirm resolves the current promise with `true` and clears the state.
5. Cancel resolves the current promise with `false` and clears the state.
6. A dialog transition to `closed` while state is still present also resolves with `false`.

The component itself performs no domain mutation after either result. Callers decide what a `true` or `false` result means. A Spartan/Relay conversion must not move caller-specific deletion, navigation, network or analytics work into this shared dialog.

There is no route contract to preserve: the component does not inject `Router` and renders no router link. There is no analytics contract in the current component or service.

## Spartan and Relay ownership

### Keep as Spartan-owned interaction

- `HlmDialogImports` for dialog state, portal, modal behaviour and focus/keyboard ownership
- `HlmButtonImports` / `hlmBtn` for Cancel and Confirm
- the existing `size="touch"` button sizing contract

The feature must not add its own document-level Escape listener, focus trap, backdrop click handler or ARIA `role="dialog"` implementation alongside Spartan. Duplicate interaction layers would create conflicting dismissal and focus behaviour.

### Keep as Relay feature composition

Relay remains responsible for visual composition around the Spartan controls:

- semantic surface, border and text tokens
- sheet/dialog radius and elevation hierarchy
- spacing and action-row layout
- responsive width and text wrapping

The current content uses semantic tokens (`border-surface-100`, `bg-surface-200`, `text-text-primary`) rather than hardcoded product colours. Preserve that ownership. Where the approved Relay dialog wrapper or recipe already supplies surface, radius or elevation, prefer that contract instead of repeating equivalent classes in this feature.

### Extension-slot assessment

No extension slot or custom primitive exemption is required. The complete interaction model is representable with the existing Spartan dialog and button primitives.

## Accessibility requirements

Any follow-on implementation must preserve or improve these contracts:

1. **Keep an accessible dialog label/description.** The current content is associated with `aria-labelledby="confirm-message"`. If the migration adopts Spartan title/description slots, ensure the message remains exposed with an equivalent or clearer relationship and that referenced ids exist only while the dialog is mounted.
2. **Preserve modal focus ownership.** Let Spartan handle focus entry, trapping and restoration. Do not add a second feature-level focus manager.
3. **Keep both decisions keyboard-operable.** Cancel and Confirm remain native `button` elements with `type="button"`; do not replace them with clickable containers.
4. **Preserve visible focus.** Feature classes must not suppress Spartan focus indicators in light, dark or forced-colour modes.
5. **Preserve cancellation semantics.** A non-Confirm close transition must continue to resolve the pending promise as `false`, never leave it unresolved.
6. **Keep action names translatable.** `common.cancel` and `common.confirm` continue through `TranslatePipe`; do not hardcode English labels.
7. **Do not translate caller content implicitly.** `state.message` is supplied by the caller and is rendered as content, not treated as a translation key by this component. Any caller that needs translated copy remains responsible for supplying the appropriate string.
8. **Support text expansion and zoom.** The message and action labels must wrap without clipping at mobile width and at high browser zoom. Avoid fixed heights on the content or action row.
9. **Avoid destructive assumptions.** A generic Confirm result can authorize many actions. Do not give the primary action a destructive accessible name or danger treatment unless the API is expanded to carry that intent explicitly.

## RTL and multilingual requirements

- Cancel and Confirm labels remain translated with the existing `| t` contract.
- The action row uses `gap` and `justify-end`, not physical left/right spacing utilities. Preserve direction-neutral layout or use logical utilities if future spacing requires a side.
- Do not introduce directional icons without defining their RTL behaviour.
- The dialog must tolerate longer translated action labels, multiline confirmation copy and non-Latin scripts without forcing horizontal scrolling.
- Keep the system body font for translated and caller-provided text in accordance with `DESIGN.md`; do not apply the display face to multilingual confirmation content.
- The responsive `w-full max-w-sm` contract is suitable for narrow viewports as long as surrounding Spartan portal padding continues to prevent viewport-edge clipping.

## Theme and token requirements

The current dialog surface uses Relay semantic tokens and should stay theme-aware:

- `border-surface-100`
- `bg-surface-200`
- `text-text-primary`

Both light and dark themes are first-class. Do not replace these with fixed palette classes or hardcoded colours. Button presentation should continue through Spartan/Relay variants so per-user primary accent behaviour and `on-fill` contrast remain centralized.

The current `rounded-2xl` and `shadow-2xl` are feature-level styling that should be checked against the canonical Relay sheet/dialog radius and elevation recipe during the conversion stage. If a shared wrapper owns those properties, remove the duplicate feature styling rather than creating a second visual contract.

## Migration risks and prerequisites

1. **Double resolution on close.** Changing controlled dialog timing can accidentally call `dismiss(false)` after a positive decision. The signal is currently cleared synchronously by `dismiss(true)` before a subsequent `closed` event can observe active state. Preserve and test this guard.
2. **Unresolved promises.** Removing `stateChanged` cancellation handling without an equivalent close contract can strand callers awaiting `confirm()`.
3. **Focus regressions.** Replacing the Spartan portal/dialog with a visual-only Relay container would lose modal focus and keyboard behaviour. Spartan must remain the interaction owner.
4. **Labelling drift.** Moving the message into a new title/description structure can leave `aria-labelledby` pointing at a missing id. Treat the relationship as part of the component contract.
5. **Generic intent.** Not every confirmation is destructive. A single hardcoded danger variant would misrepresent benign confirmations. Introduce intent metadata only as a separately reviewed service API change if product requirements need it.
6. **Concurrent confirmations.** `ConfirmService` stores one signal value. A second `confirm()` call before the first is resolved replaces the first resolver and can leave the first promise pending. This is an existing service-level limitation, not a visual migration requirement. Do not accidentally broaden this audit ticket into queue semantics; track it separately if concurrency becomes a supported use case.
7. **No focused component spec exists in the target directory on `main`.** The follow-on behavioural migration should add focused coverage instead of relying only on broad frontend gates.

No new primitive prerequisite is identified. The approved Spartan dialog and button paths already cover this surface.

## Required regression coverage for the migration stage

Add focused tests for:

- `dialogState()` is `closed` with no active confirmation and `open` while one is pending
- Confirm resolves the service promise with `true` and clears state
- Cancel resolves with `false` and clears state
- a `closed` state event while confirmation is pending resolves with `false`
- a `closed` state event after state has already cleared does not resolve again
- both actions remain native touch-sized Spartan buttons with translated labels
- the rendered dialog retains a valid accessible label/description relationship
- keyboard focus entry/restoration and non-Confirm dismissal follow the Spartan dialog contract
- long translated labels and confirmation text remain usable at narrow width, RTL and high zoom
- light/dark and per-user primary accent styling remains token-driven

Tests should use `ConfirmService` directly or a controlled test double and must not depend on caller-specific domain mutations.

## Verification

This audit is documentation-only and changes no runtime or visual contract, so it does not require a design-preview update or a behavioural test change. The follow-on implementation should run the focused component spec plus the repository's frontend gates from `frontend/package.json`:

```bash
cd frontend
npm test -- --include='src/app/components/confirm-dialog/confirm-dialog.component.spec.ts'
npm run lint:check
npm run check:spartan-health
npm run build
```

If the Angular test runner in the current workspace does not support `--include`, run `npm test` instead.

## Audit result

**Mapped and ready for the remaining migration stages.** The confirm dialog already uses Spartan Helm for every interactive control and for the overlay/dialog lifecycle. No new Brain primitive or custom interactive exemption is needed. Follow-on work should preserve the promise resolution contract, controlled cancellation behaviour, focus ownership and translated button labels while consolidating any remaining surface/radius/elevation styling into the approved Relay dialog recipe and adding focused regression coverage.
