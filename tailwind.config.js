/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif']
      },
      colors: {
        ivory: '#F7F3ED',
        sand: '#E6D9C9',
        taupe: '#B28B70',
        mocha: '#755846',
        ink: '#28231F',
        bg: 'rgb(var(--rgb-background) / <alpha-value>)',
        surface: 'rgb(var(--rgb-surface) / <alpha-value>)',
        surfaceElevated: 'rgb(var(--rgb-surface-elevated) / <alpha-value>)',
        surfaceSecondary: 'rgb(var(--rgb-surface-secondary) / <alpha-value>)',
        border: 'rgb(var(--rgb-border) / <alpha-value>)',
        textPrimary: 'rgb(var(--rgb-text) / <alpha-value>)',
        textSecondary: 'rgb(var(--rgb-text-secondary) / <alpha-value>)',
        primary: 'rgb(var(--rgb-primary) / <alpha-value>)',
        primaryHover: 'rgb(var(--rgb-primary-hover) / <alpha-value>)',
        primaryText: 'rgb(var(--rgb-primary-text) / <alpha-value>)',
        accent: 'rgb(var(--rgb-accent) / <alpha-value>)',
        success: 'rgb(var(--rgb-success) / <alpha-value>)',
        warning: 'rgb(var(--rgb-warning) / <alpha-value>)',
        error: 'rgb(var(--rgb-error) / <alpha-value>)',
        info: 'rgb(var(--rgb-info) / <alpha-value>)'
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        sheet: 'var(--shadow-sheet)'
      },
      transitionDuration: {
        fast: '150ms',
        normal: '220ms',
        slow: '300ms'
      }
    }
  },
  plugins: []
};
