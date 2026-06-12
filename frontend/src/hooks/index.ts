/**
 * 自定义 Hooks
 */

export { useMediaDevice } from './useMediaDevice';
export type { UseMediaDeviceReturn, CameraStatus, FrameCallback } from './useMediaDevice';

export { useAudioRecorder } from './useAudioRecorder';
export type { UseAudioRecorderReturn, RecorderStatus, VolumeSample } from './useAudioRecorder';

export { useTTS } from './useTTS';
export type { UseTTSReturn, TTSStatus } from './useTTS';
