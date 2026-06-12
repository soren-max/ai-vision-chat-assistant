/**
 * CameraPanel — 摄像头面板组件
 *
 * 功能:
 * - 点击按钮开启/关闭摄像头
 * - 实时显示摄像头画面 (<video> 元素)
 * - 每 3 秒自动抓取一帧，压缩为 640×480 JPEG
 * - 通过 WebSocket 上传帧到 FastAPI 后端
 * - 加载状态（启动中旋转动画）
 * - 错误提示（权限/设备/占用）
 * - 录制中的脉冲指示灯
 */

import { useEffect, useRef, useCallback } from 'react';
import { useMediaDevice } from '../hooks/useMediaDevice';
import type { CameraStatus } from '../hooks/useMediaDevice';
import { apiClient } from '../services';

// ============================================================
// 常量
// ============================================================

/** 帧捕获间隔（毫秒） */
const FRAME_CAPTURE_INTERVAL_MS = 3000;

/** 错误恢复提示延后（毫秒）—— 短暂错误不立即清除，让用户有感知 */
const ERROR_CLEAR_DELAY_MS = 5000;

// ============================================================
// Helper: 摄像头状态文案映射
// ============================================================

const STATUS_LABELS: Record<CameraStatus, string> = {
  idle: '摄像头未开启',
  starting: '正在启动摄像头...',
  active: '摄像头工作中',
  error: '摄像头异常',
  stopping: '正在关闭...',
};

// ============================================================
// CameraPanel 组件
// ============================================================

