# Devanagari and complex-script content rendering architecture

Issue: #5507 (`Spartan UI 0041`)

Status: authoritative complex-script supplement to `docs/multilingual-typography.md`, `docs/spartan-relay-architecture.md`, `DESIGN.md`, and the repository globalisation rules in `AGENTS.md`.

This document defines how Devanagari and other complex writing systems are rendered inside the Relay + Spartan UI system. It does not replace the shared multilingual typography contract. It narrows that contract for scripts whose visible glyphs can be formed from multiple Unicode code points, combining marks, conjuncts, contextual shaping, reordering, or script-specific line-breaking behaviour.

The term "complex script" is used here only as an implementation category. It is not a language identity and must never be used as a runtime `lang` value.

## Scope

The contract applies to Devanagari and to other writing systems with comparable shaping or segmentation requirements, including Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam, Sinhala, Thai, Lao, Khmer and Myanmar scripts.

It also applies whenever a product feature handles text where a user-perceived grapheme, syllable or word may not correspond to one JavaScript code unit or one Unicode code point.

The product currently exposes Hindi (`hi`) as an application language, but user-authored and translated content is not limited to the UI-language catalogue. The rendering contract must therefore work for valid language metadata beyond the currently selectable application locales.

## Current implementation audit

The repository already has several correct foundations:

- `frontend/src/styles.scss` applies the universal `font-sans` stack to the application body and does not force a script-specific product font.
- `frontend/tailwind.config.js` documents that the platform-native body stack exists specifically to preserve broad script coverage, including Devanagari.
- `frontend/scripts/check-multilingual-typography.mjs` rejects feature-level `font-family`, imperative `fontFamily`, arbitrary Tailwind font-family values and `font-display` leakage into known language-content surfaces.
- `I18nService` exposes Hindi as `hi`, marks it LTR, and keeps application direction separate from typography.
- `TokenisedTextComponent` uses `Intl.Segmenter` with the content language instead of regex or whitespace splitting for word segmentation.
- Relay already owns semantic typography and colour roles, while Spartan owns reusable accessible interaction mechanics.

The audit also identifies gaps that the migration must make explicit:

- There is no dedicated contract for preserving combining marks, conjuncts and shaping controls through feature-level text processing.
- There is no repository-wide rule defining grapheme-safe character counting, truncation, cursor-adjacent operations or user-visible slicing.
- There is no current `KeyboardEvent.isComposing` guard found in frontend source, so custom Enter or shortcut handlers can accidentally act on uncommitted IME text.
- The current multilingual typography gate protects font ownership but does not detect Latin-oriented tracking, case transforms, code-point slicing, whitespace tokenisation or fixed-height clipping in complex-script surfaces.
- The repository does not currently require known target-language content to expose a nearest semantic BCP 47 `lang` boundary when it differs from the UI locale.

This work must extend those existing foundations. It must not introduce a Devanagari-only component family, a second typography stack or a feature-owned shaping engine.

## Ownership model

### Browser and operating-system text engine

The browser, font engine and operating system own:

- glyph substitution and positioning;
- conjunct formation;
- combining-mark placement;
- script reordering required for visual shaping;
- fallback glyph selection;
- native text selection and caret behaviour;
- ordinary line breaking where the platform has script-aware rules.

Feature code must provide valid Unicode source text and must not try to reproduce these responsibilities in JavaScript or CSS.

### Application data boundary

The feature or data boundary owns the best-known language metadata for the content. That metadata should come from an authoritative source such as the selected learning language, message metadata, translation result metadata, lesson metadata or a documented language-detection result.

Do not infer language from nationality, a user's profile picture, visible glyph shape or a broad script category.

### Relay

Relay owns:

- semantic typography roles;
- line-height and spacing roles;
- surfaces and text colours;
- responsive composition;
- light and dark themes;
- per-user primary accent behaviour;
- shared presentation wrappers where a repeated complex-script presentation need is proven.

Relay must remain script-neutral. It may provide presentation roles that are safe for all scripts, but it must not embed a Hindi-only font or layout assumption into a generic primitive.

### Spartan Brain and Helm

Spartan owns reusable interaction mechanics such as focus, selection, menus, comboboxes, radio groups, dialogs and other keyboard state machines.

Complex-script support must not create a parallel interaction implementation. Existing Spartan/Helm controls inherit the surrounding language and typography. Feature code remains responsible for not triggering an action while an input method is still composing text.

## Language metadata contract

### Use BCP 47 language tags

