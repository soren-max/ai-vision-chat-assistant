"""
Simple Chat Router — POST /api/chat
Receives user message + vision context, calls DeepSeek, returns reply.
"""

import json
import logging
from fastapi import APIRouter
from pydantic import BaseModel, Field
from openai import OpenAI
from app.config import settings

logger = logging.getLogger("simple_chat")
router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    message: str = Field(..., description="用户输入的消息")
    vision_context: dict = Field(default_factory=dict, description="视觉上下文 (detected objects etc.)")


class ChatResponse(BaseModel):
    reply: str = Field(..., description="AI 回复")


@router.post("/chat", response_model=ChatResponse)
async def simple_chat(req: ChatRequest):
    """
    简单对话接口 — 用户消息 + 视觉上下文 → DeepSeek → 回复

    调试日志:
    - 收到用户消息
    - 视觉上下文
    - 最终 Prompt
    - AI 回复
    """
    # ====== DEBUG LOG ======
    logger.info("=" * 50)
    logger.info(f"收到用户消息: {req.message}")
    logger.info(f"收到视觉上下文: {json.dumps(req.vision_context, ensure_ascii=False)}")

    # Build prompt
    vision_text = ""
    if req.vision_context:
        objects = req.vision_context.get("objects", [])
        if objects:
            vision_text = "摄像头当前检测到的物体: " + ", ".join(objects)
        scene = req.vision_context.get("scene", "")
        if scene:
            vision_text += f"\n场景描述: {scene}"

    system_prompt = """你是一个视觉语音助手。你可以通过摄像头看到用户面前的场景。
请结合视觉信息回答用户的问题。如果视觉信息不足，请根据常识回答。
回答要简洁自然，适合语音播报。使用中文。"""

    user_prompt = req.message
    if vision_text:
        user_prompt = f"【视觉信息】\n{vision_text}\n\n【用户问题】\n{req.message}\n\n请结合视觉信息回答。"

    logger.info(f"最终Prompt:\nSystem: {system_prompt[:100]}...\nUser: {user_prompt[:200]}...")

    # Call DeepSeek
    try:
        client = OpenAI(
            api_key=settings.DEEPSEEK_API_KEY or settings.OPENAI_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
            timeout=30.0,
        )
        response = client.chat.completions.create(
            model=settings.DEEPSEEK_MODEL,
            temperature=0.7,
            max_tokens=512,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        reply = response.choices[0].message.content or "抱歉，我无法回答这个问题。"
        logger.info(f"AI 回复: {reply[:200]}...")
    except Exception as e:
        logger.error(f"DeepSeek 调用失败: {e}")
        reply = f"抱歉，AI 服务暂时不可用: {str(e)}"

    return ChatResponse(reply=reply)
