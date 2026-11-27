/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif']
      },
      colors: {
        graphite: '#252724',
        chalk: '#F2F2ED',
        stone: '#DADBD4',
        olive: '#68735D',
        'olive-soft': '#E7EAE2',
        'olive-hover': '#58614F',
        slate: '#7C8990',
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
