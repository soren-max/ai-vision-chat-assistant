# 🎯 AI Vision Chat Assistant — LangGraph 架构

> 基于 **LangGraph StateGraph** 的视觉语音对话助手。开启摄像头与麦克风，与 AI 实时视觉+语音交流。

## 📋 项目概述

6 节点 **LangGraph Vision Agent** 驱动核心流程：

```
用户输入 → planner_node ─┬─→ vision_node → memory_node ─┐
                         ├─→ tool_node ─────────────────┤
                         └─→ reasoning_node ←───────────┘
                                         ↓
                                  response_node → 最终回复
```

### 功能模块

| 模块 | 说明 |
|------|------|
| 📷 **Camera Module** | 640×480 JPEG 帧捕获，3s 间隔，WebSocket 上传 |
| 🎤 **Voice Recorder** | MediaRecorder + Web Audio VAD，静音 2s 自动停止，WAV 编码 |
| 🗣️ **STT 语音识别** | 科大讯飞 IAT（主力，>97% 中文准确率）+ OpenAI Whisper（降级） |
| 👁️ **Vision Analysis** | DeepSeek Vision 场景分析，图像缩放压缩，变化检测缓存 |
| 💬 **Multimodal Chat** | 视觉+语音融合 Prompt，10 轮对话上下文 |
| 🔊 **TTS 语音播报** | Edge TTS 多语音，支持打断/重播，MP3 流式输出 |
| 💰 **Cost Optimizer** | 7 策略成本优化引擎（抽帧/变化检测/缓存/Token 控制/Prompt 压缩） |

### 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| **前端** | React 18 + TypeScript + Vite 6 + TailwindCSS 3 | SPA UI |
| **后端** | FastAPI + LangGraph + LangChain | REST + WebSocket |
| **AI** | DeepSeek-V4-Pro | 多模态视觉 + 对话 |
| **AI** | 科大讯飞 IAT / OpenAI Whisper | 语音识别 (STT) |
| **AI** | Edge TTS / OpenAI TTS | 语音合成 |
| **运行** | Python 3.12+ / Node.js 22+ | 运行环境 |

---

## 🚀 快速启动

### 前置要求

