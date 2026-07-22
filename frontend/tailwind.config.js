/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts,scss}"
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#FFFFFF',
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0'
        },
        primary: {
          DEFAULT: '#3B82F6',
          dark: '#2563EB',
          light: '#60A5FA'
        },
        secondary: {
          DEFAULT: '#10B981',
          dark: '#059669',
          light: '#34D399'
        }
      },
      borderRadius: {
        app: '1rem',
        card: '1.25rem',
        sheet: '1.5rem'
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 20px rgba(15, 23, 42, 0.06)',
        lift: '0 8px 30px rgba(15, 23, 42, 0.12)'
      },
      transitionTimingFunction: {
        app: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
      },
      transitionDuration: {
        fast: '140ms',
        base: '180ms',
        slow: '260ms'
      }
    },
  },
  plugins: [],
}
