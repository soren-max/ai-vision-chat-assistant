/**
 * CameraPanel — 自动驾驶感知风格界面
 *
 * 功能:
 * - 全幅视频背景
 * - Bounding Box 物体检测叠加（半透明彩色标签）
 * - 场景摘要底部栏
 * - 检测置信度 + 物体位置
 * - 平滑动画过渡
 *
 * 参考: Tesla Vision / Comma.ai / Mobileye 感知界面
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useMediaDevice } from '../hooks/useMediaDevice';
import { apiClient } from '../services';
import { toast } from './Toast';

const FRAME_INTERVAL_MS = 3000;

// ============================================================
// Types
// ============================================================

interface DetectedObject {
  id: string;
  label: string;
  confidence: number;   // 0-1
  x: number;            // 0-1 normalized
  y: number;
  w: number;
  h: number;
  color: string;
  status: 'stable' | 'new' | 'moving';
}

type DetectedObjects = Record<string, DetectedObject>;

// ============================================================
// Mock Detection Data (simulates vision analysis results)
// ============================================================

export const MOCK_SCENES: DetectedObjects[] = [
  // Scene 1: Office Desk
  {
    laptop:    { id:'laptop',    label:'Laptop',       confidence:0.97, x:0.30, y:0.35, w:0.40, h:0.30, color:'#3b82f6', status:'stable' },
    cup:       { id:'cup',       label:'Coffee Cup',   confidence:0.89, x:0.72, y:0.55, w:0.12, h:0.15, color:'#22c55e', status:'stable' },
    keyboard:  { id:'keyboard',  label:'Keyboard',     confidence:0.94, x:0.25, y:0.68, w:0.50, h:0.10, color:'#f59e0b', status:'stable' },
    phone:     { id:'phone',     label:'Phone',        confidence:0.82, x:0.80, y:0.40, w:0.08, h:0.14, color:'#3b82f6', status:'stable' },
  },
  // Scene 2: More objects
  {
    monitor:   { id:'monitor',   label:'Monitor',      confidence:0.96, x:0.20, y:0.10, w:0.60, h:0.45, color:'#3b82f6', status:'stable' },
    mouse:     { id:'mouse',     label:'Mouse',         confidence:0.88, x:0.75, y:0.70, w:0.08, h:0.06, color:'#22c55e', status:'stable' },
    notebook:  { id:'notebook',  label:'Notebook',      confidence:0.91, x:0.35, y:0.55, w:0.15, h:0.20, color:'#ef4444', status:'new' },
    water:     { id:'water',     label:'Water Bottle',  confidence:0.79, x:0.10, y:0.72, w:0.06, h:0.12, color:'#22c55e', status:'stable' },
  },
  // Scene 3: Person detected
  {
    person:    { id:'person',    label:'Person',        confidence:0.95, x:0.35, y:0.05, w:0.25, h:0.70, color:'#ef4444', status:'moving' },
    laptop:    { id:'laptop',    label:'Laptop',        confidence:0.93, x:0.05, y:0.40, w:0.35, h:0.28, color:'#3b82f6', status:'stable' },
    mug:       { id:'mug',       label:'Mug',           confidence:0.85, x:0.65, y:0.62, w:0.10, h:0.12, color:'#f59e0b', status:'stable' },
  },
];

// ============================================================
// Bounding Box Component
// ============================================================

function BoundingBox({ obj }: { obj: DetectedObject }) {
  const isNew = obj.status === 'new';
  const isMoving = obj.status === 'moving';

  return (
    <div
      className={`
        absolute border-2 rounded-sm transition-all duration-500
        ${isNew ? 'animate-fade-in' : ''}
        ${isMoving ? 'animate-pulse' : ''}
      `}
      style={{
        left: `${obj.x * 100}%`,
        top: `${obj.y * 100}%`,
        width: `${obj.w * 100}%`,
        height: `${obj.h * 100}%`,
        borderColor: obj.color,
        boxShadow: `0 0 12px ${obj.color}33, inset 0 0 12px ${obj.color}11`,
      }}
    >
      {/* Corner accents */}
      <span className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: obj.color }} />
      <span className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: obj.color }} />
      <span className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: obj.color }} />
      <span className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: obj.color }} />

      {/* Label */}
      <div
        className="absolute -top-7 left-0 flex items-center gap-2 px-2 py-0.5 rounded-sm text-[10px] font-mono whitespace-nowrap"
        style={{
          backgroundColor: `${obj.color}20`,
          borderColor: obj.color,
          borderWidth: 1,
          color: obj.color,
        }}
      >
        <span className="font-semibold">{obj.label}</span>
        <span className="opacity-70">{Math.round(obj.confidence * 100)}%</span>
        {isMoving && <span className="text-danger animate-pulse">●</span>}
      </div>
    </div>
  );
}

// ============================================================
// Scene Summary Bar
// ============================================================

