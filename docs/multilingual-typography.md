# Multilingual typography and content rendering

Status: authoritative contract for `[Spartan UI 0005]`, `[Spartan UI 0006]`, and `[Spartan UI 0037]`.

HelloTalk renders user-authored and translated text across many writing systems. Typography and text rendering must therefore prioritise glyph coverage, language semantics, input-method compatibility, readability and reflow over a uniform branded typeface.

## Typography roles

### Universal body and language content

The platform-native `font-sans` stack is the default for application UI, user-generated text, translations, vocabulary, corrections, chat, reading content and language-learning surfaces.

This role must support the user's installed system fonts and browser fallback for Latin, CJK, Arabic, Cyrillic, Devanagari and other scripts without requiring feature code to choose language-specific fonts.

Do not set `font-family` inside feature components. Do not use arbitrary Tailwind font-family values. Let the shared stack and browser font fallback resolve the best available glyph source.

### Display typography

`font-display` uses Instrument Sans followed by the shared sans-serif fallback chain. It is optional and reserved for product-authored display contexts where the content is known to be suitable for that face, such as branded headings, large counters and short marketing copy.

`font-display` must not be applied to user messages, translated or target-language text, vocabulary/example sentences, corrections, reading passages, AI conversation content, or language labels whose script is not guaranteed in advance. If a container mixes a product-authored heading with language content, apply `font-display` only to the heading.

## Current CJK implementation audit

The current foundation is sound but incomplete as an explicit rendering contract:

- `frontend/src/styles.scss` applies the universal `font-sans` stack to the document body.
- `frontend/tailwind.config.js` keeps Instrument Sans behind the optional `font-display` role and includes system fallbacks.
- `frontend/scripts/check-multilingual-typography.mjs` rejects feature-level `font-family`, arbitrary Tailwind font families and `font-display` in known language-content surfaces.
- `I18nService` exposes Japanese (`ja`), Mandarin Chinese (`zh`) and Korean (`ko`) as application languages and correctly treats them as horizontal LTR locales.
- Feature code currently relies largely on browser-native CJK shaping and line breaking. There is no competing CJK font stack, which is desirable.
- No repository-wide contract currently requires the nearest rendered content container to expose its actual BCP 47 language when content differs from the UI locale.
- No repository-wide contract currently defines CJK-safe line breaking, mixed-script overflow handling, semantic ruby markup, or IME composition behaviour.
- There is no evidence of a deliberate vertical-writing product mode. This standard therefore defines horizontal writing only.

The migration must extend the existing universal typography architecture rather than introduce a CJK-only component family or a second visual system.

## CJK rendering contract

### Scope and language identity

"CJK" is useful as an engineering umbrella, but it is not a valid language identity. Runtime markup must use the most specific known BCP 47 language tag for the content itself.

Examples:

- Japanese: `ja` or a more specific valid tag when the product genuinely knows it.
- Korean: `ko`.
- Simplified Chinese: prefer `zh-Hans` when the script is known.
- Traditional Chinese: prefer `zh-Hant` when the script is known.
- Unknown Chinese script: `zh` is acceptable when the application cannot determine Hans versus Hant safely.

Do not infer a user's content language from nationality, interface locale, glyph appearance, or Unicode ranges. Use authoritative content metadata, selected learning language, translation result metadata, or a documented language-detection result.

### DOM language ownership

The document language represents the active UI language. Content whose language differs from the UI language must set `lang` on the nearest semantic container that contains that content.

Correct:

```html
<p class="font-sans text-base" [attr.lang]="messageLanguage()">
  {{ messageText() }}
</p>
```

For a translated pair, tag each language separately:

```html
<p [attr.lang]="sourceLanguage()">{{ sourceText() }}</p>
<p [attr.lang]="targetLanguage()">{{ translatedText() }}</p>
```

Do not put one language tag on a container that mixes unrelated source and target languages if narrower elements can express the boundary accurately.

`lang` and `dir` are independent semantics. Japanese, Chinese and Korean remain horizontal LTR in the current product. Do not add `dir="rtl"` or a mirrored component tree for CJK content.

### Font and shaping ownership

Browser shaping plus the universal system stack owns CJK glyph selection. Feature components must not pick Japanese, Chinese or Korean font families directly.

- Keep language content on `font-sans` or inherit it from the body.
- Never put unpredictable CJK content beneath `font-display`.
- Do not add letter spacing merely to make CJK resemble Latin typography.
- Do not transform user or translated CJK text to uppercase or lowercase for presentation.
- Do not insert spaces between Han, kana or hangul characters to force wrapping or tokenisation.
- Preserve the original Unicode text for display. Search/index normalisation is a separate data concern and must not rewrite the rendered user value.

Spartan Brain does not own font selection, shaping or line breaking. Relay owns shared typography roles and presentation defaults. Feature code owns only the content language metadata and product-specific composition.

### Line breaking and overflow

