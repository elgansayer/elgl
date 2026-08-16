# Multilingual typography and font fallback

Status: authoritative contract for `[Spartan UI 0005]` and `[Spartan UI 0006]`.

HelloTalk renders user-authored and translated text across many writing systems. Typography must therefore prioritise glyph coverage, readability and reflow over a uniform branded typeface.

## Typography roles

### Universal body and language content

The platform-native `font-sans` stack is the default for application UI, user-generated text, translations, vocabulary, corrections, chat, reading content and language-learning surfaces.

This role must support the user's installed system fonts and browser fallback for Latin, CJK, Arabic, Cyrillic, Devanagari and other scripts without requiring feature code to choose language-specific fonts.

Do not set `font-family` inside feature components. Do not use arbitrary Tailwind font-family values. Let the shared stack and browser font fallback resolve the best available glyph source.

### Display typography

`font-display` uses Instrument Sans followed by the shared sans-serif fallback chain. It is optional and reserved for product-authored display contexts where the content is known to be suitable for that face, such as branded headings, large counters and short marketing copy.

`font-display` must not be applied to user messages, translated or target-language text, vocabulary/example sentences, corrections, reading passages, AI conversation content, or language labels whose script is not guaranteed in advance. If a container mixes a product-authored heading with language content, apply `font-display` only to the heading.

## Spartan and Relay ownership

Spartan does not own the product font stack. Generated Helm components inherit the surrounding Relay typography unless upstream styling needs a size or weight for control semantics. A Spartan regeneration must not introduce a new application-wide font family, replace `font-sans`, or force a display face onto projected content.

## Script and direction behaviour

Typography is direction-neutral. RTL behaviour is controlled by document direction and logical layout rules, not by choosing a different component tree or hardcoded font. Arabic/Hebrew/Persian text must retain natural shaping, CJK must avoid Latin-only tracking assumptions, and Devanagari/other complex scripts must retain browser shaping and sufficient line height.

## Accessibility and reflow

- Text remains readable under browser text scaling and at 200% and 400% zoom.
- Components must not rely on a fixed font's measured width.
- Fixed-height containers must not clip translated or fallback-font text.
- Text wraps naturally unless truncation is an explicit product requirement with access to the full value.
- Font loading failure degrades to the system stack without blocking core UI or language content.
- Typography is identical across light and dark themes; only colour/contrast change by theme.

## Prohibited patterns

- `font-family:` declarations in feature-level Angular source.
- Imperative `fontFamily` component logic.
- Arbitrary Tailwind font-family values such as `font-[...]`.
- `font-display` on multilingual/user-content feature surfaces.
- Applying a branded display font to a parent containing unpredictable translated/user-generated content.
- Script-specific overrides added merely because a display face lacks glyphs; use the universal system stack.

## Verification gate

Run:

```bash
cd frontend
npm run check:multilingual-typography
```

The gate verifies the global `font-sans` body stack, the Instrument Sans display fallback chain, absence of bespoke feature font-family declarations, and absence of `font-display` across known multilingual/user-content feature areas.

Correct:

```html
<h1 class="font-display text-3xl font-bold">{{ 'onboarding.hero' | t }}</h1>
<p class="font-sans text-base">{{ translatedSentence() }}</p>
```

Incorrect:

```html
<div class="font-display"><p>{{ userMessage() }}</p></div>
```

Most components need no font-family class because the application body already supplies the universal stack. Use typography utilities for size, weight, line-height and semantic emphasis without replacing the family.
