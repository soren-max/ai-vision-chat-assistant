/**
 * VoiceRecorder — 语音录制组件
 *
 * 功能:
 * - 点击开始录音 / 停止录音
 * - 实时音量波形可视化（32 条动态柱状图）
 * - VAD 静音检测：静音超过 2 秒自动停止
 * - 暂停 / 恢复录音
 * - WAV 格式输出，上传到后端
 * - 状态提示：idle / recording / paused / uploading / error
 * - 录音时长显示
 * - 错误处理与恢复
 */

import { useCallback, useMemo } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import type { RecorderStatus } from '../hooks/useAudioRecorder';
import { apiClient } from '../services';

// ============================================================
// 常量
// ============================================================

/** 波形柱状图条数 */
const WAVEFORM_BARS = 32;
/** 柱状图最小高度占父容器比例 */
const BAR_MIN_RATIO = 0.06;
/** 柱状图最大高度占父容器比例 */
const BAR_MAX_RATIO = 0.9;

// ============================================================
// 状态文案映射
// ============================================================

const STATUS_LABELS: Record<RecorderStatus, string> = {
  idle: '麦克风就绪',
  requesting: '正在请求麦克风权限...',
  recording: '正在录音中',
  paused: '已暂停',
  stopping: '正在停止...',
  uploading: '正在上传音频...',
  error: '设备异常',
};

// ============================================================
// VoiceRecorder 组件
// ============================================================

