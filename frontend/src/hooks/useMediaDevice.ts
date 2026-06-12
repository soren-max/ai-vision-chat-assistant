/**
 * useMediaDevice — 媒体设备管理 Hook
 *
 * 管理摄像头/麦克风的开启、关闭、帧捕获和错误处理。
 *
 * 摄像头参数:
 * - 分辨率: 640x480
 * - 格式: JPEG 压缩（quality: 0.85）
 * - 捕获间隔: 3 秒（由外部组件控制）
 */

import { useState, useRef, useCallback } from 'react';
import type { MediaDeviceState } from '../types';

/** 摄像头运行状态 */
export type CameraStatus = 'idle' | 'starting' | 'active' | 'error' | 'stopping';

/** 帧捕获回调 —— 每次捕获后由组件决定是否上传 */
export type FrameCallback = (frameBase64: string) => void;

/** 摄像头配置常量 */
const CAMERA_CONFIG = {
  width: 640,
  height: 480,
  jpegQuality: 0.85,          // JPEG 压缩质量 (0-1)
  facingMode: 'user' as const, // 默认前置摄像头
};

/** Hook 入参 */
interface UseMediaDeviceOptions {
  /** 每次捕获到帧后的回调（用于上传） */
  onFrameCaptured?: FrameCallback;
  /** 摄像头出错时的回调 */
  onError?: (error: string) => void;
  /** 摄像头状态变化时的回调 */
  onStatusChange?: (status: CameraStatus) => void;
}

/** Hook 返回值 */
export interface UseMediaDeviceReturn {
  /** 当前媒体流 */
  stream: MediaStream | null;
  /** 摄像头运行状态 */
  cameraStatus: CameraStatus;
  /** 错误消息文字 */
  errorMessage: string | null;
  /** 设备状态摘要 */
  deviceState: MediaDeviceState;

  /* ---- 方法 ---- */

  /** 开启摄像头并获得媒体流 */
  startCamera: () => Promise<void>;
  /** 关闭摄像头并释放所有轨道 */
  stopCamera: () => void;
  /**
   * 从当前视频流中抓取一帧，压缩为 JPEG base64 字符串。
   * 必须传入一个 <video> 元素引用以读取当前画面。
   */
  captureFrame: (videoEl: HTMLVideoElement) => string | null;
}

/**
 * useMediaDevice Hook
 *
 * @example
 * ```tsx
 * const { stream, cameraStatus, startCamera, stopCamera, captureFrame } =
 *   useMediaDevice({ onFrameCaptured: (b64) => apiClient.sendFrame(b64) });
 * ```
 */
