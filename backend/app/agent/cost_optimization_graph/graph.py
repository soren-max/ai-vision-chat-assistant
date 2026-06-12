"""
Cost Optimization Graph — 视觉调用优化

图结构:
    START → capture_frame → change_detection → should_analyze
                                                    ↓
                                              need_vision?
                                             /            \
                                          YES              NO
                                           ↓                ↓
                                   vision_analysis        END
                                           ↓
                                          END
"""

import logging
from langgraph.graph import StateGraph, END
from app.agent.cost_optimization_graph.state import CostOptimizationState
from app.agent.cost_optimization_graph.nodes import (
    capture_frame_node,
    change_detection_node,
    should_analyze_node,
    vision_analysis_node,
    route_after_decide,
)
from app.config import settings

logger = logging.getLogger("cost_opt_graph")


def build_cost_optimization_graph() -> StateGraph:
    """构建成本优化 StateGraph"""
    graph = StateGraph(CostOptimizationState)

    graph.add_node("capture_frame", capture_frame_node)
    graph.add_node("change_detection", change_detection_node)
    graph.add_node("should_analyze", should_analyze_node)
    graph.add_node("vision_analysis", vision_analysis_node)

    graph.set_entry_point("capture_frame")

    graph.add_edge("capture_frame", "change_detection")
    graph.add_edge("change_detection", "should_analyze")

    graph.add_conditional_edges(
        "should_analyze",
        route_after_decide,
        {"vision_analysis": "vision_analysis", "end": END},
    )

    graph.add_edge("vision_analysis", END)

    compiled = graph.compile()

    logger.info("Cost Optimization Graph 编译完成")
    logger.info(f"  节点: {list(compiled.nodes.keys())}")
    logger.info(f"  流程: capture → detect → decide → vision? → END")
    logger.info(f"  阈值: similarity > 0.95 → 跳过")

    return compiled


cost_optimization_graph = build_cost_optimization_graph()
