"""
Pydantic 数据模型

定义 API 请求/响应的数据结构，用于请求体验证和 API 文档生成。
"""

from pydantic import BaseModel, Field
from typing import List, Optional


# ============================================================
# 对话相关
# ============================================================

class ChatRequest(BaseModel):
    """对话请求"""
    session_id: str = Field(default="default", description="会话 ID")
    user_input: str = Field(..., description="用户输入文本")
    image_data: Optional[str] = Field(None, description="Base64 编码的当前帧")


class ChatResponse(BaseModel):
    """对话响应"""
    session_id: str = Field(..., description="会话 ID")
    response: str = Field(..., description="AI 回复文本")
    scene_memory_count: int = Field(0, description="场景记忆条数")


# ============================================================
# Agent 状态响应
# ============================================================

class AgentStateResponse(BaseModel):
    """Agent 内部状态查询响应"""
    session_id: str
    user_input: str
    vision_context: str
    scene_memory: List[str]
    tool_result: str
    final_response: str
    agent_scratchpad: List[str]


# ============================================================
# WebSocket 消息格式
# ============================================================

class WSMessage(BaseModel):
    """WebSocket 消息"""
    type: str = Field(..., description="消息类型: transcription / frame / ai_response / tts_chunk / error")
    data: str = Field("", description="消息数据")
    session_id: str = Field("default", description="会话 ID")
    timestamp: float = Field(0.0, description="时间戳")


# ============================================================
# 媒体相关
# ============================================================

class MediaStatus(BaseModel):
    """媒体设备状态"""
    camera: bool = Field(False, description="摄像头是否开启")
    microphone: bool = Field(False, description="麦克风是否开启")
    speaker: bool = Field(False, description="扬声器是否可用")


class FrameData(BaseModel):
    """视频帧数据"""
    session_id: str = Field("default", description="会话 ID")
    frame: str = Field(..., description="Base64 编码的 JPEG 帧")
    timestamp: float = Field(0.0, description="采集时间戳")


# ============================================================
# STT 语音识别
# ============================================================

class STTResponse(BaseModel):
    """语音识别响应"""
    text: str = Field(..., description="识别出的文本")
    message: Optional[str] = Field(None, description="附加信息（如空识别提示）")


# ============================================================
# Vision 视觉分析
# ============================================================

class DetectedObject(BaseModel):
    """检测到的物体"""
    name: str = Field(..., description="物体名称")
    confidence: float = Field(..., description="置信度 0-1")
    position: str = Field("", description="位置描述")


class DetectedPerson(BaseModel):
    """检测到的人物信息"""
    count: int = Field(1, description="人数")
    pose: str = Field("", description="姿态")
    action: str = Field("", description="动作")
    expression: str = Field("", description="面部表情")
    attire: str = Field("", description="衣着特征")


class VisionRequest(BaseModel):
    """视觉分析请求"""
    session_id: str = Field("default", description="会话 ID")
    image: str = Field(..., description="Base64 编码的 JPEG 图像")
    prompt: Optional[str] = Field(None, description="附加分析指令")


class VisionResponse(BaseModel):
    """视觉分析响应"""
    scene: str = Field("", description="场景整体描述")
    objects: List[DetectedObject] = Field(default_factory=list, description="检测到的物体列表")
    people: List[DetectedPerson] = Field(default_factory=list, description="检测到的人物列表")
    screen_content: str = Field("", description="屏幕内容描述")
    risk_content: List[str] = Field(default_factory=list, description="风险内容列表")
    summary: str = Field("", description="一句话总结")


# ============================================================
# 多模态对话
# ============================================================

class ChatHistoryItem(BaseModel):
    """对话历史条目"""
    role: str = Field(..., description="角色: user | assistant")
    content: str = Field(..., description="消息内容")


class MultimodalChatRequest(BaseModel):
    """多模态对话请求"""
    session_id: str = Field("default", description="会话 ID")
    user_text: str = Field(..., description="用户语音识别文本")
    vision_context: str = Field("", description="当前视觉分析结果（可选）")
    chat_history: List[ChatHistoryItem] = Field(
        default_factory=list,
        description="前端缓存的对话历史（可选，服务端会自动管理上下文）",
    )


class MultimodalChatResponse(BaseModel):
    """多模态对话响应"""
    reply: str = Field(..., description="AI 回复文本")
    session_id: str = Field(..., description="会话 ID")
    round_count: int = Field(0, description="当前对话轮数")


class MultimodalContextResponse(BaseModel):
    """对话上下文查询响应"""
    session_id: str = Field(..., description="会话 ID")
    messages: List[ChatHistoryItem] = Field(default_factory=list, description="对话历史")
    round_count: int = Field(0, description="当前对话轮数")
    max_rounds: int = Field(10, description="最大保留轮数")


# ============================================================
# TTS 语音合成
# ============================================================

class TTSRequest(BaseModel):
    """TTS 语音合成请求"""
    text: str = Field(..., description="需要合成的文本", max_length=2000)
    voice: Optional[str] = Field(None, description="语音名称（如 zh-CN-XiaoxiaoNeural）")
    speed: Optional[float] = Field(None, description="语速倍率 (0.5~2.0)", ge=0.5, le=2.0)
