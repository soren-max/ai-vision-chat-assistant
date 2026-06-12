"""
Watch Agent — 4 个节点（循环工作流）

task_node     : 创建观察任务
observe_node  : 周期性观察场景
compare_node  : 对比判断是否满足条件
notify_node   : 通知用户 + 结束

循环逻辑:
    compare_node 返回 should_notify=false 时 → 回到 observe_node
    compare_node 返回 should_notify=true  时 → 进入 notify_node → END
"""

import json
import logging
import time
from typing import Dict, Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.config import settings
from app.agent.watch_agent.state import WatchAgentState

# ============================================================
# Logger
# ============================================================

logger = logging.getLogger("watch_agent")
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
# Node 1: task_node — 创建观察任务
# ============================================================

TASK_SYSTEM_PROMPT = """你是一个任务解析器。根据用户的请求，创建一个结构化观察任务。

输出严格 JSON:
{
  "task_id": "watch_001",
  "description": "看着水壶",
  "target_object": "水壶",
  "check_condition": "水沸腾（大量蒸气冒出）",
  "interval_sec": 5,
  "max_observations": 20
}

解析规则:
- task_id: watch_{目标}_{序号}
- check_condition: 具体可观察的视觉条件，如 "水沸腾(蒸气)" / "物体消失" / "人员进入画面"
- interval_sec: 3-10秒（根据任务紧急程度）
- max_observations: 根据任务预估，防止无限循环
"""


def task_node(state: WatchAgentState) -> Dict[str, Any]:
    """
    【任务节点】解析用户请求，创建结构化观察任务。

    输入: user_request
    输出: task, _max_loops
    """
    user_request = state.get("user_request", "")
    scratchpad = state.get("scratchpad", [])

    if not user_request:
        scratchpad.append("[task] 空请求")
        return {"scratchpad": scratchpad}

    logger.info(f"[task_node] 解析请求: {user_request}")
    llm = _llm(0.2)

    try:
        response = llm.invoke([
            SystemMessage(content=TASK_SYSTEM_PROMPT),
            HumanMessage(content=user_request),
        ])
        raw = response.content.strip()
        for prefix in ("```json", "```"):
            if raw.startswith(prefix):
                raw = raw[len(prefix):].strip()
        if raw.endswith("```"):
            raw = raw[:-3].strip()
        task = json.loads(raw)

        logger.info(
            f"[task_node] ✅ 任务创建 | "
            f"目标={task.get('target_object')} | "
            f"条件={task.get('check_condition')} | "
            f"间隔={task.get('interval_sec')}s | "
            f"最多={task.get('max_observations')}次"
        )
        scratchpad.append(
            f"[task] 目标: {task.get('target_object')} | "
            f"条件: {task.get('check_condition')}"
        )
    except Exception as e:
        # 降级：使用默认任务
        task = {
            "task_id": "watch_default",
            "description": user_request,
            "target_object": "目标",
            "check_condition": "发生变化",
            "interval_sec": 5,
            "max_observations": 10,
        }
        logger.warning(f"[task_node] 降级: {e}")
        scratchpad.append(f"[task] 降级: {str(e)[:50]}")

    return {
        "task": task,
        "_max_loops": task.get("max_observations", 10),
        "observation_count": 0,
        "history": [],
        "scratchpad": scratchpad,
    }


# ============================================================
# Node 2: observe_node — 周期性观察
# ============================================================

OBSERVE_SYSTEM_PROMPT = """你是一个场景观察员。分析当前摄像头画面，重点关注目标物体。

输出严格 JSON:
{
  "scene_summary": "厨房场景，灶台上有一个不锈钢水壶，正在加热",
  "target_status": "水壶底部有小气泡，水面轻微波动，尚未沸腾",
  "objects_near_target": ["灶台", "火焰"],
  "confidence": 0.9
}
"""


