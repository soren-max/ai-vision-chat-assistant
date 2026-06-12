"""
科大讯飞 STT 服务 (Xunfei IAT)

使用讯飞语音听写 WebSocket API 进行语音识别。
国内中文识别准确率 > 97%，远优于通用 Whisper 模型。

协议: WebSocket wss://iat-api.xfyun.cn/v2/iat
认证: HMAC-SHA256 签名
音频格式: 16kHz, 16bit, 单声道 PCM (WAV)

参考文档: https://www.xfyun.cn/doc/asr/voicedictation/API.html
"""

import base64
import hashlib
import hmac
import io
import json
import logging
import struct
import time
import wave
from datetime import datetime
from urllib.parse import urlencode
from typing import Optional

import websockets

from app.config import settings

# ============================================================
# Logger
# ============================================================

logger = logging.getLogger("xfyun_stt")
logger.setLevel(settings.LOG_LEVEL)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(
        logging.Formatter("[%(asctime)s] [%(name)s] %(levelname)s - %(message)s")
    )
    logger.addHandler(h)

# ============================================================
# 常量
# ============================================================

# 讯飞 IAT WebSocket 地址
XFYUN_STT_URL = f"wss://{settings.XFYUN_STT_HOST}/v2/iat"

# 音频参数（与前端 WAV 保持一致）
AUDIO_SAMPLE_RATE = 16000
AUDIO_BITS = 16
AUDIO_CHANNELS = 1

# 发送状态码
STATUS_FIRST_FRAME = 0     # 第一帧
STATUS_CONTINUE_FRAME = 1  # 中间帧
STATUS_LAST_FRAME = 2      # 最后一帧


# ============================================================
# XunfeiSTTService
# ============================================================

