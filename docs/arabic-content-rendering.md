# Arabic content rendering architecture

Issue: #5505 (`Spartan UI 0039`)

Status: authoritative Arabic-script supplement to `docs/multilingual-typography.md`, `docs/rtl-logical-properties-architecture.md`, `docs/spartan-relay-architecture.md`, and `DESIGN.md`.

This document defines how Arabic content is rendered inside the Relay + Spartan UI system. It does not replace the shared multilingual typography or RTL contracts. It narrows those contracts for Arabic shaping, bidi isolation, mixed-direction content and Arabic-language interaction surfaces.

## Current implementation audit

The application already has the main foundations required for Arabic content:

- `I18nService` owns the root document language/direction boundary for RTL locales.
- Relay requires logical Tailwind utilities and CSS logical properties instead of feature-owned left/right layout rules.
- The global `font-sans` stack allows browser and operating-system Arabic font fallback instead of forcing a Latin-only product font.
- Spartan Brain/Helm primitives inherit document direction and own reusable keyboard/focus/selection mechanics.
- `npm run check:rtl-logical-contract` catches common physical-direction regressions in changed frontend source.
- `cd frontend && npm run check:multilingual-typography` protects the universal font stack and prevents multilingual surfaces from adopting bespoke display fonts.

The remaining risk is local feature code treating RTL as a visual reversal problem. Common failures include physical left/right utilities, forced `text-right`, string reversal, code-point splitting, letter spacing on Arabic content, and mixed-direction identifiers disturbing surrounding punctuation.

## Ownership model

### Browser and font engine

The browser/font engine owns:

- Arabic joining and contextual shaping;
- ligatures and mark placement;
- bidirectional text ordering from semantic `dir` boundaries;
- grapheme rendering and fallback glyph selection.

Feature code must preserve normal Unicode Arabic source text and must not implement a shaping or bidi algorithm.

### Application and feature data

The application owns known language metadata and the page-level locale. Feature/data boundaries may own a local language/direction boundary only when content intentionally differs from the page or its direction is genuinely unknown until runtime.

### Relay

Relay owns semantic typography, surfaces, colour roles, logical spacing, responsive composition, light/dark parity and per-user primary accent behaviour.

### Spartan Brain and Helm

Spartan owns reusable interactive mechanics such as focus, keyboard state, selection, menus, comboboxes, popovers and dialog dismissal. Arabic support must not introduce an Arabic-only component tree or parallel keyboard behaviour.

## Language and direction contract

1. Use valid BCP 47 language metadata when content language is known, for example `ar`, `ar-EG` or `ar-SA`.
2. The active application locale owns the root `dir="rtl"` or `dir="ltr"` boundary. Features must not duplicate page direction state.
3. Use `dir="auto"` for isolated user-authored text whose direction is unknown until runtime and whose first strong character should determine the paragraph direction.
4. Use `<bdi>` for short interpolated identity/machine values that must not influence surrounding bidi ordering, including usernames, IDs, URLs, language codes and mixed-script labels.
5. Do not infer application direction with regex or character inspection. Direction belongs to locale/content metadata.
6. Do not routinely embed LRM/RLM control characters in translations. Prefer semantic `dir`, `<bdi>` and browser bidi isolation.

Known Arabic-language island:

```html
<section lang="ar" dir="rtl" class="text-start">
  <p>{{ 'profile.greeting' | t }}</p>
  <p><bdi>{{ userName() }}</bdi></p>
</section>
```

User-authored content with unknown direction:

```html
<p dir="auto" class="font-sans text-start break-words">
  {{ message().text }}
</p>
```

Most components should inherit `lang` and `dir` from the application shell rather than setting them locally.

## Arabic shaping and segmentation

Arabic shaping, joining, ligatures and diacritics must remain browser/font-engine owned.

- Never reverse Arabic strings or arrays to make content look RTL.
- Never replace normal Unicode Arabic with Arabic Presentation Forms.
- Never split learner text with `text.split('')`, `[...text]`, regex character loops or whitespace splitting when user-perceived word/grapheme semantics are required.
- Use `Intl.Segmenter` for word/grapheme segmentation in line with `AGENTS.md`.
- Preserve combining marks with their base characters.
- Do not wrap individual Arabic letters in independently transformed or animated elements.
- Do not apply Tailwind `tracking-*`, manual `letter-spacing`, uppercase transforms or other Latin-oriented typographic effects to Arabic language content.
- Avoid fixed line heights or fixed-height containers that can clip ascenders, descenders or vowel marks.

If a feature needs word interaction, segment for behaviour but render the original source text:

```ts
const words = [...new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)];
```

Incorrect:

```ts
const visualArabic = [...text].reverse().join('');
```

## Mixed-direction content

Arabic product surfaces commonly include Latin usernames, email addresses, URLs, numbers, timestamps and codes. Isolate those values rather than reordering text manually.

```html
<p class="text-start">
  {{ 'chat.sentBy' | t }} <bdi>{{ sender().displayName }}</bdi>
</p>
```

Data models that are inherently LTR, such as email addresses, URLs and machine tokens, can use a local LTR boundary while the surrounding label/layout remains RTL-aware:

