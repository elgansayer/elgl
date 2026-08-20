# Multilingual typography and font fallback

Status: authoritative contract for `[Spartan UI 0005]`, `[Spartan UI 0006]`, and `[Spartan UI 0039]`.

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

Spartan Brain and Helm own reusable interaction mechanics such as focus, keyboard state, selection, popover positioning and dialog dismissal. Relay owns semantic visual roles, typography, logical spacing, surfaces, colour and responsive composition. Feature code supplies language/content and composes those layers. Arabic support must not create a second component tree or a feature-specific interaction system.

## Script and direction behaviour

Typography is direction-neutral. RTL behaviour is controlled by semantic document direction and logical layout rules, not by choosing a different component tree or hardcoded font. Arabic, Hebrew and Persian text must retain natural shaping, CJK must avoid Latin-only tracking assumptions, and Devanagari and other complex scripts must retain browser shaping and sufficient line height.

The application-level locale owns the document direction through `I18nService`. Direction-sensitive component layout inherits that boundary. User-authored content can contain a different script or direction than the surrounding interface and therefore needs an explicit local boundary only when its content contract requires one.

## Arabic content rendering contract

### Current implementation audit

The application already has the main foundations required for Arabic:

- `I18nService` owns the root document `dir` state for RTL locales.
- The Relay layout contract requires logical Tailwind utilities and CSS logical properties.
- The global `font-sans` stack allows browser and operating-system Arabic font fallback rather than imposing a Latin-only product font.
- Shared Spartan and Relay primitives inherit document direction instead of maintaining a separate RTL mode.
- Existing `check:rtl-logical-contract` and `check:multilingual-typography` gates cover physical-direction CSS drift and bespoke font-family drift.

The remaining migration risk is local feature code that treats RTL as visual reversal rather than a text/layout semantic. Common failure modes include physical left/right utilities, forcing `text-align: right`, splitting Arabic text into code points, applying letter spacing, manually reversing strings, and allowing mixed-direction usernames, URLs or numbers to influence surrounding punctuation.

### Language and direction ownership

1. Use valid BCP 47 language metadata whenever the content language is known. Arabic examples include `ar`, `ar-EG`, `ar-SA` and other appropriate regional tags.
2. The active application locale owns the page-level `dir="rtl"` or `dir="ltr"` boundary. Do not duplicate page direction state in individual features.
3. Use `dir="auto"` for isolated user-generated text when the direction is not known until runtime and the content should determine its own paragraph direction.
4. Use `<bdi>` for short interpolated values whose direction must be isolated from surrounding text, especially usernames, identifiers, URLs, codes and other mixed-script fragments.
5. Do not infer application direction from Unicode character inspection. Direction belongs to locale or content metadata, not a feature-level regex.
6. Do not add raw LRM/RLM characters to translated strings as a routine layout fix. Prefer semantic `dir`, `<bdi>` and Unicode bidi isolation provided by the browser.

Example for a known Arabic-language region with an isolated account name:

```html
<section lang="ar" dir="rtl" class="text-start">
  <p>{{ 'profile.greeting' | t: { name: userName() } }}</p>
  <p><bdi>{{ userName() }}</bdi></p>
</section>
```

Example for user-authored content whose direction is unknown until runtime:

```html
<p dir="auto" class="font-sans text-start break-words">
  {{ message().text }}
</p>
```

The first example assumes the section is intentionally an Arabic-language island. Most feature components should inherit `lang` and `dir` from the application shell instead of setting either locally.

### Shaping, graphemes and typography

Arabic shaping, joining, ligatures and mark placement are browser/font-engine responsibilities. Feature code must preserve the source text and allow the shaping engine to operate on intact grapheme clusters.

- Never reverse Arabic strings or arrays to make them appear RTL.
- Never insert presentation-form characters as a substitute for normal Unicode Arabic text.
- Never split learner content with `text.split('')`, `[...text]`, regex character loops or other code-point-based tokenisation when the UI operates on user-perceived text units.
- Use `Intl.Segmenter` for word/grapheme segmentation according to the repository globalisation contract.
- Do not apply positive or negative `letter-spacing`, Tailwind `tracking-*`, uppercase transforms or other Latin-specific typographic effects to Arabic language content.
- Preserve combining marks and diacritics with their base characters.
- Avoid fixed line heights that clip Arabic ascenders, descenders or marks. Prefer the shared typography scale and content-driven height.
- Do not wrap individual Arabic letters in independently transformed/animated elements. If a feature needs highlighting, segment at a meaningful word or grapheme boundary.

