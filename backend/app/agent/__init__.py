"""
LangGraph Vision Agent 包

基于 LangGraph 构建的视觉对话 Agent，包含：
- AgentState:    状态定义
- vision_node:   视觉场景理解
- memory_node:   场景记忆管理
- planner_node:  行为规划
- tool_node:     工具执行
- reasoning_node: 推理与决策
- response_node: 最终响应生成

流程图:
    START → planner_node ──┬──→ vision_node → memory_node ──┐
                           ├──→ tool_node ──────────────────┤
                           └──→ reasoning_node ←────────────┘
                                           ↓
                                    response_node → END
"""
