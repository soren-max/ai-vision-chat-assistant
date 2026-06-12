/**
 * VisionChatPage — 三栏布局
 *
 *  Left  (280px): CameraPanel + SceneAnalysis
 *  Center (flex-1): ChatPanel
 *  Right  (320px): AgentDashboard
 */

import CameraPanel from '../components/CameraPanel';
import ChatPanel from '../components/ChatPanel';
import AgentDashboard from '../components/AgentDashboard';

function VisionChatPage() {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ===== LEFT: Camera + Scene ===== */}
      <aside className="w-[280px] shrink-0 border-r border-surface-border flex flex-col bg-surface overflow-y-auto">
        <CameraPanel />
      </aside>

      {/* ===== CENTER: Chat ===== */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface">
        <ChatPanel />
      </main>

      {/* ===== RIGHT: Agent Dashboard ===== */}
      <aside className="w-[320px] shrink-0 border-l border-surface-border flex flex-col bg-surface overflow-y-auto">
        <AgentDashboard />
      </aside>
    </div>
  );
}

export default VisionChatPage;
