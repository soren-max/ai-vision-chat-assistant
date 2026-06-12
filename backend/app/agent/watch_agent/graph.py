"""
Watch Agent Graph — 循环 StateGraph

图结构（循环）:
    START → task_node → observe_node → compare_node
                                           ↓
                                      should_notify?
                                     /              \
                                   NO                YES
                                    ↓                  ↓
                            observe_node ←┐     notify_node → END

关键: compare_node → observe_node 形成循环
"""

import logging
from langgraph.graph import StateGraph, END
from app.agent.watch_agent.state import WatchAgentState
from app.agent.watch_agent.nodes import (
    task_node,
    observe_node,
    compare_node,
    notify_node,
    route_after_compare,
)
from app.config import settings

logger = logging.getLogger("watch_agent.graph")


def build_watch_agent_graph() -> StateGraph:
    """
    构建 Watch Agent 的循环 StateGraph。
    """
    graph = StateGraph(WatchAgentState)

    # ========== 注册节点 ==========
    graph.add_node("task_node", task_node)
    graph.add_node("observe_node", observe_node)
    graph.add_node("compare_node", compare_node)
    graph.add_node("notify_node", notify_node)

    # ========== 入口 ==========
    graph.set_entry_point("task_node")

    # ========== 边 ==========

    # 固定边
    graph.add_edge("task_node", "observe_node")
    graph.add_edge("observe_node", "compare_node")

    # 条件边（循环关键）: compare_node → notify_node / observe_node
    graph.add_conditional_edges(
        "compare_node",
        route_after_compare,
        {
            "notify_node": "notify_node",
            "observe_node": "observe_node",   # ← 循环回到观察
        },
    )

    # 终点
    graph.add_edge("notify_node", END)

    compiled = graph.compile()

    logger.info("Watch Agent Graph 编译完成")
    logger.info(f"  节点: {list(compiled.nodes.keys())}")
    logger.info(f"  流程: task → observe → compare ⇄ observe → notify → END")

    return compiled


watch_agent_graph = build_watch_agent_graph()
