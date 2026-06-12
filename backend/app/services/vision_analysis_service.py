"""
Vision Analysis 服务

调用 DeepSeek-V4-Pro 的多模态视觉能力分析摄像头截图。
返回结构化场景分析结果。

功能:
- 图片解码 → 缩放压缩 → Base64 编码
- DeepSeek Vision API 调用
- 结构化 JSON 输出解析
- 完整异常处理和日志
"""

import base64
import io
import json
import logging
import re
import time
from typing import Optional

from openai import OpenAI
from PIL import Image, UnidentifiedImageError

from app.config import settings

# ============================================================
# Logger
# ============================================================

logger = logging.getLogger("vision_analysis")
logger.setLevel(settings.LOG_LEVEL)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(
        logging.Formatter("[%(asctime)s] [%(name)s] %(levelname)s - %(message)s")
    )
    logger.addHandler(h)

# ============================================================
# 结构化输出 Prompt 模板
# ============================================================

VISION_SYSTEM_PROMPT = """你是一个专业的视觉分析引擎。请分析提供的图像，严格按照 JSON 格式返回结果。

分析维度:
1. scene: 场景整体描述（环境类型、光线、氛围、空间布局）
2. objects: 主要物体列表，每个物体包含 name、confidence(0-1)、position 描述
3. people: 人物列表，包含数量、每个人的姿态、动作、面部表情、衣着特征
4. screen_content: 如果图像中有屏幕（电脑/手机/电视），描述屏幕显示内容
5. risk_content: 识别可能涉及风险的视觉内容（危险物品、不安全行为、敏感显示内容等），无则为空数组
6. summary: 一句话总结场景核心信息

返回格式（严格 JSON，不要包含 markdown 标记）:
{
  "scene": "...",
  "objects": [{"name": "...", "confidence": 0.95, "position": "..."}],
  "people": [{"count": 1, "pose": "...", "action": "...", "expression": "...", "attire": "..."}],
  "screen_content": "...",
  "risk_content": ["..."] or [],
  "summary": "..."
}
"""

ANALYSIS_PROMPT = "请按照系统提示的格式分析这张图像，返回严格的 JSON 结果。"

# ============================================================
# Vision Analysis Service
# ============================================================

