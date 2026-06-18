import type { VisionContext } from '../App';

interface Props {
  phase: string;
  vision: VisionContext;
}

const PHASE_LABELS: Record<string, string> = {
  idle: 'Idle',
  planning: 'Planning',
  reasoning: 'Reasoning',
  responding: 'Responding',
  done: 'Done',
  error: 'Error',
};

export default function AgentDrawer({ phase, vision }: Props) {
  return (
    <div className="p-4 space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent Monitor</h3>
      <div>
        <span className="text-[10px] text-gray-500">Current Phase</span>
        <div className="mt-1.5 flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${phase === 'error' ? 'bg-red-500' : phase === 'idle' || phase === 'done' ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`} />
          <span>{PHASE_LABELS[phase] || phase}</span>
        </div>
      </div>
      <div>
        <span className="text-[10px] text-gray-500">Memory</span>
        <div className="mt-1.5 space-y-1 text-[11px]">
          <div className="flex justify-between"><span className="text-gray-400">Scene Source</span><span className="font-mono">{vision.source}</span></div>
          <div className="flex justify-between gap-2"><span className="text-gray-400">Important Objects</span><span className="font-mono text-blue-500 text-right">{vision.objects.map(o => o.name).slice(0, 3).join(', ') || '-'}</span></div>
          <div className="flex justify-between gap-2"><span className="text-gray-400">Scene</span><span className="font-mono text-green-500 text-right">{vision.scene || '-'}</span></div>
        </div>
      </div>
      <div>
        <span className="text-[10px] text-gray-500">Tool Calls</span>
        <div className="mt-1.5 space-y-1 text-[11px] font-mono">
          {[{n:'vision_analyze',t:'8s cadence'},{n:'stt',t:'on demand'},{n:'tts',t:'on reply'}].map(t => (
            <div key={t.n} className="flex justify-between text-gray-400"><span>{t.n}()</span><span>{t.t}</span></div>
          ))}
        </div>
      </div>
      <div>
        <span className="text-[10px] text-gray-500">Workflow</span>
        <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] font-mono">
          {['Voice','Vision','Memory','Planner','Tool','Reasoning','Response'].map(n => (
            <span key={n} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">{n}</span>
          ))}
        </div>
      </div>
      <div>
        <span className="text-[10px] text-gray-500">Cost</span>
        <div className="mt-1.5 space-y-1 text-[11px]">
          <div className="flex justify-between"><span className="text-gray-400">Vision Calls</span><span className="font-mono">on interval/manual</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Reply Budget</span><span className="font-mono text-green-500">short answer</span></div>
        </div>
      </div>
    </div>
  );
}
