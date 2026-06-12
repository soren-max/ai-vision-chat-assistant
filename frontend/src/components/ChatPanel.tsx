/**
 * ChatPanel — 对话面板
 *
 * 设计: Cursor/ChatGPT Voice 风格
 * - 消息气泡左对齐 (AI) / 右对齐 (User)
 * - Developer-style: monospace 代码片段, 简练文本
 * - 底部输入栏: 语音 + 文本 + 发送
 */

import { useRef, useEffect, useState, useCallback } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([{
    id: '0',
    role: 'assistant',
    content: 'Vision Agent Assistant ready.\n\nTry:\n• `start camera` to begin visual analysis\n• `record` to speak a question\n• ask about what I see',
    timestamp: Date.now(),
  }]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    const msg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(p => [...p, msg]);
    setInput('');
    // Simulate AI response
    setTimeout(() => {
      setMessages(p => [...p, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `> Processing: "${text}"\n\nAnalyzing...`,
        timestamp: Date.now(),
      }]);
    }, 600);
  }, [input]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <div className={`max-w-[75%] px-4 py-3 rounded-md text-[13px] leading-relaxed
              ${msg.role === 'user'
                ? 'bg-brand-600/20 border border-brand-500/20 text-gray-200'
                : 'bg-surface-overlay border border-surface-border text-gray-300 font-mono'}
            `}>
              {msg.content.split('\n').map((line, i) => {
                // Code inline
                if (line.startsWith('`') && line.endsWith('`')) {
                  return <code key={i} className="text-accent-cyan text-[12px]">{line.replace(/`/g, '')}</code>;
                }
                // Blockquote
                if (line.startsWith('> ')) {
                  return <div key={i} className="text-gray-500 border-l-2 border-brand-500/30 pl-2 my-1">{line.slice(2)}</div>;
                }
                return <div key={i}>{line || '\u00A0'}</div>;
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="shrink-0 px-6 pb-4">
        <div className="flex items-end gap-2 p-2 bg-surface-raised border border-surface-border rounded-md focus-within:border-brand-500/30 transition-colors">
          {/* Voice button */}
          <button className="btn-ghost p-2 text-gray-500 hover:text-accent-green" title="Record">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>

          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about the scene..."
            rows={1}
            className="flex-1 bg-transparent text-[13px] text-gray-200 placeholder-gray-600
                       resize-none outline-none font-mono py-1"
          />

          <button onClick={send} disabled={!input.trim()}
            className="btn-ghost p-2 text-gray-500 hover:text-brand-400 disabled:opacity-30"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatPanel;
