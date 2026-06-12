/**
 * AgentFlowPanel — LangGraph 实时工作流可视化
 *
 * 7 节点垂直流水线:
 *   Voice Input → Vision Analysis → Memory → Planner → Tool Calling → Reasoning → Response
 */

import { useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  Handle,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ============================================================
// Types
// ============================================================

export type NodeStatus = 'idle' | 'running' | 'complete' | 'error';

export interface FlowNodeData {
  label: string;
  icon: string;
  status: NodeStatus;
  detail?: string;
  [key: string]: unknown;
}

// ============================================================
// Custom Node Component
// ============================================================

function AgentNode({ data }: NodeProps) {
  const { label, icon, status, detail } = data as unknown as FlowNodeData;

  const statusStyles: Record<NodeStatus, string> = {
    idle:    'border-surface-border bg-surface-overlay text-gray-500',
    running: 'border-brand-500 bg-brand-600/15 text-brand-400 ring-glow',
    complete:'border-accent-green/40 bg-accent-green/10 text-accent-green',
    error:   'border-accent-red/40 bg-accent-red/10 text-accent-red',
  };

  return (
    <div className={`
      relative px-3 py-2.5 rounded-sm border min-w-[150px] max-w-[180px]
      transition-all duration-500 font-mono text-[11px]
      ${statusStyles[status]}
      ${status === 'error' ? 'animate-pulse' : ''}
    `}>
      <Handle type="target" position={Position.Top}
        className="!w-2 !h-2 !bg-surface-border !border-2 !border-surface"
      />
      <div className="flex items-center gap-2">
        <span className={`
          w-2 h-2 rounded-full shrink-0
          ${status === 'running' ? 'bg-brand-500 animate-pulse' :
            status === 'complete' ? 'bg-accent-green' :
            status === 'error' ? 'bg-accent-red animate-pulse' :
            'bg-gray-600'}
        `} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{icon}</span>
            <span className="truncate">{label}</span>
          </div>
          {detail && (
            <div className="text-[9px] text-gray-600 truncate mt-0.5">{detail}</div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom}
        className="!w-2 !h-2 !bg-surface-border !border-2 !border-surface"
      />
    </div>
  );
}

// ============================================================
// Data
// ============================================================

const nodeTypes = { agentNode: AgentNode };

export const FLOW_NODES: FlowNodeData[] = [
  { label: 'Voice Input',     icon: '🎤', status: 'idle' },
  { label: 'Vision Analysis', icon: '👁️', status: 'idle' },
  { label: 'Memory',          icon: '🧠', status: 'idle' },
  { label: 'Planner',         icon: '📋', status: 'idle' },
  { label: 'Tool Calling',    icon: '🔧', status: 'idle' },
  { label: 'Reasoning',       icon: '💡', status: 'idle' },
  { label: 'Response',        icon: '💬', status: 'idle' },
];

function makeNodes(): Node[] {
  return FLOW_NODES.map((nd, i) => ({
    id: `node-${i}`,
    type: 'agentNode',
    position: { x: 0, y: i * 80 },
    data: { ...nd } as FlowNodeData,
  }));
}

function makeEdges(): Edge[] {
  return FLOW_NODES.slice(0, -1).map((_, i) => ({
    id: `edge-${i}-${i + 1}`,
    source: `node-${i}`,
    target: `node-${i + 1}`,
    type: 'smoothstep' as const,
    animated: false,
    style: { stroke: '#30363d', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, width: 8, height: 8, color: '#30363d' },
  }));
}

// ============================================================
// Main Component
// ============================================================

interface AgentFlowPanelProps {
  activeNode: number;
  nodeStatuses: NodeStatus[];
  className?: string;
}

function AgentFlowPanel({
  activeNode = -1,
  nodeStatuses = FLOW_NODES.map(() => 'idle'),
  className = '',
}: AgentFlowPanelProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(makeNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(makeEdges());

  useMemo(() => {
    setNodes(nds =>
      nds.map((nd) => {
        const idx = parseInt(nd.id.split('-')[1], 10);
        const base = FLOW_NODES[idx];
        const status = nodeStatuses[idx] ?? 'idle';
        const isActive = idx === activeNode;
        return {
          ...nd,
          data: {
            ...base,
            status: isActive ? 'running' : status,
            detail: isActive && status === 'running' ? 'executing...'
                  : status === 'error' ? 'error' : '',
          } as FlowNodeData,
        };
      }),
    );

    setEdges(eds =>
      eds.map((ed) => {
        const srcIdx = parseInt(ed.source.split('-')[1], 10);
        const isActive = srcIdx === activeNode - 1;
        const isPast = srcIdx < activeNode;
        return {
          ...ed,
          animated: isActive,
          style: {
            stroke: isPast ? '#3fb950' : isActive ? '#6c5ce7' : '#30363d',
            strokeWidth: isActive ? 2 : 1.5,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 8,
            height: 8,
            color: isPast ? '#3fb950' : isActive ? '#6c5ce7' : '#30363d',
          },
        };
      }),
    );
  }, [activeNode, nodeStatuses, setNodes, setEdges]);

  return (
    <div className={`h-full w-full ${className}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        className="bg-surface"
      >
        <Background gap={20} color="#21262d" />
        <Controls
          className="!bg-surface-overlay !border-surface-border !rounded-sm"
          position="bottom-right"
        />
        <MiniMap
          nodeColor={(n) => {
            if (n.data?.status === 'running') return '#6c5ce7';
            if (n.data?.status === 'complete') return '#3fb950';
            if (n.data?.status === 'error') return '#f85149';
            return '#30363d';
          }}
          maskColor="rgba(13, 17, 23, 0.7)"
          className="!bg-surface-overlay !border-surface-border !rounded-sm"
          position="bottom-left"
        />
      </ReactFlow>
    </div>
  );
}

export default AgentFlowPanel;
