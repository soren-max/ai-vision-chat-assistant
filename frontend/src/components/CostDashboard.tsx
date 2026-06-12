/**
 * CostDashboard — 企业级成本监控面板
 *
 * 展示:
 * - 6 统计卡片 (GPT/Vision/Whisper/Token/Cost/Saved)
 * - 2 折线图 (API 调用趋势 / Token 消耗趋势)
 * - 实时自动刷新 (3s)
 *
 * 风格: Datadog / Grafana 企业监控
 */

import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';

// ============================================================
// Mock Time-Series Generator
// ============================================================

function generateTimeSeries(minutes: number, baseValue: number, variance: number) {
  const now = Date.now();
  return Array.from({ length: minutes }, (_, i) => ({
    time: new Date(now - (minutes - i) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: Math.max(0, baseValue + Math.round((Math.random() - 0.5) * variance)),
  }));
}

// ============================================================
// Chart Colors
// ============================================================

const COLORS = {
  gpt: '#6c5ce7',
  vision: '#a371f7',
  whisper: '#39d2c0',
  token: '#58a6ff',
  saved: '#3fb950',
  cost: '#f85149',
};

// ============================================================
// Stat Card
// ============================================================

function StatCard({
  title, value, unit, delta, deltaLabel, color, icon,
}: {
  title: string;
  value: string | number;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  color: string;
  icon: string;
}) {
  const isPositive = (delta ?? 0) > 0;

  return (
    <div className="p-4 rounded-sm border border-surface-border bg-surface-overlay/50 hover:border-surface-border/80 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
        <span className="text-sm">{icon}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-mono font-semibold text-white tabular-nums">{value}</span>
        {unit && <span className="text-[11px] font-mono text-gray-500">{unit}</span>}
      </div>
      {delta !== undefined && (
        <div className="flex items-center gap-1.5 mt-2">
          <span className={`text-[10px] font-mono ${isPositive ? 'text-accent-green' : 'text-accent-red'}`}>
            {isPositive ? '↑' : '↓'} {Math.abs(delta)}%
          </span>
          {deltaLabel && <span className="text-[9px] font-mono text-gray-600">{deltaLabel}</span>}
        </div>
      )}
      {/* Mini sparkline bar */}
      <div className="mt-2 h-1 rounded-full bg-surface overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(95, Math.random() * 40 + 30)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

function CostDashboard() {
  const [tick, setTick] = useState(0);
  const [chatData, setChatData] = useState(() => generateTimeSeries(30, 8, 6));
  const [visionData, setVisionData] = useState(() => generateTimeSeries(30, 4, 3));
  const [tokenData, setTokenData] = useState(() => generateTimeSeries(30, 400, 300));

  // Auto-refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
      setChatData(generateTimeSeries(30, 8, 6));
      setVisionData(generateTimeSeries(30, 4, 3));
      setTokenData(generateTimeSeries(30, 400, 300));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Computed stats
  const stats = useMemo(() => {
    const totalChat = chatData.reduce((s, d) => s + d.value, 0);
    const totalVision = visionData.reduce((s, d) => s + d.value, 0);
    const totalTokens = tokenData.reduce((s, d) => s + d.value, 0);
    const visionSkipped = Math.round(totalVision * 0.65);
    const estCost = ((totalTokens / 1000) * 0.002 + totalVision * 0.002 + totalChat * 0.001).toFixed(4);

    return { totalChat, totalVision, totalTokens, visionSkipped, estCost };
  }, [chatData, visionData, tokenData]);

  // Pie data
  const pieData = [
    { name: 'GPT', value: stats.totalChat, color: COLORS.gpt },
    { name: 'Vision', value: stats.totalVision, color: COLORS.vision },
    { name: 'Whisper', value: Math.round(stats.totalTokens * 0.1), color: COLORS.whisper },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* === Header === */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-surface-raised/50 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Cost Monitor</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
            <span className="text-[9px] font-mono text-gray-600">live</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono text-gray-600">
          <span>refresh: 5s</span>
          <span className="w-px h-3 bg-surface-border" />
          <span>updated {tick}×</span>
        </div>
      </div>

      {/* === Stats Grid === */}
      <div className="grid grid-cols-3 gap-3 p-4 shrink-0">
        <StatCard title="GPT Calls" value={stats.totalChat} unit="calls" delta={12} deltaLabel="vs last hour" color={COLORS.gpt} icon="💬" />
        <StatCard title="Vision Calls" value={stats.totalVision} unit="calls" delta={-8} deltaLabel="vs last hour" color={COLORS.vision} icon="👁️" />
        <StatCard title="Whisper Calls" value={Math.round(stats.totalTokens * 0.1)} unit="calls" delta={5} deltaLabel="vs last hour" color={COLORS.whisper} icon="🎤" />
        <StatCard title="Token Usage" value={(stats.totalTokens / 1000).toFixed(1)} unit="K tokens" delta={-15} deltaLabel="saved" color={COLORS.token} icon="📊" />
        <StatCard title="Est. Cost" value={`$${stats.estCost}`} delta={-22} deltaLabel="optimized" color={COLORS.cost} icon="💰" />
        <StatCard title="Vision Saved" value={stats.visionSkipped} unit="skipped" delta={65} deltaLabel="skip rate" color={COLORS.saved} icon="✅" />
      </div>

      <div className="divider" />

      {/* === Charts === */}
      <div className="flex-1 p-4 space-y-4 min-h-0 overflow-y-auto">
        {/* API Calls Trend */}
        <div className="p-4 rounded-sm border border-surface-border bg-surface-overlay/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">API Calls (30 min)</span>
            <div className="flex items-center gap-3">
              {[
                { label: 'GPT', color: COLORS.gpt },
                { label: 'Vision', color: COLORS.vision },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[9px] font-mono text-gray-600">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} />
              <YAxis tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono' }}
              />
              <Line type="monotone" data={chatData} dataKey="value" stroke={COLORS.gpt} strokeWidth={1.5} dot={false} />
              <Line type="monotone" data={visionData} dataKey="value" stroke={COLORS.vision} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Token Usage Area */}
        <div className="p-4 rounded-sm border border-surface-border bg-surface-overlay/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Token Consumption (30 min)</span>
            <span className="text-[9px] font-mono text-gray-600">{stats.totalTokens.toLocaleString()} total</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={tokenData}>
              <defs>
                <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.token} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COLORS.token} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} />
              <YAxis tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono' }}
              />
              <Area type="monotone" dataKey="value" stroke={COLORS.token} strokeWidth={1.5} fill="url(#tokenGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie + Bar Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Cost Distribution Pie */}
          <div className="p-4 rounded-sm border border-surface-border bg-surface-overlay/30">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Cost Distribution</span>
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={30} outerRadius={50}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-3 mt-1">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-[9px] font-mono text-gray-600">{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Optimization Bar */}
          <div className="p-4 rounded-sm border border-surface-border bg-surface-overlay/30">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Optimization Impact</span>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={[
                { name: 'Vision', before: 200, after: 35 },
                { name: 'GPT', before: 50, after: 18 },
                { name: 'Tokens', before: 25, after: 7.5 },
              ]} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#6e7681' }} axisLine={{ stroke: '#30363d' }} width={45} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                <Bar dataKey="before" fill="#30363d" radius={[0, 2, 2, 0]} barSize={10} />
                <Bar dataKey="after" fill={COLORS.saved} radius={[0, 2, 2, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CostDashboard;
