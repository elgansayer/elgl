# Hardcoded UI string audit

`AGENTS.md` section 3 requires zero hard-coded UI strings. Until now only a diff-based check
(`scripts/verify-translation-safe-component-apis.mjs`) enforced it, and only for lines added in a
pull request, so copy that predated the check was never revisited. This audit walks the whole
frontend tree and fails the build when visible or assistive copy bypasses the translation layer.

## What the gate enforces

Run `npm run check:hardcoded-ui-strings` from the repository root. The same check runs inside
`cd frontend && npm run lint:check` (and `npm run lint`), so the Factory verification gate and CI
enforce it without a separate workflow.

It scans every non-test `.html` file and every inline `template:` literal under
`frontend/src/app`, plus the TypeScript of the same files. Specs, stories, `generated/` and
`testing/` directories are skipped.

| Code                         | Flags                                                                                                                                                                                                  | Fix                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `static-text-node`           | Visible words typed directly in a template                                                                                                                                                             | `{{ 'feature.key' \| t }}`                           |
| `static-copy-attribute`      | Literal `aria-label`, `aria-description`, `aria-roledescription`, `aria-valuetext`, `placeholder`, `title`, `alt`, and on components also `label`, `heading`, `description`, `actionLabel` and similar | `[attr.aria-label]="'feature.key' \| t"`             |
| `literal-copy-binding`       | The same attributes bound to a bare literal, for example `[attr.aria-label]="'Close'"` or `cond ? 'Hide' : 'Show'`                                                                                     | Pipe the key through `t`                             |
| `literal-copy-interpolation` | `{{ 'Saved' }}` or `{{ cond ? 'Yes' : 'No' }}` without a pipe                                                                                                                                          | Pipe each branch through `t`                         |
| `native-dialog-literal`      | `alert('...')`, `confirm('...')`, `prompt('...')` with a literal message                                                                                                                               | `this.i18n.translate('feature.key')`                 |
| `literal-message-state`      | `errorMessage.set('Failed to save')`, `this.message = '...'` for error, message, notice, feedback, warning, hint or toast state, when the literal has two or more words                                | Translate at the point of assignment, or store a key |

Not flagged: values that already go through a pipe, dotted translation keys passed to a component
input (design-system primitives such as `app-input` and `app-select` translate them), glyphs and
emoji, HTML entities, hex colours, URLs and email addresses used as examples, comments, `<script>`
and `<style>`, Angular control-flow headers and `@let` declarations.

### Intentionally untranslated copy

Add `translation-static-ok` on the same line, or on a standalone comment line directly above, and
say why. The marker matches the one used by the diff-based check.

```html
<!-- translation-static-ok: CSS pixel unit, not localised copy -->
<span aria-hidden="true">{{ width }}px</span>

<!-- translation-static-ok: ISO 4217 currency code -->
<option value="USD">USD</option>
```

## Running the audit

```bash
npm run check:hardcoded-ui-strings   # unit tests plus the gate
npm run audit:hardcoded-ui-strings   # report only, never fails
node scripts/verify-no-hardcoded-ui-strings.mjs --report --root=admin-portal/src/app
```

The last form audits another Angular source tree.

The report also lists translation keys that templates and `I18nService.translate` reference but
that `I18nService.baseDictionary` does not define. Those render as the raw key (for example
`admin.userManagement.title`) and are the most visible i18n defect left in the app. They are
informational because fixing them needs real product copy for each key.

## First audit results

|        | Findings | Files |
| ------ | -------- | ----- |
| Before | 262      | 52    |
| After  | 0        | 0     |

Before: 141 text nodes, 49 static assistive attributes, 49 message-state literals, 14 literal
bindings, 7 literal interpolations and 2 native dialogs.

What changed:

- 246 keys were added to `I18nService.baseDictionary` (British English, grouped by feature).
  Existing keys were reused wherever the English already existed (`common.close`,
  `common.goBack`, `rooms.roomChat.*`, `privacy.*`, `profileEdit.coverPhoto` and others).
- Whole components were translated: language challenges, instant video notes, chat media
  picker/share/message, recommended-for-you carousel, lessons, device transfer, voice room
  preview, chat settings, account deletion, room chat, study streak counter and create event
  modal language pairs.
