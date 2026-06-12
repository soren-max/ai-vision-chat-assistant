/**
 * useAudioRecorder — 音频录制与管理 Hook
 *
 * 核心能力:
 * - MediaRecorder API 录制音频流
 * - Web Audio API 实时音量分析（AnalyserNode）
 * - Voice Activity Detection（VAD）—— 静音 > 2 秒自动停止
 * - WAV 格式编码输出（16-bit PCM, 单声道）
 * - 音量波形数据供可视化
 *
 * 状态机:
 *   idle → requesting → recording → stopping → idle
 *                  ↓                    ↑
 *               paused ────────────────┘
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ============================================================
// 类型
// ============================================================

/** 录音器运行状态 */
export type RecorderStatus =
  | 'idle'          // 未启动
  | 'requesting'    // 正在请求麦克风权限
  | 'recording'    // 正在录音
  | 'paused'       // 暂停中（MediaRecorder 不支持暂停，但视觉效果）
  | 'stopping'      // 正在停止并编码
  | 'uploading'     // 正在上传
  | 'error';        // 错误

/** 音量数据点 —— 供波形可视化 */
export interface VolumeSample {
  /** 归一化音量 [0, 1] */
  level: number;
  /** 采样时间戳 */
  timestamp: number;
}

/** Hook 返回值 */
export interface UseAudioRecorderReturn {
  /* ---- 状态 ---- */
  recorderStatus: RecorderStatus;
  errorMessage: string | null;
  /** 当前音量样本（用于音量条动画） */
  volumeLevel: number;
  /** 历史音量样本（用于波形绘制） */
  volumeHistory: VolumeSample[];
  /** 最终 WAV 音频 Blob */
  audioBlob: Blob | null;
  /** 录音时长（秒） */
  durationSec: number;

  /* ---- 方法 ---- */
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<void>;
}

// ============================================================
// 常量配置
// ============================================================

/** VAD 音量阈值 —— 低于此值视为静音 */
const VAD_THRESHOLD = 0.03;
/** 静音超时（毫秒）—— 连续静音超过此值自动停止 */
const SILENCE_TIMEOUT_MS = 2000;
/** 音量采样间隔（毫秒） */
const VOLUME_SAMPLE_INTERVAL_MS = 60;
/** AnalyserNode 平滑参数 [0, 1] */
const ANALYSER_SMOOTHING = 0.8;
/** FFT 大小（用于 AnalyserNode，必须是 2 的幂） */
const FFT_SIZE = 256;

// ============================================================
// WAV 编码器
// ============================================================

/**
 * 将 Float32Array PCM 数据编码为 WAV 格式 ArrayBuffer。
 *
 * 格式: 16-bit PCM, 单声道, 小端序
 *
 * @param samples 归一化音频样本 [-1, 1]
 * @param sampleRate 采样率（Hz）
 * @returns WAV 文件内容的 ArrayBuffer
 */
function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  /** 写入 4 字节 ASCII 字符串 */
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF chunk
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');

  // fmt sub-chunk
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);                   // Sub-chunk size (PCM = 16)
  view.setUint16(20, 1, true);                    // Audio format (1 = PCM)
  view.setUint16(22, numChannels, true);          // Number of channels
  view.setUint32(24, sampleRate, true);           // Sample rate
  view.setUint32(28, byteRate, true);             // Byte rate
  view.setUint16(32, blockAlign, true);           // Block align
  view.setUint16(34, bitsPerSample, true);        // Bits per sample

  // data sub-chunk
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM 数据写入（16-bit 有符号整数）
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const sample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
    view.setInt16(offset, sample, true); // little-endian
  }

  return buffer;
}

// ============================================================
// Hook
// ============================================================

/**
 * useAudioRecorder Hook
 *
 * @example
 * ```tsx
 * const {
 *   recorderStatus, volumeLevel, volumeHistory,
 *   startRecording, stopRecording, audioBlob, durationSec,
 * } = useAudioRecorder({ onUpload: (blob) => apiClient.sendAudio(blob) });
 * ```
 */
