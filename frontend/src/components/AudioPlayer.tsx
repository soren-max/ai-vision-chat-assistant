/**
 * AudioPlayer — AI 语音播报组件
 *
 * 功能:
 * - 接收 AI 回复文本后自动调用 TTS 播放
 * - 播放状态可视化（波形动画 / 加载指示器）
 * - 控制：停止（打断）、重播
 * - 中英文混合语音
 * - 错误状态显示
 */

import { useCallback } from 'react';
import { useTTS } from '../hooks/useTTS';
import type { TTSStatus } from '../hooks/useTTS';

// ============================================================
// 状态文案映射
// ============================================================

const STATUS_ICONS: Record<TTSStatus, string> = {
  idle: '🔇',
  loading: '⏳',
  playing: '🔊',
  paused: '⏸️',
  done: '✅',
};

const STATUS_LABELS: Record<TTSStatus, string> = {
  idle: '待播报',
  loading: '合成中...',
  playing: '播放中',
  paused: '已暂停',
  done: '播放完毕',
};

// ============================================================
// Props
// ============================================================

interface AudioPlayerProps {
  /** AI 回复文本 —— 传入后自动触发 TTS 播放 */
  text?: string;
  /** 组件模式: inline = 内嵌控制，overlay = 浮动条 */
  mode?: 'inline' | 'overlay';
  /** 自定义类名 */
  className?: string;
}

// ============================================================
// 组件
// ============================================================

function AudioPlayer({ text, mode = 'inline', className = '' }: AudioPlayerProps) {
  const {
    status,
    error,
    isPlaying,
    speak,
    stop,
    replay,
    setVoice,
    currentVoice,
  } = useTTS();

  // ---- 自动播放：text 变化时触发 ----
  // (由父组件在收到 AI 回复后传入 text 触发)
  const handleSpeak = useCallback(() => {
    if (text) {
      speak(text);
    }
  }, [text, speak]);

  // ---- 渲染：inline 模式 ----
  if (mode === 'inline') {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {/* 状态栏 */}
        <div className="flex items-center gap-3">
          {/* 状态图标 */}
          <span className="text-lg" title={STATUS_LABELS[status]}>
            {status === 'playing' ? (
              <span className="inline-flex items-center gap-[2px]">
                <span className="w-[3px] h-3 bg-ai-primary rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                <span className="w-[3px] h-5 bg-ai-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                <span className="w-[3px] h-2 bg-ai-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              </span>
            ) : status === 'loading' ? (
              <span className="w-4 h-4 border-2 border-ai-primary border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              STATUS_ICONS[status]
            )}
          </span>

          {/* 状态文字 */}
          <span className={`text-xs ${error ? 'text-red-400' : 'text-gray-400'}`}>
            {error || STATUS_LABELS[status]}
          </span>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center gap-2">
          {/* 播报 / 重播按钮 */}
          {!isPlaying && text && (
            <button
              onClick={handleSpeak}
              className="px-3 py-1.5 text-xs rounded-lg bg-ai-primary/20 
                         text-ai-primary hover:bg-ai-primary/30 transition-colors"
            >
              🔊 播报
            </button>
          )}

          {/* 重播按钮（播放完毕后） */}
          {status === 'done' && (
            <button
              onClick={replay}
              className="px-3 py-1.5 text-xs rounded-lg bg-ai-primary/20 
                         text-ai-primary hover:bg-ai-primary/30 transition-colors"
            >
              🔄 重播
            </button>
          )}

          {/* 停止按钮 */}
          {isPlaying && (
            <button
              onClick={stop}
              className="px-3 py-1.5 text-xs rounded-lg bg-red-600/20 
                         text-red-400 hover:bg-red-600/30 transition-colors"
            >
              ⏹ 停止
            </button>
          )}

          {/* 语音选择 */}
          <select
            value={currentVoice}
            onChange={(e) => setVoice(e.target.value)}
            className="ml-auto px-2 py-1 text-[10px] rounded-lg bg-ai-surface 
                       border border-ai-border text-gray-400 outline-none
                       focus:border-ai-primary/50"
            title="切换语音"
          >
            <option value="zh-CN-XiaoxiaoNeural">晓晓 (女)</option>
            <option value="zh-CN-XiaoyiNeural">晓伊 (女)</option>
            <option value="zh-CN-YunxiNeural">云希 (男)</option>
            <option value="zh-CN-YunyangNeural">云扬 (男)</option>
            <option value="en-US-JennyNeural">Jenny (EN)</option>
            <option value="en-US-GuyNeural">Guy (EN)</option>
          </select>
        </div>
      </div>
    );
  }

  // ---- overlay 模式 ----
  return (
    <div
      className={`
        fixed bottom-4 right-4 z-50 
        glass-card p-3 rounded-xl 
        flex items-center gap-3 shadow-2xl
        ${isPlaying ? 'ring-2 ring-ai-primary/50' : ''}
        ${className}
      `}
    >
      {/* 波形动画 */}
      {isPlaying && (
        <div className="flex items-center gap-[2px]">
          {[1, 3, 5, 3, 1, 4, 2].map((h, i) => (
            <span
              key={i}
              className="w-[3px] bg-ai-primary rounded-full animate-pulse"
              style={{
                height: `${h * 4}px`,
                animationDelay: `${i * 120}ms`,
                animationDuration: '0.8s',
              }}
            />
          ))}
        </div>
      )}

      {/* 状态 */}
      <span className="text-xs text-gray-400">{STATUS_LABELS[status]}</span>

      {/* 控制 */}
      <div className="flex items-center gap-1">
        {isPlaying ? (
          <button
            onClick={stop}
            className="px-2 py-1 text-xs rounded bg-red-600/20 text-red-400 
                       hover:bg-red-600/30 transition-colors"
          >
            ⏹
          </button>
        ) : status === 'done' ? (
          <button
            onClick={replay}
            className="px-2 py-1 text-xs rounded bg-ai-primary/20 text-ai-primary 
                       hover:bg-ai-primary/30 transition-colors"
          >
            🔄
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default AudioPlayer;
