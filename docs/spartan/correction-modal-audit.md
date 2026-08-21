# Correction modal Spartan/Relay audit

Tracks issue #6066 for `frontend/src/app/components/correction-modal/`.

## Scope and current ownership

`CorrectionModalComponent` is a feature modal for drafting a correction to user-provided text. It accepts `originalText` and `authorName`, keeps editable correction and explanation state locally, emits a structured `submitted` payload, and emits `cancelled` when the surface closes.

The component currently mixes two interaction ownership models:

- Spartan Helm already owns the native controls through `HlmButton`, `HlmInput` and `HlmTextarea`.
- The modal lifecycle itself is hand-rolled with a fixed backdrop, backdrop click handler and inner click propagation guard. It does not use Spartan Dialog.

That modal shell is the primary interaction gap. The repository architecture requires Spartan to own dialog focus, Escape, backdrop and open-state mechanics while Relay owns product presentation. The follow-on conversion should therefore migrate the shell to the approved dialog composition rather than adding more custom modal behaviour.

The component does not inject `Router`, perform HTTP calls, write storage or call an analytics service. Its integration boundary is the `submitted` and `cancelled` outputs. No route or analytics contract is implemented inside this surface.

`authorName` is currently a public input but is not read by the component or template. Do not silently assign new behaviour to it during the visual migration. Preserve compatibility until caller usage is audited separately.

## Control, overlay and state inventory

| Surface                  | Current implementation                                           | Behaviour/state                                                                              | Spartan/Relay mapping                                      | Migration action                                                                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modal backdrop           | Fixed full-screen `<div>` with `(click)="closeModal()"`          | Clicking outside content emits `cancelled`                                                   | Spartan Dialog overlay/backdrop                            | Replace the custom dismissal shell with Spartan Dialog. Do not keep a second backdrop click state machine beside Spartan.                                                                     |
| Modal panel              | Nested `<div>` with `$event.stopPropagation()`                   | Prevents panel clicks from triggering backdrop cancellation; constrains height and scrolling | Spartan Dialog content with Relay sheet/modal presentation | Move modal semantics, focus containment and overlay lifecycle to Spartan. Keep feature layout and scrolling as Relay composition.                                                             |
| Header close action      | `<button hlmBtn>` with `✕`                                       | Emits `cancelled`                                                                            | Spartan Helm/Relay button plus dialog close contract       | Keep a native Spartan-backed button, use `type="button"`, and connect it to the canonical dialog close path. Translate its accessible name.                                                   |
| Original-text label      | Native `<label>` without an associated form control              | Labels the read-only source-text section visually                                            | Semantic content + Relay typography                        | This is section text rather than a form label. Use semantic text/heading treatment instead of an unassociated `<label>`.                                                                      |
| Reset action             | `<button hlmBtn>`                                                | Copies `originalText()` back into `correctedText`                                            | Spartan Helm/Relay button                                  | Keep Spartan button mechanics. Preserve reset semantics and give the control a translated accessible name.                                                                                    |
| Original text preview    | Read-only `<div>` with quoted original text                      | Shows the source text and a ghost-text badge                                                 | Relay presentation                                         | Keep presentation-only. No Brain primitive is required. User text must remain in the system body font.                                                                                        |
| Ghost-text badge         | Static `<span>`                                                  | Marks the source text as ghost/original content                                              | Relay badge/pill presentation                              | Use approved semantic badge presentation if available. No interaction primitive is needed.                                                                                                    |
| Corrected sentence field | `<textarea hlmTextarea>` with `ngModel` bridge to a signal       | Editable correction; initial value is the original text                                      | Relay input/textarea, Helm-backed where approved           | Keep native textarea semantics through the approved wrapper. Associate the visible label with the field and preserve writable signal state.                                                   |
| Live diff preview        | Conditional `<app-visual-diff>`                                  | Appears only when the trimmed correction is non-empty and differs from trimmed original text | Existing feature presentation component                    | Keep. It is not an interaction state machine and must not be replaced with Spartan solely for framework usage.                                                                                |
| Explanation field        | `<input hlmInput type="text">` with `ngModel` bridge to a signal | Optional explanation text                                                                    | Relay input, Helm-backed where approved                    | Keep native input semantics through the approved wrapper. Associate the visible label with the field.                                                                                         |
| Footer Cancel action     | `<button hlmBtn>`                                                | Emits `cancelled`                                                                            | Spartan Helm/Relay button plus dialog close contract       | Keep as the explicit non-destructive action. Use `type="button"` and a translated accessible name matching the visible label.                                                                 |
| Footer Send action       | `<button hlmBtn>`                                                | Calls `submitCorrection()`                                                                   | Spartan Helm/Relay button                                  | Keep native button semantics. Preserve disabled state and structured submit output. Use `type="button"`.                                                                                      |
| Send disabled state      | `[disabled]="!correctedText().trim()                             |                                                                                              | correctedText().trim() === originalText().trim()"`         | Prevents empty or unchanged submissions                                                                                                                                                       | Feature business state | Keep in the feature. Spartan owns disabled control mechanics, not the correction validity rule. |
| Local corrected state    | `signal<string>('')`, initialised in `ngOnInit()`                | Starts as `originalText()` and is writable                                                   | Feature state                                              | Preserve the one-time initialisation contract unless a deliberate API change is separately tested. A `linkedSignal` may be appropriate only if input-change semantics are explicitly defined. |
| Local explanation state  | `signal<string>('')`                                             | Optional writable note                                                                       | Feature state                                              | Keep as feature state. No shared primitive ownership is needed.                                                                                                                               |

