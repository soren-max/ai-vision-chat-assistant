/**
 * ChatInput — ChatGPT 风格输入栏
 *
 * 布局:
 * | [🎤] | 输入消息...               | [发送] |
 *
 * Enter 发送, Shift+Enter 换行
 */

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Message } from '../types/chat';

interface Props {
  onMessage: (msg: Message) => void;
  visionData: Record<string, unknown>;
}

export default function ChatInput({ onMessage, visionData }: Props) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    // Add user message
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text, timestamp: Date.now() };
    onMessage(userMsg);
    setInput('');
    setSending(true);

    // === DEBUG LOGS ===
    console.log('用户消息:', text);
    console.log('Vision Context:', visionData);

    const body = { message: text, vision_context: visionData };
    console.log('Request Body:', body);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const reply = data.reply || 'No reply';

      onMessage({ id: `a-${Date.now()}`, role: 'assistant', content: reply, timestamp: Date.now() });
    } catch (e) {
      onMessage({ id: `e-${Date.now()}`, role: 'assistant', content: `网络错误: ${e}`, timestamp: Date.now() });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="shrink-0 px-4 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm focus-within:border-blue-400 dark:focus-within:border-blue-500 transition-colors">
          {/* Mic button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center shrink-0 text-white shadow"
            title="语音输入"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </motion.button>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="输入消息..."
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none py-2 text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />

          {/* Send button */}
          <motion.button
            onClick={send}
            disabled={!input.trim() || sending}
            whileTap={{ scale: 0.9 }}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
              input.trim() && !sending
                ? 'bg-blue-500 text-white shadow hover:bg-blue-600'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
            }`}
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
