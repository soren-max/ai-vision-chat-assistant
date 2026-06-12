"""
LangGraph 节点定义

实现 Vision Agent 的 6 个核心节点函数，每个节点是一个可调用的函数，
接收 AgentState 字典，返回更新后的状态字段。
"""

import json
from datetime import datetime
from typing import Dict, Any
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from app.config import settings
from app.agent.state import AgentState
from app.services.scene_memory_store import scene_memory_store


# ============================================================
# 1. vision_node — 视觉场景理解
# ============================================================

def vision_node(state: AgentState) -> Dict[str, Any]:
    """
    【视觉节点】分析摄像头画面，生成场景描述。

    接收用户输入的视觉相关请求和当前画面数据，
    使用 DeepSeek-V4-Pro 的多模态能力理解场景并生成结构化描述。

    输入依赖: state["user_input"]
    输出字段: vision_context
    """
    # 初始化 DeepSeek 多模态模型
    llm = ChatOpenAI(
        model=settings.DEEPSEEK_MODEL,
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
        temperature=0.3,
    )

    user_request = state.get("user_input", "请描述当前场景")

    # 构建视觉分析 Prompt
    messages = [
        SystemMessage(content=(
            "你是一个视觉分析专家。根据用户的请求分析当前场景。\n"
            "请输出结构化的场景描述，包括：\n"
            "1. 场景整体概览（环境、光线、氛围）\n"
            "2. 检测到的物体列表\n"
            "3. 人物（如有）的动作和表情\n"
            "4. 空间关系和布局\n"
            "5. 与用户问题的关联分析\n\n"
            "注意：如果当前没有摄像头画面，请说明无法获取视觉信息。"
        )),
        HumanMessage(content=f"用户请求: {user_request}\n\n"
                             f"当前视觉数据: [待接入摄像头帧]"),
    ]

    try:
        response = llm.invoke(messages)
        vision_context = response.content
        print(f"[vision_node] 场景分析完成: {vision_context[:100]}...")
    except Exception as e:
        print(f"[vision_node] 分析失败: {e}")
        vision_context = f"视觉分析暂不可用: {str(e)}"

    return {"vision_context": vision_context}


# ============================================================
# 2. memory_node — 场景长期记忆管理（亮点功能）
# ============================================================

def memory_node(state: AgentState) -> Dict[str, Any]:
    """
    【记忆节点】视觉场景长期记忆管理。

    核心职责:
    1. 读取当前视觉分析结果 → 解析并存储到 SceneMemoryStore
    2. 读取历史场景 → 构建结构化 SceneContext
    3. 压缩历史内容 → 聚合重要对象，提取场景趋势
    4. 构造 Scene Context → 供 reasoning_node / response_node 使用

    存储结构:
    {
      "objects": ["laptop", "cup", "book"],
      "summary": "桌面办公场景",
      "scene_type": "office",
      "people_count": 1
    }

    输入依赖: state["vision_context"], state["session_id"]
    输出字段: scene_memory (结构化上下文), agent_scratchpad
    """
    session_id = state.get("session_id", "default")
    current_vision = state.get("vision_context", "")
    scratchpad = state.get("agent_scratchpad", [])

    # ---- 1. 解析并保存当前场景 ----
    if current_vision and "暂不可用" not in current_vision and "未检测到" not in current_vision:
        record = scene_memory_store.save(session_id, current_vision)

        scratchpad.append(
            f"[memory] 存储场景 | 类型={record.scene_type} | "
            f"物体={len(record.key_objects)}个 | "
            f"人物={record.people_count} | "
            f"变化={record.change_from_prev or '无'}"
        )

        print(
            f"[memory_node] ✅ 场景保存 | 类型: {record.scene_type} | "
            f"物体: {record.key_objects} | "
            f"当前共 {scene_memory_store.length(session_id)} 条记录"
        )

    # ---- 2. 构造 Scene Context ----
    ctx = scene_memory_store.build_scene_context(session_id)

    # ---- 3. 获取重要物体统计 ----
    object_counts = scene_memory_store.get_object_counts(session_id)
    top_objects = list(object_counts.keys())[:5] if object_counts else []

    # ---- 4. 构建结构化的 scene_memory ----
    scene_memory_entry = {
        "current": ctx.current_scene,
        "recent_history": ctx.recent_history,
        "important_objects": top_objects,
        "all_objects": ctx.all_objects[:10],
        "scene_trend": ctx.scene_type_trend,
        "has_changed": ctx.has_changed,
        "object_frequencies": dict(list(object_counts.items())[:8]),
        "total_scenes": scene_memory_store.length(session_id),
        "compressed_context": ctx.compressed_context,
    }

    scratchpad.append(
        f"[memory] SceneContext 构建完成 | "
        f"重要物体={top_objects} | "
        f"趋势={ctx.scene_type_trend}"
    )

    print(
        f"[memory_node] 📦 记忆总结 | "
        f"总场景={scene_memory_store.length(session_id)} | "
        f"重要物体: {top_objects} | "
        f"趋势: {ctx.scene_type_trend}"
    )

    return {
        "scene_memory": [json.dumps(scene_memory_entry, ensure_ascii=False)],
        "agent_scratchpad": scratchpad,
    }


