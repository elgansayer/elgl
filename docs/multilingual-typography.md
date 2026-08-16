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

`font-display` must not be applied to:

- user messages, posts, comments, profiles or other user-authored prose;
- translated or target-language text;
- vocabulary terms, example sentences, corrections or reading passages;
- AI conversation content that may be emitted in any supported language;
- language names or labels whose script is not guaranteed in advance.

If a container can contain both a product-authored heading and language content, apply `font-display` only to the heading rather than to the parent container.

## Spartan and Relay ownership

Spartan does not own the product font stack. Generated Helm components inherit the surrounding Relay typography unless their upstream implementation requires a size or weight for control semantics.

A Spartan regeneration must not introduce a new application-wide font family, replace `font-sans`, or force a display face onto projected content. Product font-family choices remain Relay-owned through global styles and Tailwind configuration.

## Script and direction behaviour

Typography is direction-neutral. RTL behaviour is controlled by document direction and logical layout rules, not by choosing a different component tree or a hardcoded font.

Arabic, Hebrew and Persian text must retain natural shaping. CJK text must not be squeezed into Latin-specific letter spacing assumptions. Devanagari and other complex scripts must retain browser shaping and sufficient line height. Feature code must not use manual letter splitting to simulate typography.

## Accessibility and reflow

- Text must remain readable under browser text scaling and at 200% and 400% zoom.
- Components must not rely on a fixed font's measured width to remain usable.
- Fixed-height containers must not clip translated or fallback-font text.
- Text should wrap naturally unless truncation is an explicit product requirement with an accessible way to reach the full value.
- Font loading failure must degrade to the system stack without making core UI or language content unavailable.
- Typography does not branch between light and dark themes. Colour and contrast are theme-aware, while the font ownership contract remains identical in both themes.

## Prohibited patterns

- `font-family:` declarations in feature-level Angular source.
- Imperative `style.fontFamily` or equivalent component logic.
- Arbitrary Tailwind font-family values such as `font-[...]`.
- `font-display` on multilingual/user-content feature surfaces.
- Applying a branded display font to a parent that projects unpredictable translated or user-generated content.
- Script-specific overrides added merely because a display face lacks glyphs. Use the universal system stack instead.

## Verification gate

Run:

```bash
cd frontend
npm run check:multilingual-typography
```

The gate verifies that:

1. the global application body continues to use `font-sans`;
2. the display stack retains Instrument Sans plus robust system fallbacks;
3. feature source does not introduce bespoke `font-family`, imperative `fontFamily`, or arbitrary Tailwind font-family declarations;
4. known multilingual and user-content feature areas do not use `font-display`.

The check deliberately leaves `font-display` available to product-authored display contexts outside those language-content surfaces. Any future expansion of display-font usage should be reviewed against this contract and the representative Claude Design/design-preview states.

## Migration examples

Correct:

```html
<h1 class="font-display text-3xl font-bold">{{ 'onboarding.hero' | t }}</h1>
<p class="font-sans text-base">{{ translatedSentence() }}</p>
```

Incorrect:

```html
<div class="font-display">
  <p>{{ userMessage() }}</p>
</div>
```

Correct components generally need no font class at all because the application body already supplies the universal stack. Use typography utilities for size, weight, line-height and semantic emphasis without replacing the family.
