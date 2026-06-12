/**
 * CameraPanel — 摄像头面板 (Redesigned)
 *
 * 设计语言: 极简开发者风格，窄边框，状态指示灯
 */

import { useEffect, useRef, useCallback } from 'react';
import { useMediaDevice } from '../hooks/useMediaDevice';
import { apiClient } from '../services';

const FRAME_INTERVAL_MS = 3000;

function CameraPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const {
    stream,
    cameraStatus,
    errorMessage,
    startCamera,
    stopCamera,
    captureFrame,
  } = useMediaDevice({
    onFrameCaptured: (b64) => apiClient.sendFrame(b64),
  });

  // Bind stream
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (stream && cameraStatus === 'active') {
      v.srcObject = stream;
      v.onloadedmetadata = () => v.play().catch(() => {});
    } else {
      v.srcObject = null;
    }
    return () => { if (v) v.srcObject = null; };
  }, [stream, cameraStatus]);

  // Frame capture
  useEffect(() => {
    if (cameraStatus !== 'active') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      const v = videoRef.current;
      if (v) captureFrame(v);
    }, FRAME_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [cameraStatus, captureFrame]);

  const isActive = cameraStatus === 'active';
  const isStarting = cameraStatus === 'starting';

  const handleToggle = useCallback(() => {
    if (isActive) stopCamera();
    else startCamera();
  }, [isActive, startCamera, stopCamera]);

  const statusDot = isActive ? 'dot-green' : cameraStatus === 'error' ? 'dot-red' : 'dot-purple';

  return (
    <div className="flex flex-col p-3 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Camera</span>
        <span className={statusDot} />
      </div>

      {/* Video Area */}
      <div className={`relative aspect-[4/3] rounded-sm overflow-hidden border ${isActive ? 'border-accent-green/30 ring-glow' : 'border-surface-border'} bg-black/50 transition-all duration-300`}>
        {/* Scan line effect */}
        {isActive && (
          <div className="absolute inset-0 z-10 pointer-events-none opacity-[0.03] bg-gradient-to-b from-transparent via-white to-transparent animate-scan-line" />
        )}

        <video ref={videoRef} className={`absolute inset-0 w-full h-full object-cover ${isActive ? 'opacity-100' : 'opacity-0'}`} muted playsInline autoPlay />

        {/* Overlay states */}
        {cameraStatus === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-600">
            <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="text-[11px] font-mono">camera::idle</span>
          </div>
        )}

        {isStarting && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {cameraStatus === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-accent-red p-4 text-center">
            <span className="text-[10px] font-mono leading-relaxed">{errorMessage || 'camera::error'}</span>
          </div>
        )}

        {/* Frame count badge */}
        {isActive && (
          <div className="absolute top-2 right-2 z-20">
            <span className="badge-green text-[10px]">● REC</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button onClick={handleToggle} disabled={isStarting}
          className={`flex-1 py-1.5 text-[11px] font-mono rounded-sm transition-colors duration-150
            ${isActive
              ? 'bg-accent-red/15 text-accent-red border border-accent-red/30 hover:bg-accent-red/20'
              : 'bg-brand-600/20 text-brand-400 border border-brand-500/30 hover:bg-brand-600/30'}`}
        >
          {isActive ? 'stop()' : 'start()'}
        </button>
      </div>

      {/* Scene Analysis */}
      <div className="border-t border-surface-border pt-3">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Scene</span>
        <div className="mt-2 p-2 rounded-sm bg-black/20 border border-surface-border min-h-[60px]">
          <code className="text-[11px] font-mono text-gray-500 leading-relaxed">
            {'// scene analysis pending...'}
          </code>
        </div>
      </div>
    </div>
  );
}

export default CameraPanel;
