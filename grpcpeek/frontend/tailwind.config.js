import defaultTheme from 'tailwindcss/defaultTheme.js'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        muted: 'var(--color-muted)',
        'muted-foreground': 'var(--color-muted-foreground)',
        border: 'var(--color-border)',
        surface: 'var(--color-surface)',
        'surface-muted': 'var(--color-surface-muted)',
        'surface-emphasis': 'var(--color-surface-emphasis)',
        'surface-contrast': 'var(--color-surface-contrast)',
        accent: 'var(--color-accent)',
        'accent-contrast': 'var(--color-accent-contrast)',
        focus: 'var(--color-focus)',
        danger: 'var(--color-danger)',
      },
      fontFamily: {
        sans: ['"Inter"', ...defaultTheme.fontFamily.sans],
        mono: ['"JetBrains Mono"', ...defaultTheme.fontFamily.mono],
      },
      boxShadow: {
        soft: '0 12px 32px -20px rgba(15, 23, 42, 0.25)',
        'soft-lg': '0 24px 52px -26px rgba(15, 23, 42, 0.28)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
      },
      transitionTimingFunction: {
        brand: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        brand: '160ms',
      },
    },
  },
  plugins: [],
}
