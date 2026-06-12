# 🎯 AI Vision Chat Assistant — LangGraph 架构

> 基于 **LangGraph StateGraph** 的视觉语音对话助手。开启摄像头与麦克风，与 AI 实时视觉+语音交流。

## 📋 项目概述

本项目构建一个 **LangGraph Vision Agent**，核心流程由 6 个节点的 StateGraph 驱动：

```
用户输入 → planner_node ─┬─→ vision_node → memory_node ─┐
                         ├─→ tool_node ─────────────────┤
                         └─→ reasoning_node ←───────────┘
                                         ↓
                                  response_node → 最终回复
```

### 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| **前端** | React 18 + TypeScript | UI 框架 |
| | Vite 6 | 构建工具 |
| | TailwindCSS 3 | 样式系统 |
| **后端** | FastAPI | REST + WebSocket API |
| | LangGraph | StateGraph Agent 框架 |
| | LangChain | LLM 调用抽象 |
| | Python 3.10+ | 运行环境 |
| **AI** | DeepSeek-V4-Pro | 语言+视觉多模态模型 |
| | Whisper | 语音转文字 (STT) |
| | Edge TTS / gTTS | 文字转语音 (TTS) |

## 📁 项目结构

```
ai-vision-chat-assistant/
├── frontend/                          # React 前端
│   ├── src/
│   │   ├── components/                # UI 组件
│   │   ├── hooks/                     # 自定义 Hooks
│   │   ├── pages/                     # 页面组件
│   │   ├── services/                  # API + WebSocket 客户端
│   │   ├── types/                     # TypeScript 类型
│   │   ├── App.tsx                    # 根组件
│   │   └── main.tsx                   # 入口文件
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                           # FastAPI 后端
│   ├── app/
│   │   ├── agent/                     # 🆕 LangGraph Agent 核心
│   │   │   ├── state.py              #   AgentState TypedDict
│   │   │   ├── nodes.py              #   6 个节点函数
│   │   │   ├── tools.py              #   工具定义
│   │   │   └── graph.py              #   StateGraph 编译
│   │   ├── routers/
│   │   │   └── chat.py               #   🆕 WebSocket + REST 端点
│   │   ├── services/
│   │   │   ├── vision_service.py     #   🆕 视觉分析服务
│   │   │   └── tts_service.py        #   🆕 语音合成服务
│   │   ├── models/
│   │   │   └── schemas.py            #   🆕 Pydantic 数据模型
│   │   ├── config.py                 # 配置管理
│   │   └── main.py                   # 应用入口
│   ├── requirements.txt
│   └── run.py
│
├── docs/
│   ├── ARCHITECTURE.md               # 🆕 架构文档
│   └── GRAPH_FLOW.md                 # 🆕 流程图文档
├── .env.example
└── README.md
```

## 🚀 快速启动

### 前置条件

- Node.js 18+
- Python 3.10+
- DeepSeek API Key（[申请地址](https://platform.deepseek.com/)）

### 1. 配置环境变量

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入 DEEPSEEK_API_KEY
cp frontend/.env.example frontend/.env
```

### 2. 启动后端

```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

访问 http://localhost:8000/api/docs 查看 Swagger 文档。

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173 即可使用。

## 🔌 API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/info` | 应用信息 |
| POST | `/api/chat/send` | 发送消息 (驱动 LangGraph Agent) |
| GET | `/api/chat/state/{session}` | 查询 Agent 内部状态 |
| WS | `/api/chat/ws/{session}` | 实时对话 WebSocket |

## 🔄 LangGraph Agent 节点

| 节点 | 职责 | 路由条件 |
|------|------|----------|
| **planner_node** | 分析用户输入，决定路径 | 入口节点 |
| **vision_node** | DeepSeek 视觉场景分析 | 包含视觉关键词 |
| **memory_node** | 管理 5 条场景记忆 | vision_node 后自动执行 |
| **tool_node** | 执行工具调用 | 包含工具关键词 |
| **reasoning_node** | 综合推理 | 默认路径 |
| **response_node** | 生成最终回复 | 终点节点 |

---

> 详细架构文档见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
> 流程图见 [docs/GRAPH_FLOW.md](docs/GRAPH_FLOW.md)
