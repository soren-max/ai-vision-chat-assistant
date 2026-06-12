/**
 * useTTS — 文字转语音播放 Hook
 *
 * 功能:
 * - 发送文本到 POST /api/tts，获取 MP3 音频
 * - 自动播放
 * - 打断（停止当前播放，开始新的）
 * - 重复播放
 * - 播放状态管理（idle / loading / playing / paused / done / error）
 * - 中英文混合语音支持
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ============================================================
// 类型
// ============================================================

export type TTSStatus =
  | 'idle'        // 空闲
  | 'loading'    // 正在请求 TTS 服务
  | 'playing'     // 正在播放
  | 'paused'      // 暂停
  | 'done';       // 播放完毕

export interface UseTTSReturn {
  /** 当前播放状态 */
  status: TTSStatus;
  /** 错误信息 */
  error: string | null;
  /** 是否正在播放 */
  isPlaying: boolean;

  /** 播放文本（自动打断当前播放） */
  speak: (text: string) => Promise<void>;
  /** 暂停播放 */
  pause: () => void;
  /** 恢复播放 */
  resume: () => void;
  /** 停止播放 */
  stop: () => void;
  /** 重播上一次文本 */
  replay: () => void;
  /** 切换语音 */
  setVoice: (voice: string) => void;
  /** 当前语音 */
  currentVoice: string;
}

// ============================================================
// 配置
// ============================================================

const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';

// ============================================================
// Hook
// ============================================================

export function useTTS(): UseTTSReturn {
  const [status, setStatus] = useState<TTSStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [voice, setVoice] = useState(DEFAULT_VOICE);

  // Refs —— 不需要触发重渲染
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTextRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // ---- 创建/获取 Audio 元素 ----
  const getAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';

      // 播放结束事件
      audioRef.current.onended = () => {
        setStatus('done');
      };

      // 播放错误
      audioRef.current.onerror = () => {
        setError('音频播放失败');
        setStatus('done');
      };
    }
    return audioRef.current;
  }, []);

  // ---- 核心方法：播放 ----

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // 打断当前播放（先中断请求，再停止播放）
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const audio = getAudio();
      audio.pause();

      // 保存文本供重播
      lastTextRef.current = text;
      setError(null);
      setStatus('loading');

      // 创建新的 AbortController
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voice,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(
            (err as { detail?: string }).detail || `HTTP ${response.status}`,
          );
        }

        // 获取音频 blob
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        // 设置音频源并播放
        const oldUrl = audio.src;
        audio.src = url;
        audio.load();

        // 播放
        await audio.play();
        setStatus('playing');

        // 清理旧 URL（延迟以避免播放中断）
        if (oldUrl && oldUrl.startsWith('blob:')) {
          setTimeout(() => URL.revokeObjectURL(oldUrl), 1000);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // 被打断，正常情况，不报错
          return;
        }
        const msg = err instanceof Error ? err.message : 'TTS 请求失败';
        setError(msg);
        setStatus('idle');
      }
    },
    [voice, getAudio],
  );

  // ---- 打断 ----

  const stop = useCallback(() => {
    // 中断进行中的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 停止播放
    const audio = getAudio();
    audio.pause();
    audio.currentTime = 0;

    setStatus('idle');
  }, [getAudio]);

  // ---- 暂停 ----

  const pause = useCallback(() => {
    const audio = getAudio();
    if (!audio.paused) {
      audio.pause();
      setStatus('paused');
    }
  }, [getAudio]);

  // ---- 恢复 ----

  const resume = useCallback(async () => {
    const audio = getAudio();
    if (audio.src && audio.paused) {
      try {
        await audio.play();
        setStatus('playing');
      } catch {
        setError('恢复播放失败');
      }
    }
  }, [getAudio]);

  // ---- 重播 ----

  const replay = useCallback(() => {
    const text = lastTextRef.current;
    if (text) {
      speak(text);
    }
  }, [speak]);

  // ---- 语音切换 ----

  const changeVoice = useCallback((newVoice: string) => {
    setVoice(newVoice);
  }, []);

  // ---- 清理 ----

  useEffect(() => {
    return () => {
      // 组件卸载时清理
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        audioRef.current = null;
      }
    };
  }, []);

  return {
    status,
    error,
    isPlaying: status === 'playing',
    speak,
    pause,
    resume,
    stop,
    replay,
    setVoice: changeVoice,
    currentVoice: voice,
  };
}