Runtime markup must use the best-known BCP 47 language tag for the content itself.

Examples:

- Hindi: `hi`
- Marathi: `mr`
- Nepali: `ne`
- Bengali: `bn`
- Punjabi in Gurmukhi when the language is known: `pa`
- Gujarati: `gu`
- Tamil: `ta`
- Telugu: `te`
- Kannada: `kn`
- Malayalam: `ml`
- Sinhala: `si`
- Thai: `th`
- Khmer: `km`

Use a more specific valid tag only when the product genuinely knows the region or script distinction. Do not fabricate specificity to satisfy a rendering rule.

### UI language and content language are separate

The document `lang` represents the active application language. Content in a different known language must set `lang` on the nearest semantic container that contains that content.

Correct:

```html
<p class="font-sans text-base" [attr.lang]="exampleLanguage()">
  {{ exampleText() }}
</p>
```

A bilingual learning pair must tag each side independently:

```html
<p [attr.lang]="sourceLanguage()">{{ sourceText() }}</p>
<p [attr.lang]="targetLanguage()">{{ targetText() }}</p>
```

Do not place one language tag on a large container that contains unrelated source and target languages when narrower semantic boundaries are available.

### Direction is independent from script complexity

Devanagari and the other scripts listed in this document are normally horizontal LTR in the product. A script being complex does not imply RTL.

Direction remains owned by the existing locale and content-direction contracts. Surrounding controls and layout still use logical spacing and border utilities so complex-script content composes correctly even when the application UI itself is RTL.

## Font and shaping contract

The universal system stack remains the canonical font strategy.

- Keep user-authored, translated, lesson and target-language content on `font-sans` or inherit the body stack.
- Never put unpredictable complex-script content beneath `font-display`.
- Never add feature-local Devanagari, Bengali, Tamil or other script-specific font stacks merely because a branded display face lacks glyphs.
- Do not manually reorder code points to match visual glyph order.
- Do not substitute Unicode presentation forms or precomposed visual glyph strings for normal source text.
- Do not remove combining marks because they appear visually small or because an ASCII-oriented validator treats them as punctuation.
- Preserve zero-width joiners and non-joiners when they are part of authored text. Security-sensitive canonicalisation must be a separate, explicit data-boundary concern and must not rewrite the displayed value silently.
- Do not add manual `letter-spacing` or Tailwind `tracking-*` to unpredictable complex-script language content.
- Do not use uppercase or lowercase transforms on unpredictable multilingual/user content.

The rendered source of truth is the original text. Search normalisation, comparison keys and indexing may derive separate values, but they must not mutate the visible user-authored value.

## Grapheme, word and sentence boundaries

### Do not equate code units with visible characters

A user-perceived character can consist of a base character plus one or more combining marks, a conjunct sequence or another multi-code-point grapheme cluster.

These patterns are therefore prohibited for user-visible text operations:

```ts
text.split('')
[...text]
text[index]
text.slice(0, characterLimit)
```

They are not safe definitions of a visible character boundary.

### Use `Intl.Segmenter`

Use `Intl.Segmenter` with the best-known language whenever product behaviour needs word, grapheme or sentence boundaries.

Word segmentation:

```ts
const segmenter = new Intl.Segmenter(language, { granularity: 'word' });
const segments = Array.from(segmenter.segment(text));
```

Grapheme-aware character count:

```ts
const segmenter = new Intl.Segmenter(language, { granularity: 'grapheme' });
const characterCount = Array.from(segmenter.segment(text)).length;
```

Do not replace this with regex character ranges, whitespace splitting or hand-maintained script tables.

### Render original text

Segmentation is for behaviour. Do not reconstruct the visible string from normalised tokens when the original source can be rendered directly.

A tokenised learning surface may wrap word segments for interaction, but each segment must remain the exact segment returned from the source text. Combining marks and punctuation must not be dropped during reconstruction.

## Line height, wrapping and clipping

Complex scripts often need more vertical space for marks, vowel signs and conjunct geometry than Latin-only examples suggest.

The default contract is:

- use content-driven block height;
- use normal browser line breaking for ordinary prose;
- use shared Relay typography/line-height roles that leave adequate glyph space;
- avoid `leading-none` on unpredictable user or target-language content;
- avoid fixed-height text containers unless truncation is an intentional product requirement and the complete value remains accessible;
- use `min-w-0` in constrained flex/grid children so text is allowed to reflow;
- use a narrow `overflow-wrap` exception for unbounded machine values such as URLs or opaque IDs rather than weakening line breaking for an entire paragraph;
- do not insert spaces between visible characters to manufacture break opportunities;
- do not use `break-all` on normal language prose.

