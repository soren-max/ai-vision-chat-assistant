/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // ============================================================
      // 🎨 Unified Dark Theme — Cursor / Linear / Claude inspired
      // ============================================================
      colors: {
        // ---- Core ----
        primary: {
          DEFAULT: '#3b82f6',   // blue-500
          50:  '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe',
          300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6',
          600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af',
          900: '#1e3a8a', 950: '#172554',
        },
        accent: {
          DEFAULT: '#22c55e',   // green-500
          50:  '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0',
          300: '#86efac', 400: '#4ade80', 500: '#22c55e',
          600: '#16a34a', 700: '#15803d', 800: '#166534',
          900: '#14532d',
        },
        warning: {
          DEFAULT: '#f59e0b',   // amber-500
          50:  '#fffbeb', 100: '#fef3c7', 200: '#fde68a',
          300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b',
          600: '#d97706', 700: '#b45309', 800: '#92400e',
          900: '#78350f',
        },
        danger: {
          DEFAULT: '#ef4444',   // red-500
          50:  '#fef2f2', 100: '#fee2e2', 200: '#fecaca',
          300: '#fca5a5', 400: '#f87171', 500: '#ef4444',
          600: '#dc2626', 700: '#b91c1c', 800: '#991b1b',
          900: '#7f1d1d',
        },

        // ---- Surface hierarchy (dark) ----
        surface: {
          DEFAULT: '#0f172a',   // deepest bg
          50:  '#f8fafc',       // light mode only
          raised: '#1e293b',    // cards / panels
          overlay: '#334155',   // hover / popovers
          border: '#475569',    // borders / dividers
          muted: '#64748b',     // secondary text
          dim: '#94a3b8',       // placeholders
        },

        // ---- Semantic aliases ----
        success: '#22c55e',
        info:    '#3b82f6',
        warn:    '#f59e0b',
        error:   '#ef4444',
      },

      // ---- Typography ----
      fontFamily: {
        sans:  ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono:  ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs':  ['10px', { lineHeight: '14px' }],
        'xs':   ['11px', { lineHeight: '16px' }],
        'sm':   ['13px', { lineHeight: '20px' }],
        'base': ['14px', { lineHeight: '22px' }],
      },

      // ---- Spacing ----
      spacing: {
        '0.5': '2px',
        '1.5': '6px',
        '2.5': '10px',
        '3.5': '14px',
        '4.5': '18px',
      },

      // ---- Border Radius ----
      borderRadius: {
        'none': '0',
        'sm':   '4px',
        'md':   '6px',
        'lg':   '8px',
        'xl':   '12px',
        '2xl':  '16px',
      },

      // ---- Shadows ----
      boxShadow: {
        'card':  '0 1px 2px 0 rgb(0 0 0 / 0.3), 0 1px 3px 0 rgb(0 0 0 / 0.2)',
        'panel': '0 4px 12px 0 rgb(0 0 0 / 0.4)',
        'glow':  '0 0 0 1px rgba(59,130,246,0.2), 0 0 12px rgba(59,130,246,0.1)',
        'glow-green': '0 0 0 1px rgba(34,197,94,0.2), 0 0 12px rgba(34,197,94,0.1)',
      },

      // ---- Animations ----
      animation: {
        'fade-in':    'fade-in 0.2s ease-out',
        'slide-up':   'slide-up 0.25s ease-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'scan-line':  'scan-line 3s linear infinite',
        'bounce-dot': 'bounce-dot 0.6s ease-in-out infinite',
      },
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 6px rgba(59,130,246,0.25)' },
          '50%':      { boxShadow: '0 0 16px rgba(59,130,246,0.5)' },
        },
        'scan-line': {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'bounce-dot': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [],
};
