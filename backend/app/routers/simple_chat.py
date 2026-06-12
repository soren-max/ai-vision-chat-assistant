"""
Chat Router — POST /api/chat

完整流水线:
  摄像头 → YOLO 识别 → Vision Context (物体列表)
  语音 → Whisper STT → User Text
  Vision Context + User Text → DeepSeek-V4-Pro → 自然语言回复

Prompt 格式:
  当前画面:
  笔记本电脑
  咖啡杯
  键盘

  用户问:
  桌子上有什么？

  请根据当前画面回答用户。
"""

import json
import logging
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from openai import OpenAI, APIError
from app.config import settings

logger = logging.getLogger("chat_api")
router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="用户输入的消息（语音转文字结果）")
    vision_context: dict = Field(default_factory=dict, description="YOLO 识别结果 {objects: [...], scene: ...}")


class ChatResponse(BaseModel):
    reply: str = Field(..., description="LLM 自然语言回复")


def _clean_object_name(name: str) -> str:
    """移除置信度后缀: '笔记本电脑(97%)' → '笔记本电脑'"""
    return re.sub(r'\s*\(\d+%\)\s*', '', name).strip()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    真实 LLM 对话 — 视觉 + 语音 → 自然回复

    Prompt 示例:
    ```
    当前画面:
    笔记本电脑
    咖啡杯
    键盘
    手机

    用户问:
    桌子上有什么？

    请根据当前画面回答用户。
    ```
    """
    # ================================================================
    # 1. 校验
    # ================================================================
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="消息不能为空")

    # ================================================================
    # 2. 构建 Prompt
    # ================================================================
    vision_lines = []
    if request.vision_context:
        objects = request.vision_context.get("objects", [])
        scene = request.vision_context.get("scene", "")
        for obj in objects:
            name = _clean_object_name(str(obj))
            if name and name not in vision_lines:
                vision_lines.append(name)
        if scene:
            vision_lines.insert(0, f"场景: {scene}")

    vision_block = "\n".join(f"  {line}" for line in vision_lines) if vision_lines else "（无画面数据）"

    final_prompt = (
        f"当前画面:\n{vision_block}\n\n"
        f"用户问:\n{request.message.strip()}\n\n"
        f"请根据当前画面回答用户。"
    )

    # ================================================================
    # 3. 调试日志
    # ================================================================
    print("====== CHAT REQUEST ======")
    print("Vision Context (raw):", json.dumps(request.vision_context, ensure_ascii=False))
    print("User Input:", request.message)
    print("Final Prompt:\n" + final_prompt)
    print("========================")

    logger.info("====== CHAT REQUEST ======")
    logger.info("Vision: %s", json.dumps(request.vision_context, ensure_ascii=False))
    logger.info("User: %s", request.message)

    # ================================================================
    # 4. 调用 DeepSeek-V4-Pro
    # ================================================================
    api_key = settings.DEEPSEEK_API_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="DEEPSEEK_API_KEY 未配置")

    try:
        client = OpenAI(api_key=api_key, base_url=settings.DEEPSEEK_BASE_URL, timeout=30.0, max_retries=1)

        response = client.chat.completions.create(
            model=settings.DEEPSEEK_MODEL,
            temperature=0.7,
            max_tokens=512,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你是一个 AI 视觉助手。你通过摄像头看到用户面前的场景。\n"
                        "用户会用自然语言提问，你需要结合画面内容给出简洁自然的回答。\n"
                        "回答要像日常对话一样，不要使用技术术语。使用中文。\n"
                        "如果画面中没有数据，诚实告知用户。"
                    ),
                },
                {"role": "user", "content": final_prompt},
            ],
        )

        reply = response.choices[0].message.content

        if not reply or not reply.strip():
            raise RuntimeError("DeepSeek API 返回空内容 — 拒绝使用 Mock 数据")

        print(f"AI Reply:\n{reply}")
        logger.info("AI Reply: %s", reply[:200])

        return ChatResponse(reply=reply.strip())

    except APIError as e:
        logger.error("DeepSeek API 失败: %s", e)
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {e}")
    except Exception as e:
        logger.error("Chat 异常: %s", e)
        raise HTTPException(status_code=500, detail=f"服务异常: {e}")
