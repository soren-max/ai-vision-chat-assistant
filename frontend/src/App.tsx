/**
 * App Shell — ChatGPT-style Vision Agent
 */

import { useState, useCallback } from 'react';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import CameraPreview from './components/CameraPreview';
import VisionDrawer from './components/VisionDrawer';
import AgentDrawer from './components/AgentDrawer';
import type { Message } from './types/chat';

export interface VisionObject {
  name: string;
  confidence: number;
  position?: string;
}

export interface VisionContext {
  scene: string;
  summary: string;
  objects: VisionObject[];
  people: Array<Record<string, unknown>>;
  screen_content: string;
  risk_content: string[];
  updatedAt: number | null;
  source: 'camera' | 'idle' | 'error';
}

const EMPTY_VISION: VisionContext = {
  scene: '',
  summary: '',
  objects: [],
  people: [],
  screen_content: '',
  risk_content: [],
  updatedAt: null,
  source: 'idle',
};

function buildVisionContextText(vision: VisionContext): string {
  if (vision.source !== 'camera' || !vision.updatedAt) {
    return '摄像头尚未提供可用画面。';
  }

  const objectText = vision.objects.length
    ? vision.objects
        .map((obj) => {
          const confidence = Math.round(obj.confidence * 100);
          const position = obj.position ? `，位置：${obj.position}` : '';
          return `${obj.name}（${confidence}%${position}）`;
        })
        .join('；')
    : '暂未识别到明确物体';

  return [
    vision.summary ? `摘要：${vision.summary}` : '',
    vision.scene ? `场景：${vision.scene}` : '',
    `物体：${objectText}`,
    vision.screen_content ? `屏幕内容：${vision.screen_content}` : '',
    vision.risk_content.length ? `风险提示：${vision.risk_content.join('；')}` : '',
  ].filter(Boolean).join('\n');
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    role: 'assistant',
    content: '你好，我是 Vision Agent。打开摄像头和麦克风后，我会结合实时画面与语音问题回答你。',
    timestamp: Date.now(),
  }]);
  const [visionOpen, setVisionOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [vision, setVision] = useState<VisionContext>(EMPTY_VISION);
  const [agentPhase, setAgentPhase] = useState('idle');

  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const visionData = {
    objects: vision.objects.map(o => o.name),
    scene: vision.scene,
    summary: vision.summary,
    screen_content: vision.screen_content,
    risk_content: vision.risk_content,
    timestamp: vision.updatedAt,
  };
  const visionContext = buildVisionContextText(vision);

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
          <ChatInput
            onMessage={addMessage}
            visionData={visionData}
            visionContext={visionContext}
            onAgentPhase={setAgentPhase}
          />
        </div>
        {(visionOpen || agentOpen) && (
          <aside className="w-80 shrink-0 border-l border-gray-200 dark:border-gray-800 overflow-y-auto bg-gray-50 dark:bg-[#1e293b]">
            {visionOpen && <VisionDrawer vision={vision} />}
            {agentOpen && <AgentDrawer phase={agentPhase} vision={vision} />}
          </aside>
        )}
      </div>

      <div className="fixed top-14 right-5 z-40">
        <CameraPreview onVisionUpdate={setVision} />
      </div>
    </div>
  );
}
