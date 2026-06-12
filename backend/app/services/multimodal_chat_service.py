"""
Multimodal Chat Service

融合用户语音识别文本和视觉分析结果，
调用 DeepSeek-V4-Pro 生成结合视觉上下文的自然语言回复。

核心能力:
- 多轮对话管理（每会话保留最近 10 轮上下文）
- 视觉+文本融合 Prompt 构建
- 对话历史修剪
- 会话级别线程安全
"""

import logging
import threading
from typing import Optional

from openai import OpenAI

from app.config import settings

# ============================================================
# Logger
# ============================================================

logger = logging.getLogger("multimodal_chat")
logger.setLevel(settings.LOG_LEVEL)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(
        logging.Formatter("[%(asctime)s] [%(name)s] %(levelname)s - %(message)s")
    )
    logger.addHandler(h)

# ============================================================
# System Prompt
# ============================================================

SYSTEM_PROMPT = """你是 AI Vision Chat Assistant，一个支持视觉和语音的多模态智能助手。

你的能力:
- 可以"看到"摄像头画面，理解周围环境
- 可以"听到"用户的语音问题
- 结合视觉信息提供精准、自然的回答

回复要求:
1. 自然口语化 —— 因为最终会通过 TTS 语音播报
2. 简洁有条理 —— 控制在 2-3 段内
3. 主动利用视觉上下文 —— 如果看到了画面就结合描述回答
4. 没有视觉信息时诚实相告 —— "目前没有画面信息，但根据我的知识..."
5. 使用中文回复
"""

# ============================================================
# 消息结构
# ============================================================

class ChatMessage:
    """单条对话消息"""

    __slots__ = ("role", "content")

    def __init__(self, role: str, content: str):
        self.role = role      # "system" | "user" | "assistant"
        self.content = content

    def to_dict(self) -> dict:
        return {"role": self.role, "content": self.content}

    @classmethod
    def user(cls, content: str) -> "ChatMessage":
        return cls("user", content)

    @classmethod
    def assistant(cls, content: str) -> "ChatMessage":
        return cls("assistant", content)


# ============================================================
# 对话存储（会话级别）
# ============================================================

class ConversationStore:
    """
    线程安全的对话存储器。

    每个会话保留最近 N 轮对话上下文（N = MULTIMODAL_MAX_HISTORY），
    超出的历史自动淘汰。
    """

    def __init__(self, max_rounds: int = 10):
        """
        Args:
            max_rounds: 保留的最大对话轮数（每轮 = 用户消息 + AI 回复）
        """
        self._max_rounds = max_rounds
        self._max_messages = max_rounds * 2  # user + assistant
        self._store: dict[str, list[ChatMessage]] = {}
        self._lock = threading.Lock()

    def get(self, session_id: str) -> list[ChatMessage]:
        """
        获取指定会话的对话历史（拷贝，避免外部修改）。

        Args:
            session_id: 会话标识

        Returns:
            对话历史列表（安全拷贝）
        """
        with self._lock:
            messages = self._store.get(session_id, [])
            return list(messages)

    def add(self, session_id: str, message: ChatMessage) -> None:
        """
        添加一条消息到会话历史。

        自动修剪：超过最大消息数时移除最早的消息。
        """
        with self._lock:
            if session_id not in self._store:
                self._store[session_id] = []

            history = self._store[session_id]
            history.append(message)

            # 修剪到最大消息数
            while len(history) > self._max_messages:
                removed = history.pop(0)
                logger.debug(
                    f"[{session_id}] 淘汰历史: {removed.role} "
                    f"\"{removed.content[:30]}...\""
                )

    def clear(self, session_id: str) -> None:
        """清除指定会话的所有历史"""
        with self._lock:
            self._store.pop(session_id, None)
            logger.info(f"[{session_id}] 对话历史已清除")

    def length(self, session_id: str) -> int:
        """获取指定会话的消息数"""
        with self._lock:
            return len(self._store.get(session_id, []))

    def rounds(self, session_id: str) -> int:
        """获取指定会话的对话轮数"""
        return self.length(session_id) // 2


# 全局单例
conversation_store = ConversationStore(max_rounds=settings.MULTIMODAL_MAX_HISTORY)


# ============================================================
# 多模态对话服务
# ============================================================

