---
name: i18n-translation-workflow
description: 'Add, rename, or remove UI translation keys under the zero-hard-coded-strings rule in the HelloTalk clone Angular frontend. Use whenever new user-facing text is introduced in a component template or TypeScript code, or when auditing for hard-coded strings.'
---

# i18n Translation Workflow

## When to Use

- Any time you write new user-facing text in an Angular template (`*.html`) or component/service TypeScript (`*.ts`).
- Auditing a component for hard-coded strings before marking work complete.

## The Rule (non-negotiable, per `AGENTS.md` Section 3 and 6)

Zero hard-coded UI strings. Every user-facing piece of text must be a translation key, resolved through:

- **Templates:** `TranslatePipe` - `{{ 'key.path' | t }}` or with params `{{ 'key.path' | t: { name: value() } }}`.
- **Component/service code:** inject `I18nService` (`frontend/src/app/services/i18n.service.ts`) and call `this.i18n.translate('key.path', params)`.

## Key Naming Convention

Dot-namespaced by feature area, matching existing keys in `I18nService.baseDictionary`, e.g.:

```
nav.discover, nav.moments, nav.liveRooms
common.coinsBalance, common.signOut, common.demoActive
gift.broadcastTitle, gift.broadcastDesc
lang.label, lang.selectTitle
profile.saveButton, profile.loadError
```

Use `{{placeholder}}` syntax for interpolated params inside the dictionary string (e.g. `'{{coins}} Coins'`), matched by the `params` object passed to `.translate()`/`| t`.

## Procedure for Adding a New Key

1. Add the English (`en-GB`, British spelling) string to `baseDictionary` in `frontend/src/app/services/i18n.service.ts`.
2. Reference it from the template/component via `| t` or `i18n.translate(...)` - never inline the literal string anywhere else.
3. If the string includes a price, ensure the price is formatted properly.
4. If the string could reasonably need localisation nuance (pluralisation, gendered forms), note it as a follow-up rather than baking English-only logic into the key.
5. For dynamically-fetched UI dictionaries in other locales, the backend `POST /nlp/translate-ui` endpoint (`NlpService#translateUi`) merges a Redis-cached per-locale dictionary over the caller-supplied English dictionary - new keys automatically flow through once added to `baseDictionary`, but non-English translations for that key won't exist until the backend dictionary/cache is updated too.

## Auditing for Violations

Run (or extend) the repo's own check scripts - there is currently no automated "no raw text in templates" grep check, so manually scan new/changed `*.html` and `*.ts` files for literal user-facing strings that aren't inside a translation key, an `aria-label` bound to a translated value, a log message, or a code comment.

## RTL Interaction

Changing `I18nService.currentLang` to an RTL language (`ar`, `he`, `fa`, `ur` are already marked `isRtl: true` in `availableLanguages`) should flip `document` directionality (`dir="rtl"`) - verify any new component still reads correctly mirrored; see `angular-feature-component` skill for the logical-CSS-property rules that make this automatic.
