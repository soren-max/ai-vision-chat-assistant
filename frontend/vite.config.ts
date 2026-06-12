import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // 开发服务器配置
  server: {
    port: 5173,               // 前端开发端口
    host: '0.0.0.0',          // 允许局域网访问
    // 代理后端 API 请求，解决跨域问题
    proxy: {
      '/api': {
        target: 'http://localhost:8000',   // 后端 FastAPI 地址
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',     // WebSocket 代理
        ws: true,
      },
    },
  },

  // 构建配置
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
