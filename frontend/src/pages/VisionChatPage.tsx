/**
 * VisionChatPage — 视觉聊天主页面
 *
 * 整合 CameraPanel、VoiceRecorder、AudioPlayer 和对话区域。
 * 左侧：CameraPanel（摄像头画面 + 帧捕获上传）
 * 右侧：VoiceRecorder + AudioPlayer + 对话记录
 */

import { CameraPanel, VoiceRecorder, AudioPlayer } from '../components';

/** 示例 AI 回复文本（后续对接 multimodal chat 服务后实时传入） */
const DEMO_AI_RESPONSE = '你好！我是你的 AI 视觉助手。我可以通过摄像头看到你周围的场景，也能听懂你的语音。请随时向我提问，我会结合视觉信息给你最准确的回答。';

function VisionChatPage() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 max-w-7xl mx-auto">
      {/* ===== 左侧：摄像头区域 ===== */}
      <section className="flex-1">
        <CameraPanel />
      </section>

      {/* ===== 右侧：语音 + 对话区域 ===== */}
      <section className="flex-1 flex flex-col gap-4">
        {/* 语音录制 */}
        <VoiceRecorder />

        {/* AI 语音播报 + 控制 */}
        <div className="glass-card p-4">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            🔊 AI 语音播报
          </h2>
          <AudioPlayer text={DEMO_AI_RESPONSE} mode="inline" />
        </div>

        {/* 聊天消息列表 */}
        <div className="glass-card p-4 flex-1 min-h-[200px] max-h-[400px] overflow-y-auto">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            💬 对话记录
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-ai-primary flex items-center justify-center text-sm flex-shrink-0">
                AI
              </div>
              <div className="bg-ai-surface rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%]">
                <p className="text-sm text-gray-300">
                  开启摄像头后可视觉分析，录制语音后可对话。
                  <br />
                  我的回复会自动语音播报 🔊
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 设置 */}
        <button
          className="w-12 h-12 rounded-xl bg-ai-surface border border-ai-border 
                     flex items-center justify-center hover:bg-ai-border transition-colors self-end"
          title="设置"
        >
          ⚙️
        </button>
      </section>
    </div>
  );
}

export default VisionChatPage;