Normal prose should use browser-native CJK line breaking. The default contract is:

- `word-break: normal` for ordinary language content.
- Natural wrapping and content-driven height.
- `overflow-wrap: anywhere` only on containers that must survive unbounded user-controlled tokens such as long URLs, opaque IDs or pasted strings without normal break opportunities.
- `break-all` is prohibited for ordinary prose because it can damage mixed Latin/CJK readability and split Latin words, URLs and learning examples at arbitrary positions.
- Fixed-height text containers are prohibited unless truncation is a deliberate product requirement with a way to access the full value.

A feature may choose a stricter locale-specific CSS `line-break` policy only after visual regression coverage proves it improves the target surface across supported browsers. Do not scatter one-off `line-break` values through feature components.

### Mixed-script content

Messages and learning material frequently mix CJK, Latin text, emoji, numbers, URLs and punctuation. Rendering must preserve that mixture as authored.

- Do not assume one visible glyph equals one JavaScript code unit.
- Do not use `.split('')`, regex character classes or ASCII whitespace splitting for user-visible segmentation.
- Use `Intl.Segmenter` with the best-known content locale when product behaviour needs grapheme, word or sentence boundaries.
- Keep punctuation with the browser's native line-breaking rules rather than injecting spaces around full-width punctuation.
- Target unbounded machine-like values with overflow handling instead of weakening wrapping rules for the entire paragraph.

Example for product logic that needs word-like segments:

```ts
const segmenter = new Intl.Segmenter(language, { granularity: 'word' });
const segments = Array.from(segmenter.segment(text));
```

The original `text` remains the rendered source of truth.

### Ruby and pronunciation annotations

When a learning feature presents pronunciation or reading annotations, use semantic HTML ruby rather than pseudo-elements, absolute-positioned duplicate text, or manually inserted parentheses.

```html
<ruby lang="ja">
  日本語
  <rt>にほんご</rt>
</ruby>
```

Ruby is a content-semantic feature, not a Spartan interaction primitive. Relay may provide a shared presentation wrapper if several learning surfaces need consistent spacing, but the underlying `<ruby>` and `<rt>` semantics must remain intact.

Do not generate furigana or other readings merely from visual glyph inspection. The feature must receive an authoritative or explicitly generated reading from its language-data boundary.

## CJK input and IME contract

Text rendering work must not break CJK input methods. Japanese, Chinese and Korean users commonly compose text through an IME before a key press represents committed text.

Any feature that handles Enter, Escape, arrow keys, shortcuts, live search or command submission inside a text input must preserve native composition.

Rules:

- Never submit a form or send a message from Enter while `KeyboardEvent.isComposing` is true.
- Do not treat composition updates as committed text for validation, search, mention detection or command parsing unless the feature explicitly supports live composition.
- Do not clear, trim, translate, tokenise or replace the input value during an active composition session.
- Prefer native form and input semantics. Add custom key handling only when the product behaviour genuinely requires it.
- Composition state is feature/input behaviour. Do not add a new Spartan Brain abstraction solely for IME state.

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

## Spartan and Relay ownership

Spartan does not own the product font stack or CJK rendering algorithm. Generated Helm components inherit the surrounding Relay typography unless upstream styling needs a size or weight for control semantics. A Spartan regeneration must not introduce a new application-wide font family, replace `font-sans`, force a display face onto projected content, or override language semantics on projected text.

Ownership is:

| Concern | Owner | Rule |
| --- | --- | --- |
| Focus, selection, dialog, combobox and other reusable interaction state | Spartan Brain | Use the approved primitive when the surface genuinely has that interaction class. |
| Product typography, spacing, colour, radius and shared presentation | Relay | Theme-neutral and script-neutral semantic roles. |
| System font fallback and native shaping | Browser + Relay global typography | Do not replace with feature-local CJK fonts. |
| Content language metadata | Feature/data boundary | Pass the best-known BCP 47 tag to the rendered semantic container. |
| CJK segmentation for product logic | Feature/shared text utility using `Intl.Segmenter` | Never regex or whitespace splitting. |
| IME-aware submission/search behaviour | Input-owning feature or shared input primitive | Never act on an uncommitted composition. |
| Ruby reading semantics | Feature content, optionally wrapped by Relay presentation | Preserve semantic `<ruby>`/`<rt>` markup. |

## Script and direction behaviour

Typography is direction-neutral. RTL behaviour is controlled by document direction and logical layout rules, not by choosing a different component tree or hardcoded font. Arabic/Hebrew/Persian text must retain natural shaping, CJK must avoid Latin-only tracking assumptions, and Devanagari/other complex scripts must retain browser shaping and sufficient line height.

CJK-specific content does not relax the repository's RTL rule. Containers and surrounding controls still use logical spacing and border utilities so a Japanese or Chinese content block remains correctly composed if the surrounding UI locale is Arabic or Hebrew.

