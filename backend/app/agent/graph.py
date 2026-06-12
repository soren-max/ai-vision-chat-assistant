"""
LangGraph StateGraph 构建

编译完整的 Vision Agent 状态图。
定义节点之间的连接关系和条件路由。
"""

from langgraph.graph import StateGraph, END
from app.agent.state import AgentState
from app.agent.nodes import (
    vision_node,
    memory_node,
    planner_node,
    tool_node,
    reasoning_node,
    response_node,
    route_planner,
)
from app.config import settings


def build_vision_agent_graph() -> StateGraph:
    """
    构建并编译 Vision Agent 的 StateGraph。

    图结构:
        START → planner_node ──┬──→ vision_node → memory_node ──┐
                               ├──→ tool_node ──────────────────┤
                               └──→ reasoning_node ←────────────┘
                                               ↓
                                        response_node → END

    Returns:
        编译后的 StateGraph 应用对象（可调用）
    """
    # 初始化状态图，指定状态类型
    graph = StateGraph(AgentState)

    # ========== 注册节点 ==========
    graph.add_node("planner_node", planner_node)
    graph.add_node("vision_node", vision_node)
    graph.add_node("memory_node", memory_node)
    graph.add_node("tool_node", tool_node)
    graph.add_node("reasoning_node", reasoning_node)
    graph.add_node("response_node", response_node)

    # ========== 设置入口 ==========
    graph.set_entry_point("planner_node")

    # ========== 添加边 ==========

    # 条件边: planner_node 根据输入决定下一步
    graph.add_conditional_edges(
        "planner_node",
        route_planner,
        {
            "vision": "vision_node",
            "tool": "tool_node",
            "direct_reason": "reasoning_node",
        },
    )

    # 固定边: 视觉分析完成后更新记忆
    graph.add_edge("vision_node", "memory_node")

    # 固定边: 记忆更新后进入推理
    graph.add_edge("memory_node", "reasoning_node")

    # 固定边: 工具执行完成后进入推理
    graph.add_edge("tool_node", "reasoning_node")

    # 固定边: 推理完成后生成最终响应
    graph.add_edge("reasoning_node", "response_node")

    # 终点边: 响应生成后结束
    graph.add_edge("response_node", END)

    # ========== 编译图 ==========
    compiled = graph.compile()

    print("[graph] Vision Agent StateGraph 编译完成")
    print(f"[graph] 节点: {list(compiled.nodes.keys())}")
    print(f"[graph] 入口点: planner_node")

    return compiled


# ============================================================
# 全局单例：编译后的 Graph
# ============================================================
vision_agent = build_vision_agent_graph()