Every visible action and form control is accounted for. The only bespoke interaction state machine is the modal shell itself.

## Submission and cancellation contract

The existing output contract is part of the feature behaviour and must survive the migration:

1. `correctedText` is initialised from `originalText` when the component initialises.
2. Reset restores the exact current `originalText()` value to `correctedText`.
3. Send remains disabled when the trimmed correction is empty or equals the trimmed original text.
4. `submitCorrection()` trims the corrected text before emitting it.
5. `original` in the emitted payload remains the unmodified `originalText()` value.
6. `explanation` is trimmed and omitted as `undefined` when empty.
7. Submit emits `{ original, corrected, explanation? }` through `submitted`.
8. Backdrop dismissal, header close and footer Cancel all emit through `cancelled`.

There is no implicit persistence or network mutation inside the component. Callers decide what to do with either output. A Spartan/Relay migration must not move caller-specific API, navigation or analytics behaviour into this surface.

The component is not a native `<form>`, so the current Send action has no Enter-to-submit contract. Do not accidentally introduce a form submission path during migration without an explicit product decision and tests.

## Spartan and Relay ownership

### Migrate to Spartan-owned dialog mechanics

The current custom modal shell should be replaced by the repository's approved Spartan Dialog path. Spartan should own:

- modal role and accessible dialog semantics
- focus entry and focus trapping
- Escape handling
- focus restoration on close
- overlay/backdrop lifecycle
- controlled close events

Feature code should translate a Spartan close event into the existing `cancelled` output exactly once. It should not retain the root `(click)` handler, `$event.stopPropagation()` guard, document-level key listeners or another custom focus manager alongside Spartan.

### Keep Spartan/Relay control ownership

The three existing Helm control classes already point in the correct direction:

- `HlmButton` for header close, Reset, Cancel and Send
- `HlmTextarea` for the corrected sentence
- `HlmInput` for the optional explanation

If an approved Relay wrapper exists for these capabilities at implementation time, feature code should use it. Otherwise the current direct Helm use is acceptable as a migration step under `docs/spartan-relay-architecture.md`. Do not introduce direct Brain imports into the feature.

### Keep feature-owned product state

The following remain feature responsibilities:

- comparison of corrected and original text
- reset-to-original behaviour
- optional explanation handling
- Send enablement rules
- the `submitted` payload shape
- the `cancelled` output
- whether `VisualDiffComponent` is shown

These rules are product behaviour, not reusable control mechanics.

### Keep presentation-only content in Relay

The original text preview, ghost badge, labels, section spacing, footer layout and visual diff container are presentation. They do not need Brain primitives. Where approved Relay recipes exist for sheets, badges, field labels, spacing, radius or elevation, use those instead of another feature-specific visual contract.

