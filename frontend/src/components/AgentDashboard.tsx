/**
 * AgentDashboard — SaaS Dashboard 风格
 *
 * 实时监控面板:
 *   Node Flow  — 6 节点可视化流程 + 当前活跃节点高亮
 *   Memory     — 场景记忆存储 (物体/场景类型/轮次)
 *   Tool Calls — 调用历史 + 参数 + 耗时
 *   Tokens     — 实时消耗仪表盘
 *
 * 参考: Cursor AI Panel · OpenAI Playground · Vercel Dashboard
 */

import { useState } from 'react';

// ============================================================
// Types
// ============================================================

interface ToolCallRecord {
  id: string;
  name: string;
  params: string;
  result: string;
  latencyMs: number;
  timestamp: number;
}

interface MemorySnapshot {
  totalScenes: number;
  importantObjects: string[];
  dominantType: string;
  typeHistory: string[];
}

interface TokenUsage {
  total: number;
  budget: number;
  breakdown: { label: string; tokens: number; color: string }[];
}

// ============================================================
// Mock Data
// ============================================================

const ACTIVE_NODE = 'reasoning';

const TOOL_HISTORY: ToolCallRecord[] = [
  { id: 't1', name: 'get_time',  params: '{}',              result: '2026-06-12 14:30', latencyMs: 234, timestamp: Date.now() - 120000 },
  { id: 't2', name: 'calculator', params: '{expr:"15*8+3"}', result: '123',              latencyMs: 156, timestamp: Date.now() - 90000 },
  { id: 't3', name: 'weather',   params: '{city:"北京"}',    result: '晴 18°C',          latencyMs: 312, timestamp: Date.now() - 45000 },
  { id: 't4', name: 'calculator', params: '{expr:"2**8"}',   result: '256',              latencyMs: 128, timestamp: Date.now() - 20000 },
];

const MEMORY_DATA: MemorySnapshot = {
  totalScenes: 7,
  importantObjects: ['笔记本电脑', '咖啡杯', '手机', '水杯', '书本'],
  dominantType: 'office',
  typeHistory: ['office', 'office', 'office', 'coding', 'coding', 'office', 'office'],
};

const TOKEN_DATA: TokenUsage = {
  total: 1247,
  budget: 2000,
  breakdown: [
    { label: 'vision', tokens: 320, color: '#3b82f6' },
    { label: 'chat', tokens: 580, color: '#3b82f6' },
    { label: 'memory', tokens: 180, color: '#22c55e' },
    { label: 'tools', tokens: 120, color: '#3b82f6' },
    { label: 'other', tokens: 47, color: '#30363d' },
  ],
};

// ============================================================
// Sub-components
// ============================================================

function NodeFlowGraph({ activeNode }: { activeNode: string }) {
  const w = 220, h = 110, r = 8;

  // Layout positions (scaled to SVG viewport)
  const pos: Record<string, [number, number]> = {
    planner:   [w/2, 14],
    vision:    [30, 55],
    tool:      [w/2, 55],
    reasoning: [w-30, 55],
    memory:    [30, 95],
    response:  [w-30, 95],
  };

  const edges = [
    ['planner', 'vision'], ['planner', 'tool'], ['planner', 'reasoning'],
    ['vision', 'memory'], ['memory', 'reasoning'],
    ['tool', 'reasoning'], ['reasoning', 'response'],
  ];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: '110px' }}>
      {/* Edges */}
      {edges.map(([from, to], i) => {
        const [x1, y1] = pos[from]!;
        const [x2, y2] = pos[to]!;
        const isActive = from === activeNode || to === activeNode;
        return (
          <line key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={isActive ? '#3b82f6' : '#30363d'}
            strokeWidth={isActive ? 1.5 : 1}
            strokeDasharray={to === 'reasoning' ? '3 2' : undefined}
            className="transition-colors duration-500"
          />
        );
      })}

      {/* Nodes */}
      {Object.entries(pos).map(([id, [cx, cy]]) => {
        const isActive = id === activeNode;
        return (
          <g key={id}>
            {isActive && (
              <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#3b82f6" strokeWidth={1}
                className="animate-pulse" opacity={0.3} />
            )}
            <circle cx={cx} cy={cy} r={r}
              fill={isActive ? '#3b82f6' : '#21262d'}
              stroke={isActive ? '#3b82f6' : '#30363d'}
              strokeWidth={1}
              className="transition-all duration-500"
            />
            <text x={cx} y={cy + 3} textAnchor="middle"
              fill={isActive ? '#fff' : '#6e7681'}
              className="text-[6px] font-mono"
            >{id[0].toUpperCase()}</text>
          </g>
        );
      })}
    </svg>
  );
}

