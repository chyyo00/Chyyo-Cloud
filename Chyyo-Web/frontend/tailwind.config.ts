import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#000000',
          900: '#0B0B0F',
          850: '#0E0E13',
          800: '#111114',
          700: '#1A1A20',
          600: '#24242C',
          500: '#2E2E38',
        },
        accent: {
          DEFAULT: '#0A84FF',
          soft: '#409CFF',
          glow: 'rgba(10,132,255,0.35)',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'SF Pro Display',
          'Inter',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['SF Mono', 'JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '1.75rem',
        '5xl': '2rem',
      },
      boxShadow: {
        glass: '0 8px 40px -12px rgba(0,0,0,0.55)',
        glow: '0 0 0 1px rgba(10,132,255,0.25), 0 0 24px -4px rgba(10,132,255,0.35)',
        card: '0 4px 24px -8px rgba(0,0,0,0.6)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-soft': 'pulse 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
