"""
STT (Speech-to-Text) 服务

调用 OpenAI Whisper API 实现语音转文字。
使用 openai SDK，支持：
- 多语言识别
- 自定义温度参数
- 多种响应格式
- 完整的异常处理和日志记录
"""

import logging
import time
import tempfile
import os
from pathlib import Path
from typing import Optional, BinaryIO

from openai import OpenAI, APIError, APITimeoutError, AuthenticationError, BadRequestError

from app.config import settings

# ============================================================
# Logger
# ============================================================

logger = logging.getLogger("stt_service")
logger.setLevel(settings.LOG_LEVEL if hasattr(settings, "LOG_LEVEL") else "INFO")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("[%(asctime)s] [%(name)s] %(levelname)s - %(message)s")
    )
    logger.addHandler(handler)


# ============================================================
# STT Service
# ============================================================

class STTService:
    """
    Whisper 语音识别服务

    使用 OpenAI Whisper API 将音频文件转换为文本。
    支持 mp3, mp4, mpeg, mpga, m4a, wav, webm 等格式。
    """

    def __init__(self):
        """初始化 OpenAI 客户端"""
        self._client: Optional[OpenAI] = None
        self._initialized = False

    @property
    def client(self) -> OpenAI:
        """
        懒加载 OpenAI 客户端。

        Returns:
            已配置的 OpenAI 客户端实例

        Raises:
            ValueError: API Key 未配置时抛出
        """
        if not self._client:
            api_key = settings.OPENAI_API_KEY
            if not api_key:
                raise ValueError(
                    "OPENAI_API_KEY 未配置。请在 .env 文件中设置 OPENAI_API_KEY=your_key"
                )

            self._client = OpenAI(
                api_key=api_key,
                base_url=settings.OPENAI_BASE_URL,
                timeout=60.0,               # 音频上传可能需要更长时间
                max_retries=2,
            )
            self._initialized = True
            logger.info(f"OpenAI 客户端初始化完成 | base_url={settings.OPENAI_BASE_URL}")

        return self._client

    @property
    def is_ready(self) -> bool:
        """检查服务是否可用"""
        return self._initialized

    # ============================================================
    # 核心方法
    # ============================================================

    async def transcribe(
        self,
        audio_data: bytes,
        *,
        language: Optional[str] = None,
        prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        response_format: Optional[str] = None,
    ) -> str:
        """
        将音频数据转写为文字。

        核心流程:
        1. 将 bytes 写入临时文件（Whisper API 需要文件对象）
        2. 调用 OpenAI Whisper API
        3. 解析并返回识别文本
        4. 清理临时文件

        Args:
            audio_data:  音频文件的字节数据（WAV / MP3 / WebM 等）
            language:    识别语言代码（ISO 639-1），默认 settings.STT_LANGUAGE
            prompt:      提示词，用于引导模型识别专有名词/领域术语
            temperature: 采样温度 [0-1]，默认 settings.STT_TEMPERATURE
            response_format: 响应格式，默认 settings.STT_RESPONSE_FORMAT

        Returns:
            识别出的文本字符串

        Raises:
            ValueError:      参数无效或音频数据为空
            AuthenticationError: API Key 无效
            APITimeoutError: 请求超时
            BadRequestError: 音频格式不支持或其他请求错误
            RuntimeError:    其他未预期的错误
        """
        # ---- 参数校验 ----
        if not audio_data:
            raise ValueError("audio_data 为空，无法进行语音识别")

        lang = language or settings.STT_LANGUAGE
        temp = temperature if temperature is not None else settings.STT_TEMPERATURE
        fmt = response_format or settings.STT_RESPONSE_FORMAT

        logger.info(
            f"开始语音识别 | 大小={len(audio_data)} bytes | "
            f"语言={lang} | 温度={temp} | 格式={fmt}"
        )

        tmp_path: Optional[str] = None
        start_time = time.perf_counter()

        try:
            # 1. 写入临时文件
            tmp_path = self._write_temp_file(audio_data)
            logger.debug(f"临时文件: {tmp_path} ({os.path.getsize(tmp_path)} bytes)")

            # 2. 调用 Whisper API
            transcription = await self._call_whisper_api(
                file_path=tmp_path,
                language=lang,
                prompt=prompt,
                temperature=temp,
                response_format=fmt,
            )

            elapsed = time.perf_counter() - start_time
            logger.info(
                f"语音识别完成 | 耗时={elapsed:.2f}s | "
                f"文本长度={len(transcription)} | "
                f"预览=\"{transcription[:50]}...\""
            )

            return transcription

        except (ValueError, AuthenticationError, APITimeoutError, BadRequestError):
            # 这些异常直接向上抛出，由路由层处理
            raise

        except APIError as e:
            logger.error(f"OpenAI API 错误: {e}")
            raise RuntimeError(f"Whisper API 调用失败: {e}") from e

        except Exception as e:
            logger.exception(f"语音识别未预期错误: {e}")
            raise RuntimeError(f"语音识别失败: {e}") from e

        finally:
            # 3. 清理临时文件
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                    logger.debug(f"已清理临时文件: {tmp_path}")
                except OSError as e:
                    logger.warning(f"清理临时文件失败: {e}")

    # ============================================================
    # 辅助方法
    # ============================================================

    def _write_temp_file(self, audio_data: bytes) -> str:
        """
        将音频字节写入临时文件。

        Args:
            audio_data: 音频字节数据

        Returns:
            临时文件路径
        """
        # 创建临时文件（保留扩展名有助于 Whisper 识别格式）
        fd, path = tempfile.mkstemp(
            suffix=".wav",
            prefix="stt_",
            dir=tempfile.gettempdir(),
        )
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(audio_data)
        except Exception:
            # 写入失败时确保删除
            if os.path.exists(path):
                os.unlink(path)
            raise

        return path

    async def _call_whisper_api(
        self,
        file_path: str,
        language: str,
        prompt: Optional[str],
        temperature: float,
        response_format: str,
    ) -> str:
        """
        调用 OpenAI Whisper API 进行语音识别。

        API 文档: https://platform.openai.com/docs/api-reference/audio/createTranscription

        Args:
            file_path:        音频文件路径
            language:         语言代码
            prompt:           可选提示词
            temperature:      采样温度
            response_format:  响应格式

        Returns:
            识别文本
        """
        # 构建 API 参数
        kwargs = {
            "model": "whisper-1",
            "file": Path(file_path),
            "language": language,
            "temperature": temperature,
            "response_format": response_format,
        }

        # prompt 为可选参数
        if prompt:
            kwargs["prompt"] = prompt

        logger.debug(f"调用 Whisper API | model={kwargs['model']}")

        # 调用 OpenAI SDK
        result = self.client.audio.transcriptions.create(**kwargs)

        # 提取文本
        # response_format="json" → result.text
        # response_format="verbose_json" → result.text
        # response_format="text" → result 本身就是字符串
        if response_format == "text":
            text = str(result)
        else:
            text = result.text

        if not text or not text.strip():
            logger.warning("Whisper 返回空文本")
            return ""

        return text.strip()

    # ============================================================
    # 便捷方法
    # ============================================================

    async def transcribe_file(self, file: BinaryIO) -> str:
        """
        从文件对象直接转写（便捷方法）。

        Args:
            file: 已打开的二进制文件对象

        Returns:
            识别文本
        """
        audio_data = file.read()
        return await self.transcribe(audio_data)


# ============================================================
# 全局单例
# ============================================================

stt_service = STTService()
