"""
多模态对话路由

提供融合视觉+语音的多模态对话 API。
- POST /api/multimodal/chat       — 发送消息，获取回复
- GET  /api/multimodal/context    — 查询对话上下文
- DELETE /api/multimodal/context  — 清除对话历史
"""

import logging
from fastapi import APIRouter, HTTPException, Query

from app.services.multimodal_chat_service import multimodal_chat_service
from app.models.schemas import (
    MultimodalChatRequest,
    MultimodalChatResponse,
    MultimodalContextResponse,
)

# ============================================================
# Logger
# ============================================================

logger = logging.getLogger("multimodal_router")

# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api/multimodal", tags=["多模态对话"])


@router.post("/chat", response_model=MultimodalChatResponse, summary="发送多模态消息")
async def multimodal_chat(request: MultimodalChatRequest) -> MultimodalChatResponse:
    """
    多模态对话接口

    融合用户语音识别文本和视觉分析结果，
    发送给 DeepSeek-V4-Pro 并返回结合视觉上下文的回复。

    **请求示例**:
    ```json
    {
      "session_id": "session_abc123",
      "user_text": "我手里拿的是什么？",
      "vision_context": "场景: 室内。物体: 红色书本在手中。",
      "chat_history": []
    }
    ```

    **维护上下文**: 每个会话自动保留最近 10 轮对话，
    无需在请求中重复传递历史（chat_history 可选，用于前端同步）。
    """
    # ---- 校验 ----
    if not request.user_text.strip():
        raise HTTPException(status_code=400, detail="user_text 不能为空")

    logger.info(
        f"[{request.session_id}] 多模态对话请求 | "
        f"文本=\"{request.user_text[:40]}...\" | "
        f"视觉={'有' if request.vision_context else '无'}"
    )

    # ---- 调用服务 ----
    try:
        reply = await multimodal_chat_service.chat(
            session_id=request.session_id,
            user_text=request.user_text.strip(),
            vision_context=request.vision_context.strip(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception(f"[{request.session_id}] 未预期错误")
        raise HTTPException(status_code=500, detail=f"对话服务异常: {str(e)}")

    # ---- 返回 ----
    stats = multimodal_chat_service.get_stats(request.session_id)

    return MultimodalChatResponse(
        reply=reply,
        session_id=request.session_id,
        round_count=stats["round_count"],
    )


@router.get("/context", response_model=MultimodalContextResponse, summary="查询对话上下文")
async def get_context(session_id: str = Query("default", description="会话 ID")):
    """
    查询指定会话的对话历史上下文。

    用于前端同步展示聊天记录，
    或调试对话状态。
    """
    messages = multimodal_chat_service.get_context(session_id)
    stats = multimodal_chat_service.get_stats(session_id)

    from app.models.schemas import ChatHistoryItem

    return MultimodalContextResponse(
        session_id=session_id,
        messages=[
            ChatHistoryItem(role=m["role"], content=m["content"])
            for m in messages
        ],
        round_count=stats["round_count"],
        max_rounds=stats["max_rounds"],
    )


@router.delete("/context", summary="清除对话上下文")
async def clear_context(session_id: str = Query("default", description="会话 ID")):
    """
    清除指定会话的所有对话历史。

    用于用户点击"新对话"按钮时重置上下文。
    """
    multimodal_chat_service.clear_context(session_id)
    logger.info(f"[{session_id}] 对话上下文已手动清除")

    return {
        "status": "ok",
        "session_id": session_id,
        "message": "对话上下文已清除",
    }