### Mixed-direction content

Arabic product surfaces regularly contain Latin usernames, email addresses, URLs, numbers, timestamps, language codes and punctuation. These values must remain readable without destabilising the surrounding bidi order.

Use isolation rather than manual reversal:

```html
<p class="text-start">
  {{ 'chat.sentBy' | t }} <bdi>{{ sender().displayName }}</bdi>
</p>
```

For inputs whose data model is inherently LTR, such as an email address, URL, invite code or machine token, use an explicit local LTR boundary while keeping surrounding labels and layout RTL-aware:

```html
<label for="invite-code">{{ 'invite.codeLabel' | t }}</label>
<input id="invite-code" dir="ltr" class="text-start" [value]="inviteCode()" readonly />
```

Do not make all inputs LTR in an Arabic interface. Names, search, chat composition and ordinary language content should inherit the relevant language direction.

### Numbers, dates, time and currency

Use `Intl` formatting with the active locale or the product-defined locale for the data contract. Do not reverse digit strings or manually place currency/date punctuation for RTL.

- `Intl.NumberFormat` owns digit grouping and locale-appropriate numeric presentation.
- `Intl.DateTimeFormat` owns date/time order and punctuation.
- Currency labels still follow the product's dual-currency rules where applicable.
- Telephone numbers, IDs and machine-readable codes can use a local LTR/isolation boundary without changing the surrounding layout direction.

### Layout and alignment

The canonical RTL layout rules in `docs/rtl-logical-properties-architecture.md` apply to Arabic without exception.

Use logical Tailwind/CSS:

```html
<div class="ms-3 pe-4 text-start">...</div>
```

```css
.notice {
  margin-inline-start: 1rem;
  padding-inline-end: 1rem;
  inset-inline-start: 0;
}
```

Direction-sensitive UI must prefer `start`/`end`, `ms`/`me`, `ps`/`pe`, `border-s`/`border-e`, `text-start`/`text-end`, and CSS logical properties. Physical coordinates remain valid only for intentionally physical domains such as crop geometry, canvas pixels or media timelines.

Do not fix Arabic layouts with `text-right`, `float: right`, `margin-left`, `right: 0` or reversed DOM order when semantic/logical layout expresses the intent.

### Controls, overlays and icons

- Spartan controls inherit the surrounding direction. Feature code must not add separate Arabic keyboard logic.
- Menus, comboboxes, select popovers and dialogs align to semantic start/end through their shared primitive contract.
- Directional icons such as Back/Next can mirror through the existing RTL-aware icon contract when the icon means spatial/progression direction.
- Brand marks, media controls, play/pause symbols, status icons and non-directional illustrations must not be mirrored merely because the interface is RTL.
- Focus order follows DOM/task order, not a manually reversed visual order.
- Touch targets and disabled/error semantics are identical between LTR and RTL.

### Accessibility

Direction is not a substitute for language metadata. Assistive technology needs the correct language boundary for pronunciation and the correct direction boundary for visual/bidi order.

- Set `lang` on the document from the active locale and on local language islands when content intentionally differs from the surrounding language.
- Keep visible labels and accessible names translated through `TranslatePipe`/`I18nService`.
- Do not hide meaningful Arabic text in CSS pseudo-content.
- `aria-label` values follow the same translation rules as visible copy.
- Preserve source order and semantic landmarks at RTL, 200% zoom and 400% zoom.
- Mixed-direction values should use semantic isolation rather than punctuation hacks that screen readers may announce unexpectedly.

### Theme, accent and responsive behaviour

Arabic rendering uses the same Relay semantic colour and surface roles as every other script. RTL must not introduce hardcoded colours or a dark-only variant.

- Light and dark themes remain first-class.
- Dynamic per-user `primary` accent behaviour remains intact.
- Layout is mobile-first from the 390px baseline and must reflow at 200% and 400% zoom.
- Arabic translation expansion must not be constrained by fixed-width or fixed-height controls.
- Use `min-w-0`, wrapping and responsive composition where long Arabic labels/content can otherwise overflow.

