/**
 * VoiceBar — ChatGPT 风格语音输入栏
 * 状态: idle / listening / thinking / speaking
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Message } from '../types/chat';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface Props { onMessage: (msg: Message) => void }

export default function VoiceBar({ onMessage }: Props) {
  const [state, setState] = useState<VoiceState>('idle');
  const [bars, setBars] = useState<number[]>(Array(16).fill(0.1));

  // Simulate audio waveform when listening
  useEffect(() => {
    if (state !== 'listening') return;
    const t = setInterval(() => setBars(Array.from({length:16}, () => 0.08 + Math.random()*0.85)), 100);
    return () => clearInterval(t);
  }, [state]);

  const toggle = useCallback(() => {
    if (state === 'idle') {
      setState('listening');
      // Simulate: stop after 3s, transcribe, then respond
      setTimeout(() => {
        setState('thinking');
        setTimeout(() => {
          setState('speaking');
          onMessage({ id: `u-${Date.now()}`, role: 'user', content: '我桌子上有什么？', timestamp: Date.now() });
          setTimeout(() => {
            onMessage({ id: `a-${Date.now()}`, role: 'assistant', content: '根据摄像头画面，你的桌子上有：\n\n- **笔记本电脑**（97%）\n- **咖啡杯**（89%）\n- **键盘**（94%）\n- **手机**（82%）\n\n需要我详细描述某个物品吗？', timestamp: Date.now() });
            setState('idle');
          }, 2000);
        }, 1500);
      }, 3000);
    } else {
      setState('idle');
    }
  }, [state, onMessage]);

  return (
    <div className="shrink-0 px-4 pb-4 pt-2">
      <div className="max-w-3xl mx-auto flex items-center justify-center">
        <motion.button
          onClick={toggle}
          whileTap={{ scale: 0.92 }}
          className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg
            ${state === 'idle' ? 'bg-blue-500 hover:bg-blue-600 shadow-blue-200' :
              state === 'listening' ? 'bg-green-500 shadow-green-200 scale-110' :
              state === 'thinking' ? 'bg-purple-500 shadow-purple-200' :
              'bg-blue-400 shadow-blue-200'}`}
        >
          {state === 'listening' ? (
            <div className="flex items-center gap-[2px] h-8">
              {bars.map((h, i) => <motion.div key={i} className="w-[3px] bg-white rounded-full" animate={{ height: h*32 }} transition={{ duration:0.1 }} />)}
            </div>
          ) : state === 'thinking' ? (
            <motion.div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration:1, repeat:Infinity, ease:'linear' }} />
          ) : state === 'speaking' ? (
            <motion.div className="flex gap-1" animate={{ scale: [1, 1.1, 1] }} transition={{ duration:0.6, repeat:Infinity }}>
              {[1,2,3,2,1].map((h,i) => <div key={i} className="w-1 bg-white rounded-full" style={{height:h*8, animationDelay:`${i*0.1}s`}} />)}
            </motion.div>
          ) : (
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </motion.button>
      </div>
      <AnimatePresence>
        {state !== 'idle' && (
          <motion.p initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            className="text-center text-xs text-gray-500 mt-2 font-medium">
            {state === 'listening' ? '正在聆听...' : state === 'thinking' ? 'AI 思考中...' : '正在播放...'}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
