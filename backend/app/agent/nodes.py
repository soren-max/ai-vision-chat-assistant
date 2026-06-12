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
# Planner 结构化输出 Schema
# ============================================================

PLANNER_SYSTEM_PROMPT = """你是一个智能规划器。分析用户输入，用 JSON 决定下一步行动。

行动类型:
- need_vision: 用户问题需要查看摄像头画面才能回答（看/识别/这是什么/描述场景/有什么/在哪里）
- need_tool: 用户问题需要调用外部工具（时间/搜索/计算/翻译/天气）
- 两者均为 false: 可以直接用常识回答

可用工具:
- get_time: 获取当前时间（"几点了"/"现在几点"/"当前时间"）
- search_web: 联网搜索（"搜索XX"/"查一下XX"/"最新XX"）
- search_knowledge: 知识库查询（"什么是XX"/"XX的定义"）
- format_response: 格式化输出

输出格式（严格 JSON，不含 markdown）:
{"need_vision": false, "need_tool": true, "tool_name": "get_time", "reasoning": "用户问时间，需要调用 get_time 工具"}

示例:
Q: "现在几点了"
A: {"need_vision": false, "need_tool": true, "tool_name": "get_time", "reasoning": "用户询问时间"}

Q: "桌上有什么"
A: {"need_vision": true, "need_tool": false, "tool_name": null, "reasoning": "需要查看桌面画面"}

Q: "你好"
A: {"need_vision": false, "need_tool": false, "tool_name": null, "reasoning": "日常问候，直接回答"}

Q: "搜索Python教程"
A: {"need_vision": false, "need_tool": true, "tool_name": "search_web", "reasoning": "需要联网搜索"}

Q: "我手里拿的是什么"
A: {"need_vision": true, "need_tool": false, "tool_name": null, "reasoning": "需要摄像头识别手中物体"}
"""


def _parse_planner_json(raw: str) -> dict:
    """从 LLM 返回中安全提取 JSON"""
    # 移除 markdown 代码块
    raw = raw.strip()
    for prefix in ("```json", "```"):
        if raw.startswith(prefix):
            raw = raw[len(prefix):].strip()
    if raw.endswith("```"):
        raw = raw[:-3].strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # 尝试提取第一个 { ... } 块
        import re
        m = re.search(r"\{[\s\S]*\}", raw)
        if m:
            return json.loads(m.group(0))
        raise


# ============================================================
# 3. planner_node — Structured Output 智能规划（亮点功能）
# ============================================================

def planner_node(state: AgentState) -> Dict[str, Any]:
    """
    【规划节点】使用 Structured Output 决定执行路径。

    调用 DeepSeek-V4-Pro 分析用户输入，输出严格 JSON:
    {
      "need_vision": bool,   # 是否需要视觉分析
      "need_tool": bool,     # 是否需要调用工具
      "tool_name": "get_time" | null,  # 工具名称
      "reasoning": "..."     # 决策理由
    }

    路由规则:
    - need_vision=true → "vision"
    - need_tool=true   → "tool" (携带 tool_name)
    - 两者 false       → "direct_reason"

    输入依赖: state["user_input"]
    输出字段: agent_scratchpad, _next_step, _tool_name, _plan_json
    """
    user_input = state.get("user_input", "").strip()
    scratchpad = state.get("agent_scratchpad", [])

    # 空输入保护
    if not user_input:
        scratchpad.append("[planner] 决策: direct_reason | 原因: 空输入")
        return {
            "agent_scratchpad": scratchpad,
            "_next_step": "direct_reason",
            "_tool_name": None,
            "_plan_json": {},
        }

    # 使用 DeepSeek 进行结构化决策
    llm = ChatOpenAI(
        model=settings.DEEPSEEK_MODEL,
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
        temperature=0.0,    # 规划需要确定性
        max_tokens=256,
    )

    messages = [
        SystemMessage(content=PLANNER_SYSTEM_PROMPT),
        HumanMessage(content=f"Q: {user_input}"),
    ]

    try:
        response = llm.invoke(messages)
        plan = _parse_planner_json(response.content)

        need_vision = plan.get("need_vision", False)
        need_tool = plan.get("need_tool", False)
        tool_name = plan.get("tool_name") if need_tool else None
        reasoning = plan.get("reasoning", "")

        # 决定路由
        if need_vision:
            decision = "vision"
        elif need_tool:
            decision = "tool"
        else:
            decision = "direct_reason"

        plan_record = (
            f"[planner] 决策: {decision} | "
            f"vision={need_vision} tool={need_tool}"
        )
        if tool_name:
            plan_record += f" tool_name={tool_name}"
        plan_record += f" | 原因: {reasoning}"

        scratchpad.append(plan_record)
        print(plan_record)

        return {
            "agent_scratchpad": scratchpad,
            "_next_step": decision,
            "_tool_name": tool_name,
            "_plan_json": plan,
        }

    except Exception as e:
        # 降级：JSON 解析失败时使用关键词规则
        print(f"[planner] Structured Output 失败，降级关键词规则: {e}")
        return _planner_fallback(user_input, scratchpad, str(e))


