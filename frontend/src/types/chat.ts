export type MessageRole = 'user' | 'assistant' | 'tool_call' | 'thinking' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  toolName?: string;
  toolLatency?: number;
  thinkingLabel?: string;
}