class MultimodalChatService:
    """
    多模态对话服务

    融合视觉上下文和用户语音文本，
    维护多轮对话，调用 DeepSeek 生成回复。
    """

    def __init__(self):
        self._client: Optional[OpenAI] = None
        self._store = conversation_store

    @property
    def client(self) -> OpenAI:
        """懒加载 DeepSeek 客户端"""
        if not self._client:
            api_key = settings.DEEPSEEK_API_KEY
            if not api_key:
                raise ValueError(
                    "DEEPSEEK_API_KEY 未配置。请在 .env 文件中设置 DEEPSEEK_API_KEY=your_key"
                )
            self._client = OpenAI(
                api_key=api_key,
                base_url=settings.DEEPSEEK_BASE_URL,
                timeout=30.0,
                max_retries=2,
            )
            logger.info(f"多模态对话客户端初始化完成 | model={settings.DEEPSEEK_MODEL}")
        return self._client

    # ============================================================
    # 核心方法
    # ============================================================

    async def chat(
        self,
        session_id: str,
        user_text: str,
        vision_context: str = "",
    ) -> str:
        """
        发送多模态消息并获取回复。

        流程:
        1. 构建用户消息（融合文本 + 视觉上下文）
        2. 获取对话历史
        3. 组装完整消息列表
        4. 调用 DeepSeek
        5. 保存本轮对话到历史
        6. 返回回复

        Args:
            session_id:      会话标识
            user_text:       用户语音识别文本
            vision_context:  视觉分析结果文本（可选）

        Returns:
            AI 回复文本

        Raises:
            ValueError:  参数无效或 API Key 未配置
            RuntimeError: API 调用失败
        """
        # ---- 1. 校验 ----
        if not session_id:
            raise ValueError("session_id 不能为空")
        if not user_text or not user_text.strip():
            raise ValueError("user_text 不能为空")
        if not settings.DEEPSEEK_API_KEY:
            raise ValueError(
                "DEEPSEEK_API_KEY 未配置。请在 .env 文件中设置 DEEPSEEK_API_KEY=your_key"
            )

        logger.info(
            f"[{session_id}] 接收消息 | 文本=\"{user_text[:50]}...\" | "
            f"视觉上下文={'有' if vision_context else '无'} | "
            f"当前轮数={self._store.rounds(session_id)}"
        )

        # ---- 2. 构建用户消息 ----
        user_message = self._build_user_message(user_text, vision_context)

        # ---- 3. 构建 API 消息列表 ----
        messages = self._build_api_messages(session_id, user_message)

        # ---- 4. 调用 DeepSeek ----
        try:
            reply = self._call_deepseek(messages)
        except Exception as e:
            logger.error(f"[{session_id}] API 调用失败: {e}")
            raise RuntimeError(f"DeepSeek 调用失败: {e}") from e

        # ---- 5. 保存对话 ----
        self._store.add(session_id, ChatMessage.user(user_message))
        self._store.add(session_id, ChatMessage.assistant(reply))

        logger.info(
            f"[{session_id}] 回复生成 | 长度={len(reply)} | "
            f"当前轮数={self._store.rounds(session_id)}"
        )

        return reply

    # ============================================================
    # Prompt 构建
    # ============================================================

    def _build_user_message(self, user_text: str, vision_context: str) -> str:
        """
        构建融合视觉上下文的用户消息。

        Prompt 格式:
        ```
        当前摄像头看到：
        {vision_context}

        用户说：
        {user_text}

        请结合视觉内容回答。
        ```

        Args:
            user_text: 用户语音识别文本
            vision_context: 视觉分析结果

        Returns:
            构建好的用户消息文本
        """
        if not vision_context or not vision_context.strip():
            # 没有视觉信息，直接返回纯文本
            return user_text

        # 有视觉上下文 —— 融合
        return (
            f"当前摄像头看到：\n{vision_context}\n\n"
            f"用户说：\n{user_text}\n\n"
            f"请结合视觉内容回答。"
        )

    def _build_api_messages(
        self, session_id: str, current_user_msg: str
    ) -> list[dict]:
        """
        组装完整的 API 消息列表。

        结构:
        [system_prompt, history_msg_1, history_msg_2, ..., current_user_msg]

        Args:
            session_id:         会话标识
            current_user_msg:   当前轮用户消息

        Returns:
            API 消息列表
        """
        messages: list[dict] = []

        # 1. System prompt
        messages.append({"role": "system", "content": SYSTEM_PROMPT})

        # 2. 对话历史
        history = self._store.get(session_id)
        if history:
            # 转为 API 格式
            history_dicts = [msg.to_dict() for msg in history]
            messages.extend(history_dicts)
            logger.debug(
                f"[{session_id}] 加载历史: {len(history)} 条消息 "
                f"({len(history) // 2} 轮)"
            )

        # 3. 当前用户消息
        messages.append({"role": "user", "content": current_user_msg})

        return messages

    # ============================================================
    # DeepSeek 调用
    # ============================================================

    def _call_deepseek(self, messages: list[dict]) -> str:
        """
        调用 DeepSeek Chat Completions API。

        Args:
            messages: 完整的消息列表

        Returns:
            AI 回复文本

        Raises:
            RuntimeError: API 返回空内容
        """
        response = self.client.chat.completions.create(
            model=settings.DEEPSEEK_MODEL,
            temperature=settings.MULTIMODAL_TEMPERATURE,
            max_tokens=settings.MULTIMODAL_MAX_TOKENS,
            messages=messages,
        )

        content = response.choices[0].message.content
        if not content:
            raise RuntimeError("DeepSeek API 返回空内容")

        return content.strip()

    # ============================================================
    # 会话管理
    # ============================================================

    def clear_context(self, session_id: str) -> None:
        """清除指定会话的对话上下文"""
        self._store.clear(session_id)

    def get_context(self, session_id: str) -> list[dict]:
        """
        获取指定会话的对话上下文（用于前端展示或调试）

        Returns:
            消息字典列表
        """
        messages = self._store.get(session_id)
        return [msg.to_dict() for msg in messages]

    def get_stats(self, session_id: str) -> dict:
        """
        获取指定会话的统计信息

        Returns:
            包含消息数、轮数的字典
        """
        return {
            "session_id": session_id,
            "message_count": self._store.length(session_id),
            "round_count": self._store.rounds(session_id),
            "max_rounds": self._store._max_rounds,
        }


# ============================================================
# 全局单例
# ============================================================

multimodal_chat_service = MultimodalChatService()
