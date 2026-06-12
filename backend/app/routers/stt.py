"""
STT (Speech-to-Text) 路由

提供语音识别 REST API 端点。
- 主力引擎: 科大讯飞 IAT (中文准确率 >97%)
- 备选引擎: OpenAI Whisper

POST /api/stt — 上传音频文件，返回识别文本
"""

import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Form

from app.services.xfyun_stt_service import xfyun_stt_service
from app.services.stt_service import stt_service
from app.models.schemas import STTResponse
from app.config import settings

# ============================================================
# Logger
# ============================================================

logger = logging.getLogger("stt_router")

# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api/stt", tags=["语音识别"])


@router.post("", response_model=STTResponse, summary="语音转文字")
async def speech_to_text(
    file: UploadFile = File(..., description="音频文件（支持 WAV / MP3 / WebM / M4A 等）"),
    language: str = Form("zh", description="识别语言（ISO 639-1 代码）"),
    prompt: str = Form("", description="提示词，用于引导模型识别特定术语"),
) -> STTResponse:
    """
    语音转文字接口

    优先使用科大讯飞 IAT（中文准确率 > 97%，识别速度快），
    不可用时自动回退到 OpenAI Whisper。

    **支持的格式**: wav, mp3, mp4, mpeg, mpga, m4a, webm, ogg

    **使用示例**:
    ```bash
    curl -X POST http://localhost:8000/api/stt \\
         -F "file=@recording.wav" \\
         -F "language=zh"
    ```
    """
    # ---- 1. 读取音频文件 ----
    try:
        audio_bytes = await file.read()
    except Exception as e:
        logger.error(f"读取上传文件失败: {e}")
        raise HTTPException(status_code=400, detail=f"无法读取音频文件: {e}")

    # ---- 2. 校验 ----
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="音频文件为空")

    max_size_mb = 25
    if len(audio_bytes) > max_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"音频超过 {max_size_mb}MB 限制")

    logger.info(
        f"STT 请求 | 文件={file.filename} | "
        f"大小={len(audio_bytes)}B | 语言={language} | 引擎={settings.STT_ENGINE}"
    )

    # ---- 3. 讯飞优先 → Whisper 降级 ----
    text = ""
    engine_used = ""

    # 尝试讯飞
    if xfyun_stt_service.is_ready and settings.STT_ENGINE == "xfyun":
        try:
            text = await xfyun_stt_service.transcribe(audio_bytes)
            engine_used = "xfyun"
            logger.info(f"STT 完成 [讯飞] | 文本=\"{text[:50]}...\"")
        except Exception as e:
            logger.warning(f"讯飞识别失败，回退 Whisper: {e}")
            engine_used = ""

    # 回退 Whisper
    if not engine_used:
        try:
            text = await stt_service.transcribe(
                audio_data=audio_bytes,
                language=language if language else None,
                prompt=prompt if prompt else None,
            )
            engine_used = "whisper"
            logger.info(f"STT 完成 [Whisper] | 文本=\"{text[:50]}...\"")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"语音识别失败: {e}")

    # ---- 4. 返回 ----
    if not text:
        return STTResponse(text="", message="未检测到有效语音内容")

    return STTResponse(text=text)