function CameraPanel() {
  // ---- Refs ----
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- 媒体设备 Hook ----
  const {
    stream,
    cameraStatus,
    errorMessage,
    startCamera,
    stopCamera,
    captureFrame,
  } = useMediaDevice({
    // 每次捕获帧后通过 WebSocket 上传
    onFrameCaptured: (frameBase64: string) => {
      apiClient.sendFrame(frameBase64);
      console.log(`[CameraPanel] 帧已上传 (${frameBase64.length} chars)`);
    },
    // 错误上报
    onError: (error) => {
      console.error('[CameraPanel] 摄像头错误:', error);
    },
  });

  // ============================================================
  // 绑定流到 <video> 元素
  // ============================================================
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream && cameraStatus === 'active') {
      // 将媒体流绑定到视频元素
      video.srcObject = stream;

      // 等待元数据加载后再播放
      video.onloadedmetadata = () => {
        video.play().catch((err) => {
          console.error('[CameraPanel] 视频播放失败:', err);
        });
      };
    } else {
      // 清理：移除流引用
      video.srcObject = null;
    }

    // 组件卸载时清理
    return () => {
      if (video) {
        video.srcObject = null;
      }
    };
  }, [stream, cameraStatus]);

  // ============================================================
  // 每 3 秒捕获一帧
  // ============================================================
  useEffect(() => {
    // 仅当摄像头活跃时启动定时器
    if (cameraStatus !== 'active') {
      if (captureTimerRef.current) {
        clearInterval(captureTimerRef.current);
        captureTimerRef.current = null;
      }
      return;
    }

    console.log(`[CameraPanel] 启动帧捕获 — 间隔: ${FRAME_CAPTURE_INTERVAL_MS}ms`);
    captureTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      if (video && cameraStatus === 'active') {
        captureFrame(video);
      }
    }, FRAME_CAPTURE_INTERVAL_MS);

    return () => {
      if (captureTimerRef.current) {
        clearInterval(captureTimerRef.current);
        captureTimerRef.current = null;
      }
    };
  }, [cameraStatus, captureFrame]);

  // ============================================================
  // 错误自动恢复
  // ============================================================
  useEffect(() => {
    if (cameraStatus !== 'error' || !errorMessage) return;

    const timer = setTimeout(() => {
      // 仅静默衰减，不清除状态（由用户手动处理）
    }, ERROR_CLEAR_DELAY_MS);

    return () => clearTimeout(timer);
  }, [cameraStatus, errorMessage]);

  // ============================================================
  // 按钮点击处理
  // ============================================================

  const handleToggle = useCallback(() => {
    if (cameraStatus === 'active') {
      stopCamera();
    } else if (cameraStatus !== 'starting') {
      startCamera();
    }
  }, [cameraStatus, startCamera, stopCamera]);

  // ============================================================
  // 渲染 Helpers
  // ============================================================

  const isIdle = cameraStatus === 'idle';
  const isActive = cameraStatus === 'active';
  const isStarting = cameraStatus === 'starting';
  const isError = cameraStatus === 'error';
  const isTransitioning = isStarting || cameraStatus === 'stopping';

  /** 按钮文案 */
  const buttonLabel = isActive ? '🔴 关闭摄像头' : '📷 开启摄像头';

  /** 按钮是否禁用 */
  const buttonDisabled = isTransitioning;

  /** 按钮额外样式 */
  const buttonVariant = isActive
    ? 'bg-red-600 hover:bg-red-700'       // 红色高亮：关闭
    : 'bg-ai-primary hover:bg-ai-secondary'; // 默认主题色：开启

  return (
    <div className="glass-card p-4 flex flex-col">
      {/* ===== 标题栏 ===== */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>📷 摄像头画面</span>
          {/* 录制脉冲指示灯 */}
          {isActive && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
          )}
        </h2>
        {/* 状态标签 */}
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            isActive
              ? 'bg-green-900/50 text-green-400 border border-green-700'
              : isError
                ? 'bg-red-900/50 text-red-400 border border-red-700'
                : 'bg-slate-700/50 text-slate-400 border border-slate-600'
          }`}
        >
          {STATUS_LABELS[cameraStatus]}
        </span>
      </div>

      {/* ===== 视频预览区 ===== */}
      <div
        className={`
          relative aspect-video rounded-xl overflow-hidden
          border-2 transition-colors duration-300
          ${isActive ? 'border-green-700' : isError ? 'border-red-700' : 'border-dashed border-ai-border'}
        `}
      >
        {/* 背景占位 */}
        <div className="absolute inset-0 bg-black/70" />

        {/* 视频元素 —— 镜像翻转（前置摄像头习惯） */}
        <video
          ref={videoRef}
          className={`
            absolute inset-0 w-full h-full object-cover
            transition-opacity duration-500
            ${isActive ? 'opacity-100' : 'opacity-0'}
          `}
          muted          // 不播放音频，避免回声
          playsInline    // iOS 内联播放
          autoPlay
        />

        {/* ---------- 空闲态：提示文字 ---------- */}
        {isIdle && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500">
            <svg
              className="w-12 h-12 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm">点击下方按钮开启摄像头</p>
          </div>
        )}

        {/* ---------- 加载态：旋转指示器 ---------- */}
        {isStarting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-ai-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">{STATUS_LABELS.starting}</p>
          </div>
        )}

        {/* ---------- 错误态：错误信息 ---------- */}
        {isError && errorMessage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <svg
              className="w-10 h-10 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <p className="text-sm text-red-400 leading-relaxed">{errorMessage}</p>
            <button
              onClick={startCamera}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-900/50 text-red-300 
                         hover:bg-red-800/60 transition-colors border border-red-700"
            >
              重试
            </button>
          </div>
        )}

        {/* ---------- 活跃态右上角帧计数（可选） ---------- */}
        {isActive && (
          <div className="absolute top-2 right-2 bg-black/60 text-xs text-green-400 px-2 py-0.5 rounded-full backdrop-blur">
            帧捕获中
          </div>
        )}
      </div>

      {/* ===== 控制按钮 ===== */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={handleToggle}
          disabled={buttonDisabled}
          className={`
            btn-primary flex-1 disabled:opacity-40
            ${buttonVariant}
          `}
        >
          {isStarting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              启动中...
            </span>
          ) : (
            buttonLabel
          )}
        </button>
      </div>

      {/* ===== 技术参数提示 ===== */}
      {isActive && (
        <p className="text-[10px] text-gray-600 mt-2 text-center">
          640×480 JPEG · 每 {FRAME_CAPTURE_INTERVAL_MS / 1000}s 捕获一帧 · WebSocket 上传
        </p>
      )}
    </div>
  );
}

export default CameraPanel;
