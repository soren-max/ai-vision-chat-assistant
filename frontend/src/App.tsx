/**
 * App Shell — ChatGPT-style Vision Agent
 */

import { useState, useCallback, useEffect } from 'react';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import CameraPreview from './components/CameraPreview';
import VisionDrawer from './components/VisionDrawer';
import AgentDrawer from './components/AgentDrawer';
import { MOCK_SCENES } from './components/CameraPanel';
import type { Message } from './types/chat';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    role: 'assistant',
    content: '👋 你好！我是 Vision Agent。打开摄像头后，我可以看到你的画面并回答你的问题。',
    timestamp: Date.now(),
  }]);
  const [visionOpen, setVisionOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [sceneIdx, setSceneIdx] = useState(0);

  // Cycle mock scenes
  useEffect(() => {
    const t = setInterval(() => setSceneIdx(i => (i + 1) % MOCK_SCENES.length), 4000);
    return () => clearInterval(t);
  }, []);

  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  // Build vision data from current scene
  const currentScene = MOCK_SCENES[sceneIdx] || {};
  const visionData = {
    objects: Object.values(currentScene).map(o => `${o.label}(${Math.round(o.confidence*100)}%)`),
    scene: 'office',
    timestamp: Date.now(),
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-[#0f172a] text-gray-900 dark:text-gray-100 overflow-hidden">
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
            className={`px-3 py-1 text-xs rounded-md transition-colors ${visionOpen ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}>Vision</button>
          <button onClick={() => setAgentOpen(!agentOpen)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${agentOpen ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}>Agent</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0">
          <ChatWindow messages={messages} />
          <ChatInput onMessage={addMessage} visionData={visionData} />
        </div>
        {(visionOpen || agentOpen) && (
          <aside className="w-80 shrink-0 border-l border-gray-200 dark:border-gray-800 overflow-y-auto bg-gray-50 dark:bg-[#1e293b]">
            {visionOpen && <VisionDrawer />}
            {agentOpen && <AgentDrawer />}
          </aside>
        )}
      </div>

      <div className="fixed top-14 right-5 z-40">
        <CameraPreview />
      </div>
    </div>
  );
}
