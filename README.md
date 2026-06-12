# 🎯 Vision Agent Assistant

> AI 视觉语音对话助手 — 开启摄像头与麦克风，与 AI 实时视觉+语音交流。

[![Built with React](https://img.shields.io/badge/React-18-3b82f6?logo=react)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-22c55e?logo=fastapi)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-1.0-3b82f6)](https://langchain.com)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-V4_Pro-3b82f6)](https://deepseek.com)
[![License](https://img.shields.io/badge/license-MIT-22c55e)](LICENSE)

---

## 📋 Demo 流程

```
1. 打开网页 → http://localhost:5173
2. 点击 start() 开启摄像头
3. 语音提问 "桌上有什么？"
4. AI 看到画面 → 分析场景 → 回复 + 语音播报
```

## 🏗️ Architecture

```
┌─────────┐   ┌──────────────────────┐   ┌─────────────┐
│ Camera  │   │  Agent Workflow      │   │ Dashboard   │
│ Panel   │   │  🔊 Voice Input      │   │ Agent State │
│ BBoxes  │   │  👁️ Vision Analysis  │   │ Tool Calls  │
│ REC ●   │   │  🧠 Memory           │   │ Token Usage │
│ Objects │   │  📋 Planner           │   │ Cost Stats  │
│         │   │  🔧 Tool Calling     │   │ Optimization│
│         │   │  💡 Reasoning        │   └─────────────┘
│         │   │  💬 Response         │
└─────────┘   │                      │
              │  Chat Messages       │
              │  [input...]          │
              └──────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Python 3.12+ / Node.js 22+
- DeepSeek API Key ([Get one](https://platform.deepseek.com/))

### Setup

```bash
# 1. Clone
git clone https://github.com/soren-max/ai-vision-chat-assistant.git
cd ai-vision-chat-assistant

# 2. Configure
cp backend/.env.example backend/.env
# Edit backend/.env → fill DEEPSEEK_API_KEY

# 3. Backend
cd backend
pip install -r requirements.txt
python run.py
# → http://localhost:8000

# 4. Frontend (new terminal)
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Docker

```bash
cp backend/.env.example backend/.env  # Fill API key
docker compose up -d
```

## 🧠 LangGraph Agents

| Graph | Flow | Purpose |
|-------|------|---------|
| **VisionAgent** | planner → vision → memory → reasoning → response | Main vision+voice conversation |
| **CodeAssistant** | ocr → parse → analyze → fix | IDE screenshot code review |
| **WatchAgent** | task → observe ⇄ compare → notify | Cyclic scene monitoring |
| **CostOptimizer** | capture → detect → decide → vision? | Frame skip optimization |

## 🎨 UI Design

| Feature | Description |
|---------|-------------|
| Camera Panel | Bounding box perception overlay (self-driving style) |
| Workflow Viz | ReactFlow 7-node real-time graph |
| Chat | OpenAI-style Markdown + Code highlighting |
| Voice UI | Framer Motion 4-state animations |
| Cost Dashboard | Recharts charts + live monitoring |
| Dark Theme | Cursor / Linear / Claude inspired |

## 🔌 API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/vision/analyze` | Scene analysis |
| `POST` | `/api/stt` | Speech-to-text (Whisper/Xfyun) |
| `POST` | `/api/multimodal/chat` | Vision+voice conversation |
| `POST` | `/api/tts` | Text-to-speech (Edge TTS) |
| `POST` | `/api/code/analyze` | IDE screenshot analysis |
| `POST` | `/api/watch/start` | Start cyclic observation |
| `GET` | `/api/optimize/report` | Cost savings report |

## 📐 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 · Vite 6 · TypeScript · TailwindCSS · Framer Motion · ReactFlow · Recharts |
| Backend | FastAPI · LangGraph · LangChain · Python 3.12 |
| AI | DeepSeek-V4-Pro (Vision+Chat) · Edge TTS · Xfyun STT · OpenAI Whisper |

## 📂 Project Structure

```
├── frontend/src/
│   ├── components/
│   │   ├── CameraPanel.tsx       # Bounding box perception
│   │   ├── ChatPanel.tsx         # OpenAI-style chat
│   │   ├── AgentDashboard.tsx    # 5-section monitor
│   │   ├── CostDashboard.tsx     # Charts + stats
│   │   ├── AgentFlowPanel.tsx    # ReactFlow workflow
│   │   ├── VoiceInteraction.tsx  # Framer Motion voice UI
│   │   └── Toast.tsx             # Notification system
│   ├── hooks/
│   │   ├── useMediaDevice.ts     # Camera/Mic
│   │   ├── useAudioRecorder.ts   # VAD + WAV
│   │   └── useTTS.ts             # TTS playback
│   └── pages/
│       └── VisionChatPage.tsx    # 3-column layout
│
├── backend/app/
│   ├── agent/
│   │   ├── nodes.py / graph.py   # Vision Agent (6 nodes)
│   │   ├── code_assistant/       # Code Assistant Graph
│   │   ├── watch_agent/          # Watch Agent Graph
│   │   └── cost_optimization_graph/ # Cost Optimizer
│   ├── services/
│   │   ├── vision_analysis_service.py
│   │   ├── multimodal_chat_service.py
│   │   ├── scene_memory_store.py
│   │   ├── cost_optimizer.py
│   │   ├── tts_service.py / stt_service.py
│   │   └── xfyun_stt_service.py
│   └── routers/ (7 route modules)
│
└── docs/ (Architecture + Flow + Cost docs)
```

## 📄 License

MIT
