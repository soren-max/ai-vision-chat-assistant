"""
Cost Optimization Graph — 节点实现

4 节点:
  1. capture_frame_node   — 接收帧，计算感知哈希
  2. change_detection_node — 与上一帧对比，计算相似度
  3. should_analyze_node   — 相似度 > 0.95 → 跳过
  4. vision_analysis_node  — 执行 Vision API 调用
"""

import hashlib
import json
import logging
import time
from typing import Dict, Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.config import settings
from app.agent.cost_optimization_graph.state import CostOptimizationState

# ============================================================
# Logger
# ============================================================

logger = logging.getLogger("cost_opt_graph")
logger.setLevel(settings.LOG_LEVEL)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(
        logging.Formatter("[%(asctime)s] [%(name)s] %(levelname)s - %(message)s")
    )
    logger.addHandler(h)


def _llm(temp: float = 0.3) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.DEEPSEEK_MODEL,
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
        temperature=temp,
    )


# ============================================================
# 1. capture_frame_node — 帧捕获与哈希
# ============================================================

SIMILARITY_THRESHOLD = 0.95        # 相似度阈值
TOKENS_PER_VISION_CALL = 800       # 每次 Vision 调用的 token 估算
COST_PER_VISION_CALL = 0.002       # 每次 Vision 调用成本（美元）


def _compute_phash(b64: str) -> str:
    """计算感知哈希"""
    if not b64:
        return ""
    text = b64.strip()
    # 采样：首 + 中 + 尾
    sample = text[:80] + text[len(text)//2-40:len(text)//2+40] + text[-80:]
    return hashlib.md5(sample.encode()).hexdigest()


def capture_frame_node(state: CostOptimizationState) -> Dict[str, Any]:
    """
    【帧捕获节点】接收帧，生成感知哈希。

    输入: current_frame_b64
    输出: previous_phash (从当前帧计算，供下一轮使用)
    """
    frame_b64 = state.get("current_frame_b64", "")
    scratchpad = state.get("scratchpad", [])
    stats = state.get("stats", {
        "total_frames": 0, "analyzed_count": 0,
        "skipped_count": 0, "saved_tokens": 0,
        "saved_cost": 0.0, "skip_rate": 0.0,
    })

    phash = _compute_phash(frame_b64)
    stats["total_frames"] += 1

    logger.info(f"[capture] 帧捕获 | phash={phash[:12]}... | 总帧数={stats['total_frames']}")

    scratchpad.append(f"[capture] phash={phash[:12]}...")

    return {
        "current_phash": phash,
        "stats": stats,
        "scratchpad": scratchpad,
    }


# ============================================================
# 2. change_detection_node — 变化检测
# ============================================================

def _hamming_similarity(h1: str, h2: str) -> float:
    """汉明距离相似度"""
    if not h1 or not h2 or len(h1) != len(h2):
        return 0.0
    diff = sum(
        bin(int(a, 16) ^ int(b, 16)).count('1')
        for a, b in zip(h1, h2)
    )
    return 1.0 - (diff / (len(h1) * 4))


def change_detection_node(state: CostOptimizationState) -> Dict[str, Any]:
    """
    【变化检测节点】对比当前帧与上一帧的相似度。

    输入: current_frame_b64, previous_phash
    输出: similarity
    """
    prev_phash = state.get("previous_phash", "")
    current_phash = state.get("current_phash", "")
    scratchpad = state.get("scratchpad", [])

    similarity = _hamming_similarity(prev_phash, current_phash) if prev_phash else 0.0

    logger.info(
        f"[detect] 相似度={similarity:.4f} | "
        f"{'高相似' if similarity > SIMILARITY_THRESHOLD else '有变化'}"
    )

    scratchpad.append(f"[detect] similarity={similarity:.4f}")

    return {
        "similarity": similarity,
        "scratchpad": scratchpad,
    }


# ============================================================
# 3. should_analyze_node — 决策
# ============================================================

def should_analyze_node(state: CostOptimizationState) -> Dict[str, Any]:
    """
    【决策节点】根据相似度决定是否调用 Vision API。

    规则: similarity > 0.95 → 跳过 (need_vision=false)
          similarity ≤ 0.95 → 分析 (need_vision=true)

    输入: similarity, stats
    输出: need_vision, stats (更新跳过计数)
    """
    similarity = state.get("similarity", 0.0)
    stats = state.get("stats", {
        "total_frames": 0, "analyzed_count": 0,
        "skipped_count": 0, "saved_tokens": 0,
        "saved_cost": 0.0, "skip_rate": 0.0,
    })
    scratchpad = state.get("scratchpad", [])

    need = similarity <= SIMILARITY_THRESHOLD

    if need:
        stats["analyzed_count"] += 1
        logger.info(f"[decide] ✅ 需要分析 (similarity={similarity:.4f} ≤ {SIMILARITY_THRESHOLD})")
        scratchpad.append(f"[decide] analyze: similarity={similarity:.4f}")
    else:
        stats["skipped_count"] += 1
        stats["saved_tokens"] += TOKENS_PER_VISION_CALL
        stats["saved_cost"] += COST_PER_VISION_CALL
        total = max(stats["total_frames"], 1)
        stats["skip_rate"] = stats["skipped_count"] / total

        logger.info(
            f"[decide] ⏭️ 跳过 (similarity={similarity:.4f} > {SIMILARITY_THRESHOLD}) | "
            f"节省={stats['saved_tokens']}tokens ${stats['saved_cost']:.4f}"
        )
        scratchpad.append(
            f"[decide] skip: saved {TOKENS_PER_VISION_CALL}tokens ${COST_PER_VISION_CALL:.4f}"
        )

    return {
        "need_vision": need,
        "stats": stats,
        "scratchpad": scratchpad,
    }


# ============================================================
# 4. vision_analysis_node — 视觉分析（仅在需要时执行）
# ============================================================

VISION_PROMPT = """分析这张图像，返回场景描述 JSON:
{"scene":"...","objects":["obj1","obj2"],"summary":"..."}
"""


def vision_analysis_node(state: CostOptimizationState) -> Dict[str, Any]:
    """
    【视觉分析节点】调用 DeepSeek Vision API 分析帧。

    仅在 need_vision=true 时执行。

    输入: current_frame_b64
    输出: vision_result
    """
    frame_b64 = state.get("current_frame_b64", "")
    scratchpad = state.get("scratchpad", [])

    if not frame_b64:
        scratchpad.append("[vision] 空帧，跳过")
        return {"vision_result": "空帧", "scratchpad": scratchpad}

    logger.info(f"[vision] 执行分析 | 帧大小={len(frame_b64)}")

    llm = _llm(0.3)

    try:
        response = llm.invoke([
            SystemMessage(content=VISION_PROMPT),
            HumanMessage(content=f"图像 (base64): {frame_b64[:200]}..."),
        ])
        result = response.content
        logger.info(f"[vision] ✅ 完成 | 结果={result[:80]}...")
        scratchpad.append(f"[vision] 完成: {result[:60]}...")
    except Exception as e:
        result = f"分析失败: {e}"
        logger.error(f"[vision] ❌ {e}")
        scratchpad.append(f"[vision] 错误: {str(e)[:60]}")

    return {
        "vision_result": result,
        "scratchpad": scratchpad,
    }


# ============================================================
# 条件路由
# ============================================================

def route_after_decide(state: CostOptimizationState) -> str:
    """决策后路由"""
    if state.get("need_vision", False):
        return "vision_analysis"
    return "end"
