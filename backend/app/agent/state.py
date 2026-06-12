"""
Agent 状态定义

使用 TypedDict 定义 StateGraph 中流转的 Agent 状态。
"""

from typing import TypedDict, List


class AgentState(TypedDict):
    """
    Vision Agent 的状态类型。

    属性说明:
        user_input:     用户输入的文本（语音转写结果或文字输入）
        vision_context: 当前摄像头画面的场景描述文本
        scene_memory:   历史场景描述列表，用于维持视觉上下文连续性
        tool_result:    工具调用的结果（如搜索、计算等）
        final_response: Agent 生成的最终回复文本
        session_id:     会话唯一标识
        agent_scratchpad: Agent 内部推理过程的临时记录
    """

    user_input: str
    vision_context: str
    scene_memory: List[str]
    tool_result: str
    final_response: str
    session_id: str
    agent_scratchpad: List[str]
