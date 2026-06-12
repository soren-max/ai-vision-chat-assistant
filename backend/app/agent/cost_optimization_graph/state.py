"""
Cost Optimization Graph — 视觉调用优化流水线

StateGraph:
    capture_frame → change_detection → should_analyze?
                                       ├─ YES → vision_analysis → END
                                       └─ NO  → END (skipped, increment stats)
"""

from typing import TypedDict, List


class FrameRecord(TypedDict):
    """单帧记录"""
    frame_id: int
    phash: str          # 感知哈希
    timestamp: float


class OptimizationStats(TypedDict):
    """优化统计"""
    total_frames: int           # 总帧数
    analyzed_count: int         # 实际分析次数
    skipped_count: int          # 跳过次数
    saved_tokens: int           # 节省 Token 数
    saved_cost: float           # 节省成本（美元）
    skip_rate: float            # 跳过率 (0-1)


class CostOptimizationState(TypedDict):
    """
    成本优化状态 — 驱动帧拦截与跳过决策
    """
    # 输入
    current_frame_b64: str      # 当前帧 Base64
    previous_phash: str         # 上一帧感知哈希（由上一轮保存）

    # 中间
    current_phash: str          # 当前帧感知哈希
    similarity: float           # 相似度 0-1
    need_vision: bool           # 是否需要视觉分析
    vision_result: str          # 视觉分析结果（如有）

    # 统计
    stats: OptimizationStats    # 累计统计

    # 内部
    scratchpad: List[str]
