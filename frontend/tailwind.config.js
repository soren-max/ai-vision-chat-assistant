/** @type {import('tailwindcss').Config} */
export default {
  // 扫描所有 JSX/TSX 文件以提取 Tailwind 类名
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 自定义主题色 - 深色 AI 风格
      colors: {
        'ai-primary': '#6366f1',     // indigo-500 主色调
        'ai-secondary': '#8b5cf6',   // violet-500 辅助色
        'ai-accent': '#06b6d4',      // cyan-500 强调色
        'ai-bg': '#0f172a',          // slate-900 背景
        'ai-surface': '#1e293b',     // slate-800 卡片背景
        'ai-border': '#334155',      // slate-700 边框
      },
    },
  },
  plugins: [],
};
