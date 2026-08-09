/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts,scss}'],
  theme: {
    extend: {
      colors: {
        surface: {
          50: '#2C2C2E',
          100: '#2C2C2C',
          200: '#1E1E1E',
          300: '#1A1A1A',
          400: '#161616',
          500: '#121212',
          600: '#0E0E0E',
          700: '#0A0A0A',
          800: '#050505',
          900: '#000000',
        },
        primary: {
          DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          dark: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          light: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: '#06B6D4', // Cyan
          dark: '#0891B2',
          light: '#22D3EE',
        },
        accent: {
          50: '#FDF2F8',
          100: '#FCE7F3',
          200: '#FBCFE8',
          300: '#F9A8D4',
          400: '#F472B6',
          500: '#EC4899', // HelloTalk pink accent
          DEFAULT: '#EC4899',
          600: '#DB2777',
          700: '#BE185D',
        },
        neon: {
          purple: '#B357EA',
          pink: '#F53561',
          cyan: '#00D387',
          blue: '#3793FF',
          orange: '#FFA102',
        },
        vip: {
          DEFAULT: '#F59E0B', // Gold/Amber
          light: '#FBBF24',
          dark: '#D97706',
        },
        text: {
          primary: '#F9FAFB',
          secondary: '#9CA3AF',
          muted: '#6B7280',
        },
      },
      borderRadius: {
        app: '1rem',
        card: '1.25rem',
        sheet: '1.5rem',
        pill: '9999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 20px rgba(0, 0, 0, 0.4)',
        lift: '0 8px 30px rgba(0, 0, 0, 0.5)',
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
  plugins: [],
};
