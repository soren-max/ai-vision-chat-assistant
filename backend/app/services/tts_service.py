"""
Text-to-Speech (TTS) 语音合成服务

将 AI 回复文本转换为 MP3 音频。
支持多引擎：Edge TTS（主力，免费高质中英文）、OpenAI TTS（备选）。

特性:
- 中英文混合语音
- MP3 格式输出
- 可调速播放
- 完整的异常处理和日志
"""

import io
import logging
from typing import Optional, AsyncGenerator

from app.config import settings

# ============================================================
# Logger
# ============================================================

logger = logging.getLogger("tts_service")
logger.setLevel(settings.LOG_LEVEL)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(
        logging.Formatter("[%(asctime)s] [%(name)s] %(levelname)s - %(message)s")
    )
    logger.addHandler(h)

# ============================================================
# 语音配置映射
# ============================================================

# Edge TTS 中英文语音映射
VOICE_MAP = {
    # 中文女声
    "zh-CN-XiaoxiaoNeural": "zh-CN-XiaoxiaoNeural",      # 活泼女声
    "zh-CN-XiaoyiNeural": "zh-CN-XiaoyiNeural",          # 温柔女声
    "zh-CN-YunxiNeural": "zh-CN-YunxiNeural",            # 青春男声
    "zh-CN-YunyangNeural": "zh-CN-YunyangNeural",        # 新闻男声
    # 英文
    "en-US-JennyNeural": "en-US-JennyNeural",            # 美式女声
    "en-US-GuyNeural": "en-US-GuyNeural",                # 美式男声
    "en-GB-SoniaNeural": "en-GB-SoniaNeural",            # 英式女声
}

# ============================================================
# TTS Service
# ============================================================

class TTSService:
    """
    TTS 语音合成服务

    将文本合成 MP3 音频。
    优先使用 Edge TTS（免费，高质量中英文），
    OpenAI TTS 作为备选。
    """

    def __init__(self):
        self._engine = settings.TTS_ENGINE
        self._voice = settings.TTS_VOICE
        self._speed = settings.TTS_SPEED
        self._rate_str = self._speed_to_rate(self._speed)

    @staticmethod
    def _speed_to_rate(speed: float) -> str:
        """
        将速度倍数转换为 Edge TTS 的 rate 字符串。

        Edge TTS rate 格式: "+0%" ~ "+100%" (加速) / "-0%" ~ "-100%" (减速)
        """
        if speed == 1.0:
            return "+0%"
        elif speed > 1.0:
            return f"+{int((speed - 1) * 100)}%"
        else:
            return f"-{int((1 - speed) * 100)}%"

    # ============================================================
    # 核心方法：Edge TTS
    # ============================================================

    async def synthesize(self, text: str) -> Optional[bytes]:
        """
        使用 Edge TTS 合成完整 MP3 音频。

        Args:
            text: 要合成的文本

        Returns:
            MP3 字节数据，失败返回 None
        """
        if not text or not text.strip():
            logger.warning("TTS 收到空文本")
            return None

        logger.info(
            f"TTS 合成 | 引擎={self._engine} | "
            f"语音={self._voice} | 速度={self._speed}x | "
            f"文本长度={len(text)}"
        )

        try:
            import edge_tts

            voice = VOICE_MAP.get(self._voice, self._voice)

            communicate = edge_tts.Communicate(
                text=text.strip(),
                voice=voice,
                rate=self._rate_str,
            )

            # 收集所有音频块
            mp3_chunks: list[bytes] = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    mp3_chunks.append(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    # 字边界事件（可用于前端口型同步）
                    pass

            if not mp3_chunks:
                logger.error("Edge TTS 未产生音频数据")
                return None

            mp3_data = b"".join(mp3_chunks)
            logger.info(
                f"TTS 合成完成 | 引擎=edge | "
                f"大小={len(mp3_data)} bytes ({len(mp3_data) / 1024:.1f}KB)"
            )
            return mp3_data

        except ImportError:
            logger.error("edge-tts 未安装，请运行: pip install edge-tts")
            return None
        except Exception as e:
            logger.error(f"Edge TTS 合成失败: {e}")
            # 尝试 OpenAI TTS 备选
            return await self._synthesize_openai(text)

    # ============================================================
    # 备选：OpenAI TTS
    # ============================================================

    async def _synthesize_openai(self, text: str) -> Optional[bytes]:
        """
        使用 OpenAI TTS API 合成音频（备选方案）。

        需要配置 OPENAI_API_KEY。
        """
        try:
            from openai import OpenAI

            api_key = settings.OPENAI_API_KEY
            if not api_key:
                logger.warning("OPENAI_API_KEY 未配置，OpenAI TTS 不可用")
                return None

            client = OpenAI(
                api_key=api_key,
                base_url=settings.OPENAI_BASE_URL,
                timeout=30.0,
            )

            response = client.audio.speech.create(
                model="tts-1",
                voice="alloy",
                input=text.strip(),
                speed=self._speed,
                response_format="mp3",
            )

            mp3_data = response.content
            logger.info(
                f"TTS 合成完成 | 引擎=openai | 大小={len(mp3_data)} bytes"
            )
            return mp3_data

        except Exception as e:
            logger.error(f"OpenAI TTS 合成失败: {e}")
            return None

    # ============================================================
    # 流式合成
    # ============================================================

    async def synthesize_stream(
        self, text: str
    ) -> AsyncGenerator[bytes, None]:
        """
        流式合成 TTS，逐块产出 MP3 数据。

        边合成边传输，前端可立即开始播放。

        Args:
            text: 需要播报的文本

        Yields:
            MP3 音频数据块
        """
        if not text or not text.strip():
            return

        try:
            import edge_tts

            voice = VOICE_MAP.get(self._voice, self._voice)

            communicate = edge_tts.Communicate(
                text=text.strip(),
                voice=voice,
                rate=self._rate_str,
            )

            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]

        except ImportError:
            logger.error("edge-tts 未安装，无法流式合成")
        except Exception as e:
            logger.error(f"流式 TTS 失败: {e}")

    # ============================================================
    # 工具方法
    # ============================================================

    def get_voice_info(self) -> dict:
        """获取当前语音配置"""
        return {
            "engine": self._engine,
            "voice": self._voice,
            "speed": self._speed,
            "available_voices": list(VOICE_MAP.keys()),
        }

    def set_voice(self, voice: str) -> bool:
        """切换语音（运行时）"""
        if voice in VOICE_MAP:
            self._voice = voice
            return True
        return False

    def set_speed(self, speed: float) -> None:
        """调整语速（0.5 ~ 2.0）"""
        self._speed = max(0.5, min(2.0, speed))
        self._rate_str = self._speed_to_rate(self._speed)


# 全局单例
tts_service = TTSService()
