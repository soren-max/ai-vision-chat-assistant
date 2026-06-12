"""
应用配置模块

使用 pydantic-settings 从环境变量或 .env 文件加载配置。
"""

from pydantic import model_validator
from pydantic_settings import BaseSettings
from typing import Optional, List


class Settings(BaseSettings):
    """
    全局应用设置

    所有配置项优先读取环境变量，其次从 .env 文件加载。
    DeepSeek API Key 作为主 Key，其他服务 Key 未设置时自动回退。
    """

    # ---- 应用基础配置 ----
    APP_NAME: str = "AI Vision Chat Assistant"
    APP_VERSION: str = "0.2.0"          # LangGraph 架构升级
    DEBUG: bool = True

    # ---- 服务器配置 ----
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ---- CORS 允许的来源 ----
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:8000",
    ]

    # ---- DeepSeek API 配置（主 Key） ----
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_MODEL: str = "deepseek-v4-pro"
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"

    # ---- 视觉分析配置 ----
    VISION_MAX_DIMENSION: int = 1024      # 分析前缩放最大边长
    VISION_JPEG_QUALITY: int = 75         # 压缩 JPEG 质量 (1-100)
    VISION_MAX_IMAGE_SIZE_MB: int = 10    # 最大接受图片大小 (MB)
    VISION_TEMPERATURE: float = 0.3       # Vision 分析温度

    # ---- 多模态对话配置 ----
    MULTIMODAL_MAX_HISTORY: int = 10     # 保留最近 N 轮对话上下文
    MULTIMODAL_TEMPERATURE: float = 0.7  # 对话温度
    MULTIMODAL_MAX_TOKENS: int = 1024    # 回复最大 token 数

    # ---- LangGraph Agent 配置 ----
    AGENT_MAX_ITERATIONS: int = 10       # Graph 最大循环次数
    AGENT_RECURSION_LIMIT: int = 50      # LangGraph 递归限制

    # ---- 科大讯飞 STT 配置（主力语音识别）----
    XFYUN_APPID: Optional[str] = None         # 讯飞应用 APPID
    XFYUN_API_KEY: Optional[str] = None       # 讯飞 APIKey
    XFYUN_API_SECRET: Optional[str] = None    # 讯飞 APISecret
    XFYUN_STT_HOST: str = "iat-api.xfyun.cn"  # 讯飞语音听写服务地址

    # ---- OpenAI API 配置（Whisper STT 备选） ----
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"

    # ---- 语音识别通用配置 ----
    STT_ENGINE: str = "xfyun"              # 主力引擎: xfyun / whisper
    STT_LANGUAGE: str = "zh"               # 默认识别语言（ISO 639-1）

    # ---- TTS 语音合成配置 ----
    TTS_ENGINE: str = "edge"
    TTS_VOICE: str = "zh-CN-XiaoxiaoNeural"
    TTS_SPEED: float = 1.0

    # ---- 音频参数 ----
    AUDIO_SAMPLE_RATE: int = 16000
    AUDIO_CHANNELS: int = 1
    AUDIO_CHUNK_SIZE: int = 1024

    # ---- 成本优化配置（比赛场景） ----
    OPT_COST_SAVING_MODE: bool = True         # 启用成本优化模式
    OPT_VISION_MIN_INTERVAL_SEC: int = 8      # 视觉分析最小间隔秒数
    OPT_VISION_CHANGE_THRESHOLD: float = 0.15 # 场景变化检测阈值 (0-1)
    OPT_CACHE_TTL_SEC: int = 300              # 缓存过期时间（5分钟）
    OPT_TOKEN_BUDGET: int = 2000              # 单次请求 Token 预算上限
    OPT_MAX_HISTORY_ROUNDS: int = 3           # 优化模式下保留的对话轮数
    OPT_SUMMARY_HISTORY: bool = True          # 是否压缩历史为摘要
    OPT_SKIP_EMPTY_AUDIO: bool = True         # 跳过空/极短音频的 Whisper 调用
    OPT_MIN_AUDIO_DURATION_SEC: float = 0.5   # 最小有效音频时长（秒）

    # ---- 日志级别 ----
    LOG_LEVEL: str = "INFO"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }

    @model_validator(mode="after")
    def _apply_key_fallbacks(self) -> "Settings":
        """
        Key 回退策略:
        - OPENAI_API_KEY 未设置时 → 复用 DEEPSEEK_API_KEY
        - 确保所有 AI 服务统一使用 DeepSeek Key

        注意: DeepSeek 不提供原生 Whisper/TTS API，
        这些服务需要真实的 OpenAI Key 才能使用。
        """
        if not self.OPENAI_API_KEY and self.DEEPSEEK_API_KEY:
            self.OPENAI_API_KEY = self.DEEPSEEK_API_KEY
        return self


# 全局单例
settings = Settings()