## Accessibility findings and requirements

The migration should address the current modal-semantic gaps rather than merely restyle the surface:

1. **Provide real dialog semantics.** The current fixed backdrop/panel has no dialog role, `aria-modal` contract or managed focus. Spartan Dialog should become authoritative for these behaviours.
2. **Manage focus deterministically.** Opening must place focus inside the modal, Tab must remain within it, Escape must follow the product close policy, and closing must restore focus to the invoking control.
3. **Translate close names.** Both current close paths use the hardcoded English `aria-label="Close modal"`. This violates the repository zero-hardcoded-UI-string rule. Use a translation key in the conversion.
4. **Match accessible and visible names.** Footer Cancel visibly uses `common.cancel` but currently has the English accessible name `Close modal`. The accessible name should identify the actual action consistently.
5. **Associate field labels.** The corrected sentence and explanation `<label>` elements currently have no `for`/`id` relationship. Their fields instead use placeholder translation keys as `aria-label` values. The migration should create explicit label-control associations and use placeholders only as supplementary hints.
6. **Do not use a form label for static source text.** The original-text label is not attached to a form control. Use semantic section text or a heading-like element.
7. **Preserve native disabled semantics.** Send remains a real `button` with `[disabled]`; do not replace this with visual-only disabled styling or `aria-disabled` on a clickable container.
8. **Add explicit button types.** Header close, Reset, Cancel and Send currently omit `type="button"`. There is no form today, but explicit types prevent accidental submit behaviour if composition changes later.
9. **Keep user-generated text script-safe.** Original and corrected content must remain in the system body font so CJK, Arabic, Cyrillic, Devanagari and other scripts retain glyph coverage.
10. **Keep diff meaning colour-independent.** `VisualDiffComponent` currently distinguishes additions/removals using semantic colour plus removal strike-through. Follow-on accessibility testing should ensure the diff remains understandable in forced-colour and screen-reader contexts rather than relying on colour alone.
11. **Support high zoom and reflow.** The content area already scrolls within `max-h-[90vh]`. The Spartan dialog conversion must preserve access to both fields and footer actions at 200% and 400% zoom without trapping content behind a fixed footer or viewport edge.
12. **Preserve touch operability.** All four actions should meet the repository's touch-target expectations after Relay sizing is applied.

## RTL and multilingual requirements

The current template has no physical left/right spacing utilities. Keep that direction-neutral approach.

- Continue using logical positioning such as `end-2` for the ghost badge.
- Do not add `left-*`, `right-*`, `ml-*`, `mr-*`, `pl-*` or `pr-*` utilities during migration.
- Corrected text, original text and explanations may contain arbitrary scripts and mixed-direction content. Do not force a Latin-only display face or a fixed LTR direction on these fields.
- All product-authored labels and accessible names must go through `TranslatePipe` or `I18nService` according to the repository translation contract.
- Long translated labels must wrap without clipping the close control, Reset action or footer buttons.
- The modal should remain usable at the 390px baseline and at high zoom in both LTR and RTL document directions.

## Theme and token findings

The surface already uses several Relay semantic roles such as `surface-*`, `text-*`, `primary`, `secondary`, `warning` and `on-fill`, but the audit identifies visual ownership that belongs in the theme-parity follow-on ticket:

- `bg-black/70` is a fixed backdrop colour rather than an approved Relay overlay/scrim role.
- `text-neon-blue`, `border-neon-blue/40` and `focus:ring-neon-blue` use a decorative neon token for functional text/focus treatment. `DESIGN.md` reserves neon for decorative use, not text.
- `rounded-3xl`, repeated `rounded-full` controls and `shadow-2xl` bypass the documented Relay sheet/app radius and elevation hierarchy.
- The Send button composes a feature-level `from-primary to-secondary` gradient. The implementation stage should use the approved product button/duet treatment rather than treating this ad hoc gradient as a primitive contract.

Do not fix these token concerns in this audit-only ticket. Record them as constraints for #6068 so interaction conversion (#6067) and theme conversion (#6068) do not overwrite each other unpredictably.

## Visual diff dependency

