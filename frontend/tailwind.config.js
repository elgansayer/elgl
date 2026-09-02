const plugin = require('tailwindcss/plugin');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts,scss}'],
  theme: {
    extend: {
      colors: {
        // "Relay" design system. Every colour below (except accent/neon, which
        // stay static tint scales) is CSS-var-driven so it resolves to an
        // independently-designed light or dark value via the `.dark` class
        // toggle already wired up in theme.service.ts. See styles.scss for
        // the :root / .dark var blocks and docs/design-redesign-audit.md for
        // the full rationale.
        surface: {
          50: 'rgb(var(--surface-50-rgb) / <alpha-value>)',
          100: 'rgb(var(--surface-100-rgb) / <alpha-value>)',
          200: 'rgb(var(--surface-200-rgb) / <alpha-value>)',
          300: 'rgb(var(--surface-300-rgb) / <alpha-value>)',
          400: 'rgb(var(--surface-400-rgb) / <alpha-value>)',
          500: 'rgb(var(--surface-500-rgb) / <alpha-value>)',
          600: 'rgb(var(--surface-600-rgb) / <alpha-value>)',
          700: 'rgb(var(--surface-700-rgb) / <alpha-value>)',
          800: 'rgb(var(--surface-800-rgb) / <alpha-value>)',
          900: 'rgb(var(--surface-900-rgb) / <alpha-value>)',
        },
        // "Ember" - your voice. Per-user dynamic (ThemeService overrides the
        // CSS var from profile.primary_accent_color); the value here is only
        // the fallback default, themed light/dark like everything else.
        primary: {
          DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          dark: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          light: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
        },
        // "Tide" - your exchange partner's voice. Fixed (not per-user), the
        // other half of the duet used anywhere a screen shows two paired
        // people (chat header, discovery match card, shared-streak widget).
        secondary: {
          DEFAULT: 'rgb(var(--color-secondary-rgb) / <alpha-value>)',
          dark: 'rgb(var(--color-secondary-rgb) / <alpha-value>)',
          light: 'rgb(var(--color-secondary-rgb) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--color-danger-rgb) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--color-success-rgb) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--color-warning-rgb) / <alpha-value>)',
        },
        vip: {
          DEFAULT: 'rgb(var(--color-vip-rgb) / <alpha-value>)',
          light: 'rgb(var(--color-vip-rgb) / <alpha-value>)',
          dark: 'rgb(var(--color-vip-rgb) / <alpha-value>)',
        },
        // Text sitting directly on a saturated fill (primary/secondary/
        // danger/success/warning/vip buttons and badges). Resolves to paper
        // (near-white) in light mode and ink (near-black) in dark mode,
        // because the fills themselves are tuned brighter in dark mode and
        // read better with a dark label there than a white one.
        'on-fill': {
          DEFAULT: 'rgb(var(--on-fill-rgb) / <alpha-value>)',
        },
        // Reserved for celebratory/gift moments (VIP CTAs, gift cards) -
        // distinct from the primary/secondary duet so it reads as a special
        // occasion, not the everyday accent. DEFAULT/500 (the only shades
        // ever used as a solid fill with on-fill text) are theme-aware like
        // the other semantic tokens - a fixed hue can't clear 4.5:1 against
        // both paper and ink at small text sizes simultaneously. The 50-700
        // tint scale stays static (light-background tints, not solid fills).
        accent: {
          50: '#FFF1F0',
          100: '#FFE1DE',
          200: '#FFC3BD',
          300: '#FF9A8F',
          400: '#F96F60',
          500: 'rgb(var(--color-accent-rgb) / <alpha-value>)',
          DEFAULT: 'rgb(var(--color-accent-rgb) / <alpha-value>)',
          600: '#C23A2F',
          700: '#9C2C23',
        },
        // Decorative-only gamification accents (streaks, leaderboard,
        // confetti/gift flourishes). Not for text - see docs/design-
        // redesign-audit.md usage note. Desaturated slightly from the old
        // "neon" set so they sit inside the Relay palette instead of
        // clashing with it.
        neon: {
          violet: '#8B6CF0',
          pink: '#E8578F',
          cyan: '#2FC6D9',
          blue: '#5B8DEF',
          orange: '#F0954A',
        },
        text: {
          primary: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
          muted: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        },
      },
      fontFamily: {
        // Body stays the platform-native stack deliberately - it's what
        // reliably covers every script HelloTalk's users type in (CJK,
        // Arabic, Cyrillic, Devanagari, etc). Never apply `font-display` to
        // user-generated or translated content, only to guaranteed-Latin
        // product copy (headlines, streak numerals, onboarding).
        display: [
          '"Instrument Sans"',
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
      },
      borderRadius: {
        app: '0.75rem', // controls: buttons, inputs - confident, not bubble-heavy
        card: '1rem',
        sheet: '1.25rem', // modals / bottom sheets
        bubble: '1.125rem', // chat message bubbles - the one place generous rounding stays a genre convention
        pill: '9999px', // reserved for chips/pills/tags only, not buttons
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow-color-rgb) / 0.04), 0 4px 14px rgb(var(--shadow-color-rgb) / 0.08)',
        lift: '0 12px 32px rgb(var(--shadow-color-rgb) / 0.16), 0 4px 10px rgb(var(--shadow-color-rgb) / 0.08)',
      },
      transitionTimingFunction: {
        app: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionDuration: {
        fast: '140ms',
        base: '180ms',
        slow: '260ms',
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.pt-safe': {
          paddingTop: 'env(safe-area-inset-top)',
        },
        '.pb-safe': {
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
        '.pl-safe': {
          paddingLeft: 'env(safe-area-inset-left)',
        },
        '.pr-safe': {
          paddingRight: 'env(safe-area-inset-right)',
        },
      });
    }),
  ],
};
