/**
 * App Shell — Vision Agent Assistant
 *
 * 三栏布局:
 *   Left   (280px): Camera + Scene Analysis
 *   Center (flex-1): Chat
 *   Right  (320px): Agent Status + Tools + Cost
 */

import { useState } from 'react';
import VisionChatPage from './pages/VisionChatPage';

function App() {
  const [version] = useState('v2.0.0');

  return (
    <div className="h-screen flex flex-col bg-surface text-gray-200 overflow-hidden">
      {/* === Top Bar === */}
      <header className="h-11 flex items-center justify-between px-4 bg-surface-raised border-b border-surface-border select-none shrink-0">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-sm bg-brand-600 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold tracking-tight text-white">
              Vision Agent
            </span>
            <span className="badge-purple text-[10px]">{version}</span>
          </div>
          {/* Divider */}
          <span className="w-px h-4 bg-surface-border" />
          {/* Connection status */}
          <span className="flex items-center gap-1.5 text-[11px] text-gray-500 font-mono">
            <span className="dot-green" />
            connected
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button className="btn-ghost text-[11px] px-3 py-1 font-mono">⌘K</button>
          <button className="btn-ghost text-[11px] px-3 py-1">
            <span className="dot-purple" /> Agent Online
          </button>
        </div>
      </header>

      {/* === Main Content === */}
      <main className="flex-1 flex overflow-hidden">
        <VisionChatPage />
      </main>

      {/* === Status Bar === */}
      <footer className="h-6 flex items-center justify-between px-4 bg-surface-overlay border-t border-surface-border text-[11px] text-gray-600 font-mono shrink-0 select-none">
        <div className="flex items-center gap-4">
          <span>DeepSeek-V4-Pro</span>
          <span className="w-px h-3 bg-surface-border" />
          <span>recording: 00:00</span>
        </div>
        <div className="flex items-center gap-4">
          <span>tokens: 1,247</span>
          <span className="w-px h-3 bg-surface-border" />
          <span>cost: $0.02</span>
          <span className="w-px h-3 bg-surface-border" />
          <span>latency: 234ms</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