`VisualDiffComponent` is a non-interactive feature dependency. It uses `Intl.Segmenter` for word segmentation and renders added, removed and unchanged segments with Relay semantic success/danger/text tokens. The correction modal should continue to pass only `original` and `corrected` values.

No new Spartan primitive is required for the diff. If screen-reader semantics for change annotations need improvement, that should be done in the visual-diff component with its own focused tests rather than embedding a duplicate diff implementation in the modal.

## Migration risks and prerequisites

1. **Double cancellation.** Moving several current close paths onto Spartan Dialog can cause both a close callback and a button handler to emit `cancelled`. The conversion must establish one authoritative close path and test exactly-once output.
2. **Lost backdrop behaviour.** Backdrop click currently cancels. Preserve that behaviour only through Spartan's supported dismissal contract. Do not layer the old root click listener over the new dialog.
3. **Focus regression.** A visual-only rewrite that keeps the fixed `<div>` would leave the current focus/keyboard gap in place. #6067 should treat Spartan Dialog as required, not optional polish.
4. **State reinitialisation changes.** `correctedText` is currently copied from `originalText` once in `ngOnInit`. Replacing it with a reactive derivation could unexpectedly overwrite an in-progress edit when the input changes. Define and test input-change behaviour before changing this contract.
5. **Submit payload drift.** The emitted corrected value is trimmed while the original value is not. Explanation is omitted when blank. Preserve these details unless a separate product change intentionally revises the API.
6. **Accessible-name drift.** Moving to shared field/dialog wrappers must not leave stale `aria-label`, `for`, `id`, title or description references.
7. **Button-submit drift.** If a Relay field composition introduces a `<form>`, the existing buttons without explicit type could begin submitting unexpectedly. Set explicit types during conversion.
8. **Unused `authorName` input.** It is currently accepted but unused. Removing or repurposing it without checking callers can be a breaking change. Keep this outside the visual migration unless caller analysis proves it safe.
9. **Visual-stage overlap.** #6068 owns token, responsive and theme parity. #6067 should avoid broad visual restyling beyond what is required to adopt the dialog/control primitives.
10. **Design-preview parity.** This audit changes no visual contract. The later implementation/theme stages must update the mapped Claude Design/design-preview surface when they materially change dialog structure or appearance.

No new primitive prerequisite is identified. Spartan Dialog plus the existing button/input/textarea path covers the interactive needs of this surface.

## Required regression coverage for the migration stages

The existing component spec covers creation, initial corrected text, successful output and direct cancellation. Follow-on work should extend it with focused coverage for:

- Reset restoring the exact original text
- empty and unchanged corrections not emitting `submitted`
- corrected text being trimmed before emission
- blank explanation being omitted and non-empty explanation being trimmed
- Send disabled state for empty/unchanged values and enabled state for a real correction
- conditional visual diff rendering only for a real correction
- header close, footer Cancel and allowed backdrop/Escape dismissal producing one `cancelled` event
- valid Spartan dialog semantics and deterministic focus entry/restoration
- associated visible labels for the textarea and explanation input
- translated accessible names, including the close action
- all action controls remaining native buttons with explicit `type="button"`
- RTL layout and mixed-direction user text
- 390px/mobile, 200% and 400% zoom/reflow with required actions still reachable
- light/dark and per-user primary accent behaviour after the theme stage

The existing `VisualDiffComponent` should retain its own focused tests for tokenisation and segment rendering rather than duplicating those assertions here.

## Verification

This audit is documentation-only and changes no runtime, interaction or visual contract. It therefore does not require a component test modification or design-preview update in this ticket. The follow-on implementation should run the focused component spec and the repository frontend gate:

```bash
cd frontend
npm run test -- --watch=false
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
```

For any mapped visual-contract change, also run from the repository root:

```bash
npm run check:design-sync
```

## Audit result

**Mapped and ready for interaction migration.** The correction modal already uses Spartan Helm for its buttons, textarea and input, but its modal overlay, dismissal and focus lifecycle are hand-rolled. #6067 should migrate that shell to Spartan Dialog while preserving the exact submit/cancel output contract. #6068 should then consolidate the off-token scrim, neon functional styling, radius/elevation and button treatment into approved Relay recipes. No new Brain capability or custom interactive exemption is needed.
