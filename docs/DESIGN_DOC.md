# 🎯 AI 视觉对话助手 — 设计文档

> 实习申请提交 — AI Vision Chat Assistant
> 作者: soren-max | 仓库: https://github.com/soren-max/ai-vision-chat-assistant

---

## 一、用户故事

### 计划实现 & 实际完成对照

| # | 用户故事 | 计划 | 实际 | 说明 |
|---|---------|------|------|------|
| 1 | 用户打开网页即可使用 | ✅ | ✅ | Vite + React SPA, 一键启动 |
| 2 | 点击按钮开启摄像头 | ✅ | ✅ | `CameraPanel` + `useMediaDevice` Hook |
| 3 | 实时看到摄像头画面 | ✅ | ✅ | `<video>` 元素绑定 MediaStream |
| 4 | AI 识别摄像头中的物体 | ✅ | ✅ | DeepSeek Vision API + Bounding Box UI |
| 5 | 点击按钮开启麦克风 | ✅ | ✅ | `VoiceRecorder` + `useAudioRecorder` |
| 6 | 说话后自动识别为文字 | ✅ | ✅ | 科大讯飞 STT (97%中文) + Whisper 备选 |
| 7 | AI 结合视觉+语音回答 | ✅ | ✅ | Multimodal Chat: vision+voice → DeepSeek |
| 8 | AI 回复以语音播报 | ✅ | ✅ | Edge TTS 多语音合成 |
| 9 | 多轮对话记忆上下文 | ✅ | ✅ | 10轮对话历史 + SceneMemoryStore |
| 10 | 看到成本使用情况 | ✅ | ✅ | CostDashboard: Recharts 4图表 |
| 11 | AI 主动观察场景变化 | ✅ | ✅ | WatchAgent: 循环 task→observe⇄compare |
| 12 | IDE 截图代码审查 | ✅ | ✅ | CodeAssistant: OCR→Parse→Analyze→Fix |
| 13 | 视觉调用成本优化 | ✅ | ✅ | CostOptimizer: 95%相似度跳过 |

### 亮点用户故事

**US-01: AI 视觉场景理解**
> 作为用户，我打开摄像头后，AI 能实时识别画面中的物体并以 Bounding Box 叠加显示（类似自动驾驶感知界面）。

**US-02: 自然语音交互**
> 作为用户，我对着麦克风说话后，AI 听到我的问题，结合摄像头画面理解我的意图，用自然语音回答我。

**US-03: LangGraph 多 Agent 架构**
> 作为开发者，我可以选择不同的 Agent Graph 处理不同任务：VisionAgent（对话）、CodeAssistant（代码审查）、WatchAgent（主动监控）。

**US-04: 成本可视化**
> 作为用户，我能在右侧面板看到实时 Token 消耗、API 调用统计和优化节省效果。

---

## 二、技术架构

### 全栈架构

```
┌─────────────────────────────────────────────────────────┐
│                    前端 (React 18 + Vite)                 │
│  CameraPanel │ ChatPanel │ AgentDashboard │ CostDashboard│
│  AgentFlowPanel │ VoiceInteraction │ Toast              │
│  Framer Motion · ReactFlow · Recharts · TailwindCSS     │
└──────────────────────┬──────────────────────────────────┘
                       │ WebSocket + REST
┌──────────────────────▼──────────────────────────────────┐
│                  后端 (FastAPI + LangGraph)               │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │              4 LangGraph StateGraphs              │  │
│  │  VisionAgent (6 nodes)                            │  │
│  │  CodeAssistant (4 nodes)                          │  │
│  │  WatchAgent (4 nodes + cycle)                     │  │
│  │  CostOptimizer (4 nodes)                          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  Services: VisionAnalysis · STT(Xfyun/Whisper) · TTS   │
│            MultimodalChat · SceneMemory · CostOptimizer │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   AI 服务层                              │
│  DeepSeek-V4-Pro (Vision + Chat)                        │
│  科大讯飞 IAT (STT, >97% 中文)                           │
│  Edge TTS (语音合成, 免费)                                │
│  OpenAI Whisper (STT 备选)                               │
└─────────────────────────────────────────────────────────┘
```

### Vision Agent StateGraph

```
START → planner_node ─┬─→ vision_node → memory_node ─┐
                      ├─→ tool_node ─────────────────┤
                      └─→ reasoning_node ←───────────┘
                                      ↓
                               response_node → END
```

---

## 三、运营成本控制策略

### 想到的策略 vs 实际采用