- Attribute-level fixes landed in profile, settings, moments feed, user detail, chat room, share
  modal, emoji picker, chip primitive, lesson manager and the Helm dialog close button.
- The design-sync manifest records the change in each of the 19 mapped items it touches, because
  `check:design-sync-drift` requires a preview or manifest update for every mapped template.
- The orphaned CLI scaffold `visitor-logs.ts` (with its html, scss and spec), which rendered
  "visitor-logs works!" and duplicated the real `VisitorLogsComponent`, was removed. Nothing
  imported it.
- `components/audio-stage` is not rendered by any route: the live stage markup ships inside
  `app-audio-room`, and issue #5955 tracks a standalone stage component. Its scaffold sentence
  (`audio-stage works!`) was removed instead of excused, so the template now carries no copy of its
  own and `audio-stage.spec.ts` asserts that. The component stays enrolled in the design-sync
  manifest, the calls-live preview and the coverage report, which all still point at the path.
- Field wording that only ever appeared as in-field hint text now rides an accessible name:
  `chat-view` and `emoji-picker` search/composers, and the room chat plus speaker caption composers
  in `room-chat`, bind a translated `aria-label`. `docs/interactive-accessible-name-contract.md`
  already forbids hint text as the only accessible name, and issue 1752 established the same shape
  for the chat page composers. The profile learning goals field keeps the visible label and helper
  sentence it already had, so its redundant hint sentence was dropped rather than renamed.
- A stray backslash in the My subscription price (`UKP / \$`) disappeared with the move to a
  translated price key.
- `core/services/settings.service.ts` now stores translation keys in its error state instead of
  English sentences.

## Open findings

These are not covered by the gate and are tracked as follow-up work.

1. **Undefined translation keys.** Run `npm run audit:hardcoded-ui-strings` for the live list.
   At the time of this audit it was 556 keys across 77 prefixes (largest: `admin` 62, `settings`
   51, `profile` 34, `languageParty` 32, `resource_library` 28). `frontend/src/assets/i18n/en.json`
   holds usable copy for 102 of them and only humanised key names (for example
   "Delete Button") for 123 more. `TranslatePipe` and `I18nService` resolve keys from
   `baseDictionary` only. The JSON files are loaded for ngx-translate, which no application code
   calls, so adding a key only to `en.json` does not fix the raw key.
2. **The admin portal has no translation layer.** `admin-portal/src/app` reports 374 findings in
   15 files (329 text nodes, 22 assistive attributes, 22 literal interpolations, 1 message) and
   contains no `TranslatePipe` or `I18nService` usage. Localising it needs a decision on the
   admin portal's i18n approach first, so it is not part of the gate.
3. **Copy the scanner cannot see.** English labels held in TypeScript data (option arrays, config
   objects), string concatenation inside bindings, dynamic keys such as
   `'audioRoom.languagePair.' + code`, and the `'Empty state'` fallback label in
   `AppEmptyStateComponent`.
4. **Unbuilt surfaces that still ship.** `audio-stage` renders nothing until issue #5955 builds the
   standalone stage, so the live stage stays inside `app-audio-room`. `ChatPageComponent.viewMedia`
   shows an alert that stands in for the view-once media viewer. `core/services/settings.service.ts`
   is a mock service used by
   two settings screens. `frontend/src/app/components/discovery/recommended-for-you/` contains a
   stray `.patch` file and `rooms/room-chat/` holds only an orphaned stylesheet.
5. **Visual parity with `original-hello-talk-screenshots/`.** The screenshots are a behavioural
   and information-hierarchy reference, not a pixel specification (see
   `docs/moments-feed-reference-analysis.md`). `check:chat-reference-analysis` and
   `check-moments-reference-analysis` confirm that all 49 captures are accounted for in the
   analysis documents, and `check:visual-contract-matrix` confirms the design-sync previews. A
   rendered comparison needs the full backend stack and a browser, which this audit did not run,
   so visual parity is not asserted here.

## Rollback

The gate is one script and one `package.json` entry in the root and `frontend` workspaces. To
disable it, remove the `check:hardcoded-ui-strings` step from the `frontend` `lint` and
`lint:check` chains. The translated templates are plain `| t` bindings backed by dictionary keys
and need no rollback.
