---
name: i18n-translation-workflow
description: 'Add, rename, or remove user-facing text, or touch RTL/directional CSS or word tokenisation, anywhere in the HelloTalk clone (Angular frontend or NestJS backend). Use whenever new user-facing text is introduced in a component template, TypeScript code, or a backend-generated string, when auditing for hard-coded strings, or when writing directional CSS.'
---

# i18n Translation Workflow, RTL & Tokenisation

## When to Use

- Any time you write new user-facing text in an Angular template (`*.html`), component/service TypeScript (`*.ts`), or a NestJS-generated user-facing string (notifications, emails, error messages).
- Auditing a component or endpoint for hard-coded strings before marking work complete.
- Writing or reviewing any directional CSS (padding, margin, position, border, text-align).
- Parsing text into word tokens for any feature (clickable words, reading tools).

## The Rule (non-negotiable, per `AGENTS.md` Section 3)

Zero hard-coded UI strings, in any language. Every user-facing piece of text must be a translation key, resolved through:

- **Templates:** `TranslatePipe` - `{{ 'key.path' | t }}` or with params `{{ 'key.path' | t: { name: value() } }}`.
- **Frontend component/service code:** inject `I18nService` (`frontend/src/app/services/i18n.service.ts`) and call `this.i18n.translate('key.path', params)`.
- **Backend:** any user-facing string a service returns (notifications, emails, error messages) needs a translation key resolved the same way, not an inline English literal.

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
5. For dynamically-fetched UI dictionaries in other locales, the backend `POST /nlp/translate-ui` endpoint (`NlpService#translateUi`) translates the caller-supplied English dictionary and caches each translation in Redis by locale and a SHA-256 hash of the English text (`ui_str:<locale>:<hash>`). New keys and reworded English strings therefore flow through automatically: an unseen string is translated on first use and a changed string is never served a stale translation. Keep `{{token}}` interpolation names stable; a translation that changes, drops or adds a token is discarded in favour of the English text. The request is bounded (see `translate-ui.dto.ts`) and each user is limited to ten requests per ten minutes. Interface-language pickers must call `UiLanguagePreferenceService.changeLanguage`, never `I18nService.setLanguage` directly (`ui-language-single-owner.contract.spec.ts` enforces this); see `docs/language-settings.md`.

## Dictionary Value Hygiene

`| t` and `I18nService.translate` print a value verbatim, so keep every value plain, user-safe text:

- Store emoji and symbols as characters, never HTML entities such as `&#127979;`. Interpolation does not decode entities, so users would read the entity text literally.
- Do not put an emoji in a label when the template already draws an icon beside it (every `nav.*` label, `moments.readAloud`, `moments.stopReading`). The icon would show twice and the emoji would leak into the accessible name.
- Never name infrastructure in end-user copy (Cloudflare, R2, LiveKit, Supabase, Centrifugo, Redis). Describe what the user is doing instead, for example `Uploading...`.
- `frontend/src/app/services/i18n.service.spec.ts` (`dictionary value hygiene`) guards these rules.
- A corrected English string reaches non-English users only when their browser copy refreshes: the browser keeps `hellotalk_dict_<locale>`. The backend cache is addressed by the English text itself (`ui_str:<locale>:<hash>`, seven days), so it never serves a stale translation for reworded text. Legacy `ui_dict:<locale>` entries are no longer read and expire on their own.

## Word Tokenisation

Use the native `Intl.Segmenter` API (baseline browser support since 2024) to parse text into clickable word
tokens. Never use regex or space-splitting - it breaks for CJK, Thai, and other non-space-delimited scripts.

## RTL Layout

Use Tailwind logical properties, never physical directions, so the interface natively mirrors for Arabic,
Hebrew, and Persian:

| Never (physical) | Use (logical) |
| --- | --- |
| `pl-`, `pr-` | `ps-`, `pe-` |
| `ml-`, `mr-` | `ms-`, `me-` |
| `left-`, `right-` | `start-`, `end-` |
| `border-l`, `border-r` | `border-s`, `border-e` |
| `text-left`, `text-right` | `text-start`, `text-end` |

Prefer `gap-*` over `space-*` too - `space-*` is direction-sensitive in ways that don't always mirror correctly.

Changing `I18nService.currentLang` to an RTL language (`ar`, `he`, `fa`, `ur` are already marked `isRtl: true` in
`availableLanguages`) flips `document` directionality (`dir="rtl"`) - verify any new component still reads
correctly mirrored.

## Auditing for Violations

`npm run check:rtl-logical` (frontend) fails the build on any physical-direction utility - run it, alongside the
frontend completion gate, before marking i18n/RTL-touching work complete. There is no automated "no raw text in
templates" check yet, so manually scan new/changed `*.html`/`*.ts` files for literal user-facing strings that
aren't inside a translation key, an `aria-label` bound to a translated value, a log message, or a code comment.
