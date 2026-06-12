export default function AgentDrawer() {
  return (
    <div className="p-4 space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent Monitor</h3>
      <div>
        <span className="text-[10px] text-gray-500">Memory</span>
        <div className="mt-1.5 space-y-1 text-[11px]">
          <div className="flex justify-between"><span className="text-gray-400">Total Scenes</span><span className="font-mono">7/10</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Important Objects</span><span className="font-mono text-blue-500">Laptop, Cup, Keyboard</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Dominant Type</span><span className="font-mono text-green-500">office</span></div>
        </div>
      </div>
      <div>
        <span className="text-[10px] text-gray-500">Tool Calls</span>
        <div className="mt-1.5 space-y-1 text-[11px] font-mono">
          {[{n:'get_time',t:'234ms'},{n:'vision_analysis',t:'312ms'},{n:'calculator',t:'128ms'}].map(t => (
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
          <div className="flex justify-between"><span className="text-gray-400">Tokens</span><span className="font-mono">1,247 / 2,000</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Est. Cost</span><span className="font-mono text-green-500">$0.014</span></div>
        </div>
      </div>
    </div>
  );
}
