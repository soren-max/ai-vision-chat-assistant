# 🏗️ 架构文档 — LangGraph Vision Agent

## 系统架构总览

```
┌──────────────────────────────────────────────────────┐
│                    前端 (React + Vite)                │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────┐   │
│  │ 摄像头   │  │ 麦克风    │  │ 聊天界面          │   │
│  │ 画面采集  │  │ 语音录制  │  │ 消息列表 + 语音播报│   │
│  └────┬────┘  └────┬─────┘  └────────┬──────────┘   │
│       │            │                  │              │
│       ▼            ▼                  ▼              │
│  ┌─────────────────────────────────────────────┐     │
│  │              WebSocket / REST               │     │
│  └────────────────────┬────────────────────────┘     │
└───────────────────────┼──────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────┐
│                  后端 (FastAPI)                       │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │          LangGraph StateGraph                │    │
│  │                                              │    │
│  │   START                                       │    │
│  │     │                                         │    │
│  │     ▼                                         │    │
│  │  ┌─────────────┐                              │    │
│  │  │ planner_node │── 条件路由 ──────────┐       │    │
│  │  └──────┬──────┘                       │       │    │
│  │         │                              │       │    │
│  │    ┌────┼────────────┐                 │       │    │
│  │    ▼                ▼                  ▼       │    │
│  │ ┌──────────┐  ┌──────────┐  ┌──────────────┐  │    │
│  │ │vision_node│  │ tool_node │  │reasoning_node│  │    │
│  │ └─────┬────┘  └─────┬────┘  └──────┬───────┘  │    │
│  │       │              │              │          │    │
│  │       ▼              │              │          │    │
│  │ ┌──────────┐         │              │          │    │
│  │ │memory_node│◄───────┘              │          │    │
│  │ └─────┬────┘                        │          │    │
│  │       │                            │          │    │
│  │       └──────────┬─────────────────┘          │    │
│  │                  ▼                            │    │
│  │           ┌──────────────┐                    │    │
│  │           │ response_node│                    │    │
│  │           └──────┬───────┘                    │    │
│  │                  ▼                            │    │
│  │                 END                           │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ DeepSeek    │  │ Whisper     │  │ TTS         │  │
│  │ V4 Pro      │  │ (STT)       │  │ (语音合成)   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└──────────────────────────────────────────────────────┘
```

## LangGraph Agent 设计

### AgentState

```python
class AgentState(TypedDict):
    user_input: str          # 用户输入（文字或语音转写）
    vision_context: str      # 当前场景描述
    scene_memory: list       # 历史场景记忆（保留5条）
    tool_result: str         # 工具执行结果
    final_response: str      # 最终回复
    session_id: str          # 会话标识
    agent_scratchpad: list   # 推理过程记录
```

### 节点说明

| 节点 | 职责 | 输入依赖 | 输出 |
|------|------|----------|------|
| **planner_node** | 分析用户输入，决定路由方向 | `user_input` | `_next_step` 路由标记 |
| **vision_node** | 调用 DeepSeek 分析画面 | `user_input` | `vision_context` |
| **memory_node** | 管理场景记忆上下文 | `vision_context`, `scene_memory` | `scene_memory` (更新) |
| **tool_node** | 执行工具调用 | `user_input` | `tool_result` |
| **reasoning_node** | 综合所有信息进行推理 | 全部状态 | `agent_scratchpad` |
| **response_node** | 生成最终回复 | 全部状态 | `final_response` |

### 路由逻辑

planner_node 使用关键词匹配判断路由：

```
"看到什么？"               → vision → memory → reasoning → response
"搜索一下XXX"              → tool → reasoning → response
"你好，今天天气如何？"      → reasoning → response
"我手里拿的是什么？"        → vision → memory → reasoning → response
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/info` | 应用信息 |
| POST | `/api/chat/send` | 发送消息 (REST) |
| GET | `/api/chat/state/{session}` | 查询 Agent 状态 |
| WS | `/api/chat/ws/{session}` | 实时对话 |

## WebSocket 消息协议

### 客户端 → 服务端

```json
{ "type": "text",           "data": "看到了什么？", "session_id": "...", "timestamp": 1234 }
{ "type": "transcription",  "data": "语音转写文本", "session_id": "...", "timestamp": 1234 }
{ "type": "frame",          "data": "base64_jpeg", "session_id": "...", "timestamp": 1234 }
```

### 服务端 → 客户端

```json
{ "type": "status",      "data": "processing",     "timestamp": 1234 }
{ "type": "ai_response", "data": "回复文本...",     "session_id": "...", "timestamp": 1234 }
{ "type": "error",       "data": "错误信息",       "timestamp": 1234 }
```

## 依赖关系

```
backend/
├── app/
│   ├── agent/          # LangGraph Agent 核心
│   │   ├── state.py    #   AgentState 定义
│   │   ├── nodes.py    #   6 个节点函数 + 条件路由
│   │   ├── tools.py    #   工具注册
│   │   └── graph.py    #   StateGraph 编译
│   ├── routers/
│   │   └── chat.py     #   WebSocket + REST 端点
│   ├── services/
│   │   ├── vision_service.py  # 视觉处理
│   │   └── tts_service.py     # 语音合成
│   ├── models/
│   │   └── schemas.py  # Pydantic 模型
│   ├── main.py         # 应用入口
│   └── config.py       # 配置管理
└── requirements.txt    # 依赖清单
```