class VisionAnalysisService:
    """
    视觉分析服务

    接收 Base64 编码的 JPEG 图像，调用 DeepSeek-V4-Pro Vision API
    返回结构化场景分析。
    """

    def __init__(self):
        self._client: Optional[OpenAI] = None

    @property
    def client(self) -> OpenAI:
        """懒加载 OpenAI 客户端（使用 DeepSeek 兼容端点）"""
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
            logger.info(f"DeepSeek Vision 客户端初始化完成 | base_url={settings.DEEPSEEK_BASE_URL}")
        return self._client

    # ============================================================
    # 核心方法
    # ============================================================

    async def analyze(
        self,
        image_b64: str,
        *,
        user_prompt: Optional[str] = None,
    ) -> dict:
        """
        分析图像并返回结构化场景描述。

        流程:
        1. 校验 Base64 数据
        2. 解码 → 缩放压缩 → 重编码
        3. 调用 DeepSeek Vision API
        4. 解析 JSON 响应

        Args:
            image_b64:   Base64 编码的 JPEG 图像数据
            user_prompt: 附加的用户分析指令（可选）

        Returns:
            结构化分析结果字典:
            { scene, objects, people, screen_content, risk_content, summary }

        Raises:
            ValueError:     图像数据无效
            RuntimeError:   API 调用失败或解析失败
        """
        start_time = time.perf_counter()

        # ---- 1. 校验 ----
        if not image_b64:
            raise ValueError("图像数据为空")

        # 移除可能的 data:image/...;base64, 前缀
        clean_b64 = self._strip_data_uri(image_b64)

        # 校验大小（解码前估算）
        estimated_size = len(clean_b64) * 3 // 4  # Base64 → raw 近似
        max_bytes = settings.VISION_MAX_IMAGE_SIZE_MB * 1024 * 1024
        if estimated_size > max_bytes * 1.5:  # 留 50% 余量（压缩后可能更大）
            raise ValueError(
                f"图像过大（预估 {estimated_size / 1024 / 1024:.1f}MB，"
                f"限制 {settings.VISION_MAX_IMAGE_SIZE_MB}MB）"
            )

        logger.info(
            f"开始视觉分析 | Base64 长度={len(clean_b64)} | "
            f"预估大小={estimated_size / 1024:.0f}KB"
        )

        # ---- 2. 解码 → 缩放 → 压缩 ----
        try:
            processed_b64 = self._preprocess_image(clean_b64)
        except UnidentifiedImageError:
            raise ValueError("无法识别图像格式，请确认上传的是 JPEG/PNG/WEBP 格式")
        except Exception as e:
            raise ValueError(f"图像预处理失败: {e}")

        # ---- 3. 调用 DeepSeek Vision API ----
        analysis_prompt = user_prompt or ANALYSIS_PROMPT

        try:
            raw_result = await self._call_vision_api(processed_b64, analysis_prompt)
            logger.debug(f"API 返回: {raw_result[:200]}...")
        except Exception as e:
            raise RuntimeError(f"DeepSeek Vision API 调用失败: {e}") from e

        # ---- 4. 解析 JSON ----
        try:
            parsed = self._parse_vision_response(raw_result)
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.error(f"JSON 解析失败: {e}\n原始返回: {raw_result[:500]}")
            # 尝试降级返回：用原始文本作为 summary
            return self._fallback_response(raw_result, str(e))

        elapsed = time.perf_counter() - start_time
        logger.info(
            f"视觉分析完成 | 耗时={elapsed:.2f}s | "
            f"场景=\"{parsed.get('scene', '')[:40]}...\" | "
            f"物体={len(parsed.get('objects', []))}个"
        )

        return parsed

    # ============================================================
    # 图像预处理
    # ============================================================

    def _strip_data_uri(self, b64: str) -> str:
        """
        移除 data:image/...;base64, 前缀（如果存在）

        Returns:
            纯 Base64 字符串
        """
        if b64.startswith("data:"):
            # data:image/jpeg;base64,xxxxx
            parts = b64.split(",", 1)
            if len(parts) == 2:
                logger.debug(f"已移除 data URI 前缀: {parts[0][:30]}")
                return parts[1]
        return b64

    def _preprocess_image(self, b64_data: str) -> str:
        """
        图像预处理：解码 → 缩放 → 压缩 JPEG → 重新 Base64 编码。

        流程:
        1. Base64 解码
        2. PIL 加载图像
        3. 缩放到 max_dimension 以内（保持宽高比）
        4. 转为 RGB（确保 JPEG 兼容）
        5. JPEG 压缩编码
        6. Base64 编码返回（不含 data URI 前缀）

        Args:
            b64_data: 纯 Base64 编码的原始图像

        Returns:
            压缩后的纯 Base64 编码 JPEG 图像
        """
        # 解码 Base64
        raw_bytes = base64.b64decode(b64_data)
        original_size = len(raw_bytes)
        logger.debug(f"解码后大小: {original_size} bytes")

        # 加载图像
        image = Image.open(io.BytesIO(raw_bytes))

        # 转为 RGB（处理 RGBA/P/CMYK 等格式）
        if image.mode not in ("RGB", "L"):
            logger.debug(f"转换色彩模式: {image.mode} → RGB")
            image = image.convert("RGB")

        # 缩放（如果超过最大尺寸）
        max_dim = settings.VISION_MAX_DIMENSION
        w, h = image.size
        if w > max_dim or h > max_dim:
            scale = max_dim / max(w, h)
            new_w, new_h = int(w * scale), int(h * scale)
            image = image.resize((new_w, new_h), Image.Resampling.LANCZOS)
            logger.debug(f"缩放: {w}x{h} → {new_w}x{new_h}")

        # 编码为 JPEG
        out_buf = io.BytesIO()
        image.save(
            out_buf,
            format="JPEG",
            quality=settings.VISION_JPEG_QUALITY,
            optimize=True,
        )
        out_buf.seek(0)
        compressed_bytes = out_buf.read()
        compressed_size = len(compressed_bytes)

        # Base64 编码
        encoded = base64.b64encode(compressed_bytes).decode("ascii")

        reduction = (1 - compressed_size / max(original_size, 1)) * 100
        logger.debug(
            f"预处理完成: {original_size} → {compressed_size} bytes "
            f"({reduction:+.0f}%), 尺寸={image.size}"
        )

        return encoded

    # ============================================================
    # DeepSeek Vision API 调用
    # ============================================================

    async def _call_vision_api(
        self, image_b64: str, user_prompt: str
    ) -> str:
        """
        调用 DeepSeek Vision API

        支持两种格式（自动降级）:
        1. OpenAI 兼容的 image_url 数组格式
        2. 内联 data URI 文本格式（DeepSeek 兼容方案）

        Args:
            image_b64:   预处理后的 Base64 编码图像
            user_prompt: 用户分析指令

        Returns:
            API 返回的文本（应是 JSON 字符串）
        """
        image_uri = f"data:image/jpeg;base64,{image_b64}"
        logger.debug(f"调用 DeepSeek Vision | image 长度={len(image_uri)}")

        # 方案 1：OpenAI 兼容的多模态格式
        try:
            response = self.client.chat.completions.create(
                model=settings.DEEPSEEK_MODEL,
                temperature=settings.VISION_TEMPERATURE,
                max_tokens=2048,
                messages=[
                    {"role": "system", "content": VISION_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": image_uri},
                            },
                        ],
                    },
                ],
            )
            content = response.choices[0].message.content
            if content:
                return content
        except Exception as e:
            logger.debug(f"image_url 格式失败，尝试内联格式: {e}")

        # 方案 2：内联 data URI 文本格式（DeepSeek 兼容方案）
        # 将图像 data URI 嵌入到文本内容中作为单独段落
        logger.info("使用内联 data URI 文本格式")
        response = self.client.chat.completions.create(
            model=settings.DEEPSEEK_MODEL,
            temperature=settings.VISION_TEMPERATURE,
            max_tokens=2048,
            messages=[
                {"role": "system", "content": VISION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"{user_prompt}\n\n"
                        f"[图像数据]\n{image_uri}"
                    ),
                },
            ],
        )

        content = response.choices[0].message.content
        if not content:
            raise RuntimeError("DeepSeek API 返回空内容")

        return content

    # ============================================================
    # JSON 解析
    # ============================================================

    def _parse_vision_response(self, raw_text: str) -> dict:
        """
        从 API 返回文本中提取并解析 JSON。

        处理两种情况:
        1. 纯 JSON 字符串
        2. Markdown 代码块包裹的 JSON（```json ... ```）

        Args:
            raw_text: API 返回的原始文本

        Returns:
            解析后的字典
        """
        # 尝试直接解析
        try:
            return json.loads(raw_text)
        except json.JSONDecodeError:
            pass

        # 尝试从 Markdown 代码块中提取
        # 匹配 ```json ... ``` 或 ``` ... ```
        code_patterns = [
            r"```json\s*([\s\S]*?)\s*```",
            r"```\s*([\s\S]*?)\s*```",
        ]
        for pattern in code_patterns:
            match = re.search(pattern, raw_text)
            if match:
                inner = match.group(1).strip()
                try:
                    return json.loads(inner)
                except json.JSONDecodeError:
                    continue

        # 尝试找第一个 { ... } 块
        brace_match = re.search(r"\{[\s\S]*\}", raw_text)
        if brace_match:
            try:
                return json.loads(brace_match.group(0))
            except json.JSONDecodeError:
                pass

        raise json.JSONDecodeError("无法从响应中提取有效 JSON", raw_text, 0)

    def _fallback_response(self, raw_text: str, error: str) -> dict:
        """
        降级响应：当 JSON 解析失败时，返回最小可用结构。

        Args:
            raw_text: API 原始返回
            error:    解析错误描述

        Returns:
            降级后的分析结果
        """
        logger.warning(f"使用降级响应 (原因: {error})")
        return {
            "scene": "",
            "objects": [],
            "people": [],
            "screen_content": "",
            "risk_content": [],
            "summary": raw_text[:500] if raw_text else f"分析解析异常: {error}",
            "_parse_error": error,  # 标记用于调试
        }


# ============================================================
# 全局单例
# ============================================================

vision_analysis_service = VisionAnalysisService()
