/**
 * VisionChatPage — 三栏 + Flow 布局
 *
 *  Left  (280px): CameraPanel
 *  Center (flex-1): AgentFlowPanel + ChatPanel
 *  Right  (340px): AgentDashboard / CostDashboard (Tab 切换)
 */

import { useState, useEffect } from 'react';
import CameraPanel from '../components/CameraPanel';
import ChatPanel from '../components/ChatPanel';
import AgentDashboard from '../components/AgentDashboard';
import CostDashboard from '../components/CostDashboard';
import AgentFlowPanel from '../components/AgentFlowPanel';
import VoiceInteraction from '../components/VoiceInteraction';
import type { VoiceState } from '../components/VoiceInteraction';
import type { NodeStatus } from '../components/AgentFlowPanel';

type RightTab = 'agent' | 'cost';

function useDemoFlow() {
  const [active, setActive] = useState(-1);
  const [statuses, setStatuses] = useState<NodeStatus[]>(Array(7).fill('idle'));

  useEffect(() => {
    let step = 0;
    const total = 7;
    const interval = setInterval(() => {
      if (step >= total) {
        setTimeout(() => { setActive(-1); setStatuses(Array(7).fill('idle')); }, 2000);
        step = 0;
        return;
      }
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

function useDemoVoice() {
  const [voice, setVoice] = useState<VoiceState>('idle');
  useEffect(() => {
    const states: VoiceState[] = ['idle', 'listening', 'thinking', 'speaking'];
    let i = 0;
    const timer = setInterval(() => {
      i = (i + 1) % states.length;
      setVoice(states[i]);
      if (i === 0) setTimeout(() => setVoice('idle'), 4000);
    }, 5000);
    return () => clearInterval(timer);
  }, []);
  return voice;
}

function VisionChatPage() {
  const { active, statuses } = useDemoFlow();
  const voiceState = useDemoVoice();
  const [rightTab, setRightTab] = useState<RightTab>('agent');

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ===== LEFT ===== */}
      <aside className="w-[280px] shrink-0 border-r border-surface-border flex flex-col bg-surface overflow-y-auto">
        <CameraPanel />
      </aside>

      {/* ===== CENTER ===== */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface">
        <div className="h-[180px] shrink-0 border-b border-surface-border">
          <div className="flex items-center justify-between px-4 py-2 border-b border-surface-border bg-surface-raised/50">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Workflow</span>
              <span className="text-[9px] font-mono text-gray-600">step {active + 1}/7</span>
            </div>
            <div className="flex items-center gap-3">
              <VoiceInteraction state={voiceState} compact />
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                <span className="text-[9px] font-mono text-gray-500">live</span>
              </div>
            </div>
          </div>
          <AgentFlowPanel activeNode={active} nodeStatuses={statuses} className="h-[calc(100%-33px)]" />
        </div>
        <div className="flex-1 min-h-0"><ChatPanel /></div>
      </main>

      {/* ===== RIGHT: Tabs ===== */}
      <aside className="w-[340px] shrink-0 border-l border-surface-border flex flex-col bg-surface overflow-y-auto">
        {/* Tab bar */}
        <div className="flex shrink-0 border-b border-surface-border bg-surface-raised/50">
          {([
            { id: 'agent', label: 'Agent' },
            { id: 'cost', label: 'Cost' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setRightTab(tab.id)}
              className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors
                ${rightTab === tab.id
                  ? 'text-white border-b-2 border-brand-500 bg-brand-500/5'
                  : 'text-gray-600 hover:text-gray-400'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {/* Tab content */}
        {rightTab === 'agent' ? <AgentDashboard /> : <CostDashboard />}
      </aside>
    </div>
  );
}

export default VisionChatPage;
