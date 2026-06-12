"""
Code Assistant Graph — 编译 StateGraph

流水线: ocr_node → code_parser_node → error_analysis_node → fix_generator_node → END
"""

import logging
from langgraph.graph import StateGraph, END
from app.agent.code_assistant.state import CodeAssistantState
from app.agent.code_assistant.nodes import (
    ocr_node,
    code_parser_node,
    error_analysis_node,
    fix_generator_node,
)
from app.config import settings

logger = logging.getLogger("code_assistant.graph")


def build_code_assistant_graph() -> StateGraph:
    """
    构建 Code Assistant StateGraph。

    图结构（线性流水线）:
        START → ocr_node → code_parser_node → error_analysis_node → fix_generator_node → END
    """
    graph = StateGraph(CodeAssistantState)

    # 注册节点
    graph.add_node("ocr_node", ocr_node)
    graph.add_node("code_parser_node", code_parser_node)
    graph.add_node("error_analysis_node", error_analysis_node)
    graph.add_node("fix_generator_node", fix_generator_node)

    # 入口
    graph.set_entry_point("ocr_node")

    # 线性流水线
    graph.add_edge("ocr_node", "code_parser_node")
    graph.add_edge("code_parser_node", "error_analysis_node")
    graph.add_edge("error_analysis_node", "fix_generator_node")
    graph.add_edge("fix_generator_node", END)

    compiled = graph.compile()

    logger.info("Code Assistant Graph 编译完成")
    logger.info(f"  节点: {list(compiled.nodes.keys())}")
    logger.info(f"  流程: OCR → CodeParser → ErrorAnalysis → FixGenerator")

    return compiled


code_assistant_graph = build_code_assistant_graph()
