"""
Watch Agent — 主动观察智能体

循环工作流:
    task_node → observe_node → compare_node ──┬→ notify_node → END
                                      ↑        │
                                      └─ NO ───┘ (继续观察)

用途: "帮我看着水壶" / "监控门口是否有人" / "盯着屏幕上的进度条"
"""

from typing import TypedDict, List


class WatchTask(TypedDict):
    """观察任务定义"""
    task_id: str               # 任务唯一 ID
    description: str           # 任务描述: "看着水壶"
    target_object: str         # 目标物体: "水壶"
    check_condition: str       # 触发条件: "水沸腾" / "物体移动" / "进度完成"
    interval_sec: int          # 观察间隔（秒）
    max_observations: int      # 最大观察次数（防止无限循环）


class ObservationRecord(TypedDict):
    """单次观察记录"""
    count: int                 # 第几次观察
    timestamp: float           # 观察时间
    scene_summary: str         # 场景描述
    target_status: str         # 目标物体状态


class ComparisonResult(TypedDict):
    """对比结果"""
    has_changed: bool          # 目标是否发生变化
    change_type: str           # 变化类型: condition_met / no_change / target_disappeared
    detail: str                # 详细描述
    confidence: float          # 置信度 0-1


class WatchAgentState(TypedDict):
    """
    Watch Agent 状态 — 驱动循环观察工作流
    """
    # 任务
    task: dict                 # WatchTask
    user_request: str          # 用户原始请求 "帮我看着水壶"

    # 观察
    current_observation: str   # 当期观察到的场景文本
    history: List[dict]        # ObservationRecord 列表
    observation_count: int     # 已观察次数

    # 判断
    comparison: dict           # ComparisonResult
    should_notify: bool        # 是否触发通知

    # 输出
    notification_message: str  # 通知消息

    # 循环控制
    _loop_count: int           # 循环计数器（防止无限循环）
    _max_loops: int            # 最大循环次数

    # 内部
    session_id: str
    scratchpad: List[str]
