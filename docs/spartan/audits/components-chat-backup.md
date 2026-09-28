# Spartan / Relay mapping: components / chat backup

Issue: [#5990](https://github.com/elgansayer/elgl/issues/5990)

Target: `frontend/src/app/components/chat-backup`

Source baseline: [b613278fe70f](https://github.com/elgansayer/elgl/commit/b613278fe70f743c45d6ea9e5a2a291c6015ab27). This is a source audit of the checked-in implementation, including its local tests. Runtime validation results are recorded separately in the pull request.

## Scope and ownership

This fulfils the issue's pre-implementation inventory under programme prerequisite [#5462](https://github.com/elgansayer/elgl/issues/5462). Feature code keeps business state, data/service calls, route contracts and analytics. Existing Relay components keep product APIs and token roles. Installed Helm/Brain components keep generic accessible interaction. Native structural, media and drawing elements retain their browser semantics.

The current source is authoritative where older descriptions in DESIGN.md and the phase-zero audit differ. The ownership rules in [Spartan / Relay architecture](../../spartan-relay-architecture.md), [DESIGN.md](../../../DESIGN.md), [AGENTS.md](../../../AGENTS.md) and [frontend/AGENTS.md](../../../frontend/AGENTS.md) apply to follow-up implementation.

No runtime or visual contract changes in this audit, so no design-preview mutation is required. Accessibility, visual contrast and device behaviour below are migration risks to verify, not claims of a completed browser audit.

## Source inventory

| File                                                                                                                                                                          | SHA-256                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [chat-backup.component.ts](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts) | `a05278cbc5eaf94adaef3e411d981c47d8a7c1b5ad95d59bca96a2eeacc81f18` |

## Complete template element and control map

9 element sites are inventoried, including native layout and custom component hosts. A loop creates multiple runtime instances of the listed site; its track expression is recorded below. Projected controls belong to their consumers. Attribute and event expressions are recorded with whitespace normalised so migration cannot silently drop bindings. Long member initialisers and method calls are summarised with explicit continuation markers; their source links contain the complete code.

| Source                                                                                                                                                                               | Element and presentation owner                     | Current attributes and bindings                    | Events and visible content                                                        | Migration target and constraint                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [chat-backup.component.ts:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L11) | `div`; Native structure and Relay presentation     | `class=flex flex-col gap-4 p-4`                    | None                                                                              | `Keep semantic div; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.                                                                       |
| [chat-backup.component.ts:12](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L12) | `h2`; Native structure and Relay presentation      | `class=text-lg font-bold`                          | Content: `{{ 'chat_backup.title' \| t }}`                                         | `Keep semantic h2; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.                                                                        |
| [chat-backup.component.ts:15](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L15) | `p`; Native structure and Relay presentation       | `class=text-primary`                               | Content: `{{ 'chat_backup.exporting' \| t }}`                                     | `Keep semantic p; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.                                                                         |
| [chat-backup.component.ts:19](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L19) | `p`; Native structure and Relay presentation       | `class=text-primary`                               | Content: `{{ 'chat_backup.importing' \| t }}`                                     | `Keep semantic p; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.                                                                         |
| [chat-backup.component.ts:22](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L22) | `app-button-primary`; Existing product component   | `[disabled]="exporting()"`                         | `(clicked)="onExport()"` Content: `{{ 'chat_backup.export_button' \| t }}`        | `AppButtonPrimaryComponent (frontend/src/app/components/primitives/button-primary/button-primary.component.ts)`; Keep its input/output boundary; migrate generic interaction inside its owner.       |
| [chat-backup.component.ts:26](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L26) | `input`; Native field / Spartan input capability   | `type=file`; `accept=.json`; `style=display: none` | `(change)="onFileSelected($event)"`                                               | `Installed input with field/label composition`; Preserve value type, change timing, validation and accessible field relationships.                                                                   |
| [chat-backup.component.ts:33](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L33) | `app-button-secondary`; Existing product component | `[disabled]="importing()"`                         | `(clicked)="fileInput.click()"` Content: `{{ 'chat_backup.import_button' \| t }}` | `AppButtonSecondaryComponent (frontend/src/app/components/primitives/button-secondary/button-secondary.component.ts)`; Keep its input/output boundary; migrate generic interaction inside its owner. |
| [chat-backup.component.ts:38](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L38) | `p`; Native structure and Relay presentation       | `class=text-danger`                                | Content: `{{ 'chat_backup.export_error' \| t }}`                                  | `Keep semantic p; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.                                                                         |
| [chat-backup.component.ts:41](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L41) | `p`; Native structure and Relay presentation       | `class=text-danger`                                | Content: `{{ 'chat_backup.import_error' \| t }}`                                  | `Keep semantic p; use Relay colour, radius and spacing tokens`; No new Brain state machine is needed for presentation alone.                                                                         |

## Conditional, repeated and deferred states

| Source                                                                                                                                                                               | Block           | Condition or collection | Identity contract                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ----------------------- | -------------------------------------------- |
| [chat-backup.component.ts:14](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L14) | `IfBlockBranch` | `exporting()`           | Preserve branch identity and rendering order |
| [chat-backup.component.ts:18](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L18) | `IfBlockBranch` | `importing()`           | Preserve branch identity and rendering order |
| [chat-backup.component.ts:37](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L37) | `IfBlockBranch` | `exportError()`         | Preserve branch identity and rendering order |
| [chat-backup.component.ts:40](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L40) | `IfBlockBranch` | `importError()`         | Preserve branch identity and rendering order |

## Public inputs, outputs, state and host bindings

| Source                                                                                                                                                                               | Member                              | Type       | Initialiser / binding summary |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ---------- | ----------------------------- |
| [chat-backup.component.ts:47](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L47) | `ChatBackupComponent.channelId`     | `inferred` | `input.required<string>()`    |
| [chat-backup.component.ts:49](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L49) | `ChatBackupComponent.backupService` | `inferred` | `inject(ChatBackupService)`   |
| [chat-backup.component.ts:51](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L51) | `ChatBackupComponent.exporting`     | `inferred` | `signal(false)`               |
| [chat-backup.component.ts:52](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L52) | `ChatBackupComponent.importing`     | `inferred` | `signal(false)`               |
| [chat-backup.component.ts:53](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L53) | `ChatBackupComponent.exportError`   | `inferred` | `signal(false)`               |
| [chat-backup.component.ts:54](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L54) | `ChatBackupComponent.importError`   | `inferred` | `signal(false)`               |

## Behaviour, side effects and bespoke utilities

The table inventories every local method, constructor and accessor. Call expressions expose delegated behaviour; the linked body is authoritative for conditions, assignments and cleanup. Keep event payloads, failure handling and call order stable when replacing presentation.

| Source                                                                                                                                                                               | Method / accessor                                  | Calls and delegated behaviour                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [chat-backup.component.ts:56](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L56) | `ChatBackupComponent.onExport()`                   | `this.exporting.set(true)`; `this.exportError.set(false)`; `this.backupService.exportChannel(this.channelId())`; `this.channelId()`; `URL.createObjectURL(blob)`; `document.createElement('a')`; `a.click()`; `URL.revokeObjectURL(url)`; `this.exportError.set(true)`; `this.exporting.set(false)` |
| [chat-backup.component.ts:75](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L75) | `ChatBackupComponent.onFileSelected(event: Event)` | `this.importError.set(true)`; `JSON.parse(rawResult)`; `Array.isArray(messages)`; `this.importing.set(true)`; `this.backupService.importChannel(this.channelId(), messages)`; `this.channelId()`; `this.importing.set(false)`; `reader.readAsText(file)`                                            |

### Route, consumer and analytics boundaries

References below include class imports and actual template use, and are labelled by their source expressions. An import alone is not proof that a route renders the surface. Local routing calls are also recorded in the method inventory.

No class-name or selector reference was found outside this target in frontend source. Treat integration as unproven and verify reachability before a product migration.

No direct component/loadComponent route entry was found for this target. Keep host composition and output events as its integration boundary.

No direct analytics/telemetry call was found in the local method inventory. Delegated services may instrument requests; preserve their call sites and do not add telemetry as an incidental styling change.

## Existing primitive and service dependencies

| Source                                                                                                                                                                             | Imported API                           | Module                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------- |
| [chat-backup.component.ts:1](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L1) | `{ Component, input, inject, signal }` | `@angular/core`                                             |
| [chat-backup.component.ts:2](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L2) | `{ ChatBackupService }`                | `../../services/chat-backup.service`                        |
| [chat-backup.component.ts:3](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L3) | `{ TranslatePipe }`                    | `../../services/translate.pipe`                             |
| [chat-backup.component.ts:4](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L4) | `{ AppButtonPrimaryComponent }`        | `../primitives/button-primary/button-primary.component`     |
| [chat-backup.component.ts:5](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L5) | `{ AppButtonSecondaryComponent }`      | `../primitives/button-secondary/button-secondary.component` |

## Token, layout and bespoke style inventory

These are source declarations to preserve or deliberately migrate. Generic Tailwind sizing/rounding is not automatically a defect; determine its product role against the Relay hierarchy. Static source cannot establish rendered contrast or high-zoom overflow.

| Source                                                                                                                                                                               | Declaration                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| [chat-backup.component.ts:11](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L11) | `<div class="flex flex-col gap-4 p-4">`                             |
| [chat-backup.component.ts:12](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L12) | `<h2 class="text-lg font-bold">{{ 'chat_backup.title' \| t }}</h2>` |
| [chat-backup.component.ts:15](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L15) | `<p class="text-primary">{{ 'chat_backup.exporting' \| t }}</p>`    |
| [chat-backup.component.ts:19](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L19) | `<p class="text-primary">{{ 'chat_backup.importing' \| t }}</p>`    |
| [chat-backup.component.ts:38](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L38) | `<p class="text-danger">{{ 'chat_backup.export_error' \| t }}</p>`  |
| [chat-backup.component.ts:41](https://github.com/elgansayer/elgl/blob/b613278fe70f743c45d6ea9e5a2a291c6015ab27/frontend/src/app/components/chat-backup/chat-backup.component.ts#L41) | `<p class="text-danger">{{ 'chat_backup.import_error' \| t }}</p>`  |

## Migration risks and prerequisite work

No imperative timer, legacy binding, click-host or local routing/persistence risk matched the targeted checks. This is not proof of complete accessibility or production correctness.

The mapping uses these ownership categories: `Native structure and Relay presentation`, `Existing product component`, `Native field / Spartan input capability`.

Before converting a control, use the checked-in Helm implementation and Spartan CLI inventory to confirm its exact API. Keep existing product wrappers when they own the required behaviour; do not recreate retired names just to match the issue title. The installed package inventory at this baseline is `autocomplete`, `button`, `checkbox`, `combobox`, `dialog`, `input`, `input-group`, `native-select`, `popover`, `radio-group`, `textarea`, `utils`.

Verify field labels and error relationships, native button/link semantics, focus visibility and return, keyboard/touch equivalence, RTL logical layout, long translated labels, light/dark and user-accent contrast, forced colours, reduced motion and 200/400 percent zoom in the implementation ticket. For overlay sites, Brain should own focus trapping/Escape/backdrop mechanics. For media/canvas sites, native APIs and feature services keep permission and lifecycle ownership.

## Existing test contracts

Test names below are an inventory of assertions in source, not a statement that all accessibility or behaviour requirements are covered.

No adjacent unit spec was found. Add behavioural coverage before changing this surface.

## Follow-up implementation and verification

1. Preserve every event, binding, branch and service boundary listed above; add targeted tests for any observed gap before changing behaviour.
2. Reuse the mapped primitive owner and keep product state in the feature. Confirm any unavailable capability with the Spartan CLI before generating it.
3. Exercise the rendered surface with keyboard and touch, both directions/themes, long translations, reduced motion and high zoom. Keep lifecycle/resource cleanup in the behavioural tests.
4. When a visual contract changes, update its mapped design preview and the existing Claude Design project.
5. Run frontend lint, build, unit tests, control-flow/template/RTL checks and applicable design-sync checks. Required CI and independent review must pass before merge.

This audit can be reverted independently. It creates no schema, service, route or runtime dependency.
