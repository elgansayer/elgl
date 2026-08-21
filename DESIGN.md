# HelloTalk Design System - "Relay"

Source of truth: `frontend/tailwind.config.js`, `frontend/src/styles.scss`, and
`frontend/src/app/services/theme.service.ts`. This file describes what the code actually does,
including known inconsistencies, so treat call-outs below as bugs to fix, not style choices to
preserve. Mirrored into the "HelloTalk Design System" project in Claude Design
(`foundations/tokens.html`, `components/primitives/*.html`, `screens/*.html`).

**Redesign in progress.** The palette, typography, radius, and shadow tokens below are the new
"Relay" system (Phase 1 of the redesign - see `docs/design-redesign-audit.md`). It replaces the
old dark-neon-only system with an original identity (not inspired by any other product) and
genuinely first-class light and dark themes. The "Component Primitives" section further down still
describes the _old_ structural bugs (hardcoded colours, i18n-smuggled classes) - those primitives
now render on the new token values automatically, but their structural fixes land in Phase 2.

## Design direction: the duet

HelloTalk is fundamentally about exactly two people meeting across a language gap. Instead of one
generic accent colour, the system pairs two: **Ember** (`primary`, warm coral-orange - "your
voice") and **Tide** (`secondary`, cool teal - "your exchange partner's voice"). Any screen showing
a paired relationship - a chat header, a discovery match card, a shared-streak widget - should use
the Ember/Tide pair rather than a single accent, so the pairing itself becomes recognisable across
the app. Everything else (surfaces, semantic colours, VIP gold) stays a calm, largely neutral
backdrop so the duet reads clearly against it.

## Brand Colours

All colours below except `accent` and `neon` are CSS-variable-driven (`rgb(var(--x-rgb) /
<alpha-value>)`) so they resolve to independently-designed light and dark values via the `.dark`
class `theme.service.ts` already toggles. Token _names_ are unchanged from before the redesign -
only what they resolve to changed - so no template touch was needed for this phase.

| Token                 | Light                                                                                  | Dark                  | Usage                                                                                                                                                                                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `surface-50` .. `900` | `#FFFFFF` → `#12151C`                                                                  | `#3A4152` → `#000000` | 9-step ramp; `500` is the page background (`#F6F7FA` light / `#12151C` dark, an ink-navy charcoal, not flat black)                                                                                                                                                                                                                       |
| `primary` (Ember)     | `#C65230`                                                                              | `#FF7A52`             | **Dynamic per-user** by default - `ThemeService.setPrimaryAccentColor()` overrides from `profile.primary_accent_color`. Values here are only the fallback default. "Your voice" in the duet.                                                                                                                                             |
| `secondary` (Tide)    | `#1A8478`                                                                              | `#35D6C0`             | Fixed, not per-user. "Your exchange partner's voice" in the duet.                                                                                                                                                                                                                                                                        |
| `danger`              | `#D93A3A`                                                                              | `#FF6B6B`             | **New** - was previously a no-op (`bg-danger` resolved to nothing).                                                                                                                                                                                                                                                                      |
| `success`             | `#198654`                                                                              | `#34D399`             | **New.**                                                                                                                                                                                                                                                                                                                                 |
| `warning`             | `#A16C09`                                                                              | `#F2B33D`             | **New.**                                                                                                                                                                                                                                                                                                                                 |
| `vip`                 | `#996F10`                                                                              | `#E8B84B`             | Antique gold, warmed and darkened from the old bright-amber for better on-fill contrast.                                                                                                                                                                                                                                                 |
| `on-fill`             | `#FFFFFF` (paper)                                                                      | `#12151C` (ink)       | **New.** Text sitting on a saturated fill (primary/secondary/danger/success/warning/vip buttons and badges). Flips to ink in dark mode because fills are tuned brighter there and read better with a dark label.                                                                                                                         |
| `accent`              | `#CC483C` (raspberry-ember)                                                            | `#E14F42`             | Reserved for celebratory/gift moments - distinct from the primary/secondary duet so it reads as a special occasion. `DEFAULT`/`500` are theme-aware (updated after a real Phase 4 usage needed on-fill pairing at small text sizes - a fixed hue couldn't clear 4.5:1 against both paper and ink); the `50-700` tint scale stays static. |
| `neon`                | `violet #8B6CF0` / `pink #E8578F` / `cyan #2FC6D9` / `blue #5B8DEF` / `orange #F0954A` | same (static)         | Decorative-only gamification accents (streaks, leaderboard, gift flourishes). **Not for text** - most of these fail on-fill text contrast; pair with a scrim or use as background only.                                                                                                                                                  |
| `text-primary`        | `#12151C`                                                                              | `#F3F4F7`             |                                                                                                                                                                                                                                                                                                                                          |
| `text-secondary`      | `#4A5163`                                                                              | `#B4BAC9`             |                                                                                                                                                                                                                                                                                                                                          |
| `text-muted`          | `#6B7182`                                                                              | `#7E8494`             |                                                                                                                                                                                                                                                                                                                                          |

Every pairing above was contrast-audited: all text/surface and on-fill/fill combinations clear
4.5:1 (WCAG AA) in both themes. `neon` is intentionally left as a static (non-branched) scale -
decorative/tint use, not paired with `on-fill` as a solid fill. `accent`'s `DEFAULT`/`500` became
theme-aware during Phase 4 (see below) once a real usage needed `on-fill` pairing at small text
sizes; its `50-700` tint scale stays static.

## Typography

- **Body:** stays the platform-native system-UI stack (`font-sans`), deliberately - it's what
  reliably covers every script HelloTalk's users type in (CJK, Arabic, Cyrillic, Devanagari, etc).
- **Display:** new `font-display` (`"Instrument Sans"`, self-hosted via Google Fonts import in
  `styles.scss`) for headline/numeral contexts only - streak counters, onboarding hero text,
  product-authored marketing copy. **Never** apply it to user-generated or translated content; the
  risk of a Latin-only display face silently dropping non-Latin glyphs is real for a
  language-exchange app with a global user base.
- **Base size:** 16px, unchanged.
- **Scale:** Tailwind's default `text-xs` .. `text-3xl` scale, unchanged.

## Border Radius

- **app:** 0.75rem (12px) - buttons, inputs. Tightened from 1rem; a more confident, less
  "bubble" control shape.
- **card:** 1rem (16px) - tightened from 1.25rem.
- **sheet:** 1.25rem (20px) - bottom sheets/modals, tightened from 1.5rem.
- **bubble:** 1.125rem (18px) - **new**, chat message bubbles specifically. Chat bubbles keep
  generous rounding as a genre convention distinct from generic cards.
- **pill:** 9999px - reserved for chips/pills/tags only. Buttons move to `app` in Phase 2's button
  consolidation; they're still on `rounded-pill` today via the legacy `.app-button-primary`/
  `.app-button-secondary` CSS classes pending that structural change.

## Spacing Scale

Unchanged - Tailwind's stock 0.25rem-based scale.

## Shadow & Motion

- **shadow-card:** `0 1px 2px rgb(var(--shadow-color-rgb) / 0.04), 0 4px 14px rgb(var(--shadow-color-rgb) / 0.08)`
- **shadow-lift:** `0 12px 32px rgb(var(--shadow-color-rgb) / 0.16), 0 4px 10px rgb(var(--shadow-color-rgb) / 0.08)`
- Both theme-aware via `--shadow-color-rgb` (near-ink in light mode, pure black in dark mode) -
  much softer than the old heavy black-glow shadows, and nearly invisible in dark mode by design:
  dark-mode elevation reads primarily through the surface-lightness steps and a hairline border,
  not a shadow.
- **Durations:** fast 140ms / base 180ms / slow 260ms - unchanged.
- **Easing:** `cubic-bezier(0.2, 0.8, 0.2, 1)` - unchanged.

## Component Primitives (`frontend/src/app/components/primitives/`) - pre-Phase-2 state

These structural issues are unchanged by the Phase 1 token work (colours/radii referenced via
token _names_ update automatically; hardcoded, non-token values do not) and are the Phase 2
work-list:

- **Buttons - not consolidated.** Four separate components exist side by side:
  `app-button` (variant input, hardcodes `bg-blue-600`/`bg-red-600`, `rounded-lg`),
  `app-button-primary` (correctly token-driven, still on `rounded-pill` pending the radius
  structural change above),
  `app-button-secondary` (off-token `ring-slate-400`, hover state is a no-op),
  `app-gradient-button` (hardcoded gradient, off-token `ring-purple-500`).
- **app-card:** base classes are fetched via `I18nService.translate('card.base_classes')` - CSS
  smuggled into the translation dictionary. Fix as part of the Phase 2 card rebuild.
- **app-pill:** colour is looked up via `I18nService.translate('pill.colour_' + colour)` against
  hardcoded classes in the i18n dictionary, unrelated to the new token palette. Fix as part of the
  Phase 2 pill rebuild.
- **app-scrollable-pills:** selected state hardcodes `bg-purple-600` instead of `primary`.
- **app-toast:** a second, unused `Toast` class/selector collision exists - dead code, delete in
  Phase 2, along with adding its missing spec file.
- **app-button, app-toast, app-fluency-indicator, app-lottie-player:** missing spec files -
  add in Phase 2 alongside their rebuild, per AGENTS.md §7.
- **app-language-picker:** to be rebuilt on Spartan/ui's Combobox brain in Phase 2 - it's
  functionally already a combobox.

Full findings and the complete feature inventory driving the Claude Design sync are in
`docs/design-redesign-audit.md`.

## Guidelines

1. **Light and dark are both first-class.** `ThemeService`'s existing `system`/`light`/`dark`
   toggle now has a genuinely designed palette on both sides - no more dark-mode-only mandate.
2. **Primary is per-user, not fixed** - don't hardcode a specific primary hex in new components;
   use the `primary` token so accent-colour theming keeps working.
3. **The duet** - pair `primary` (Ember, you) with `secondary` (Tide, your exchange partner) on
   any screen that shows a 1:1 relationship, rather than reaching for a single accent.
4. **`on-fill` for text on saturated backgrounds** - don't assume white text on a
   primary/secondary/danger/success/warning/vip fill; use `text-on-fill`, which flips to ink in
   dark mode where those fills are tuned brighter.
5. **Mobile-first** - design for 390px width, then scale up.
6. **Logical properties** - use `ps`/`pe`/`ms`/`me`/`border-s`/`border-e` for RTL support (this one
   is consistently followed in the codebase).
7. **Gradient buttons** - VIP/gift CTAs use a gold gradient (`app-gradient-button`), distinct from
   the primary/secondary button family.
8. **Flag indicators** - language pairs show flag emoji badges (`getLanguageFlag()` in
   `language-picker.component.ts`).
9. **No em dashes** - use hyphens or colons instead (project-wide rule, see `AGENTS.md`).
10. **Dual currency** - prices show both UKP and USD (e.g., "8 UKP / $10 USD").