function VoiceRecorder() {
  const {
    recorderStatus,
    errorMessage,
    volumeLevel,
    volumeHistory,
    durationSec,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  } = useAudioRecorder({
    onUpload: async (wavBlob: Blob) => {
      // 上传 WAV 到后端供 Whisper STT 处理
      await apiClient.sendAudio(wavBlob);
    },
    onError: (msg) => {
      console.error('[VoiceRecorder]', msg);
    },
  });

  // ---- 派生状态 ----
  const isIdle = recorderStatus === 'idle';
  const isRecording = recorderStatus === 'recording';
  const isPaused = recorderStatus === 'paused';
  const isRequesting = recorderStatus === 'requesting';
  const isProcessing = recorderStatus === 'stopping' || recorderStatus === 'uploading';
  const isError = recorderStatus === 'error';
  const isActive = isRecording || isPaused;
  const canInteract = !isRequesting && !isProcessing;

  // ---- 时长格式化 ----
  const durationLabel = useMemo(() => {
    const mins = Math.floor(durationSec / 60);
    const secs = Math.floor(durationSec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [durationSec]);

  // ---- 按钮操作 ----
  const handleToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else if (isPaused) {
      resumeRecording();
    } else if (isIdle || isError) {
      startRecording();
    }
  }, [isRecording, isPaused, isIdle, isError, stopRecording, resumeRecording, startRecording]);

  const handlePause = useCallback(() => {
    if (isRecording) {
      pauseRecording();
    }
  }, [isRecording, pauseRecording]);

  // ---- 按钮文案和样式 ----
  const toggleLabel = (() => {
    if (isRecording) return '⏹ 停止录音';
    if (isPaused) return '▶ 继续录音';
    if (isRequesting) return '请求中...';
    if (isProcessing) return '处理中...';
    return '🎤 开始录音';
  })();

  const toggleVariant = isRecording
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-ai-primary hover:bg-ai-secondary';

  // ---- 波形柱状图数据 ----
  const waveBars = useMemo(() => {
    // 从历史音量样本中取最新 N 条
    const recent = volumeHistory.slice(-WAVEFORM_BARS);
    const bars = new Array(WAVEFORM_BARS).fill(0);

    for (let i = 0; i < recent.length; i++) {
      // 将音量映射为柱状图高度比例
      // 使用对数映射让低音量区域更敏感
      const level = Math.min(1, recent[i].level * 4); // 放大 4x
      const logScale = level > 0.001
        ? Math.log10(1 + level * 9) / Math.log10(10) // 0..1
        : 0;
      bars[i] = BAR_MIN_RATIO + logScale * (BAR_MAX_RATIO - BAR_MIN_RATIO);
    }

    // 尾部填充最低高度
    for (let i = recent.length; i < WAVEFORM_BARS; i++) {
      bars[i] = BAR_MIN_RATIO;
    }

    return bars;
  }, [volumeHistory]);

  // ---- 实时音量背景亮度 ----
  const volumeGlowIntensity = isRecording
    ? Math.min(1, volumeLevel * 5) * 0.3
    : 0;

  return (
    <div className="glass-card p-4 flex flex-col">
      {/* ===== 标题栏 ===== */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>🎤 语音录制</span>
          {/* 录音中脉冲指示 */}
          {isRecording && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
          )}
        </h2>

        {/* 状态标签 */}
        <span
          className={`text-xs px-2 py-1 rounded-full transition-colors ${
            isRecording
              ? 'bg-red-900/50 text-red-400 border border-red-700'
              : isPaused
                ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700'
                : isError
                  ? 'bg-red-900/50 text-red-400 border border-red-700'
                  : isProcessing
                    ? 'bg-blue-900/50 text-blue-400 border border-blue-700'
                    : 'bg-slate-700/50 text-slate-400 border border-slate-600'
          }`}
        >
          {STATUS_LABELS[recorderStatus]}
        </span>
      </div>

      {/* ===== 波形可视化区域 ===== */}
      <div
        className={`
          relative rounded-xl overflow-hidden border-2 transition-all duration-300
          h-28 flex items-end justify-center gap-[2px] px-2
          ${isRecording ? 'border-red-700/60' : isPaused ? 'border-yellow-700/60' : 'border-ai-border/40'}
        `}
        style={{
          backgroundColor: isRecording
            ? `rgba(239, 68, 68, ${volumeGlowIntensity})`
            : 'rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* 背景网格提示线 */}
        <div className="absolute inset-0 flex flex-col">
          <div className="flex-1 border-b border-white/5" />
          <div className="flex-1 border-b border-white/5" />
          <div className="flex-1 border-b border-white/5" />
          <div className="flex-1" />
        </div>

        {/* 波形柱状图 */}
        {isActive || volumeHistory.length > 0 ? (
          <div className="relative z-10 flex items-end gap-[2px] w-full h-full pb-1">
            {waveBars.map((ratio, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm transition-[height] duration-75 ease-linear"
                style={{
                  height: `${ratio * 100}%`,
                  backgroundColor: isRecording
                    ? `hsl(${Math.max(0, 40 - ratio * 30)}, 100%, ${Math.min(70, 55 + ratio * 30)}%)` // 红色系渐变
                    : 'rgb(100, 116, 241)', // 默认蓝色
                  opacity: isActive ? 0.85 : 0.4,
                }}
              />
            ))}
          </div>
        ) : (
          /* 空闲态提示 */
          <div className="relative z-10 flex flex-col items-center text-gray-600 text-xs">
            <svg className="w-6 h-6 mb-1 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            <span>点击开始录音</span>
          </div>
        )}

        {/* 加载/处理态覆盖层 */}
        {isProcessing && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 gap-2">
            <div className="w-8 h-8 border-4 border-ai-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400">{STATUS_LABELS[recorderStatus]}</span>
          </div>
        )}

        {/* 错误态覆盖层 */}
        {isError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50 gap-2">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <span className="text-sm text-red-400 px-8 text-center leading-relaxed">
              {errorMessage || '未知错误'}
            </span>
          </div>
        )}
      </div>

      {/* ===== 录音时长 —— 仅在活跃时显示 ===== */}
      {isActive && (
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="text-xs text-gray-500">已录制</span>
          <span className="font-mono text-lg text-red-400 tabular-nums">{durationLabel}</span>
        </div>
      )}

      {/* ===== 控制按钮 ===== */}
      <div className="flex gap-3 mt-3">
        {/* 主操作按钮 */}
        <button
          onClick={handleToggle}
          disabled={!canInteract}
          className={`btn-primary flex-1 disabled:opacity-40 ${toggleVariant}`}
        >
          {isRequesting || isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {toggleLabel}
            </span>
          ) : (
            toggleLabel
          )}
        </button>

        {/* 暂停/继续按钮 —— 仅录音中显示 */}
        {isRecording && (
          <button
            onClick={handlePause}
            className="w-12 h-12 rounded-xl bg-yellow-700/30 border border-yellow-700
                       flex items-center justify-center text-yellow-400
                       hover:bg-yellow-700/50 transition-colors active:scale-95"
            title="暂停录音"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <rect x="5" y="3" width="3" height="14" rx="1" />
              <rect x="12" y="3" width="3" height="14" rx="1" />
            </svg>
          </button>
        )}
      </div>

      {/* ===== 技术参数 ===== */}
      <p className="text-[10px] text-gray-600 mt-2 text-center">
        16kHz 单声道 WAV · VAD 自动停止 · VAD 阈值 {">"} 2s 静音
      </p>
    </div>
  );
}

export default VoiceRecorder;
