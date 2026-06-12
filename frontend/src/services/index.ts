/**
 * API 服务层
 * 
 * 封装与后端 LangGraph Agent 的所有通信。
 * 支持 REST API 和 WebSocket 实时对话。
 */

import type { AppConfig, WSMessage, AgentPhase } from '../types';

/** 默认应用配置 */
const defaultConfig: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  wsUrl: import.meta.env.VITE_WS_URL || '/ws',
};

/**
 * 获取应用配置
 */
export function getConfig(): AppConfig {
  return defaultConfig;
}

// ============================================================
// WebSocket 回调类型
// ============================================================

export type MessageCallback = (message: WSMessage) => void;
export type StatusCallback = (phase: AgentPhase) => void;
export type ErrorCallback = (error: string) => void;

// ============================================================
// API 客户端
// ============================================================

/**
 * API 客户端类
 * 
 * 负责:
 * - REST API 调用（健康检查、发送消息）
 * - WebSocket 连接管理（实时对话）
 * - 摄像头帧传输
 * - Agent 阶段状态回调
 */
export class ApiClient {
  private config: AppConfig;
  private ws: WebSocket | null = null;
  private sessionId: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  // 回调
  private onMessage?: MessageCallback;
  private onStatus?: StatusCallback;
  private onError?: ErrorCallback;

  constructor(config?: Partial<AppConfig>) {
    this.config = { ...defaultConfig, ...config };
    this.sessionId = this.generateSessionId();
  }

  /**
   * 生成唯一会话 ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 注册消息回调
   */
  setCallbacks(callbacks: {
    onMessage?: MessageCallback;
    onStatus?: StatusCallback;
    onError?: ErrorCallback;
  }): void {
    this.onMessage = callbacks.onMessage;
    this.onStatus = callbacks.onStatus;
    this.onError = callbacks.onError;
  }

  /**
   * 获取当前会话 ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 建立 WebSocket 连接
   * 
   * 连接到后端的 LangGraph Agent WebSocket 端点。
   * 支持自动重连机制。
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const wsUrl = `${this.config.wsUrl}/chat/ws/${this.sessionId}`;
    const fullUrl = wsUrl.startsWith('ws') ? wsUrl : `ws://${window.location.host}${wsUrl}`;

    console.log('[ApiClient] 连接 WebSocket:', fullUrl);
    this.ws = new WebSocket(fullUrl);

    this.ws.onopen = () => {
      console.log('[ApiClient] WebSocket 已连接');
      this.reconnectAttempts = 0;
      this.onStatus?.('planning');
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch {
        console.warn('[ApiClient] 收到非 JSON 消息:', event.data);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[ApiClient] WebSocket 错误:', error);
      this.onError?.('连接异常');
    };

    this.ws.onclose = () => {
      console.log('[ApiClient] WebSocket 已关闭');
      this.onStatus?.('idle');
      this.attemptReconnect();
    };
  }

  /**
   * 处理收到的消息
   */
  private handleMessage(message: WSMessage): void {
    switch (message.type) {
      case 'status':
        if (message.data === 'processing') {
          this.onStatus?.('reasoning');
        } else if (message.data === '帧已接收') {
          this.onStatus?.('analyzing');
        }
        break;

      case 'ai_response':
        this.onStatus?.('done');
        this.onMessage?.(message);
        break;

      case 'error':
        this.onError?.(message.data);
        this.onStatus?.('idle');
        break;

      default:
        this.onMessage?.(message);
    }
  }

  /**
   * 尝试重连
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onError?.('重连失败，请刷新页面');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    console.log(`[ApiClient] ${delay}ms 后重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * 发送用户输入（文字或语音转写）
   * 
   * 触发后端的 LangGraph Agent 处理流程:
   * planner_node → vision_node/memory_node/tool_node → reasoning_node → response_node
   */
  sendUserInput(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.onError?.('连接未建立');
      return;
    }

    const message: WSMessage = {
      type: 'text',
      data: text,
      session_id: this.sessionId,
      timestamp: Date.now() / 1000,
    };

    this.ws.send(JSON.stringify(message));
    this.onStatus?.('planning');
    console.log('[ApiClient] 发送用户输入:', text);
  }

  /**
   * 发送摄像头帧
   * 
   * 定期发送帧数据供 vision_node 分析使用。
   */
  sendFrame(frameBase64: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message: WSMessage = {
      type: 'frame',
      data: frameBase64,
      session_id: this.sessionId,
      timestamp: Date.now() / 1000,
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * 断开 WebSocket 连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onStatus?.('idle');
  }

  /**
   * 上传音频文件到后端
   *
   * 通过 REST API 上传 WAV 音频，供 Whisper STT 处理。
   */
  async sendAudio(audioBlob: Blob): Promise<void> {
    const url = `${this.config.apiBaseUrl}/chat/audio`;
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.wav');
    formData.append('session_id', this.sessionId);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      console.log('[ApiClient] 音频上传成功');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      this.onError?.(`音频上传失败: ${msg}`);
      throw error;
    }
  }

  /**
   * 通过 REST API 发送消息（非实时场景备用）
   */
  async sendMessageRest(text: string): Promise<string> {
    try {
      const url = `${this.config.apiBaseUrl}/chat/send`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          user_input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      this.onError?.(`REST 请求失败: ${msg}`);
      return '';
    }
  }
}

/** 全局单例 API 客户端 */
export const apiClient = new ApiClient();