# ============================================================
# 3. planner_node — 行为规划
# ============================================================

def planner_node(state: AgentState) -> Dict[str, Any]:
    """
    【规划节点】分析用户输入，决定下一步执行路径。

    根据用户输入的特征，判断需要:
    - "vision" → 进入视觉节点分析画面
    - "tool"   → 调用外部工具
    - "direct_reason" → 直接进入推理节点

    输入依赖: state["user_input"]
    输出字段: agent_scratchpad（记录规划决策）
    """
    user_input = state.get("user_input", "").strip().lower()
    scratchpad = state.get("agent_scratchpad", [])

    # 关键词规则判断路由方向
    vision_keywords = [
        "看", "看到", "看见", "画面", "摄像头", "场景", "这是什么",
        "what", "see", "look", "camera", "scene", "vision",
        "describe", "识别", "检测",
    ]
    tool_keywords = [
        "搜索", "查找", "查询", "计算", "翻译",
        "search", "find", "look up", "calculate", "translate",
    ]

    # 判断路由方向
    has_vision_request = any(kw in user_input for kw in vision_keywords)
    has_tool_request = any(kw in user_input for kw in tool_keywords)

    # 记录规划决策
    if has_vision_request:
        decision = "vision"
        reason = "用户请求涉及视觉分析"
    elif has_tool_request:
        decision = "tool"
        reason = "用户请求需要调用工具"
    else:
        decision = "direct_reason"
        reason = "普通对话，直接进入推理"

    plan_record = f"[planner] 决策: {decision} | 原因: {reason} | 输入: {user_input[:50]}"
    scratchpad.append(plan_record)
    print(plan_record)

    return {
        "agent_scratchpad": scratchpad,
        "_next_step": decision,  # 内部路由标记，供条件边使用
    }


# ============================================================
# 4. tool_node — 工具执行
# ============================================================

def tool_node(state: AgentState) -> Dict[str, Any]:
    """
    【工具节点】执行 Agent 工具调用。

    根据用户输入选择合适的工具并执行，
    将结果写入 tool_result 字段供后续节点使用。

    输入依赖: state["user_input"]
    输出字段: tool_result
    """
    user_input = state.get("user_input", "")
    scratchpad = state.get("agent_scratchpad", [])

    # 使用 DeepSeek 判断调用哪个工具并生成参数
    llm = ChatOpenAI(
        model=settings.DEEPSEEK_MODEL,
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
        temperature=0.1,
    )

    messages = [
        SystemMessage(content=(
            "你是一个工具调度器。根据用户输入，决定调用哪个工具。\n"
            "可用工具:\n"
            "1. search_knowledge - 搜索知识库获取信息\n"
            "2. analyze_scene_description - 分析场景描述\n"
            "3. format_response - 格式化输出\n\n"
            "请直接输出工具名称和参数，格式: TOOL=工具名 | ARGS=参数"
        )),
        HumanMessage(content=user_input),
    ]

    try:
        response = llm.invoke(messages)
        tool_result = response.content
        print(f"[tool_node] 工具调度结果: {tool_result[:100]}...")
    except Exception as e:
        tool_result = f"工具调用失败: {str(e)}"

    scratchpad.append(f"[tool] 结果: {tool_result[:80]}")

    return {
        "tool_result": tool_result,
        "agent_scratchpad": scratchpad,
    }


# ============================================================
# 5. reasoning_node — 推理与决策
# ============================================================

