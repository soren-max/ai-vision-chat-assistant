"""
TTS (Text-to-Speech) 路由

提供文本转语音 REST API 端点。
- POST /api/tts          — 文本合成 MP3 音频
- POST /api/tts/stream   — 流式合成
- GET  /api/tts/voices   — 查询可用语音列表
"""

import logging
import io
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.services.tts_service import tts_service
from app.models.schemas import TTSRequest

# ============================================================
# Logger
# ============================================================

logger = logging.getLogger("tts_router")

# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api/tts", tags=["语音合成"])


@router.post("", summary="文本转语音")
async def text_to_speech(request: TTSRequest):
    """
    将文本合成为 MP3 音频。

    使用 Edge TTS 引擎，支持中英文混合语音。
    返回 audio/mpeg 流，前端可直接用 <audio> 播放。

    **语音示例**:
    - `zh-CN-XiaoxiaoNeural` — 中文活泼女声（默认）
    - `zh-CN-YunxiNeural`   — 中文青春男声
    - `en-US-JennyNeural`   — 美式英语女声

    **速度**: 0.5 ~ 2.0（默认 1.0）
    """
    # ---- 校验 ----
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="文本不能为空")

    max_chars = 2000
    if len(request.text) > max_chars:
        raise HTTPException(
            status_code=400,
            detail=f"文本过长（{len(request.text)} 字符），最大 {max_chars} 字符",
        )

    logger.info(
        f"TTS 请求 | 文本长度={len(request.text)} | "
        f"语音={request.voice or 'default'} | 速度={request.speed or 1.0}"
    )

    # ---- 切换语音/速度（如果指定） ----
    original_voice = tts_service._voice
    original_speed = tts_service._speed

    try:
        if request.voice:
            tts_service._voice = request.voice
        if request.speed:
            tts_service.set_speed(request.speed)

        # ---- 合成 ----
        mp3_data = await tts_service.synthesize(request.text)

        if mp3_data is None:
            raise HTTPException(
                status_code=500,
                detail="TTS 合成失败，请检查服务日志",
            )

        logger.info(f"TTS 响应 | 大小={len(mp3_data)} bytes")

        # StreamingResponse 返回音频
        return StreamingResponse(
            io.BytesIO(mp3_data),
            media_type="audio/mpeg",
            headers={
                "Content-Length": str(len(mp3_data)),
                "X-TTS-Engine": "edge",
                "X-TTS-Voice": tts_service._voice,
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS 异常: {e}")
        raise HTTPException(status_code=500, detail=f"TTS 合成失败: {str(e)}")
    finally:
        # 恢复原配置
        tts_service._voice = original_voice
        tts_service._speed = original_speed


@router.post("/stream", summary="流式文本转语音")
async def text_to_speech_stream(request: TTSRequest):
    """
    流式 TTS — 边合成边传输。

    前端可立即开始播放，无需等待完整合成。
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="文本不能为空")

    if request.voice:
        tts_service._voice = request.voice
    if request.speed:
        tts_service.set_speed(request.speed)

    return StreamingResponse(
        tts_service.synthesize_stream(request.text),
        media_type="audio/mpeg",
        headers={"X-TTS-Engine": "edge"},
    )


@router.get("/voices", summary="获取可用语音列表")
async def get_voices():
    """
    返回所有可用的 TTS 语音选项。

    前端可用于设置界面展示语音选择器。
    """
    return {
        "voices": [
            {
                "id": "zh-CN-XiaoxiaoNeural",
                "name": "晓晓 (活泼女声)",
                "language": "zh-CN",
                "gender": "female",
            },
            {
                "id": "zh-CN-XiaoyiNeural",
                "name": "晓伊 (温柔女声)",
                "language": "zh-CN",
                "gender": "female",
            },
            {
                "id": "zh-CN-YunxiNeural",
                "name": "云希 (青春男声)",
                "language": "zh-CN",
                "gender": "male",
            },
            {
                "id": "zh-CN-YunyangNeural",
                "name": "云扬 (新闻男声)",
                "language": "zh-CN",
                "gender": "male",
            },
            {
                "id": "en-US-JennyNeural",
                "name": "Jenny (美式女声)",
                "language": "en-US",
                "gender": "female",
            },
            {
                "id": "en-US-GuyNeural",
                "name": "Guy (美式男声)",
                "language": "en-US",
                "gender": "male",
            },
        ],
        "current_voice": tts_service._voice,
        "current_speed": tts_service._speed,
    }
