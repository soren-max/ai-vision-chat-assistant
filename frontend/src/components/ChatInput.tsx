/**
 * ChatInput — ChatGPT 风格输入栏
 *
 * 布局:
 * | [🎤] | 输入消息...               | [发送] |
 *
 * Enter 发送, Shift+Enter 换行
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Message } from '../types/chat';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useTTS } from '../hooks/useTTS';

interface Props {
  onMessage: (msg: Message) => void;
  visionData: Record<string, unknown>;
  visionContext: string;
  onAgentPhase?: (phase: string) => void;
}

export default function ChatInput({ onMessage, visionData, visionContext, onAgentPhase }: Props) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [transcript, setTranscript] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef(`web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const tts = useTTS();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const visionSummary = useMemo(() => {
    const objects = Array.isArray(visionData.objects) ? visionData.objects : [];
    if (objects.length > 0) return `${objects.length} objects`;
    return visionData.timestamp ? 'scene ready' : 'no scene';
  }, [visionData]);

  const sendText = useCallback(async (rawText: string, source: 'text' | 'voice' = 'text') => {
    const text = rawText.trim();
    if (!text || sending) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: source === 'voice' ? `${text}` : text,
      timestamp: Date.now(),
    };
    onMessage(userMsg);
    setInput('');
    setSending(true);
    onAgentPhase?.('planning');

    const thinkingId = `think-${Date.now()}`;
    onMessage({
      id: thinkingId,
      role: 'thinking',
      content: [
        `输入来源: ${source === 'voice' ? '语音识别' : '文字输入'}`,
        `视觉上下文: ${visionSummary}`,
        '策略: 复用最近一次视觉分析，必要时由用户手动刷新画面',
      ].join('\n'),
      thinkingLabel: '多模态理解中',
      timestamp: Date.now(),
    });

    const startedAt = performance.now();

    try {
      onAgentPhase?.('reasoning');
      const res = await fetch('/api/multimodal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          user_text: text,
          vision_context: visionContext,
        }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const reply = data.reply || '我没有拿到有效回复。';
      const latency = Math.round(performance.now() - startedAt);

      onMessage({
        id: `tool-${Date.now()}`,
        role: 'tool_call',
        content: 'multimodal_chat',
        toolName: 'vision+voice',
        toolLatency: latency,
        timestamp: Date.now(),
      });
      onAgentPhase?.('responding');
      onMessage({ id: `a-${Date.now()}`, role: 'assistant', content: reply, timestamp: Date.now() });

      if (voiceEnabled) {
        await tts.speak(reply);
      }
      onAgentPhase?.('done');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      onAgentPhase?.('error');
      onMessage({
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: `我暂时无法完成这次云端对话：${message}\n\n你可以检查后端服务和 API Key，或稍后重试。`,
        timestamp: Date.now(),
      });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [onAgentPhase, onMessage, sending, tts, visionContext, visionSummary, voiceEnabled]);

  const {
    recorderStatus,
    volumeLevel,
    durationSec,
    startRecording,
    stopRecording,
    errorMessage,
  } = useAudioRecorder({
    onUpload: async (wavBlob: Blob) => {
      const formData = new FormData();
      formData.append('file', wavBlob, 'voice.wav');
      formData.append('language', 'zh');
      formData.append('prompt', 'AI 视觉对话助手，摄像头，画面，物体，场景');

      const response = await fetch('/api/stt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail || `STT HTTP ${response.status}`);
      }

      const data = await response.json();
      const text = String(data.text || '').trim();
      setTranscript(text);

      if (text) {
        await sendText(text, 'voice');
      } else {
        onMessage({
          id: `stt-empty-${Date.now()}`,
          role: 'assistant',
          content: data.message || '没有识别到有效语音，请靠近麦克风再试一次。',
          timestamp: Date.now(),
        });
      }
    },
    onError: (message) => {
      onMessage({
        id: `mic-error-${Date.now()}`,
        role: 'assistant',
        content: `麦克风不可用：${message}`,
        timestamp: Date.now(),
      });
    },
  });

  const send = useCallback(() => {
    sendText(input, 'text');
  }, [input, sendText]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const isRecording = recorderStatus === 'recording';
  const isMicBusy = ['requesting', 'stopping', 'uploading'].includes(recorderStatus);
  const micLevel = Math.min(1, volumeLevel * 8);

  const handleMic = () => {
    if (isRecording) stopRecording();
    else if (!isMicBusy && !sending) startRecording();
  };

  return (
    <div className="shrink-0 px-4 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        <div className="mb-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full ${visionData.timestamp ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="truncate">Vision: {visionSummary}</span>
            {transcript && <span className="hidden sm:inline truncate">Last voice: {transcript}</span>}
          </div>
          <button
            onClick={() => {
              if (voiceEnabled) tts.stop();
              setVoiceEnabled(v => !v);
            }}
            className={`px-2 py-1 rounded-md border transition-colors ${voiceEnabled ? 'border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300' : 'border-gray-200 dark:border-gray-700'}`}
            title="切换自动语音播报"
          >
            {voiceEnabled ? (tts.status === 'playing' ? 'speaking' : 'voice on') : 'voice off'}
          </button>
        </div>

        <div className="flex items-end gap-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm focus-within:border-blue-400 dark:focus-within:border-blue-500 transition-colors">
          {/* Mic button */}
          <motion.button
            onClick={handleMic}
            disabled={isMicBusy || sending}
            whileTap={{ scale: 0.9 }}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white shadow transition-colors disabled:opacity-50 ${
              isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
            }`}
            title={isRecording ? '停止录音' : '语音输入'}
          >
            {isRecording && (
              <span
                className="absolute inset-0 rounded-full bg-red-400/40"
                style={{ transform: `scale(${1 + micLevel * 0.45})` }}
              />
            )}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isRecording ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 8h8v8H8z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              )}
            </svg>
          </motion.button>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isRecording ? `正在听你说话... ${durationSec.toFixed(1)}s` : '输入消息，或点击麦克风直接提问...'}
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
        {(errorMessage || tts.error) && (
          <div className="mt-2 text-[11px] text-red-500">
            {errorMessage || tts.error}
          </div>
        )}
      </div>
    </div>
  );
}
