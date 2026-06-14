import { useCallback, useEffect, useRef, useState } from 'react';
import { useMediaDevice } from '../hooks/useMediaDevice';
import { apiClient } from '../services';
import type { VisionContext } from '../App';

const ANALYZE_INTERVAL_MS = 8000;

interface Props {
  onVisionUpdate: (vision: VisionContext) => void;
}

export default function CameraPreview({ onVisionUpdate }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyzingRef = useRef(false);
  const [minimized, setMinimized] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<number | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const { stream, cameraStatus, errorMessage, startCamera, stopCamera, captureFrame } = useMediaDevice({
    onFrameCaptured: b64 => apiClient.sendFrame(b64),
    onError: message => {
      onVisionUpdate({
        scene: '',
        summary: message,
        objects: [],
        people: [],
        screen_content: '',
        risk_content: [],
        updatedAt: Date.now(),
        source: 'error',
      });
    },
  });

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (stream && cameraStatus === 'active') { v.srcObject = stream; v.onloadedmetadata = () => v.play().catch(() => {}); }
    else v.srcObject = null;
    return () => { if (v) v.srcObject = null; };
  }, [stream, cameraStatus]);

  const isActive = cameraStatus === 'active';

  const analyzeCurrentFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !isActive || analyzingRef.current) return;

    const frame = captureFrame(video);
    if (!frame) return;

    analyzingRef.current = true;
    setAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch('/api/vision/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'browser-session',
          image: frame,
          prompt: '请优先识别用户可能会询问的物体、屏幕内容、人物动作和安全风险，回答保持简洁。',
        }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const analyzedAt = Date.now();
      setLastAnalyzedAt(analyzedAt);
      onVisionUpdate({
        scene: data.scene || '',
        summary: data.summary || '',
        objects: Array.isArray(data.objects) ? data.objects : [],
        people: Array.isArray(data.people) ? data.people : [],
        screen_content: data.screen_content || '',
        risk_content: Array.isArray(data.risk_content) ? data.risk_content : [],
        updatedAt: analyzedAt,
        source: 'camera',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '视觉分析失败';
      setAnalysisError(message);
      onVisionUpdate({
        scene: '',
        summary: message,
        objects: [],
        people: [],
        screen_content: '',
        risk_content: [],
        updatedAt: Date.now(),
        source: 'error',
      });
    } finally {
      analyzingRef.current = false;
      setAnalyzing(false);
    }
  }, [captureFrame, isActive, onVisionUpdate]);

  useEffect(() => {
    if (!isActive) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setLastAnalyzedAt(null);
      setAnalysisError(null);
      onVisionUpdate({
        scene: '',
        summary: '',
        objects: [],
        people: [],
        screen_content: '',
        risk_content: [],
        updatedAt: null,
        source: 'idle',
      });
      return;
    }

    const firstCapture = window.setTimeout(() => analyzeCurrentFrame(), 900);
    timerRef.current = setInterval(() => analyzeCurrentFrame(), ANALYZE_INTERVAL_MS);

    return () => {
      window.clearTimeout(firstCapture);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [analyzeCurrentFrame, isActive, onVisionUpdate]);

  const statusText = (() => {
    if (cameraStatus === 'starting') return 'Starting';
    if (analyzing) return 'Analyzing';
    if (isActive) return 'Live';
    if (cameraStatus === 'error') return 'Error';
    return 'Camera Off';
  })();

  return (
    <div className={`rounded-xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 bg-black transition-all ${minimized ? 'w-12 h-12' : 'w-80'}`}>
      {minimized ? (
        <button onClick={() => setMinimized(false)} className="w-full h-full flex items-center justify-center bg-gray-900 text-white text-xs">
          Cam
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 text-[11px] text-gray-400">
            <div className="flex items-center gap-2">
              <span>Camera</span>
              <span className={`${isActive ? 'text-green-400' : cameraStatus === 'error' ? 'text-red-400' : 'text-gray-500'}`}>
                {statusText}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
              {isActive && (
                <button
                  onClick={analyzeCurrentFrame}
                  disabled={analyzing}
                  className="text-[10px] hover:text-white disabled:opacity-40"
                >
                  Analyze
                </button>
              )}
              <button onClick={() => { isActive ? stopCamera() : startCamera(); }} className="text-[10px] hover:text-white">{isActive ? 'Stop' : 'Start'}</button>
              <button onClick={() => setMinimized(true)} className="hover:text-white">−</button>
            </div>
          </div>
          <div className="aspect-video bg-black relative">
            <video ref={videoRef} className={`absolute inset-0 w-full h-full object-cover ${isActive ? 'opacity-100' : 'opacity-0'}`} muted playsInline autoPlay />
            {analyzing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <div className="px-2 py-1 rounded bg-black/70 text-[10px] text-blue-200 border border-blue-500/30">reading frame...</div>
              </div>
            )}
            {!isActive && <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs">{errorMessage || 'Camera Off'}</div>}
            {isActive && (
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 text-[10px] text-white/80">
                <span className="px-2 py-0.5 rounded bg-black/60">auto {ANALYZE_INTERVAL_MS / 1000}s</span>
                <span className="px-2 py-0.5 rounded bg-black/60">
                  {lastAnalyzedAt ? new Date(lastAnalyzedAt).toLocaleTimeString() : 'waiting'}
                </span>
              </div>
            )}
          </div>
          {analysisError && (
            <div className="px-3 py-2 bg-red-950/80 text-[11px] text-red-200 border-t border-red-800/60">
              {analysisError}
            </div>
          )}
        </>
      )}
    </div>
  );
}
