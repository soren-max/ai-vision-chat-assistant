"""
Agent 工具定义

定义 Vision Agent 可调用的工具函数，使用 @tool 装饰器注册到 LangChain 工具系统。
"""

from langchain_core.tools import tool


@tool
def analyze_scene_description(description: str) -> str:
    """
    分析场景描述中包含的对象和关键信息。

    例如：描述中有"一个红色的苹果在桌子上"，
    返回："物体: 苹果(红色), 桌子; 关系: 苹果在桌子上"

    Args:
        description: 场景描述文本

    Returns:
        结构化的场景分析结果
    """
    # 实际实现中将调用 DeepSeek 进行结构化分析
    # 当前为桩函数，真实场景下交由 vision_node 中的 LLM 处理
    return f"场景分析完成: {description}"


@tool
def search_knowledge(query: str) -> str:
    """
    搜索知识库获取相关信息，用于回答用户的问题。

    Args:
        query: 搜索查询语句

    Returns:
        搜索结果文本
    """
    # TODO: 集成知识库或搜索引擎
    return f"知识库搜索: '{query}' 的结果将在后续实现"


@tool
def format_response(text: str, style: str = "conversational") -> str:
    """
    格式化输出文本，支持不同风格。

    Args:
        text: 原始文本
        style: 风格选项 (conversational / professional / concise)

    Returns:
        格式化后的文本
    """
    if style == "concise":
        return text[:200] + "..." if len(text) > 200 else text
    return text


@tool
def get_time() -> str:
    """
    获取当前系统时间。

    用于回答"几点了"、"现在什么时间"等问题。

    Returns:
        当前时间字符串（含日期和星期）
    """
    from datetime import datetime
    now = datetime.now()
    weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    return (
        f"{now.year}年{now.month}月{now.day}日 "
        f"{weekdays[now.weekday()]} "
        f"{now.hour:02d}:{now.minute:02d}:{now.second:02d}"
    )


@tool
def search_web(query: str) -> str:
    """
    联网搜索获取实时信息，用于回答需要最新数据的问题。

    Args:
        query: 搜索查询语句

    Returns:
        搜索结果摘要
    """
    # TODO: 接入搜索引擎 API
    return f"联网搜索 '{query}' 的结果将在后续集成搜索引擎后返回"


# 工具注册表 —— 供 planner 和 tool_node 使用
TOOL_REGISTRY = {
    "get_time": get_time,
    "search_web": search_web,
    "search_knowledge": search_knowledge,
    "analyze_scene_description": analyze_scene_description,
    "format_response": format_response,
}

# 工具列表，供 Agent 注册使用
VISION_AGENT_TOOLS = list(TOOL_REGISTRY.values())