def reasoning_node(state: AgentState) -> Dict[str, Any]:
    """
    【推理节点】综合所有上下文进行推理决策。

    整合用户输入、视觉场景、历史记忆和工具结果，
    使用 DeepSeek-V4-Pro 进行综合分析，生成推理结论。

    输入依赖: user_input, vision_context, scene_memory, tool_result
    输出字段: agent_scratchpad（记录推理过程）
    """
    user_input = state.get("user_input", "")
    vision_ctx = state.get("vision_context", "")
    scene_memory = state.get("scene_memory", [])
    tool_result = state.get("tool_result", "")
    scratchpad = state.get("agent_scratchpad", [])

    # 构建推理所需的上下文（从结构化 scene_memory 中提取）
    memory_context = "无历史场景记录"
    if scene_memory and len(scene_memory) > 0:
        try:
            parsed = json.loads(scene_memory[0])
            memory_context = parsed.get("compressed_context", "无历史场景记录")
        except (json.JSONDecodeError, KeyError):
            memory_context = str(scene_memory[0])[:500]

    # 使用 DeepSeek 进行推理
    llm = ChatOpenAI(
        model=settings.DEEPSEEK_MODEL,
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
        temperature=0.7,
    )

    messages = [
        SystemMessage(content=(
            "你是 AI Vision Chat Assistant 的推理核心。\n"
            "请基于以下上下文进行深入推理：\n"
            "1. 分析用户意图和需求\n"
            "2. 结合视觉场景信息\n"
            "3. 利用历史场景记忆的连续性\n"
            "4. 参考工具返回的结果\n\n"
            "输出推理结论，为最终回答做准备。"
        )),
        HumanMessage(content=(
            f"用户输入: {user_input}\n\n"
            f"当前视觉场景: {vision_ctx}\n\n"
            f"历史场景记忆:\n{memory_context}\n\n"
            f"工具结果: {tool_result}"
        )),
    ]

    try:
        response = llm.invoke(messages)
        reasoning = response.content
        scratchpad.append(f"[reasoning] 推理完成 ({len(reasoning)} chars)")
        print(f"[reasoning_node] 推理完成: {reasoning[:100]}...")
    except Exception as e:
        reasoning = f"推理过程出错: {str(e)}"
        scratchpad.append(f"[reasoning] 错误: {str(e)}")

    return {"agent_scratchpad": scratchpad}


# ============================================================
# 6. response_node — 最终响应生成
# ============================================================

def response_node(state: AgentState) -> Dict[str, Any]:
    """
    【响应节点】生成最终回复。

    基于推理结论，结合视觉上下文和对话历史，
    生成自然流畅的最终回复。

    输入依赖: user_input, vision_context, scene_memory, tool_result, agent_scratchpad
    输出字段: final_response
    """
    user_input = state.get("user_input", "")
    vision_ctx = state.get("vision_context", "")
    scene_memory = state.get("scene_memory", [])
    tool_result = state.get("tool_result", "")
    scratchpad = state.get("agent_scratchpad", [])

    # 最近的推理内容（从 scratchpad 中提取）
    reasoning_logs = [s for s in scratchpad if s.startswith("[reasoning]")]
    reasoning_content = reasoning_logs[-1] if reasoning_logs else ""

    # 构建最终回复
    llm = ChatOpenAI(
        model=settings.DEEPSEEK_MODEL,
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
        temperature=0.8,
        max_tokens=1024,
    )

    # 视觉上下文摘要
    vision_summary = ""
    if scene_memory:
        vision_summary = "最近的场景记录:\n" + "\n".join(scene_memory[-2:])

    messages = [
        SystemMessage(content=(
            "你是 AI Vision Chat Assistant，一个支持视觉和语音的智能助手。\n\n"
            "回复要求:\n"
            "1. 自然口语化（因为是语音播报）\n"
            "2. 结合视觉场景信息回答\n"
            "3. 回答简洁有条理（控制在 2-3 段内）\n"
            "4. 如果无法获取视觉信息，诚实告知\n"
            "5. 使用中文回复\n\n"
            "重要: 直接输出回答内容，不要包含思考过程。"
        )),
        HumanMessage(content=(
            f"用户问题: {user_input}\n\n"
            f"视觉场景: {vision_ctx}\n\n"
            f"{vision_summary}\n\n"
            f"工具结果: {tool_result}\n"
            f"推理参考: {reasoning_content}"
        )),
    ]

    try:
        response = llm.invoke(messages)
        final_response = response.content
        print(f"[response_node] 生成回复 ({len(final_response)} chars)")
    except Exception as e:
        final_response = f"抱歉，我暂时无法回答这个问题。错误: {str(e)}"

    return {"final_response": final_response}


# ============================================================
# 条件路由函数（供 graph.py 的条件边使用）
# ============================================================

def route_planner(state: AgentState) -> str:
    """
    规划节点的条件路由函数。

    根据 planner_node 设置的路由标记决定下一个节点:
    - "vision" → vision_node
    - "tool"   → tool_node
    - "direct_reason" → reasoning_node

    Args:
        state: 当前 Agent 状态

    Returns:
        下一个节点的名称
    """
    next_step = state.get("_next_step", "direct_reason")
    return next_step