def _planner_fallback(user_input: str, scratchpad: list, error: str) -> Dict[str, Any]:
    """降级关键词规则 — LLM 结构化输出失败时的保底方案"""
    user_lower = user_input.lower()

    vision_kw = [
        "看", "看到", "看见", "画面", "摄像头", "场景", "这是什么", "有什么",
        "what", "see", "look", "camera", "scene", "describe", "识别", "检测",
    ]
    tool_kw = {
        "几点了": "get_time",
        "时间": "get_time",
        "搜索": "search_web",
        "查一下": "search_web",
        "计算": "search_knowledge",
        "翻译": "search_knowledge",
    }

    has_vision = any(kw in user_lower for kw in vision_kw)
    tool_name = None
    for kw, tn in tool_kw.items():
        if kw in user_lower:
            tool_name = tn
            break

    if has_vision:
        decision = "vision"
    elif tool_name:
        decision = "tool"
    else:
        decision = "direct_reason"

    record = f"[planner] 降级决策: {decision} | vision={has_vision} tool={tool_name} | err={error[:50]}"
    scratchpad.append(record)
    print(record)

    return {
        "agent_scratchpad": scratchpad,
        "_next_step": decision,
        "_tool_name": tool_name,
        "_plan_json": {"fallback": True, "error": error},
    }


# ============================================================
# 4. tool_node — 工具执行
# ============================================================

def tool_node(state: AgentState) -> Dict[str, Any]:
    """
    【工具节点】执行 planner 指定的工具。

    优先使用 planner_node 的 Structured Output 中的 tool_name，
    直接调用对应工具函数，避免二次 LLM 调用。

    输入依赖: state["user_input"], state["_tool_name"]
    输出字段: tool_result
    """
    from app.agent.tools import TOOL_REGISTRY

    user_input = state.get("user_input", "")
    tool_name = state.get("_tool_name", "")
    scratchpad = state.get("agent_scratchpad", [])

    # 优先使用 planner 指定的工具
    if tool_name and tool_name in TOOL_REGISTRY:
        tool_fn = TOOL_REGISTRY[tool_name]
        try:
            result = tool_fn.invoke({"query": user_input} if tool_name in ("search_web", "search_knowledge") else {})
            tool_result = str(result)
            print(f"[tool_node] ✅ {tool_name}: {tool_result[:100]}")
        except Exception as e:
            tool_result = f"工具 {tool_name} 执行失败: {e}"
            print(f"[tool_node] ❌ {e}")
    else:
        # 降级：无工具名或工具不存在
        tool_result = f"无可用工具 (planner 未指定 tool_name)"
        print(f"[tool_node] ⚠️ 无 tool_name，跳过执行")

    scratchpad.append(f"[tool] {tool_name}: {tool_result[:80]}")

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

    根据 planner_node 的 Structured Output 决定下一个节点:
    - "vision" → vision_node
    - "tool"   → tool_node
    - "direct_reason" → reasoning_node

    Args:
        state: 当前 Agent 状态（含 _next_step 和 _plan_json）

    Returns:
        下一个节点的名称
    """
    next_step = state.get("_next_step", "direct_reason")

    # 打印路由决策摘要
    plan = state.get("_plan_json", {})
    if plan:
        tool = plan.get("tool_name", "")
        vision = plan.get("need_vision", False)
        tool_need = plan.get("need_tool", False)
        reason = plan.get("reasoning", "")
        print(
            f"[route] → {next_step} | "
            f"vision={vision} tool={tool_need}"
            + (f" tool_name={tool}" if tool else "")
            + (f" | {reason}" if reason else "")
        )

    return next_step