## Theme, responsive and accessibility requirements

- CJK typography does not define separate light or dark colours. Use Relay semantic text and surface tokens in both themes.
- Per-user primary accent behaviour must remain intact and must not affect font selection or language semantics.
- Text remains readable under browser text scaling and at 200% and 400% zoom.
- Components must not rely on a fixed font's measured width.
- Fixed-height containers must not clip translated or fallback-font text.
- Text wraps naturally unless truncation is an explicit product requirement with access to the full value.
- Font loading failure degrades to the system stack without blocking core UI or language content.
- Important language content must not be represented only as an image of text.
- Accurate `lang` boundaries are required where the application knows the content language so assistive technology can choose appropriate pronunciation rules.
- A CJK string must not be considered accessible merely because it is visible. Accessible names, descriptions and state remain subject to the normal WCAG and Spartan/Relay contracts.
- Test the 390px baseline with realistic long Japanese, Chinese and Korean strings, not only short English placeholders.

## Migration examples

### User-authored message

Preferred:

```html
<p
  class="min-w-0 whitespace-pre-wrap break-words font-sans text-text-primary"
  [attr.lang]="messageLanguage()"
>
  {{ messageText() }}
</p>
```

Avoid:

```html
<p class="font-display break-all tracking-wide">{{ messageText() }}</p>
```

### Product heading beside language content

Preferred:

```html
<h2 class="font-display text-xl">{{ 'lesson.exampleTitle' | t }}</h2>
<p class="font-sans" [attr.lang]="exampleLanguage()">{{ exampleSentence() }}</p>
```

The heading may use the display role only because its copy is product-authored and controlled. The learning sentence remains on the universal stack.

### Mixed UI and target-language labels

If a language name is shown in its own script, the visible native name should carry that language's `lang` value when known. The surrounding button or option still delegates keyboard and selection behaviour to its existing Spartan/Relay primitive.

## Prohibited patterns

- `font-family:` declarations in feature-level Angular source.
- Imperative `fontFamily` component logic.
- Arbitrary Tailwind font-family values such as `font-[...]`.
- `font-display` on multilingual/user-content feature surfaces.
- Applying a branded display font to a parent containing unpredictable translated/user-generated content.
- Feature-local Japanese, Chinese or Korean font stacks added merely because a display face lacks glyphs.
- `break-all` on normal message, translation, lesson, profile, correction or reading prose.
- ASCII whitespace splitting, regex character ranges or `.split('')` for visible-language segmentation.
- Injecting spaces between CJK characters to influence layout or tokenisation.
- Acting on Enter/shortcuts while `KeyboardEvent.isComposing` is true.
- Rewriting the visible user value through compatibility or search normalisation.
- Absolute-positioned fake ruby annotations when semantic `<ruby>`/`<rt>` can express the content.
- Guessing `ja`, `zh` or `ko` from glyph shape, nationality or UI locale when authoritative language metadata is available.
- Fixed-height containers that clip CJK content at supported zoom or font scaling.

## Verification gate

Existing typography verification:

```bash
cd frontend
npm run check:multilingual-typography
```

The current gate verifies the global `font-sans` body stack, the Instrument Sans display fallback chain, absence of bespoke feature font-family declarations, and absence of `font-display` across known multilingual/user-content feature areas.

`[Spartan UI 0038]` should extend migration verification with focused CJK checks rather than introducing a second generic typography gate. The smallest useful additions are:

1. A static check that rejects `break-all` in known language-content surfaces unless a narrowly documented machine-token exception exists.
2. Unit coverage that the application synchronises the document `lang` attribute with the active UI locale.
3. Focused component tests for representative translated/user-authored surfaces proving a known content language is reflected through a nearest `lang` boundary.
4. Focused input tests proving Enter-based submission/search does nothing while `KeyboardEvent.isComposing` is true and works after composition commits.
5. Regression fixtures containing Japanese, Simplified or Traditional Chinese, Korean, mixed Latin/CJK, emoji and a long unbroken token.
6. Visual/reflow coverage at 390px and high zoom for a representative language-content surface in both light and dark themes.

Do not make the future gate scan every `lang` attribute mechanically. Content language can be unknown legitimately, and false-positive rules that encourage fabricated language metadata are worse than an explicit unknown state.

## Verification commands for architecture-only changes

This document changes architecture guidance only and does not change a runtime or visual contract. The relevant repository checks are:

```bash
cd frontend
npm run check:multilingual-typography
npm run check:rtl-logical
```

The normal pull-request CI remains authoritative for repository-wide formatting, constitution and documentation checks. A design-preview change is not required for this architecture-only issue because no rendered component contract changes.

## Rollback

This standard extends the existing multilingual typography contract without changing a runtime API, schema or persisted value. A rollback is a normal documentation revert. Runtime implementation work under follow-up migration tickets must remain independently revertible and must not depend on a new CJK-specific component hierarchy.