| # | 策略 | 是否采用 | 实现方式 |
|---|------|---------|---------|
| 1 | 图片抽帧（降低 Vision 调用频率） | ✅ 已采用 | 8s 最小间隔 + 变化检测触发 |
| 2 | 图像变化检测（静止场景跳过） | ✅ 已采用 | pHash 汉明距离，相似度>95%跳过 |
| 3 | 场景缓存（相同场景复用结果） | ✅ 已采用 | TTL 300s 场景缓存 |
| 4 | Whisper 静音跳过 | ✅ 已采用 | VAD 静音检测 + <0.5s 音频跳过 |
| 5 | 对话响应缓存 | ✅ 已采用 | 相同问题+场景复用回复 |
| 6 | Token 预算控制 | ✅ 已采用 | 2000 token 硬限制 |
| 7 | Prompt 压缩 | ✅ 已采用 | 历史摘要 + 视觉上下文精简 |
| 8 | 免费 TTS 引擎 | ✅ 已采用 | Edge TTS (免费) 代替 OpenAI TTS |
| 9 | 国内 STT 替代 | ✅ 已采用 | 科大讯飞 (¥0.33/万次) 代替 OpenAI Whisper |
| 10 | 多模型降级策略 | ✅ 已采用 | 讯飞→Whisper 自动降级 |
| 11 | 使用更小 Vision 模型 | ❌ 未采用 | 比赛要求 DeepSeek-V4-Pro |
| 12 | CDN 加速静态资源 | ❌ 未采用 | 本地开发环境无需 |
| 13 | 请求合并批处理 | ❌ 未采用 | 实时交互不允许延迟 |
| 14 | 用户配额限制 | ❌ 未采用 | 无用户系统 |

### 成本优化效果（10分钟模拟）

| 指标 | 未优化 | 已优化 | 节省 |
|------|--------|--------|------|
| Vision API 调用 | 200 次 | 35 次 | **82.5%** |
| Whisper/STT 调用 | 20 次 | 8 次 | **60%** |
| GPT/Chat 调用 | 15 次 | 5 次 | **66.7%** |
| 总 Token | 25,000 | 7,500 | **70%** |
| 估算费用 | $0.85 | $0.17 | **$0.68** |

### 最大亮点：Cost Optimization Graph

```
capture_frame → change_detection → should_analyze?
                                     ├─ YES → vision_analysis
                                     └─ NO  → END (skipped)
```

独立的 LangGraph 在线拦截流水线，每次 Vision API 调用前自动检测。

---

## 四、核心模块清单

### 前端 (11 组件 + 3 Hooks)

| 组件 | 功能 |
|------|------|
| CameraPanel | 摄像头画面 + Bounding Box 物体叠加 |
| ChatPanel | OpenAI 风格对话 (Markdown + 代码高亮) |
| AgentDashboard | 5区块: Graph/Memory/Tools/Tokens/Stats |
| CostDashboard | Recharts 4图表实时监控 |
| AgentFlowPanel | ReactFlow 7节点工作流可视化 |
| VoiceInteraction | Framer Motion 4态语音动画 |
| VoiceRecorder | MediaRecorder + VAD + WAV |
| AudioPlayer | TTS 播放控制 (打断/重播) |
| Toast | 通知系统 |
| CostDashboard | 企业监控面板 |
| AgentDashboard | Agent 状态面板 |

### 后端 (4 Graphs + 10 Services + 8 Routers)

| 模块 | 行数 | 亮点 |
|------|------|------|
| Vision Agent Graph | 550 | Structured Output Planner + 条件路由 |
| Code Assistant Graph | 320 | OCR→Parse→Analyze→Fix 流水线 |
| Watch Agent Graph | 330 | 循环观察 loop: observe⇄compare |
| Cost Optimizer Graph | 160 | 95%阈值帧跳过 |
| Scene Memory Store | 270 | LRU + 物体追踪 + 类型推断 |
| Tool Registry | 486 | register_tool/execute_tool 动态扩展 |
| Cost Optimizer Service | 470 | 7策略集成优化引擎 |
| Xfyun STT Service | 260 | HMAC-SHA256 WebSocket 鉴权 |
| Multimodal Chat Service | 290 | 视觉+语音融合 + 10轮上下文 |
| Vision Analysis Service | 310 | 图像预处理 + DeepSeek Vision |

---

## 五、技术亮点总结

1. **LangGraph 多 Agent 架构** — 4 个独立 StateGraph，含循环工作流
2. **Structured Output Planner** — LLM 直接输出 JSON 路由决策
3. **Scene Memory Store** — 视觉长期记忆 + 物体追踪 + 场景分类
4. **Cost Optimization Graph** — 在线拦截 + 变化检测 + 82.5% 节省
5. **Tool Registry** — 3 行代码扩展新工具，参数自动映射
6. **Bounding Box UI** — 自动驾驶感知风格物体叠加
7. **ReactFlow 工作流** — 7 节点实时可视化 + 状态动画
8. **Unified Dark Theme** — Cursor/Linear/Claude 风格设计系统
9. **10 PRs** — 真实团队开发工作流

---

## 六、目录结构

```
ai-vision-chat-assistant/
├── frontend/src/
│   ├── components/ (11 components)
│   ├── hooks/       (3 hooks)
│   ├── pages/       (main page)
│   └── services/    (API client)
├── backend/app/
│   ├── agent/       (4 LangGraph graphs)
│   ├── services/    (10 services)
│   └── routers/     (8 API routers)
├── docs/            (4 docs)
└── README.md
```

**总代码量**: ~120 文件, ~15,000 行
