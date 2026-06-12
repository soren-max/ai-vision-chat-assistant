/**
 * App 根组件
 * 
 * AI Vision Chat Assistant 主应用入口
 * 采用前后端分离架构，前端负责摄像头/麦克风采集与 UI 展示，
 * 后端负责 AI 推理（DeepSeek-V4-Pro、Whisper STT、TTS）。
 */

import VisionChatPage from './pages/VisionChatPage';

function App() {
  return (
    <div className="min-h-screen bg-ai-bg flex flex-col">
      {/* 应用头部 */}
      <header className="px-6 py-4 border-b border-ai-border">
        <h1 className="text-xl font-bold text-white">
          🎯 AI Vision Chat Assistant
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          视觉语音对话助手 — 开启摄像头与麦克风，与 AI 实时交流
        </p>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1">
        <VisionChatPage />
      </main>

      {/* 底部信息 */}
      <footer className="px-6 py-3 text-center text-xs text-gray-500 border-t border-ai-border">
        Powered by DeepSeek-V4-Pro · Whisper · TTS
      </footer>
    </div>
  );
}

export default App;