## Accessibility and reflow

- Text remains readable under browser text scaling and at 200% and 400% zoom.
- Components must not rely on a fixed font's measured width.
- Fixed-height containers must not clip translated or fallback-font text.
- Text wraps naturally unless truncation is an explicit product requirement with access to the full value.
- Font loading failure degrades to the system stack without blocking core UI or language content.
- Typography is identical across light and dark themes; only colour/contrast change by theme.

## Migration examples

### Replace physical alignment

Incorrect:

```html
<div class="ml-3 pr-4 text-right">{{ translatedText() }}</div>
```

Correct:

```html
<div class="ms-3 pe-4 text-start">{{ translatedText() }}</div>
```

### Preserve mixed-direction identity values

Incorrect:

```html
<p>{{ userName() }}: {{ message().text }}</p>
```

Preferred when the message direction is user-controlled:

```html
<p>
  <bdi>{{ userName() }}</bdi>:
  <span dir="auto">{{ message().text }}</span>
</p>
```

### Preserve browser shaping

Incorrect:

```ts
const visualArabic = [...text].reverse().join('');
```

Correct:

```ts
const words = [...new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)];
```

Rendering still uses the original source text; segmentation is only for the feature behaviour that genuinely needs word units.

## Prohibited patterns

- `font-family:` declarations in feature-level Angular source.
- Imperative `fontFamily` component logic.
- Arbitrary Tailwind font-family values such as `font-[...]`.
- `font-display` on multilingual/user-content feature surfaces.
- Applying a branded display font to a parent containing unpredictable translated/user-generated content.
- Script-specific font overrides added merely because a display face lacks glyphs; use the universal system stack.
- Direction-sensitive `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left` or `text-right` where a logical equivalent exists.
- `margin-left`, `margin-right`, `padding-left`, `padding-right`, `left` or `right` for direction-sensitive layout where a logical CSS property exists.
- JavaScript reversal of Arabic strings, tokens, arrays or DOM item order to simulate RTL.
- Manual Arabic shaping, presentation-form substitution or feature-owned bidi algorithms.
- Character tokenisation with regex, whitespace splitting or code-point loops when word/grapheme semantics are required.
- Tailwind `tracking-*`, forced uppercase or letter-spacing on Arabic language content.
- Raw directional control characters embedded in translated strings as a routine layout technique.
- Hardcoded Arabic or English UI copy in templates/component code.
- A second Arabic-only Spartan/Relay component tree.

## Verification gates

Existing checks remain mandatory. Run both from the repository root:

```bash
npm run check:rtl-logical-contract
cd frontend && npm run check:multilingual-typography
```

`check:multilingual-typography` verifies the global `font-sans` body stack, the Instrument Sans display fallback chain, absence of bespoke feature font-family declarations, and absence of `font-display` across known multilingual/user-content feature areas.

`check:rtl-logical-contract` verifies the global RTL boundary and fails when changed frontend source lines introduce common physical-direction Tailwind/CSS patterns without an explicit `rtl-physical-ok` annotation on the same line.

Follow-up `[Spartan UI 0040]` (#5506) should add the smallest focused Arabic migration verification gate. It should exercise representative Relay/Spartan controls in Arabic under light and dark themes and verify:

1. root `lang`/`dir` and local `dir="auto"`/`bdi` boundaries;
2. no direction-sensitive physical utility regression;
3. Arabic shaping survives interactive highlighting/tokenisation;
4. mixed Arabic plus Latin identity/URL/number content remains isolated;
5. translated labels, focus order and accessible names remain correct;
6. 390px, 200% and 400% reflow does not hide content or required actions.

A verifier should fail with a specific file/line and rule name. It should not attempt screenshot-only approval for semantics that can be checked structurally. Visual preview coverage can supplement semantic tests for light/dark, mixed-direction and high-zoom states.

Correct universal typography:

```html
<h1 class="font-display text-3xl font-bold">{{ 'onboarding.hero' | t }}</h1>
<p class="font-sans text-base">{{ translatedSentence() }}</p>
```

Incorrect:

```html
<div class="font-display"><p>{{ userMessage() }}</p></div>
```

Most components need no font-family class because the application body already supplies the universal stack. Use typography utilities for size, weight, line-height and semantic emphasis without replacing the family.