export function useAudioRecorder(options: {
  /** 录制完成并编码后，上传 WAV blob 的回调 */
  onUpload?: (wavBlob: Blob) => Promise<void>;
  /** 错误回调 */
  onError?: (message: string) => void;
} = {}): UseAudioRecorderReturn {
  const { onUpload, onError } = options;

  // ---- 状态 ----
  const [recorderStatus, setRecorderStatus] = useState<RecorderStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [volumeHistory, setVolumeHistory] = useState<VolumeSample[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [durationSec, setDurationSec] = useState(0);

  // ---- Refs（不需要触发重渲染的值）----
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // VAD
  const silenceStartRef = useRef<number | null>(null);
  const isSpeakingRef = useRef(false);
  const volumeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 录音计时
  const startTimeRef = useRef<number>(0);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- 工具方法 ----

  /** 统一的错误处理 */
  const setError = useCallback(
    (msg: string) => {
      setErrorMessage(msg);
      setRecorderStatus('error');
      onError?.(msg);
    },
    [onError],
  );

  /** 统一的录音器清理 */
  const cleanup = useCallback(() => {
    // 停止所有媒体轨道
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    // 关闭 AudioContext
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];

    // 清除定时器
    if (volumeTimerRef.current) {
      clearInterval(volumeTimerRef.current);
      volumeTimerRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    silenceStartRef.current = null;
    isSpeakingRef.current = false;
  }, []);

  // ============================================================
  // 音量分析 + VAD
  // ============================================================

  const startVolumeAnalysis = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    volumeTimerRef.current = setInterval(() => {
      analyser.getByteTimeDomainData(dataArray);

      // 计算 RMS 音量
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128; // → [-1, 1]
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);

      // 更新当前音量
      setVolumeLevel(rms);

      // 记录历史样本
      const sample: VolumeSample = {
        level: rms,
        timestamp: Date.now(),
      };
      setVolumeHistory((prev) => {
        // 限制历史长度，防止无限增长
        const next = [...prev, sample];
        if (next.length > 200) return next.slice(-200);
        return next;
      });

      // ---- VAD（Voice Activity Detection）----
      if (rms > VAD_THRESHOLD) {
        // 检测到说话
        if (!isSpeakingRef.current) {
          console.log(`[VAD] 开始说话 (RMS: ${rms.toFixed(4)})`);
          isSpeakingRef.current = true;
        }
        silenceStartRef.current = null; // 重置静音计时
      } else {
        // 静音中
        if (isSpeakingRef.current) {
          // 第一次进入静音，记录时间戳
          if (silenceStartRef.current === null) {
            silenceStartRef.current = Date.now();
          }
          const silenceDuration = Date.now() - silenceStartRef.current;

          // 连续静音超过阈值 → 自动停止
          if (silenceDuration >= SILENCE_TIMEOUT_MS) {
            console.log(`[VAD] 静音超过 ${SILENCE_TIMEOUT_MS}ms，自动停止录音`);
            isSpeakingRef.current = false;

            // 如果正在录制中，自动触发停止（异步但无需 await）
            if (mediaRecorderRef.current?.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
          }
        }
      }
    }, VOLUME_SAMPLE_INTERVAL_MS);
  }, []);

  // ============================================================
  // 录制计时
  // ============================================================

  const startDurationTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    setDurationSec(0);

    durationTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setDurationSec(elapsed);
    }, 100);
  }, []);

  // ============================================================
  // 开始录音
  // ============================================================

  const startRecording = useCallback(async () => {
    if (recorderStatus === 'requesting' || recorderStatus === 'recording') return;

    setRecorderStatus('requesting');
    setErrorMessage(null);
    setAudioBlob(null);
    setVolumeLevel(0);
    setVolumeHistory([]);
    cleanup();

    try {
      // 1. 获取音频流
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('浏览器不支持麦克风 API（需要 HTTPS 或 localhost）');
      }

      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: { ideal: 16000 },
          echoCancellation: true,     // 回音消除
          noiseSuppression: true,     // 降噪
          autoGainControl: true,      // 自动增益
        },
        video: false,
      });

      const audioTrack = audioStream.getAudioTracks()[0];
      if (!audioTrack) {
        throw new Error('未检测到麦克风设备');
      }
      console.log(
        `[useAudioRecorder] 麦克风已开启 | ${audioTrack.label} | ` +
        `${audioTrack.getSettings().sampleRate}Hz`,
      );

      streamRef.current = audioStream;

      // 2. 创建 AudioContext → AnalyserNode
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(audioStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;
      source.connect(analyser);
      // 不连接到 destination，避免回声

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      // 3. 创建 MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''; // 兜底使用浏览器默认格式

      const recorder = mimeType
        ? new MediaRecorder(audioStream, { mimeType })
        : new MediaRecorder(audioStream);

      mediaRecorderRef.current = recorder;

      // 收集音频数据块
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      // 录制完成/停止时触发
      recorder.onstop = async () => {
        await handleRecordStop();
      };

      // 录制出错
      recorder.onerror = () => {
        setError('录音过程中发生错误');
      };

      // 4. 启动录制
      recorder.start(1000); // 每秒产出一个数据块
      startVolumeAnalysis();
      startDurationTimer();
      isSpeakingRef.current = false;
      silenceStartRef.current = null;

      setRecorderStatus('recording');
      console.log('[useAudioRecorder] 录音开始');
    } catch (err: unknown) {
      cleanup();

      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotAllowedError':
            setError('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风');
            return;
          case 'NotFoundError':
            setError('未检测到麦克风设备');
            return;
          case 'NotReadableError':
            setError('麦克风被其他应用占用');
            return;
          default:
            setError(`麦克风错误: ${err.message}`);
            return;
        }
      }
      const msg = err instanceof Error ? err.message : '未知错误';
      setError(msg);
    }
  }, [recorderStatus, cleanup, startVolumeAnalysis, startDurationTimer, setError]);

  // ============================================================
  // 录制完成 → 编码为 WAV
  // ============================================================

  const handleRecordStop = useCallback(async () => {
    setRecorderStatus('stopping');

    // 清理定时器
    if (volumeTimerRef.current) {
      clearInterval(volumeTimerRef.current);
      volumeTimerRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    const chunks = recordedChunksRef.current;
    if (chunks.length === 0) {
      console.warn('[useAudioRecorder] 无录音数据');
      cleanup();
      setRecorderStatus('idle');
      return;
    }

    try {
      // 将收集到的数据块合并为 Blob
      const rawBlob = new Blob(chunks, { type: chunks[0].type });

      // 解码为 AudioBuffer（获取原始 PCM 数据）
      const audioCtx = audioCtxRef.current ?? new AudioContext();
      const arrayBuffer = await rawBlob.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      // 提取单声道 PCM 数据
      const pcmData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;

      console.log(
        `[useAudioRecorder] 解码完成 | 时长: ${audioBuffer.duration.toFixed(2)}s | ` +
        `采样率: ${sampleRate}Hz | 样本数: ${pcmData.length}`,
      );

      // 编码为 WAV
      const wavBuffer = encodeWAV(pcmData, sampleRate);
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

      setAudioBlob(wavBlob);

      // 上传回调
      if (onUpload) {
        setRecorderStatus('uploading');
        try {
          await onUpload(wavBlob);
          console.log(`[useAudioRecorder] 上传完成 (${wavBlob.size} bytes)`);
        } catch (err) {
          console.error('[useAudioRecorder] 上传失败:', err);
        }
      }

      setRecorderStatus('idle');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '编码失败';
      setError(`音频处理失败: ${msg}`);
    } finally {
      cleanup();
    }
  }, [onUpload, cleanup, setError]);

  // ============================================================
  // 暂停录音（逻辑暂停 —— 不实际暂停 MediaRecorder）
  // ============================================================

  const pauseRecording = useCallback(() => {
    if (recorderStatus !== 'recording') return;

    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.pause();
    }

    // 暂停音量分析
    if (volumeTimerRef.current) {
      clearInterval(volumeTimerRef.current);
      volumeTimerRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    setRecorderStatus('paused');
    console.log('[useAudioRecorder] 录音暂停');
  }, [recorderStatus]);

  // ============================================================
  // 恢复录音
  // ============================================================

  const resumeRecording = useCallback(() => {
    if (recorderStatus !== 'paused') return;

    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.resume();
    }

    isSpeakingRef.current = false;
    silenceStartRef.current = null;
    startVolumeAnalysis();
    startDurationTimer();

    setRecorderStatus('recording');
    console.log('[useAudioRecorder] 录音恢复');
  }, [recorderStatus, startVolumeAnalysis, startDurationTimer]);

  // ============================================================
  // 停止录音
  // ============================================================

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state === 'recording') {
      // MediaRecorder.stop() 会触发 onstop 回调，最终调用 handleRecordStop
      recorder.stop();
    } else {
      // 如果录制器未活跃，直接清理
      cleanup();
      setRecorderStatus('idle');
    }
  }, [cleanup]);

  // ============================================================
  // 组件卸载时自动清理
  // ============================================================

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    recorderStatus,
    errorMessage,
    volumeLevel,
    volumeHistory,
    audioBlob,
    durationSec,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  };
}