class XunfeiSTTService:
    """
    科大讯飞语音听写服务

    通过 WebSocket 连接讯飞 IAT API 进行实时语音识别。
    中文识别准确率极高，适合国内场景。
    """

    def __init__(self):
        self._appid = settings.XFYUN_APPID
        self._api_key = settings.XFYUN_API_KEY
        self._api_secret = settings.XFYUN_API_SECRET

    @property
    def is_ready(self) -> bool:
        """检查服务是否可用"""
        return bool(self._appid and self._api_key and self._api_secret)

    # ============================================================
    # 核心方法
    # ============================================================

    async def transcribe(self, audio_bytes: bytes) -> str:
        """
        将 WAV 音频转为识别文本。

        Args:
            audio_bytes: WAV 格式音频数据

        Returns:
            识别文本

        Raises:
            ValueError:  凭据未配置或音频格式错误
            RuntimeError: 讯飞 API 调用失败
        """
        if not self.is_ready:
            raise ValueError(
                "科大讯飞凭据未完整配置。需要在 .env 中设置 "
                "XFYUN_APPID, XFYUN_API_KEY, XFYUN_API_SECRET"
            )

        # 1. 从 WAV 中提取原始 PCM 数据
        pcm_data = self._extract_pcm(audio_bytes)
        logger.info(
            f"讯飞 STT 开始 | 音频大小={len(audio_bytes)} bytes | "
            f"PCM={len(pcm_data)} bytes | APPID={self._appid}"
        )

        # 2. 构建鉴权 URL
        ws_url = self._build_auth_url()

        # 3. WebSocket 通信
        try:
            result = await self._websocket_transcribe(ws_url, pcm_data)
            logger.info(
                f"讯飞 STT 完成 | 文本=\"{result[:80]}\" | 长度={len(result)}"
            )
            return result
        except Exception as e:
            logger.error(f"讯飞 STT 失败: {e}")
            raise RuntimeError(f"科大讯飞识别失败: {e}") from e

    # ============================================================
    # WebSocket 通信
    # ============================================================

    async def _websocket_transcribe(
        self, ws_url: str, pcm_data: bytes
    ) -> str:
        """
        通过 WebSocket 发送音频并接收识别结果。
        """
        recognized_text: list[str] = []

        # 连接参数
        param = {
            "host": settings.XFYUN_STT_HOST,
            "app_id": self._appid,
            "status": STATUS_FIRST_FRAME,
            "format": f"audio/L16;rate={AUDIO_SAMPLE_RATE}",
            "encoding": "raw",
            "audio": "",  # 第一帧不传音频
        }

        try:
            async with websockets.connect(ws_url) as ws:
                logger.debug(f"WebSocket 已连接: {settings.XFYUN_STT_HOST}")

                # 发送音频帧
                frame_size = 1280  # 40ms @ 16kHz 16bit mono
                for i in range(0, len(pcm_data), frame_size):
                    chunk = pcm_data[i : i + frame_size]

                    if i == 0:
                        # 第一帧
                        param["status"] = STATUS_FIRST_FRAME
                    elif i + frame_size >= len(pcm_data):
                        # 最后一帧
                        param["status"] = STATUS_LAST_FRAME
                    else:
                        # 中间帧
                        param["status"] = STATUS_CONTINUE_FRAME

                    param["audio"] = base64.b64encode(chunk).decode()
                    await ws.send(json.dumps(param))

                    # 接收识别结果
                    try:
                        response = await ws.recv()
                        result = json.loads(response)

                        # 解析识别文本
                        if result.get("code") == 0:
                            text = self._parse_result(result)
                            if text:
                                recognized_text.append(text)
                        else:
                            logger.warning(
                                f"讯飞返回错误: code={result.get('code')} "
                                f"msg={result.get('message')}"
                            )
                    except websockets.exceptions.ConnectionClosed:
                        break

        except Exception as e:
            logger.error(f"WebSocket 通信失败: {e}")
            raise

        return "".join(recognized_text).strip()

    # ============================================================
    # 鉴权
    # ============================================================

    def _build_auth_url(self) -> str:
        """
        构建带 HMAC-SHA256 签名的 WebSocket URL。

        讯飞鉴权规则:
        1. 拼接: host + date + method
        2. 使用 APISecret 做 HMAC-SHA256 签名
        3. 在 URL 参数中携带 authorization
        """
        # 当前时间 (RFC 1123)
        now = datetime.utcnow()
        date = now.strftime("%a, %d %b %Y %H:%M:%S GMT")

        # 签名字符串
        signature_origin = f"host: {settings.XFYUN_STT_HOST}\ndate: {date}\nGET /v2/iat HTTP/1.1"

        # HMAC-SHA256 签名
        signature = base64.b64encode(
            hmac.new(
                self._api_secret.encode(),
                signature_origin.encode(),
                digestmod=hashlib.sha256,
            ).digest()
        ).decode()

        # 组装 authorization
        authorization_origin = (
            f'api_key="{self._api_key}", '
            f'algorithm="hmac-sha256", '
            f'headers="host date request-line", '
            f'signature="{signature}"'
        )
        authorization = base64.b64encode(authorization_origin.encode()).decode()

        # 构建 URL 参数
        params = {
            "authorization": authorization,
            "date": date,
            "host": settings.XFYUN_STT_HOST,
        }

        return f"{XFYUN_STT_URL}?{urlencode(params)}"

    # ============================================================
    # 音频处理
    # ============================================================

    def _extract_pcm(self, wav_bytes: bytes) -> bytes:
        """
        从 WAV 文件中提取原始 PCM 数据。

        验证音频参数是否匹配讯飞要求。
        """
        try:
            buf = io.BytesIO(wav_bytes)
            with wave.open(buf, "rb") as wf:
                # 验证参数
                if wf.getnchannels() != AUDIO_CHANNELS:
                    logger.warning(
                        f"声道数不匹配: {wf.getnchannels()} → 需要 {AUDIO_CHANNELS}"
                    )
                if wf.getsampwidth() != AUDIO_BITS // 8:
                    logger.warning(
                        f"采样位深不匹配: {wf.getsampwidth() * 8} → 需要 {AUDIO_BITS}"
                    )

                return wf.readframes(wf.getnframes())
        except Exception as e:
            raise ValueError(f"WAV 解析失败: {e}") from e

    # ============================================================
    # 结果解析
    # ============================================================

    def _parse_result(self, result: dict) -> str:
        """
        解析讯飞返回的识别结果 JSON。

        返回格式:
        {
          "code": 0,
          "data": {
            "result": {
              "ws": [
                {
                  "cw": [{"w": "你好"}],
                  "wb": 0, "we": 0
                }
              ]
            }
          }
        }
        """
        try:
            data = result.get("data", {})
            ws_list = data.get("result", {}).get("ws", [])

            words: list[str] = []
            for ws in ws_list:
                cw_list = ws.get("cw", [])
                for cw in cw_list:
                    word = cw.get("w", "")
                    if word:
                        words.append(word)

            return "".join(words)
        except (KeyError, TypeError, IndexError):
            return ""


# ============================================================
# 全局单例
# ============================================================

xfyun_stt_service = XunfeiSTTService()