def observe_node(state: WatchAgentState) -> Dict[str, Any]:
    """
    【观察节点】获取并分析当前场景，聚焦目标物体状态。

    输入: task, observation_count
    输出: current_observation, history, observation_count(+1)
    """
    task = state.get("task", {})
    obs_count = state.get("observation_count", 0)
    history = state.get("history", [])
    scratchpad = state.get("scratchpad", [])

    target = task.get("target_object", "目标")
    condition = task.get("check_condition", "变化")

    # 模拟摄像头帧获取（实际接入 vision_service）
    # vision_context 从 state 获取或模拟
    current_frame = state.get("current_observation", "")
    if not current_frame:
        current_frame = f"当前画面: 正在观察「{target}」，检查是否{condition}"

    logger.info(
        f"[observe_node] 第 {obs_count + 1} 次观察 | "
        f"目标={target} | 条件={condition}"
    )

    llm = _llm(0.4)

    try:
        response = llm.invoke([
            SystemMessage(content=OBSERVE_SYSTEM_PROMPT),
            HumanMessage(content=(
                f"观察目标: {target}\n"
                f"触发条件: {condition}\n"
                f"画面内容: {current_frame}\n"
                f"这是第 {obs_count + 1} 次观察"
            )),
        ])
        raw = response.content.strip()
        for prefix in ("```json", "```"):
            if raw.startswith(prefix):
                raw = raw[len(prefix):].strip()
        if raw.endswith("```"):
            raw = raw[:-3].strip()
        obs_result = json.loads(raw)
    except Exception:
        obs_result = {
            "scene_summary": "观察中",
            "target_status": "正常",
            "confidence": 0.5,
        }

    # 构建观察记录
    record = {
        "count": obs_count + 1,
        "timestamp": time.time(),
        "scene_summary": obs_result.get("scene_summary", ""),
        "target_status": obs_result.get("target_status", ""),
    }

    history.append(record)
    new_count = obs_count + 1

    logger.info(
        f"[observe_node] ✅ #{new_count} | "
        f"状态={obs_result.get('target_status', '?')[:40]}"
    )
    scratchpad.append(f"[observe #{new_count}] {obs_result.get('target_status', '?')[:50]}")

    return {
        "current_observation": obs_result.get("target_status", ""),
        "history": history,
        "observation_count": new_count,
        "_loop_count": new_count,
        "scratchpad": scratchpad,
    }


# ============================================================
# Node 3: compare_node — 对比与决策
# ============================================================

COMPARE_SYSTEM_PROMPT = """你是一个条件判断器。根据观察历史和触发条件，判断是否满足通知条件。

判断规则:
1. 目标状态匹配 check_condition → should_notify=true, change_type="condition_met"
2. 目标消失/离开画面 → should_notify=true, change_type="target_disappeared"
3. 无明显变化 → should_notify=false, change_type="no_change"
4. 已达到最大观察次数但未触发 → should_notify=true, change_type="timeout"

输出严格 JSON:
{
  "has_changed": true,
  "change_type": "condition_met",
  "detail": "水壶冒出大量蒸气，水已沸腾",
  "confidence": 0.95,
  "should_continue": false,
  "reason": "触发条件满足"
}
"""


