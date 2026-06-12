/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // 主色调 — 冷峻紫蓝
        'brand': {
          50: '#f0f0ff', 100: '#e0e0ff', 200: '#c4c4ff',
          300: '#9d9dff', 400: '#7c7cff', 500: '#6c5ce7',
          600: '#5a4bd1', 700: '#4a3db5', 800: '#3c3194',
          900: '#2d256e',
        },
        // 表面层级
        'surface': {
          DEFAULT: '#0d1117',    // 最深背景 (GitHub dark)
          'raised': '#161b22',   // 卡片
          'overlay': '#21262d',  // 悬浮层
          'border': '#30363d',   // 边框
        },
        // 语义色
        'accent': {
          'green': '#3fb950',
          'red': '#f85149',
          'orange': '#d29922',
          'blue': '#58a6ff',
          'purple': '#a371f7',
          'cyan': '#39d2c0',
        },
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'scan-line': 'scan-line 3s linear infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(108, 92, 231, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(108, 92, 231, 0.6)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      borderRadius: {
        'sm': '4px',
        'md': '6px',
        'lg': '8px',
      },
    },
  },
  plugins: [],
};