No layout may depend on a Latin test string being representative of the height or width of the same content in Hindi, Bengali, Tamil or another supported script.

## IME and composition contract

Users can enter Devanagari and other scripts through native script keyboards, transliteration IMEs and composition-based input methods. An intermediate composition value is not committed user input.

Any feature that handles Enter, Escape, arrow keys, shortcuts, live search, mention detection or command submission in an editable control must preserve composition.

Rules:

- Never submit a form, send a message or run a command from Enter while `KeyboardEvent.isComposing` is true.
- Do not treat composition updates as final input for validation, tokenisation, translation, mention detection or search unless the product explicitly requires composition-aware previews.
- Do not trim, replace, normalise or clear the input value during an active composition session.
- Prefer native form/input semantics and allow the browser to own text editing.
- Custom key handlers must be additive product behaviour, not replacements for browser text entry.

Correct:

```ts
onComposerKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return;
  if (event.key === 'Enter') this.submit();
}
```

Incorrect:

```ts
onComposerKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') this.submit();
}
```

A shared input primitive may expose an IME-safe product action in the future if repeated use proves it is useful. Do not create a new Spartan abstraction solely for one feature's composition flag.

## Native selection, caret and editing

Editable text should remain in native form controls or content-editing primitives with clear ownership. Do not build a character-by-character fake editor simply to colour or animate complex-script text.

For read-only learning interactions:

- prefer word or grapheme segmentation through `Intl.Segmenter`;
- preserve DOM order as source order;
- do not absolutely position individual combining marks;
- do not animate individual code points independently;
- keep copy/paste capable of recovering the original source text;
- preserve browser text selection unless the interaction contract explicitly requires another selection model.

## Transliteration and pronunciation

Transliteration is supplementary presentation. It must never replace the original script as the canonical rendered value.

When both original and transliterated forms are presented:

- preserve the original script visibly;
- tag the original with its known language;
- keep transliteration in a separate semantic element;
- do not claim transliteration is a faithful pronunciation guide unless the provider contract explicitly guarantees that property;
- do not derive accessibility names solely from transliteration when the original content has meaningful text semantics.

The existing `TokenisedTextComponent` follows the correct high-level model by retaining original segments and presenting transliteration separately.

## Accessibility contract

Complex-script content follows the same WCAG requirements as every other surface.

- Accurate `lang` boundaries are required when the content language is known so assistive technology can select appropriate pronunciation rules.
- Meaningful text must remain real text, not an image of text or CSS pseudo-content.
- Accessible names and descriptions for controls remain product-translated through the normal translation system.
- Do not remove diacritics or combining marks from accessible names if they are part of the meaningful value.
- Text and controls remain usable at browser text scaling, 200% zoom and 400% zoom/reflow.
- Focus order stays semantic and deterministic regardless of the script being displayed.
- Do not communicate token status, correctness or learning state only through colour.
- Where interactive word highlighting is used, the complete sentence must remain understandable to assistive technology and copy/paste users.

A visible script sample is not sufficient accessibility verification. Semantic language metadata, focus behaviour and reflow require automated and manual checks.

## Theme, accent and responsive behaviour

Complex-script rendering uses the same Relay semantic tokens as all other content.

- Light and dark themes are first-class.
- Dynamic per-user `primary` accent behaviour remains intact.
- Script selection must not change product colours, surfaces, radii or elevation.
- The 390px mobile baseline must support realistic long language strings without clipping or horizontal page overflow.
- Tablet and desktop layouts must preserve readable line lengths rather than simply stretching a mobile text block indefinitely.
- At 200% and 400% zoom, required content and actions must reflow rather than disappear behind fixed-height containers.
- Font fallback changes must not change application interaction ownership.

## Migration examples

### Target-language sentence

Preferred:

```html
<p
  class="min-w-0 whitespace-pre-wrap font-sans text-text-primary leading-relaxed"
  [attr.lang]="sentenceLanguage()"
>
  {{ sentenceText() }}
</p>
```

Avoid:

```html
<p class="font-display tracking-wide uppercase h-8 overflow-hidden">
  {{ sentenceText() }}
</p>
```

### Grapheme-aware character limit

Preferred:

```ts
const segmenter = new Intl.Segmenter(language, { granularity: 'grapheme' });
const graphemes = Array.from(segmenter.segment(text));
const isWithinLimit = graphemes.length <= maximumCharacters;
```

Avoid:

```ts
const isWithinLimit = text.length <= maximumCharacters;
```

when the limit is presented to users as a count of visible characters.

### Word interaction

Preferred:

```ts
const segmenter = new Intl.Segmenter(language, { granularity: 'word' });
const words = Array.from(segmenter.segment(text));
```

Avoid:

```ts
const words = text.trim().split(/\s+/);
```

### IME-safe Enter action

Preferred:

```ts
onKeydown(event: KeyboardEvent): void {
  if (event.isComposing) return;
  if (event.key === 'Enter') this.submit();
}
```

The product action may still be wrapped by an existing Spartan/Relay control. This guard protects the editable text lifecycle rather than creating a new visual primitive.

## Prohibited patterns

- Feature-level Devanagari, Bengali, Tamil or other script-specific `font-family` declarations.
- `font-display` on translated, target-language or unpredictable user content.
- Tailwind `tracking-*` or manual `letter-spacing` on unpredictable complex-script content.
- Forced uppercase/lowercase transformations on unpredictable multilingual content.
- Manual code-point reordering or feature-owned shaping logic.
- Removing combining marks, joiners or non-joiners from the displayed value as a layout shortcut.
- `.split('')`, `[...text]`, regex character ranges or direct code-unit indexing when the product requirement is a user-perceived character boundary.
- Whitespace splitting or regex tokenisation when the product requirement is a language-aware word boundary.
- Acting on Enter or another command shortcut while `KeyboardEvent.isComposing` is true.
- Fixed-height text containers that clip glyph marks or required content at supported zoom levels.
- Inserting spaces between script characters to force line breaks or token boundaries.
- Replacing original script text with transliteration.
- Guessing a language from glyph shape, nationality or the current UI locale when authoritative content metadata exists.
- Hardcoded colours or script-specific theme overrides outside Relay semantic roles.
- A Devanagari-only Spartan/Relay component family.

## Verification contract

Existing structural checks already protect important parts of this contract:

```bash
cd frontend
npm run check:multilingual-typography
npm run check:rtl-logical
```

`check:multilingual-typography` protects the shared system font strategy and prevents feature-level font-family drift. `check:rtl-logical` protects surrounding layout from direction-sensitive physical spacing regressions.

Follow-up #5508 (`Spartan UI 0042`) should extend migration verification with the smallest focused checks needed for complex-script regressions instead of duplicating the existing typography gate.

Recommended verification scope for #5508:

1. Extend the static multilingual check for known language-content surfaces to flag Latin-oriented `tracking-*`, `letter-spacing`, `uppercase`, `lowercase` and ordinary-prose `break-all` patterns unless a narrowly documented exception is present.
2. Add a source check for obvious visible-language segmentation regressions such as `.split('')` and whitespace splitting in shared language-content utilities. Keep the rule narrow enough to avoid false positives in non-text parsing code.
3. Add focused unit fixtures containing Devanagari conjuncts and combining marks, plus representative Bengali, Tamil and another complex script.
4. Verify word and grapheme operations use `Intl.Segmenter` and preserve the original displayed source.
5. Add IME tests proving Enter-based submit/search actions do nothing while `KeyboardEvent.isComposing` is true and work after composition commits.
6. Verify known target-language content exposes the expected `lang` boundary without fabricating language metadata when it is genuinely unknown.
7. Add representative 390px, light/dark, 200% and 400% reflow coverage for a language-content surface with realistic multi-line complex-script text.
8. Verify dynamic primary accent changes do not alter typography or content-language semantics.

A verifier should report the file, line and rule for structural failures. Do not require every content node to invent a `lang` value. Unknown language is a legitimate state and is preferable to false metadata.

## Verification for this architecture-only change

This issue changes documentation and implementation guidance, not a rendered component, API, route, schema or persisted value. The relevant targeted commands are:

```bash
cd frontend
npm run check:multilingual-typography
npm run check:rtl-logical
```

The normal pull-request CI remains authoritative for repository formatting, constitution and documentation checks. Claude Design/design-preview reconciliation is not required for this issue because no visual component contract changes.

## Rollback

This architecture standard is documentation-only. A rollback is a normal documentation revert and requires no API, database, routing, persistence or user-data rollback.

Runtime migration work under follow-up issues must remain independently revertible and must not depend on a new script-specific component hierarchy.