function TokenRing({ total, budget, breakdown }: TokenUsage) {
  const pct = Math.min(100, Math.round((total / budget) * 100));
  const circumference = 2 * Math.PI * 28;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      {/* Ring */}
      <div className="relative w-[72px] h-[72px] shrink-0">
        <svg viewBox="0 0 72 72" className="-rotate-90">
          <circle cx="36" cy="36" r="28" fill="none" stroke="#21262d" strokeWidth="6" />
          <circle cx="36" cy="36" r="28" fill="none" stroke="url(#tokenGrad)" strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700"
          />
          <defs>
            <linearGradient id="tokenGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[13px] font-mono font-semibold text-white">{pct}%</span>
          <span className="text-[9px] font-mono text-gray-500">{total}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-1">
        {breakdown.slice(0, 4).map(b => (
          <div key={b.label} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
              <span className="text-[10px] font-mono text-gray-500">{b.label}</span>
            </div>
            <span className="text-[10px] font-mono text-gray-400">{b.tokens}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

function AgentDashboard() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (section: string) =>
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));

  const SectionHeader = ({ title, section, extra }: { title: string; section: string; extra?: React.ReactNode }) => (
    <button
      onClick={() => toggle(section)}
      className="w-full flex items-center justify-between py-2 px-1 hover:bg-surface-overlay/50 rounded-sm transition-colors group"
    >
      <div className="flex items-center gap-2">
        <svg
          className={`w-3 h-3 text-gray-600 transition-transform duration-200 ${collapsed[section] ? '-rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{title}</span>
      </div>
      {extra}
    </button>
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* ================================================================ */}
      {/* Section 1: Node Flow                                              */}
      {/* ================================================================ */}
      <div className="border-b border-surface-border">
        <SectionHeader title="Graph Flow" section="flow"
          extra={<span className="dot-green" />}
        />
        {!collapsed['flow'] && (
          <div className="px-3 pb-3">
            <NodeFlowGraph activeNode={ACTIVE_NODE} />
            <div className="flex items-center justify-between mt-2 px-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <code className="text-[11px] font-mono text-accent">{ACTIVE_NODE}_node</code>
              </div>
              <span className="text-[9px] font-mono text-gray-600">6 nodes</span>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* Section 2: Memory State                                          */}
      {/* ================================================================ */}
      <div className="border-b border-surface-border">
        <SectionHeader title="Memory" section="memory"
          extra={<span className="text-[9px] font-mono text-gray-600">{MEMORY_DATA.totalScenes} scenes</span>}
        />
        {!collapsed['memory'] && (
          <div className="px-3 pb-3 space-y-2">
            {/* Scene count */}
            <div className="flex items-center justify-between px-2 py-1.5 rounded-sm bg-surface-overlay/50">
              <span className="text-[10px] font-mono text-gray-500">total_scenes</span>
              <span className="text-[11px] font-mono text-gray-200">{MEMORY_DATA.totalScenes} / 10</span>
            </div>

            {/* Important objects */}
            <div>
              <span className="text-[9px] font-mono text-gray-600 px-1">objects</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {MEMORY_DATA.importantObjects.map(obj => (
                  <span key={obj} className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary-400 border border-primary/20">
                    {obj}
                  </span>
                ))}
              </div>
            </div>

            {/* Type history pills */}
            <div>
              <span className="text-[9px] font-mono text-gray-600 px-1">type_history</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {MEMORY_DATA.typeHistory.map((t, i) => (
                  <span key={i} className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm border ${
                    t === 'office'
                      ? 'bg-primary-400/10 text-primary-400 border-primary-400/20'
                      : 'bg-primary/10 text-primary border-primary/20'
                  }`}>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Dominant type */}
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-mono text-gray-500">dominant</span>
              <span className="badge-cyan text-[10px]">{MEMORY_DATA.dominantType}</span>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* Section 3: Tool Call History                                     */}
      {/* ================================================================ */}
      <div className="border-b border-surface-border">
        <SectionHeader title="Tool Calls" section="tools"
          extra={<span className="text-[9px] font-mono text-gray-600">{TOOL_HISTORY.length} calls</span>}
        />
        {!collapsed['tools'] && (
          <div className="px-3 pb-3 space-y-1">
            {TOOL_HISTORY.map(call => (
              <div key={call.id}
                className="px-2 py-2 rounded-sm bg-surface-overlay/30 border border-surface-border hover:border-primary/20 transition-colors group"
              >
                {/* Header row */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      call.latencyMs < 200 ? 'bg-accent' :
                      call.latencyMs < 400 ? 'bg-warning' : 'bg-danger'
                    }`} />
                    <code className="text-[11px] font-mono text-gray-300">{call.name}</code>
                  </div>
                  <span className="text-[9px] font-mono text-gray-600">{call.latencyMs}ms</span>
                </div>
                {/* Params + Result */}
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <code className="text-[9px] font-mono text-gray-600">{call.params}</code>
                  </div>
                  <div className="text-right">
                    <code className="text-[10px] font-mono text-accent">{call.result}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* Section 4: Token Consumption                                     */}
      {/* ================================================================ */}
      <div className="border-b border-surface-border">
        <SectionHeader title="Tokens" section="tokens"
          extra={<span className="text-[9px] font-mono text-gray-600">{TOKEN_DATA.total}/{TOKEN_DATA.budget}</span>}
        />
        {!collapsed['tokens'] && (
          <div className="px-3 pb-3">
            <TokenRing {...TOKEN_DATA} />

            {/* Budget bar */}
            <div className="mt-3">
              <div className="flex justify-between text-[9px] font-mono text-gray-600 mb-1">
                <span>budget usage</span>
                <span>{Math.round((TOKEN_DATA.total / TOKEN_DATA.budget) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-surface-overlay rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (TOKEN_DATA.total / TOKEN_DATA.budget) * 100)}%`,
                    background: 'linear-gradient(90deg, #3b82f6, #22c55e)',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] font-mono text-gray-600">$0.014</span>
                <span className="text-[9px] font-mono text-gray-600">est. $0.035</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* Section 5: Stats Footer                                          */}
      {/* ================================================================ */}
      <div className="p-3">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'cache hit', value: '53%', color: 'text-accent' },
            { label: 'frame skip', value: '82%', color: 'text-accent' },
            { label: 'avg latency', value: '207ms', color: 'text-primary-400' },
            { label: 'uptime', value: '24m', color: 'text-gray-400' },
          ].map(stat => (
            <div key={stat.label} className="p-2 rounded-sm bg-surface-overlay/50 border border-surface-border">
              <div className="text-[9px] font-mono text-gray-600">{stat.label}</div>
              <div className={`text-[13px] font-mono font-semibold mt-0.5 ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AgentDashboard;
