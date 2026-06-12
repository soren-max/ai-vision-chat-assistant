/**
 * 类型定义
 * 
 * 项目共享的类型定义，包含消息、WebSocket 通信、LangGraph Agent 状态等。
 */

/** 消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system';

/** 消息来源 */
export type MessageSource = 'text' | 'voice' | 'vision';

/** 单条聊天消息 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  source: MessageSource;
  timestamp: number;
  /** 语音播报状态 */
  ttsStatus?: 'pending' | 'playing' | 'done';
}

/** WebSocket 事件类型 */
export type WSEventType =
  | 'text'             // 用户文字输入
  | 'frame'            // 摄像头帧数据
  | 'transcription'    // 语音转文字结果
  | 'ai_response'      // AI 回复文本（LangGraph response_node 输出）
  | 'tts_chunk'        // TTS 语音片段
  | 'error'            // 错误消息
  | 'status';          // 状态更新（processing / 帧已接收 等）

/** WebSocket 消息格式 */
export interface WSMessage {
  type: WSEventType;
  data: string;
  session_id?: string;
  timestamp: number;
}

/** 媒体设备状态 */
export interface MediaDeviceState {
  camera: boolean;
  microphone: boolean;
  speaker: boolean;
}

/** 应用配置 */
export interface AppConfig {
  apiBaseUrl: string;
  wsUrl: string;
}

/** 连接状态 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// ============================================================
// LangGraph Agent 相关类型
// ============================================================

/** Agent 处理阶段（对应 StateGraph 节点） */
export type AgentPhase =
  | 'idle'
  | 'planning'        // planner_node
  | 'analyzing'       // vision_node
  | 'remembering'     // memory_node
  | 'executing_tool'  // tool_node
  | 'reasoning'       // reasoning_node
  | 'responding'      // response_node
  | 'done';

/** Agent 阶段显示信息 */
export const AGENT_PHASE_LABELS: Record<AgentPhase, string> = {
  idle: '就绪',
  planning: '🤔 规划中...',
  analyzing: '👁️ 分析画面...',
  remembering: '💾 记忆更新...',
  executing_tool: '🔧 执行工具...',
  reasoning: '🧠 推理中...',
  responding: '💬 生成回复...',
  done: '✅ 完成',
};