def compare_node(state: WatchAgentState) -> Dict[str, Any]:
    """
    【对比节点】判断当前状态是否满足触发条件。

    决策:
    - should_notify=true → 进入 notify_node
    - should_notify=false → 循环回到 observe_node

    输入: task, history, observation_count, _loop_count, _max_loops
    输出: comparison, should_notify
    """
    task = state.get("task", {})
    history = state.get("history", [])
    obs_count = state.get("observation_count", 0)
    # _max_loops 是上层硬限制，从 task 中取 max_observations 兜底
    hard_limit = state.get("_max_loops") or task.get("max_observations", 10)
    scratchpad = state.get("scratchpad", [])

    target = task.get("target_object", "目标")
    condition = task.get("check_condition", "变化")

    # 安全检查：达到硬限制 → 强制结束（不依赖 LLM）
    if obs_count >= hard_limit:
        logger.info(f"[compare_node] ⚠️ 达到硬限制 ({obs_count}/{hard_limit})，强制停止")
        return {
            "comparison": {
                "has_changed": False,
                "change_type": "timeout",
                "detail": f"已观察 {obs_count} 次未触发，超过硬限制",
                "confidence": 1.0,
            },
            "should_notify": True,
            "notification_message": (
                f"⏰ 观察超时 — 已监控「{target}」共 {obs_count} 次，"
                f"未检测到「{condition}」的触发条件。请检查画面或调整设置。"
            ),
            "scratchpad": scratchpad,
        }

    # 构建上下文
    history_text = "\n".join(
        f"#{h['count']}: {h.get('target_status', '?')}"
        for h in history[-5:]  # 最近 5 次
    )

    logger.info(
        f"[compare_node] 判断 #{obs_count} | "
        f"目标={target} | 条件={condition}"
    )

    llm = _llm(0.3)

    try:
        response = llm.invoke([
            SystemMessage(content=COMPARE_SYSTEM_PROMPT),
            HumanMessage(content=(
                f"观察目标: {target}\n"
                f"触发条件: {condition}\n"
                f"最近观察记录:\n{history_text}\n"
                f"已观察 {obs_count} 次，最多 {max_loops} 次\n"
                f"请判断是否满足通知条件。"
            )),
        ])
        raw = response.content.strip()
        for prefix in ("```json", "```"):
            if raw.startswith(prefix):
                raw = raw[len(prefix):].strip()
        if raw.endswith("```"):
            raw = raw[:-3].strip()
        result = json.loads(raw)
    except Exception:
        # 用 _max_loops（如果设置了的话）作为硬上限
        config_limit = state.get("_max_loops", 0)
        effective_limit = min(config_limit, hard_limit) if config_limit else hard_limit

        result = {
            "has_changed": False,
            "change_type": "no_change",
            "detail": "判断中",
            "confidence": 0.5,
            "should_continue": obs_count < effective_limit,
        }

    should_notify = result.get("has_changed", False) or not result.get("should_continue", True)
    change_type = result.get("change_type", "no_change")

    logger.info(
        f"[compare_node] 结果: {change_type} | "
        f"confidence={result.get('confidence', 0)} | "
        f"notify={should_notify} | "
        f"{'→ notify_node' if should_notify else '→ loop back'}"
    )

    scratchpad.append(
        f"[compare] {change_type} | notify={should_notify}"
    )

    comparison = {
        "has_changed": result.get("has_changed", False),
        "change_type": change_type,
        "detail": result.get("detail", ""),
        "confidence": result.get("confidence", 0),
    }

    # 需要通知时 → 生成通知消息
    notification = ""
    if should_notify:
        if change_type == "condition_met":
            notification = (
                f"🔔 观察通知 — 「{target}」已满足条件「{condition}」!\n"
                f"{result.get('detail', '')}\n"
                f"共观察 {obs_count} 次后触发。"
            )
        elif change_type == "target_disappeared":
            notification = (
                f"⚠️ 观察通知 — 「{target}」已离开画面!\n"
                f"请确认目标状态。"
            )
        elif change_type == "timeout":
            notification = (
                f"⏰ 观察超时 — 「{target}」共观察 {obs_count} 次，"
                f"未检测到「{condition}」。"
            )

    return {
        "comparison": comparison,
        "should_notify": should_notify,
        "notification_message": notification,
        "scratchpad": scratchpad,
    }


# ============================================================
# Node 4: notify_node — 通知用户
# ============================================================

def notify_node(state: WatchAgentState) -> Dict[str, Any]:
    """
    【通知节点】生成用户通知消息并结束工作流。

    输入: notification_message, task, history, observation_count
    输出: final_response
    """
    task = state.get("task", {})
    history = state.get("history", [])
    obs_count = state.get("observation_count", 0)
    notification = state.get("notification_message", "")
    scratchpad = state.get("scratchpad", [])

    # 构建最终报告
    lines = [
        "## 📡 Watch Agent 观察报告\n",
        f"**任务**: {task.get('description', '未知')}",
        f"**目标**: {task.get('target_object', '未知')}",
        f"**条件**: {task.get('check_condition', '未知')}",
        f"**观察次数**: {obs_count}",
        f"**结果**: {notification}\n",
        "### 📋 观察记录\n",
    ]

    for h in history[-10:]:
        lines.append(f"- #{h['count']}: {h.get('target_status', '?')[:60]}")

    final = "\n".join(lines)

    logger.info(f"[notify_node] ✅ 通知已生成 | 共 {obs_count} 次观察")
    scratchpad.append(f"[notify] 报告完成")

    return {
        "notification_message": notification,
        "final_response": final,
        "scratchpad": scratchpad,
    }


# ============================================================
# 条件路由 — 决定继续循环还是退出
# ============================================================

def route_after_compare(state: WatchAgentState) -> str:
    """
    compare_node 后的条件路由。

    - should_notify=true  → notify_node → END
    - should_notify=false → observe_node (循环)
    """
    should = state.get("should_notify", False)
    count = state.get("observation_count", 0)

    if should:
        logger.info(f"[route] → notify_node (条件满足)")
        return "notify_node"
    else:
        logger.info(f"[route] → observe_node (#{count + 1} 继续观察)")
        return "observe_node"