export function useMediaDevice(
  options: UseMediaDeviceOptions = {},
): UseMediaDeviceReturn {
  const { onFrameCaptured, onError, onStatusChange } = options;

  // ---- 状态 ----
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 隐藏 canvas，仅供帧捕获使用
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /**
   * 统一的状态更新——确保回调触发
   */
  const updateStatus = useCallback(
    (status: CameraStatus) => {
      setCameraStatus(status);
      onStatusChange?.(status);
    },
    [onStatusChange],
  );

  /**
   * 错误处理
   */
  const handleError = useCallback(
    (msg: string) => {
      setErrorMessage(msg);
      updateStatus('error');
      onError?.(msg);
    },
    [onError, updateStatus],
  );

  // ---- 操作 ----

  /**
   * 开启摄像头
   *
   * 调用 navigator.mediaDevices.getUserMedia 获取流，
   * 设置分辨率和 facingMode，绑定到状态。
   */
  const startCamera = useCallback(async () => {
    // 防止重复启动
    if (cameraStatus === 'starting' || cameraStatus === 'active') {
      return;
    }

    updateStatus('starting');
    setErrorMessage(null);

    try {
      // 检查浏览器是否支持 mediaDevices API
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('浏览器不支持摄像头 API（需要 HTTPS 或 localhost）');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: CAMERA_CONFIG.width },
          height: { ideal: CAMERA_CONFIG.height },
          facingMode: CAMERA_CONFIG.facingMode,
        },
        audio: false, // 摄像头模块只负责视频
      });

      // 验证流包含视频轨道
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('未检测到视频轨道，请确认摄像头已连接');
      }

      console.log(
        `[useMediaDevice] 摄像头已开启 | 轨道: ${videoTrack.label} | ` +
        `分辨率: ${videoTrack.getSettings().width}x${videoTrack.getSettings().height}`,
      );

      setStream(mediaStream);
      updateStatus('active');
    } catch (err: unknown) {
      // 分类错误信息
      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotAllowedError':
            handleError('摄像头权限被拒绝，请在浏览器设置中允许访问摄像头');
            return;
          case 'NotFoundError':
            handleError('未检测到摄像头设备，请确认摄像头已连接');
            return;
          case 'NotReadableError':
            handleError('摄像头被其他应用占用，请关闭其他应用后重试');
            return;
          case 'OverconstrainedError':
            handleError('摄像头不支持所需分辨率，请尝试其他设备');
            return;
          default:
            handleError(`摄像头错误: ${err.message}`);
            return;
        }
      }
      const message = err instanceof Error ? err.message : '未知错误';
      handleError(message);
    }
  }, [cameraStatus, updateStatus, handleError]);

  /**
   * 关闭摄像头并释放资源
   *
   * 遍历所有媒体轨道并调用 stop()，释放硬件。
   */
  const stopCamera = useCallback(() => {
    updateStatus('stopping');

    if (stream) {
      // 停止所有轨道以释放硬件
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      console.log('[useMediaDevice] 摄像头已关闭，所有轨道已释放');
    }

    setStream(null);
    setErrorMessage(null);
    updateStatus('idle');
  }, [stream, updateStatus]);

  /**
   * 从视频元素中抓取当前帧
   *
   * 流程:
   * 1. 将视频当前帧绘制到离屏 canvas (640x480)
   * 2. 导出为 JPEG base64
   * 3. 触发 onFrameCaptured 回调供上传
   *
   * @param videoEl 正在播放流的 <video> 元素
   * @returns Base64 JPEG 字符串，失败返回 null
   */
  const captureFrame = useCallback(
    (videoEl: HTMLVideoElement): string | null => {
      if (!videoEl || videoEl.readyState < 2) {
        console.warn('[useMediaDevice] 视频未就绪，跳过帧捕获');
        return null;
      }

      try {
        // 复用 or 创建离屏 canvas
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }
        const canvas = canvasRef.current;
        canvas.width = CAMERA_CONFIG.width;
        canvas.height = CAMERA_CONFIG.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('无法获取 Canvas 2D 上下文');
        }

        // 绘制视频当前帧并缩放至目标分辨率
        ctx.drawImage(videoEl, 0, 0, CAMERA_CONFIG.width, CAMERA_CONFIG.height);

        // 导出 JPEG base64
        const frameBase64 = canvas.toDataURL('image/jpeg', CAMERA_CONFIG.jpegQuality);

        // 从 data URL 中提取纯 base64（去掉 "data:image/jpeg;base64," 前缀）
        const base64 = frameBase64.split(',')[1] ?? frameBase64;

        // 触发上传回调
        onFrameCaptured?.(base64);

        return base64;
      } catch (err) {
        const msg = err instanceof Error ? err.message : '帧捕获失败';
        console.error(`[useMediaDevice] ${msg}`);
        return null;
      }
    },
    [onFrameCaptured],
  );

  // ---- 计算 ----

  const deviceState: MediaDeviceState = {
    camera: cameraStatus === 'active',
    microphone: false,  // 暂由后续语音模块管理
    speaker: false,      // 暂由后续 TTS 模块管理
  };

  return {
    stream,
    cameraStatus,
    errorMessage,
    deviceState,
    startCamera,
    stopCamera,
    captureFrame,
  };
}
