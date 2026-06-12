"""
Chat Router — POST /api/chat

真实 LLM 调用流水线:
  User Message + Vision Context → DeepSeek-V4-Pro → Reply

零 Mock 数据 — API 调用失败直接抛异常，不返回占位内容。
"""

import json
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from openai import OpenAI, APIError
from app.config import settings

logger = logging.getLogger("chat_api")
router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="用户输入的消息")
    vision_context: dict = Field(default_factory=dict, description="视觉上下文 (detected objects etc.)")


class ChatResponse(BaseModel):
    reply: str = Field(..., description="AI 回复")


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    真实 LLM 对话接口。

    无 Mock 数据 — 调用失败直接返回 502，不返回占位文本。
    """
    # ================================================================
    # 1. 输入校验
    # ================================================================
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="消息不能为空")

    # ================================================================
    # 2. 构建 Prompt
    # ================================================================
    vision_text = ""
    if request.vision_context:
        objects = request.vision_context.get("objects", [])
        scene = request.vision_context.get("scene", "")
        if objects:
            vision_text += "摄像头检测到的物体: " + ", ".join(objects)
        if scene:
            vision_text += f"\n场景描述: {scene}"

    system_prompt = """你是一个 AI 视觉语音助手。你可以通过摄像头看到用户面前的场景。
请结合视觉信息回答用户的问题。回答要简洁自然，适合语音播报。使用中文。"""

    final_prompt = request.message.strip()
    if vision_text:
        final_prompt = (
            f"【视觉信息】\n{vision_text}\n\n"
            f"【用户问题】\n{request.message.strip()}\n\n"
            f"请结合视觉信息用中文回答。"
        )

    # ================================================================
    # 3. 调试日志
    # ================================================================
    print("====== CHAT REQUEST ======")
    print("User Input:", request.message)
    print("Vision Context:", json.dumps(request.vision_context, ensure_ascii=False))
    print("Prompt:", final_prompt)
    print("========================")

    logger.info("====== CHAT REQUEST ======")
    logger.info("User Input: %s", request.message)
    logger.info("Vision Context: %s", json.dumps(request.vision_context, ensure_ascii=False))
    logger.info("Final Prompt: %s", final_prompt[:300])

    # ================================================================
    # 4. 调用 DeepSeek-V4-Pro
    # ================================================================
    api_key = settings.DEEPSEEK_API_KEY or settings.OPENAI_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="API Key 未配置，无法调用 LLM")

    try:
        client = OpenAI(
            api_key=api_key,
            base_url=settings.DEEPSEEK_BASE_URL,
            timeout=30.0,
            max_retries=1,
        )

        response = client.chat.completions.create(
            model=settings.DEEPSEEK_MODEL,
            temperature=0.7,
            max_tokens=512,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": final_prompt},
            ],
        )

        reply = response.choices[0].message.content

        # === 关键守卫: 如果 API 返回空，抛异常 ===
        if not reply or not reply.strip():
            raise RuntimeError("DeepSeek API 返回空内容 — 拒绝使用 Mock 数据")

        logger.info("AI Reply: %s", reply[:200])
        print(f"AI Reply: {reply}")

        return ChatResponse(reply=reply.strip())

    except APIError as e:
        logger.error("DeepSeek API 调用失败: %s", e)
        raise HTTPException(
            status_code=502,
            detail=f"LLM 调用失败: {e}。未使用 Mock 数据，请检查 API Key 和网络。"
        )
    except Exception as e:
        logger.error("Chat 服务异常: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"服务异常: {e}。未使用 Mock 数据。"
        )
