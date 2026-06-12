"""
成本优化路由

提供优化统计查询和控制接口。
"""

from fastapi import APIRouter
from app.services.cost_optimizer import cost_optimizer

router = APIRouter(prefix="/api/optimize", tags=["成本优化"])


@router.get("/report", summary="获取优化效果报告")
async def get_savings_report():
    """
    获取成本优化节省效果报告。

    包含视觉分析、对话、音频、Token 各维度的节省统计。
    """
    return cost_optimizer.get_savings_report()


@router.post("/reset", summary="重置优化统计")
async def reset_stats():
    """重置所有优化统计数据"""
    cost_optimizer.reset_stats()
    return {"status": "ok", "message": "统计数据已重置"}


@router.get("/config", summary="获取优化配置")
async def get_config():
    """获取当前成本优化配置参数"""
    from app.config import settings
    return {
        "enabled": settings.OPT_COST_SAVING_MODE,
        "vision_min_interval_sec": settings.OPT_VISION_MIN_INTERVAL_SEC,
        "vision_change_threshold": settings.OPT_VISION_CHANGE_THRESHOLD,
        "cache_ttl_sec": settings.OPT_CACHE_TTL_SEC,
        "token_budget": settings.OPT_TOKEN_BUDGET,
        "max_history_rounds": settings.OPT_MAX_HISTORY_ROUNDS,
        "summary_history": settings.OPT_SUMMARY_HISTORY,
        "skip_empty_audio": settings.OPT_SKIP_EMPTY_AUDIO,
        "min_audio_duration_sec": settings.OPT_MIN_AUDIO_DURATION_SEC,
    }