function SceneSummary({ objects }: { objects: DetectedObject[] }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-8 bg-black/70 backdrop-blur-sm border-t border-white/10 flex items-center px-3 gap-3">
      <span className="text-[9px] font-mono text-gray-500 shrink-0">PERCEPTION</span>
      <div className="flex items-center gap-2 overflow-x-auto">
        {objects.map(obj => (
          <span
            key={obj.id}
            className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm shrink-0"
            style={{ backgroundColor: `${obj.color}20`, color: obj.color }}
          >
            {obj.label}
          </span>
        ))}
      </div>
      <span className="text-[9px] font-mono text-gray-600 ml-auto shrink-0">
        {objects.length} objects
      </span>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

function CameraPanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const [objects, setObjects] = useState<DetectedObjects>({});
  const [, setSceneIndex] = useState(0);

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

  // Mock detection cycle — simulates vision API returning objects
  useEffect(() => {
    if (cameraStatus !== 'active') {
      setObjects({});
      return;
    }

    // Initial scene
    setObjects(MOCK_SCENES[0]);

    // Cycle through scenes
    const cycle = setInterval(() => {
      setSceneIndex(prev => {
        const next = (prev + 1) % MOCK_SCENES.length;
        setObjects(MOCK_SCENES[next]);
        return next;
      });
    }, 4000);

    return () => clearInterval(cycle);
  }, [cameraStatus]);

  const isActive = cameraStatus === 'active';
  const isStarting = cameraStatus === 'starting';

  const handleToggle = useCallback(() => {
    if (isActive) {
      stopCamera();
      toast.info('Camera stopped');
    } else {
      startCamera();
      toast.info('Camera starting...');
    }
  }, [isActive, startCamera, stopCamera]);

  // Toast on status changes
  useEffect(() => {
    if (cameraStatus === 'active') toast.success('Camera active — analyzing scene');
    if (cameraStatus === 'error' && errorMessage) toast.error(errorMessage);
  }, [cameraStatus, errorMessage]);

  const objList = Object.values(objects);
  const statusDot = isActive ? 'dot-green' : cameraStatus === 'error' ? 'dot-red' : 'dot-purple';

  // Stats
  const highConf = objList.filter(o => o.confidence >= 0.9).length;
  const movingCount = objList.filter(o => o.status === 'moving').length;

  return (
    <div className="flex flex-col h-full">
      {/* === Header === */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border bg-surface-raised/50 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Camera</span>
          <span className={statusDot} />
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono text-gray-600">
          {isActive && (
            <>
              <span>{objList.length} det</span>
              <span className="w-px h-3 bg-surface-border" />
              <span className="text-accent">{highConf} high</span>
              {movingCount > 0 && (
                <>
                  <span className="w-px h-3 bg-surface-border" />
                  <span className="text-danger">{movingCount} mov</span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* === Video Area with Perception Overlay === */}
      <div className={`
        relative flex-1 min-h-0 overflow-hidden border-b border-surface-border
        ${isActive ? 'bg-black' : 'bg-surface-overlay'}
      `}>
        {/* Grid overlay (autonomous driving style) */}
        {isActive && (
          <div className="absolute inset-0 z-10 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />
        )}

        {/* Scan line */}
        {isActive && (
          <div className="absolute inset-0 z-10 pointer-events-none opacity-[0.02] bg-gradient-to-b from-transparent via-white to-transparent animate-scan-line" />
        )}

        {/* Video */}
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover ${isActive ? 'opacity-100' : 'opacity-0'}`}
          muted playsInline autoPlay
        />

        {/* === Bounding Boxes === */}
        {isActive && objList.map(obj => (
          <BoundingBox key={obj.id} obj={obj} />
        ))}

        {/* === Scene Summary Bar === */}
        {isActive && objList.length > 0 && (
          <SceneSummary objects={objList} />
        )}

        {/* === Overlay States === */}
        {cameraStatus === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-600 z-20">
            <div className="w-12 h-12 rounded-full border-2 border-gray-700 flex items-center justify-center">
              <svg className="w-6 h-6 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-center">
              <div className="text-[11px] font-mono">camera::idle</div>
              <div className="text-[9px] font-mono text-gray-700 mt-1">press start() to initialize</div>
            </div>
          </div>
        )}

        {isStarting && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-surface-overlay/50">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] font-mono text-gray-500">initializing...</span>
            </div>
          </div>
        )}

        {cameraStatus === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-danger z-20 bg-surface-overlay/50">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-[10px] font-mono max-w-[200px] text-center leading-relaxed">{errorMessage || 'camera::error'}</span>
            <button onClick={startCamera} className="mt-2 px-3 py-1 text-[10px] font-mono rounded-sm bg-danger/15 border border-danger/30 hover:bg-danger/20 transition-colors">
              retry()
            </button>
          </div>
        )}

        {/* REC badge */}
        {isActive && (
          <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-black/60 border border-accent/30 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[9px] font-mono text-accent">REC</span>
          </div>
        )}
      </div>

      {/* === Controls === */}
      <div className="p-3 shrink-0 border-b border-surface-border">
        <button
          onClick={handleToggle}
          disabled={isStarting}
          className={`w-full py-1.5 text-[11px] font-mono rounded-sm transition-all duration-200
            ${isActive
              ? 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/20'
              : 'bg-primary/20 text-primary-400 border border-primary/30 hover:bg-primary/30'}`}
        >
          {isActive ? 'stop()' : isStarting ? 'initializing...' : 'start()'}
        </button>
      </div>

      {/* === Detection Details === */}
      {isActive && objList.length > 0 && (
        <div className="p-3 shrink-0">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Detections</div>
          <div className="space-y-1">
            {objList.map(obj => (
              <div
                key={obj.id}
                className="flex items-center justify-between px-2 py-1.5 rounded-sm bg-surface-overlay/50 border border-surface-border hover:border-primary/20 transition-colors"
                style={{ borderLeftWidth: 2, borderLeftColor: obj.color }}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    obj.status === 'moving' ? 'bg-danger animate-pulse' :
                    obj.status === 'new' ? 'bg-warning' : 'bg-accent'
                  }`} />
                  <code className="text-[10px] font-mono text-gray-300">{obj.label}</code>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-mono text-gray-600">
                    {Math.round(obj.x * 100)},{Math.round(obj.y * 100)}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: obj.color }}>
                    {Math.round(obj.confidence * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CameraPanel;