```html
<label for="invite-code">{{ 'invite.codeLabel' | t }}</label>
<input id="invite-code" dir="ltr" class="text-start" [value]="inviteCode()" readonly />
```

Do not make all inputs LTR in an Arabic interface. Names, search, chat composition and ordinary language content should inherit the relevant language direction.

## Numbers, dates, time and currency

Formatting is locale-owned, not manually reversed.

- Use `Intl.NumberFormat` for digit grouping and locale-appropriate numeric presentation.
- Use `Intl.DateTimeFormat` for date/time order and punctuation.
- Preserve product currency rules, including dual-currency presentation where required.
- Telephone numbers, IDs and machine-readable codes can use a local LTR or isolation boundary without changing surrounding layout direction.

## Logical layout contract

The canonical rules in `docs/rtl-logical-properties-architecture.md` apply to Arabic.

Correct:

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

Direction-sensitive UI must prefer `start`/`end`, `ms`/`me`, `ps`/`pe`, `border-s`/`border-e`, `text-start`/`text-end` and CSS logical properties.

Physical coordinates are permitted only when the domain is intentionally physical and direction-independent, such as crop geometry, canvas pixels or media timelines.

Do not fix Arabic layouts with `text-right`, `float: right`, `margin-left`, `right: 0` or reversed DOM order when semantic/logical layout expresses the intent.

## Controls, overlays and icons

- Spartan controls inherit the surrounding direction. Feature code must not add separate Arabic keyboard logic.
- Menus, comboboxes, selects, popovers and dialogs align through their shared semantic start/end primitive contracts.
- Focus order follows DOM/task order, not manually reversed visual order.
- Directional icons such as Back/Next may mirror through the existing RTL-aware icon contract when the icon communicates spatial/progression direction.
- Brand marks, play/pause controls, status icons and non-directional illustrations must not be mirrored solely because the UI is RTL.
- Touch targets, loading, disabled and error semantics are identical in LTR and RTL.

## Accessibility

Direction does not replace language metadata.

- The document receives the active locale `lang`; intentional local language islands receive their own correct `lang`.
- Visible labels and accessible names remain translated through `TranslatePipe` and `I18nService`.
- `aria-label` values follow the same translation rules as visible UI copy.
- Meaningful Arabic text must not live only in CSS pseudo-content.
- Source order and semantic landmarks remain logical under RTL and at 200%/400% zoom.
- Mixed-direction identity values use semantic isolation rather than punctuation hacks that assistive technology may announce unpredictably.

## Theme, accent and responsive behaviour

Arabic surfaces use the same Relay tokens as every other script.

- Light and dark themes are both first-class.
- Dynamic per-user `primary` accent behaviour remains intact.
- No RTL-specific hardcoded product colours are allowed.
- Layout remains mobile-first from the 390px baseline.
- Arabic translation expansion must not be constrained by fixed-width/fixed-height controls.
- Use wrapping, `min-w-0` and responsive composition so long labels/content remain available at 200% and 400% zoom.

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

### Isolate mixed-direction values

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

## Prohibited patterns

- Direction-sensitive `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left` or `text-right` where a logical equivalent exists.
- Direction-sensitive `margin-left`, `margin-right`, `padding-left`, `padding-right`, `left` or `right` where a CSS logical property exists.
- JavaScript reversal of Arabic strings, token arrays or DOM item order to simulate RTL.
- Manual Arabic shaping, presentation-form substitution or feature-owned bidi algorithms.
- Character tokenisation using regex, whitespace splitting or code-point loops when word/grapheme semantics are required.
- Tailwind `tracking-*`, forced uppercase or manual letter spacing on Arabic language content.
- Raw directional control characters embedded in translation copy as a routine layout technique.
- Hardcoded Arabic or English user-facing strings in Angular templates/component code.
- Bespoke feature font-family declarations for Arabic.
- Applying `font-display` to Arabic, translated or unpredictable user content.
- A second Arabic-only Spartan/Relay component family.

## Verification contract

Run the existing structural gates from the repository root:

```bash
npm run check:rtl-logical-contract
cd frontend && npm run check:multilingual-typography
```

The RTL gate protects the global direction boundary and rejects newly introduced physical-direction patterns in changed source. The multilingual typography gate protects the universal system font stack and rejects bespoke feature font families/display-font leakage into multilingual surfaces.

Follow-up #5506 (`Spartan UI 0040`) should add the smallest focused Arabic migration verification gate rather than duplicating these existing checks. It should cover representative Relay/Spartan controls and verify:

1. root `lang`/`dir` plus local `dir="auto"`/`bdi` boundaries;
2. no direction-sensitive physical utility regression;
3. Arabic shaping survives interactive highlighting/tokenisation;
4. mixed Arabic/Latin identity, URL and number content remains isolated;
5. translated labels, focus order and accessible names remain correct;
6. light/dark and dynamic primary accent remain token-owned;
7. 390px, 200% and 400% reflow does not hide content or required actions.

A verifier should report the specific file, line and rule for structural failures. Screenshot/design-preview coverage can supplement semantic tests for light/dark, mixed-direction and high-zoom states, but screenshot approval must not replace semantic verification.

## Rollback

This document changes architecture guidance only. Reverting it requires no API, database, routing, persistence or runtime rollback.
