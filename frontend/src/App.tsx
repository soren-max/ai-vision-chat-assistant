/**
 * App Shell — ChatGPT-style Vision Agent
 *
 * Layout:
 *   Top:   Minimal Header
 *   Center: Chat Area (70%+)
 *   Bottom: Voice Input Bar
 *   Right-Top: Camera Preview (320x240)
 *   Right: Vision Drawer (collapsible)
 *   Right: Agent Drawer (collapsible)
 */

import { useState, useCallback } from 'react';
import ChatWindow from './components/ChatWindow';
import VoiceBar from './components/VoiceBar';
import CameraPreview from './components/CameraPreview';
import VisionDrawer from './components/VisionDrawer';
import AgentDrawer from './components/AgentDrawer';
import type { Message } from './types/chat';

function App() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    role: 'assistant',
    content: '👋 你好！我是 Vision Agent。打开摄像头后，我可以看到你的画面并回答你的问题。点击下方的麦克风按钮开始语音对话。',
    timestamp: Date.now(),
  }]);
  const [visionOpen, setVisionOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-[#0f172a] text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* === Header === */}
      <header className="h-12 flex items-center justify-between px-5 border-b border-gray-200 dark:border-gray-800 shrink-0 bg-white dark:bg-[#0f172a]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <span className="text-sm font-semibold">Vision Agent</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setVisionOpen(!visionOpen)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${visionOpen ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}>
            Vision
          </button>
          <button onClick={() => setAgentOpen(!agentOpen)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${agentOpen ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}>
            Agent
          </button>
        </div>
      </header>

      {/* === Main Content === */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <ChatWindow messages={messages} />
          <VoiceBar onMessage={addMessage} />
        </div>

        {/* Right Sidebar */}
        {(visionOpen || agentOpen) && (
          <aside className="w-80 shrink-0 border-l border-gray-200 dark:border-gray-800 overflow-y-auto bg-gray-50 dark:bg-[#1e293b]">
            {visionOpen && <VisionDrawer />}
            {agentOpen && <AgentDrawer />}
          </aside>
        )}
      </div>

      {/* Camera Preview (top-right corner) */}
      <div className="fixed top-14 right-5 z-40">
        <CameraPreview />
      </div>
    </div>
  );
}

export default App;
