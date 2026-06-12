"""
Watch Agent 路由

POST /api/watch/start — 启动观察任务
GET  /api/watch/status — 查询观察状态
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from app.agent.watch_agent.graph import watch_agent_graph
from app.agent.watch_agent.state import WatchAgentState

logger = logging.getLogger("watch_router")
router = APIRouter(prefix="/api/watch", tags=["主动观察"])


class WatchStartRequest(BaseModel):
    user_request: str = Field(..., description="观察请求，如'帮我看着水壶'")
    session_id: str = Field("default", description="会话 ID")


class WatchStatusResponse(BaseModel):
    task: dict
    observation_count: int
    should_notify: bool
    notification_message: str
    final_response: str


@router.post("/start", response_model=WatchStatusResponse, summary="启动观察任务")
async def start_watch(request: WatchStartRequest):
    """
    启动一次主动观察任务。

    工作流（循环）:
    1. task_node    — 解析用户请求，创建观察任务
    2. observe_node — 观察场景，记录状态
    3. compare_node — 对比判断是否满足条件
       - 未满足 → 循环回到 observe_node
       - 已满足 → 进入 notify_node
    4. notify_node  — 通知用户，结束

    示例:
    ```json
    {"user_request": "帮我看着水壶，水开了告诉我"}
    ```
    """
    state: WatchAgentState = {
        "task": {},
        "user_request": request.user_request,
        "current_observation": "",
        "history": [],
        "observation_count": 0,
        "comparison": {},
        "should_notify": False,
        "notification_message": "",
        "final_response": "",
        "_loop_count": 0,
        "_max_loops": 10,
        "session_id": request.session_id,
        "scratchpad": [],
    }

    try:
        result = await watch_agent_graph.ainvoke(state)
    except Exception as e:
        logger.error(f"Watch Agent 失败: {e}")
        raise HTTPException(status_code=500, detail=f"观察任务失败: {str(e)}")

    return WatchStatusResponse(
        task=result.get("task", {}),
        observation_count=result.get("observation_count", 0),
        should_notify=result.get("should_notify", False),
        notification_message=result.get("notification_message", ""),
        final_response=result.get("final_response", ""),
    )


@router.get("/status", summary="查询观察器配置")
async def watch_status():
    """返回 Watch Agent 的图结构和配置信息"""
    return {
        "graph_nodes": ["task_node", "observe_node", "compare_node", "notify_node"],
        "flow": "task → observe → compare ⇄ observe → notify → END",
        "cycle_type": "conditional loop (compare → observe)",
        "config": {
            "default_max_loops": 10,
        },
    }
