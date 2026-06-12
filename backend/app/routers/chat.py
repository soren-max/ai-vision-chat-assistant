"""
对话路由模块

提供 LangGraph Vision Agent 驱动的 WebSocket 对话接口。
前端通过 WebSocket 发送语音/文本/帧数据，后端驱动 StateGraph 处理并返回结果。
"""

import json
import time
import os
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from app.agent.graph import vision_agent
from app.agent.state import AgentState
from app.services.vision_service import vision_service
from app.services.tts_service import tts_service
from app.models.schemas import ChatRequest, ChatResponse, AgentStateResponse

# 创建路由实例
router = APIRouter(prefix="/api/chat", tags=["对话"])


# ============================================================
# 会话管理器（管理 WebSocket 连接与 Agent 实例）
# ============================================================

class SessionManager:
    """
    会话管理器

    维护每个会话的 WebSocket 连接和 Agent 运行状态。
    """

    def __init__(self):
        self._connections: dict[str, WebSocket] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        """建立会话连接"""
        await websocket.accept()
        self._connections[session_id] = websocket
        print(f"[session] 会话 {session_id} 已连接")

    def disconnect(self, session_id: str):
        """断开会话连接"""
        self._connections.pop(session_id, None)
        print(f"[session] 会话 {session_id} 已断开")

    def get_connection(self, session_id: str) -> Optional[WebSocket]:
        """获取会话的 WebSocket 连接"""
        return self._connections.get(session_id)


# 全局会话管理器
session_manager = SessionManager()


# ============================================================
# REST API 端点
# ============================================================

@router.post("/send", response_model=ChatResponse)
async def send_message(request: ChatRequest):
    """
    发送对话消息（REST 方式）

    接收用户输入，驱动 LangGraph Agent 处理并返回结果。
    """
    # 初始化 Agent 状态
    initial_state: AgentState = {
        "user_input": request.user_input,
        "vision_context": "",
        "scene_memory": [],
        "tool_result": "",
        "final_response": "",
        "session_id": request.session_id,
        "agent_scratchpad": [],
    }

    # 如果有图片数据，更新视觉服务
    if request.image_data:
        vision_service.update_frame(request.image_data.encode())

    try:
        # 执行 LangGraph Agent
        result = await vision_agent.ainvoke(initial_state)

        return ChatResponse(
            session_id=request.session_id,
            response=result.get("final_response", "抱歉，处理失败"),
            scene_memory_count=len(result.get("scene_memory", [])),
        )
    except Exception as e:
        print(f"[chat] Agent 执行错误: {e}")
        return ChatResponse(
            session_id=request.session_id,
            response=f"系统处理出错: {str(e)}",
            scene_memory_count=0,
        )


@router.post("/audio")
async def upload_audio(
    file: UploadFile = File(...),
    session_id: str = Form("default"),
):
    """
    接收前端上传的 WAV 音频文件。

    供 Whisper STT 服务处理。
    """
    try:
        # 读取音频内容
        audio_bytes = await file.read()

        # 保存到临时目录（供 Whisper 处理）
        temp_dir = "/tmp/ai-vision-audio"
        os.makedirs(temp_dir, exist_ok=True)
        file_path = os.path.join(temp_dir, f"{session_id}_{int(time.time())}.wav")

        with open(file_path, "wb") as f:
            f.write(audio_bytes)

        print(f"[audio] 音频已接收 | 会话: {session_id} | "
              f"文件: {file.filename} | 大小: {len(audio_bytes)} bytes | "
              f"路径: {file_path}")

        # TODO: 调用 Whisper STT 进行转写，然后将文本送入 LangGraph Agent

        return {
            "status": "ok",
            "session_id": session_id,
            "filename": file.filename,
            "size_bytes": len(audio_bytes),
        }
    except Exception as e:
        print(f"[audio] 接收失败: {e}")
        return {
            "status": "error",
            "message": str(e),
        }


@router.get("/state/{session_id}", response_model=AgentStateResponse)
async def get_agent_state(session_id: str):
    """
    查询 Agent 内部状态（调试用）

    返回指定会话的最近 Agent 运行状态。
    """
    # TODO: 从持久化存储中查询状态
    return AgentStateResponse(
        session_id=session_id,
        user_input="",
        vision_context="",
        scene_memory=[],
        tool_result="",
        final_response="",
        agent_scratchpad=[],
    )


# ============================================================
# WebSocket 端点（实时对话）
# ============================================================

@router.websocket("/ws/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str = "default"):
    """
    WebSocket 实时对话端点

    支持双向实时通信：
    客户端 → 服务端: 语音转写文本 / 视频帧 / 文字消息
    服务端 → 客户端: AI 回复文本 / TTS 音频流 / 状态信息

    消息格式 (JSON):
    ```json
    {
        "type": "transcription | frame | text",
        "data": "...",
        "session_id": "...",
        "timestamp": 1234567890.0
    }
    ```
    """
    await session_manager.connect(session_id, websocket)
    scene_memory: list = []

    try:
        while True:
            # 接收前端消息
            raw = await websocket.receive_text()
            message = json.loads(raw)
            msg_type = message.get("type", "text")
            msg_data = message.get("data", "")

            if msg_type == "frame":
                # 视频帧更新
                vision_service.update_frame(msg_data.encode())
                await websocket.send_json({
                    "type": "status",
                    "data": "帧已接收",
                    "timestamp": time.time(),
                })

            elif msg_type in ("transcription", "text"):
                # 用户输入（语音转写或文字）
                user_input = msg_data

                # 构建 Agent 状态
                initial_state: AgentState = {
                    "user_input": user_input,
                    "vision_context": vision_service.get_frame_summary(),
                    "scene_memory": scene_memory,
                    "tool_result": "",
                    "final_response": "",
                    "session_id": session_id,
                    "agent_scratchpad": [],
                }

                # 发送处理中状态
                await websocket.send_json({
                    "type": "status",
                    "data": "processing",
                    "timestamp": time.time(),
                })

                try:
                    # 驱动 LangGraph Agent
                    result = await vision_agent.ainvoke(initial_state)

                    # 更新场景记忆
                    if result.get("scene_memory"):
                        scene_memory = result["scene_memory"]

                    # 发送 AI 回复
                    final = result.get("final_response", "抱歉，我暂时无法回答。")
                    await websocket.send_json({
                        "type": "ai_response",
                        "data": final,
                        "session_id": session_id,
                        "timestamp": time.time(),
                    })

                    # 触发 TTS 语音合成（异步）
                    # audio_data = await tts_service.synthesize(final)
                    # if audio_data:
                    #     await websocket.send_bytes(audio_data)

                except Exception as e:
                    await websocket.send_json({
                        "type": "error",
                        "data": f"Agent 处理失败: {str(e)}",
                        "timestamp": time.time(),
                    })

            else:
                await websocket.send_json({
                    "type": "error",
                    "data": f"未知消息类型: {msg_type}",
                    "timestamp": time.time(),
                })

    except WebSocketDisconnect:
        print(f"[ws] 会话 {session_id} WebSocket 断开")
    except Exception as e:
        print(f"[ws] 会话 {session_id} 异常: {e}")
    finally:
        session_manager.disconnect(session_id)
