/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          bg: 'var(--color-success-bg)',
          text: 'var(--color-success-text)',
          hover: 'var(--color-success-hover)',
          border: 'var(--color-success-border)',
          ring: 'var(--color-success-ring)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          bg: 'var(--color-danger-bg)',
          text: 'var(--color-danger-text)',
          hover: 'var(--color-danger-hover)',
          border: 'var(--color-danger-border)',
          ring: 'var(--color-danger-ring)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          bg: 'var(--color-warning-bg)',
          text: 'var(--color-warning-text)',
          hover: 'var(--color-warning-hover)',
          border: 'var(--color-warning-border)',
          ring: 'var(--color-warning-ring)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          bg: 'var(--color-info-bg)',
          text: 'var(--color-info-text)',
          hover: 'var(--color-info-hover)',
          border: 'var(--color-info-border)',
          ring: 'var(--color-info-ring)',
        },
        racing: {
          red: '#dc2626',
          green: '#16a34a',
          yellow: '#eab308',
          checkered: '#1f2937',
        },
        status: {
          pending: '#f59e0b',
          reviewed: '#3b82f6',
          finalized: '#16a34a',
          rejected: '#dc2626',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
