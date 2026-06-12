/**
 * VisionChatPage — 三栏 + Flow 布局
 *
 *  Left  (280px): CameraPanel + SceneAnalysis
 *  Center (flex-1): AgentFlowPanel + ChatPanel
 *  Right  (320px): AgentDashboard
 */

import { useState, useEffect } from 'react';
import CameraPanel from '../components/CameraPanel';
import ChatPanel from '../components/ChatPanel';
import AgentDashboard from '../components/AgentDashboard';
import AgentFlowPanel from '../components/AgentFlowPanel';
import type { NodeStatus } from '../components/AgentFlowPanel';

/** Mock execution flow demo — cycles through nodes */
function useDemoFlow() {
  const [active, setActive] = useState(-1);
  const [statuses, setStatuses] = useState<NodeStatus[]>(
    Array(7).fill('idle'),
  );

  useEffect(() => {
    let step = 0;
    const total = 7;
    const interval = setInterval(() => {
      if (step >= total) {
        // Reset cycle
        setTimeout(() => {
          setActive(-1);
          setStatuses(Array(7).fill('idle'));
        }, 2000);
        step = 0;
        return;
      }

      // Mark previous as complete
      setStatuses(prev => {
        const next = [...prev];
        if (step > 0) next[step - 1] = 'complete';
        next[step] = 'running';
        return next;
      });
      setActive(step);
      step++;
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  return { active, statuses };
}

function VisionChatPage() {
  const { active, statuses } = useDemoFlow();

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ===== LEFT: Camera + Scene ===== */}
      <aside className="w-[280px] shrink-0 border-r border-surface-border flex flex-col bg-surface overflow-y-auto">
        <CameraPanel />
      </aside>

      {/* ===== CENTER: Flow + Chat ===== */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface">
        {/* Agent Flow Visualization */}
        <div className="h-[180px] shrink-0 border-b border-surface-border">
          <div className="flex items-center justify-between px-4 py-2 border-b border-surface-border bg-surface-raised/50">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Workflow</span>
              <span className="text-[9px] font-mono text-gray-600">
                step {active + 1}/7
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
              <span className="text-[9px] font-mono text-gray-500">live</span>
            </div>
          </div>
          <AgentFlowPanel
            activeNode={active}
            nodeStatuses={statuses}
            className="h-[calc(100%-33px)]"
          />
        </div>

        {/* Chat */}
        <div className="flex-1 min-h-0">
          <ChatPanel />
        </div>
      </main>

      {/* ===== RIGHT: Agent Dashboard ===== */}
      <aside className="w-[320px] shrink-0 border-l border-surface-border flex flex-col bg-surface overflow-y-auto">
        <AgentDashboard />
      </aside>
    </div>
  );
}

export default VisionChatPage;
