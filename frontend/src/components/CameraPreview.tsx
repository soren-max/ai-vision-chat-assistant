import { useEffect, useRef, useState } from 'react';
import { useMediaDevice } from '../hooks/useMediaDevice';
import { apiClient } from '../services';

export default function CameraPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [minimized, setMinimized] = useState(false);
  const { stream, cameraStatus, startCamera, stopCamera } = useMediaDevice({ onFrameCaptured: b64 => apiClient.sendFrame(b64) });

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (stream && cameraStatus === 'active') { v.srcObject = stream; v.onloadedmetadata = () => v.play().catch(() => {}); }
    else v.srcObject = null;
    return () => { if (v) v.srcObject = null; };
  }, [stream, cameraStatus]);

  const isActive = cameraStatus === 'active';

  return (
    <div className={`rounded-xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 bg-black transition-all ${minimized ? 'w-12 h-12' : 'w-80'}`}>
      {minimized ? (
        <button onClick={() => setMinimized(false)} className="w-full h-full flex items-center justify-center bg-gray-900 text-white text-xs">
          📷
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 text-[11px] text-gray-400">
            <span>Camera Preview</span>
            <div className="flex items-center gap-2">
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
              <button onClick={() => { isActive ? stopCamera() : startCamera(); }} className="text-[10px] hover:text-white">{isActive ? 'Stop' : 'Start'}</button>
              <button onClick={() => setMinimized(true)} className="hover:text-white">−</button>
            </div>
          </div>
          <div className="aspect-video bg-black relative">
            <video ref={videoRef} className={`absolute inset-0 w-full h-full object-cover ${isActive ? 'opacity-100' : 'opacity-0'}`} muted playsInline autoPlay />
            {!isActive && <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs">Camera Off</div>}
          </div>
        </>
      )}
    </div>
  );
}
