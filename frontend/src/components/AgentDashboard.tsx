/**
 * AgentDashboard — Agent 状态 / 工具调用 / 成本监控
 *
 * 设计: 终端风格面板，实时数据流
 */

function AgentDashboard() {
  return (
    <div className="flex flex-col p-3 gap-4">
      {/* === Agent Status === */}
      <section>
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Agent</span>
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between p-2 rounded-sm bg-surface-overlay border border-surface-border">
            <span className="text-[11px] font-mono text-gray-500">graph</span>
            <span className="badge-green text-[10px]">running</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-sm bg-surface-overlay border border-surface-border">
            <span className="text-[11px] font-mono text-gray-500">node</span>
            <span className="text-[11px] font-mono text-accent-cyan">planner_node</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-sm bg-surface-overlay border border-surface-border">
            <span className="text-[11px] font-mono text-gray-500">state</span>
            <span className="badge-cyan text-[10px]">6 nodes</span>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* === Tool Calls === */}
      <section>
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Tools</span>
        <div className="mt-2 space-y-1.5">
          {[
            { name: 'get_time', status: 'ready', latency: '-' },
            { name: 'calculator', status: 'ready', latency: '-' },
            { name: 'weather', status: 'ready', latency: '-' },
            { name: 'web_search', status: 'ready', latency: '-' },
          ].map(tool => (
            <div key={tool.name} className="flex items-center justify-between px-2 py-1.5 rounded-sm bg-surface-overlay/50 border border-surface-border hover:border-brand-500/20 transition-colors cursor-default">
              <code className="text-[11px] font-mono text-gray-300">{tool.name}()</code>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-gray-600">{tool.latency}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="divider" />

      {/* === Cost Monitor === */}
      <section>
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Cost</span>
        <div className="mt-2 space-y-2">
          {/* Token usage bar */}
          <div>
            <div className="flex justify-between text-[10px] font-mono text-gray-500 mb-1">
              <span>tokens</span>
              <span>1,247 / 2,000</span>
            </div>
            <div className="h-1 bg-surface-overlay rounded-full overflow-hidden">
              <div className="h-full w-[62%] bg-brand-500 rounded-full transition-all duration-500" />
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'vision', cost: '$0.004', calls: '2' },
              { label: 'chat', cost: '$0.008', calls: '5' },
              { label: 'stt', cost: '$0.002', calls: '1' },
              { label: 'tts', cost: '$0.000', calls: '3' },
            ].map(item => (
              <div key={item.label} className="p-2 rounded-sm bg-surface-overlay border border-surface-border">
                <code className="text-[10px] font-mono text-gray-500">{item.label}</code>
                <div className="flex justify-between items-baseline mt-1">
                  <span className="text-[12px] font-mono text-gray-200">{item.cost}</span>
                  <span className="text-[10px] font-mono text-gray-600">{item.calls}×</span>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex justify-between items-center px-2 py-1.5 rounded-sm bg-brand-600/10 border border-brand-500/20">
            <span className="text-[11px] font-mono text-gray-400">total</span>
            <span className="text-[12px] font-mono text-brand-400">$0.014</span>
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* === Optimization Stats === */}
      <section>
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Optimization</span>
        <div className="mt-2 space-y-1.5">
          {[
            { label: 'frame skip rate', value: '82%' },
            { label: 'cache hit rate', value: '53%' },
            { label: 'token saved', value: '1,250' },
          ].map(stat => (
            <div key={stat.label} className="flex justify-between px-2 py-1">
              <span className="text-[10px] font-mono text-gray-500">{stat.label}</span>
              <span className="text-[11px] font-mono text-accent-green">{stat.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AgentDashboard;