- **Python 3.12+** 或 Anaconda/Miniconda
- **Node.js 22+**（含 npm）
- **DeepSeek API Key** — [申请地址](https://platform.deepseek.com/)
- （可选）科大讯飞 API 凭据 — [申请地址](https://console.xfyun.cn/)

### 1. 配置环境变量

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

编辑 `backend/.env`，填入：

```bash
# 必填
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here

# 可选 — 科大讯飞 STT（中文识别更精准）
XFYUN_APPID=your_xfyun_appid
XFYUN_API_KEY=your_xfyun_api_key
XFYUN_API_SECRET=your_xfyun_api_secret
```

---

### 方式 A — Conda 本地运行（推荐）

```bash
# 1. 创建虚拟环境
conda create -n ai-vision python=3.12 -y
conda activate ai-vision

# 2. 安装后端依赖
cd backend
pip install -r requirements.txt

# 3. 启动后端
python run.py
# → http://localhost:8000
# → Swagger 文档: http://localhost:8000/api/docs
```

**新开终端：**

```bash
# 4. 安装前端依赖
cd frontend
npm install

# 5. 启动前端
npm run dev
# → http://localhost:5173
```

---

### 方式 B — UV 启动（更快的依赖安装）

```bash
# 1. 安装 UV（如未安装）
pip install uv

# 2. 创建虚拟环境 + 安装依赖（一键完成）
cd backend
uv venv .venv --python 3.12
source .venv/bin/activate      # Windows: .venv\Scripts\activate
uv pip install -r requirements.txt

# 3. 启动后端
uv run python run.py
# → http://localhost:8000
```

**新开终端：**

```bash
# 4. 启动前端
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

### 方式 C — Docker 一键启动

```bash
# 1. 确保 .env 已配置
cp backend/.env.example backend/.env
# 编辑 backend/.env → 填入 DEEPSEEK_API_KEY

# 2. 启动全部服务
docker compose up -d

# 3. 查看日志
docker compose logs -f

# 4. 停止
docker compose down
```

> `docker-compose.yml` 已包含前后端两个容器，端口 8000（后端）/ 5173（前端）。

---

## 🔌 API 总览

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查 |
| `GET` | `/api/info` | 应用信息 |
| `POST` | `/api/vision/analyze` | 视觉分析 — 上传摄像头截图 |
| `POST` | `/api/stt` | 语音识别 — 上传 WAV 音频 |
| `POST` | `/api/multimodal/chat` | 多模态对话 — 文字+视觉 |
| `POST` | `/api/tts` | 语音合成 — 文本转 MP3 |
| `POST` | `/api/chat/send` | 发送消息 (驱动 LangGraph Agent) |
| `WS` | `/api/chat/ws/{session}` | WebSocket 实时对话 |
| `GET` | `/api/optimize/report` | 成本优化效果报告 |
| `GET` | `/api/tts/voices` | 可用语音列表 |

> 启动后访问 http://localhost:8000/api/docs 查看完整 Swagger 文档。

---

## 🔄 LangGraph Agent 节点

| 节点 | 职责 | 路由条件 |
|------|------|----------|
| **planner_node** | 分析用户输入，决定执行路径 | 入口节点 |
| **vision_node** | DeepSeek 视觉场景分析 | 包含视觉关键词 |
| **memory_node** | 管理 5 条场景记忆 | vision_node 后自动执行 |
| **tool_node** | 执行工具调用 | 包含工具关键词 |
| **reasoning_node** | 综合推理 | 默认路径 |
| **response_node** | 生成最终回复 | 终点节点 |

---

## 📁 项目结构

```
ai-vision-chat-assistant/
├── frontend/                              # React 前端
│   ├── src/
│   │   ├── components/                    # UI 组件
│   │   │   ├── CameraPanel.tsx           #   摄像头面板（帧捕获+上传）
│   │   │   ├── VoiceRecorder.tsx         #   语音录制（VAD+波形）
│   │   │   └── AudioPlayer.tsx           #   语音播报（打断+重播）
│   │   ├── hooks/                         # 自定义 Hooks
│   │   │   ├── useMediaDevice.ts         #   摄像头/麦克风管理
│   │   │   ├── useAudioRecorder.ts       #   录音+VAD+WAV编码
│   │   │   └── useTTS.ts                 #   文字转语音播放
│   │   ├── pages/VisionChatPage.tsx      # 主页面
│   │   ├── services/index.ts            # API+WebSocket 客户端
│   │   └── types/index.ts               # 完整 TS 类型定义
│   ├── package.json / vite.config.ts / tailwind.config.js
│   └── Dockerfile
│
├── backend/                               # FastAPI 后端
│   ├── app/
│   │   ├── agent/                         # LangGraph Agent 核心
│   │   │   ├── state.py                  #   AgentState TypedDict
│   │   │   ├── nodes.py                  #   6 个节点函数
│   │   │   ├── tools.py                  #   工具定义
│   │   │   └── graph.py                  #   StateGraph 编译
│   │   ├── routers/                       # API 路由
│   │   │   ├── chat.py                   #   对话 + WebSocket
│   │   │   ├── stt.py                    #   语音识别（讯飞+Whisper）
│   │   │   ├── tts.py                    #   语音合成
│   │   │   ├── vision.py                 #   视觉分析
│   │   │   ├── multimodal.py             #   多模态对话
│   │   │   └── optimize.py               #   成本优化报告
│   │   ├── services/                      # 业务服务
│   │   │   ├── vision_analysis_service.py   # DeepSeek Vision
│   │   │   ├── multimodal_chat_service.py   # 多模态对话
│   │   │   ├── xfyun_stt_service.py         # 科大讯飞 STT
│   │   │   ├── stt_service.py               # OpenAI Whisper
│   │   │   ├── tts_service.py               # Edge/OpenAI TTS
│   │   │   ├── cost_optimizer.py            # 成本优化引擎
│   │   │   └── vision_service.py            # 视觉帧缓存
│   │   ├── models/schemas.py             # Pydantic 数据模型
│   │   ├── config.py                     # 配置管理
│   │   └── main.py                       # 应用入口
│   ├── requirements.txt
│   ├── run.py
│   └── Dockerfile
│
├── docs/
│   ├── ARCHITECTURE.md                    # 完整架构文档
│   ├── GRAPH_FLOW.md                      # Mermaid 流程图
│   └── COST_OPTIMIZATION.md               # 成本优化方案
├── docker-compose.yml                     # Docker 一键部署
├── .env.example                           # 环境变量模板
└── README.md
```

---

## 📊 成本优化

比赛场景下自动启用 7 策略成本优化：

| 策略 | 节省效果 |
|------|---------|
| 图片抽帧（8s 间隔） | Vision 调用 ↓ 65% |
| 图像变化检测（pHash） | 静止场景再省 70% |
| 响应缓存（TTL 300s） | GPT 调用 ↓ 50% |
| Token 预算控制（2000） | Token 消耗 ↓ 70% |
| Prompt 压缩（3 轮历史） | 上下文长度 ↓ 70% |

> 详情见 [docs/COST_OPTIMIZATION.md](docs/COST_OPTIMIZATION.md)

---

## 🎥 Demo 演示

> 视频展示完整功能操作流程，评审可直接观看复现效果。

| 平台 | 链接 |
|------|------|
| **Bilibili** | [🔗 待上传 — 占位链接](https://www.bilibili.com/) |
| **备用链接** | [🔗 待上传 — 云盘链接](https://pan.baidu.com/) |

> 📹 视频内容覆盖：摄像头视觉分析 → 语音录制与识别 → 多模态对话 → TTS 语音播报 → 成本优化面板

---

## 📄 License

MIT
