"""
LangGraph Tool Registry — 动态工具注册与执行

设计:
- ToolRegistry: 统一工具注册/查找/执行中心
- 每个工具包含: name, description, function, parameter_schema
- 支持 register_tool() 和 execute_tool() 动态调用
- tool_node 通过 ToolRegistry 动态执行工具

工具列表:
1. calculator  — 数学表达式计算
2. get_time    — 获取当前时间
3. weather     — 查询天气（模拟）
4. web_search  — 联网搜索（模拟）
"""

import logging
import re
from datetime import datetime
from typing import Any, Callable, Optional

from app.config import settings

# ============================================================
# Logger
# ============================================================

logger = logging.getLogger("tool_registry")
logger.setLevel(settings.LOG_LEVEL)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(
        logging.Formatter("[%(asctime)s] [%(name)s] %(levelname)s - %(message)s")
    )
    logger.addHandler(h)


# ============================================================
# 工具参数 Schema
# ============================================================

class ToolParam:
    """工具参数定义"""
    def __init__(self, name: str, type_: str, description: str, required: bool = True):
        self.name = name
        self.type = type_
        self.description = description
        self.required = required

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "type": self.type,
            "description": self.description,
            "required": self.required,
        }


class ToolDef:
    """工具定义"""
    def __init__(
        self,
        name: str,
        description: str,
        func: Callable,
        params: list[ToolParam],
        category: str = "general",
    ):
        self.name = name
        self.description = description
        self.func = func
        self.params = params
        self.category = category

    def to_schema(self) -> dict:
        """导出为 JSON Schema（供 LLM 使用）"""
        props = {}
        required = []
        for p in self.params:
            type_map = {"str": "string", "int": "integer", "float": "number"}
            props[p.name] = {"type": type_map.get(p.type, "string"), "description": p.description}
            if p.required:
                required.append(p.name)

        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": props,
                "required": required,
            },
        }


# ============================================================
# 工具实现
# ============================================================

def _tool_calculator(expression: str) -> str:
    """
    计算数学表达式。

    支持: +, -, *, /, **, %, sqrt, sin, cos, pi

    Args:
        expression: 数学表达式字符串，如 "2+3*4" 或 "sqrt(16)"

    Returns:
        计算结果字符串
    """
    if not expression or not expression.strip():
        return "错误: 表达式为空"

    # 安全白名单：只允许数学字符
    safe_pattern = r'^[\d\s+\-*/().%^eEpPiIsSnNqQrRtTcCoOaA]+$'
    cleaned = expression.strip()

    if not re.match(safe_pattern, cleaned):
        return f"错误: 表达式包含不允许的字符: {expression}"

    try:
        # 替换数学函数
        cleaned = cleaned.replace('^', '**')
        cleaned = cleaned.replace('pi', '3.141592653589793')
        cleaned = cleaned.replace('Pi', '3.141592653589793')
        cleaned = cleaned.replace('sqrt', '_sqrt')
        cleaned = cleaned.replace('sin', '_sin')
        cleaned = cleaned.replace('cos', '_cos')

        # 安全命名空间
        import math
        safe_ns = {
            "__builtins__": {},
            "_sqrt": math.sqrt,
            "_sin": math.sin,
            "_cos": math.cos,
        }

        result = eval(cleaned, safe_ns)

        if isinstance(result, float):
            result = round(result, 6)

        logger.info(f"calculator: {expression} = {result}")
        return f"{expression} = {result}"

    except ZeroDivisionError:
        return "错误: 除数不能为零"
    except Exception as e:
        return f"计算错误: {str(e)}"


def _tool_get_time(timezone: str = "Asia/Shanghai") -> str:
    """
    获取当前日期和时间。

    Args:
        timezone: 时区（暂仅支持 Asia/Shanghai）

    Returns:
        格式化的时间字符串
    """
    now = datetime.now()
    weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

    return (
        f"现在是 {now.year}年{now.month}月{now.day}日 "
        f"{weekdays[now.weekday()]} "
        f"{now.hour:02d}:{now.minute:02d}:{now.second:02d}"
    )


def _tool_weather(city: str) -> str:
    """
    查询天气（模拟数据）。

    实际部署时接入天气 API（如和风天气、OpenWeatherMap）。

    Args:
        city: 城市名称

    Returns:
        模拟天气信息
    """
    city = city.strip() or "北京"

    # 模拟天气数据
    conditions = ["晴", "多云", "阴", "小雨", "晴转多云"]
    import hashlib
    # 用城市名 hash 决定天气（使同一城市结果稳定）
    idx = int(hashlib.md5(city.encode()).hexdigest()[:2], 16) % len(conditions)
    temp = 18 + (idx * 3) % 15

    logger.info(f"weather: {city} → {conditions[idx]}, {temp}°C")
    return (
        f"{city}天气: {conditions[idx]}，气温 {temp}°C，"
        f"湿度 {50 + idx * 5}%，风力 {1 + idx % 3}级。"
        f"（注: 当前为模拟数据，实际部署请接入天气 API）"
    )


def _tool_web_search(query: str) -> str:
    """
    联网搜索（模拟）。

    实际部署时接入搜索 API（如 Bing Search、SerpAPI）。

    Args:
        query: 搜索查询

    Returns:
        模拟搜索结果
    """
    query = query.strip()
    if not query:
        return "搜索查询为空"

    logger.info(f"web_search: {query}")

    # 模拟搜索结果
    return (
        f"搜索 '{query}' 的结果:\n"
        f"1. [{query} - 百科] 相关定义和解释...\n"
        f"2. [{query} 最新资讯] 近期相关动态...\n"
        f"3. [{query} 教程] 入门指南和示例...\n"
        f"（注: 当前为模拟搜索，实际部署请接入搜索 API）"
    )


# ============================================================
# ToolRegistry — 动态工具注册中心
# ============================================================

class ToolRegistry:
    """
    动态工具注册中心。

    功能:
    - register_tool(name, description, func, params) — 注册新工具
    - execute_tool(name, **kwargs) — 动态执行
    - get_schema() — 导出所有工具 Schema 供 LLM 使用
    - list_tools() — 列出所有已注册工具
    - get_tool(name) — 获取单个工具定义
    """

    def __init__(self):
        self._tools: dict[str, ToolDef] = {}
        self._register_builtins()

    # ============================================================
    # 注册
    # ============================================================

    def _register_builtins(self) -> None:
        """注册内置工具"""
        self.register_tool(
            name="calculator",
            description="计算数学表达式。支持加减乘除、幂运算、开方、三角函数。如: '2+3*4', 'sqrt(16)', 'sin(0.5)'",
            func=_tool_calculator,
            params=[
                ToolParam("expression", "str", "数学表达式，如 2+3*4"),
            ],
            category="utility",
        )

        self.register_tool(
            name="get_time",
            description="获取当前日期、星期和时间。用于回答'几点了'、'今天几号'、'今天星期几'等问题。",
            func=_tool_get_time,
            params=[
                ToolParam("timezone", "str", "时区，默认 Asia/Shanghai", required=False),
            ],
            category="utility",
        )

        self.register_tool(
            name="weather",
            description="查询指定城市的天气信息（温度、湿度、风力）。用于回答'XX天气怎么样'等问题。",
            func=_tool_weather,
            params=[
                ToolParam("city", "str", "城市名称，如 北京、上海、Tokyo"),
            ],
            category="utility",
        )

        self.register_tool(
            name="web_search",
            description="联网搜索获取信息和最新资讯。用于需要实时数据的问题，如新闻、教程、文档。",
            func=_tool_web_search,
            params=[
                ToolParam("query", "str", "搜索关键词"),
            ],
            category="search",
        )

        logger.info(f"ToolRegistry 初始化完成 | 已注册 {len(self._tools)} 个工具")

    def register_tool(
        self,
        name: str,
        description: str,
        func: Callable,
        params: list[ToolParam],
        category: str = "general",
    ) -> None:
        """
        注册新工具。

        Args:
            name:        工具唯一名称
            description: 工具描述（供 LLM 选择工具）
            func:        工具执行函数
            params:      参数定义列表
            category:    工具分类
        """
        if name in self._tools:
            logger.warning(f"工具 '{name}' 已存在，将被覆盖")

        self._tools[name] = ToolDef(
            name=name,
            description=description,
            func=func,
            params=params,
            category=category,
        )
        logger.info(f"注册工具: {name} ({category}) — params={[p.name for p in params]}")

    # ============================================================
    # 执行
    # ============================================================

    def execute_tool(self, name: str, **kwargs) -> str:
        """
        动态执行指定工具。

        自动匹配参数:
        - 如果函数需要 'expression' 参数，但传入的是 'query'，则自动映射 query → expression
        - 多余的 kwargs 参数会被忽略
        - 缺少的参数使用默认值

        Args:
            name:   工具名称
            **kwargs: 工具参数

        Returns:
            工具执行结果字符串

        Raises:
            ValueError: 工具不存在
        """
        if name not in self._tools:
            available = ", ".join(self._tools.keys())
            raise ValueError(f"工具 '{name}' 未注册。可用工具: {available}")

        tool = self._tools[name]
        logger.info(f"执行工具: {name} | kwargs={kwargs}")

        try:
            # 构建参数
            params = {}
            for p in tool.params:
                if p.name in kwargs:
                    params[p.name] = kwargs[p.name]
                elif p.required:
                    # 参数名映射: query/expression/text 互通
                    aliases = {"query", "expression", "text", "input"}
                    found = False
                    for alias in aliases:
                        if alias in kwargs:
                            params[p.name] = kwargs[alias]
                            found = True
                            break
                    if not found:
                        raise ValueError(
                            f"工具 '{name}' 缺少必填参数: {p.name}"
                        )

            # 执行
            result = tool.func(**params)
            return str(result)

        except Exception as e:
            logger.error(f"工具 '{name}' 执行失败: {e}")
            return f"工具执行错误: {str(e)}"

    # ============================================================
    # 查询
    # ============================================================

    def get_tool(self, name: str) -> Optional[ToolDef]:
        """获取工具定义"""
        return self._tools.get(name)

    def list_tools(self) -> list[str]:
        """列出所有已注册工具名称"""
        return list(self._tools.keys())

    def get_schema(self) -> list[dict]:
        """
        导出所有工具 Schema（供 planner 的 System Prompt 使用）。

        Returns:
            工具定义列表
        """
        return [tool.to_schema() for tool in self._tools.values()]

    def get_tool_names_for_prompt(self) -> str:
        """生成 LLM Prompt 中使用的工具列表"""
        lines = []
        for name, tool in self._tools.items():
            params_str = ", ".join(
                f"{p.name}: {p.type}" + ("?" if not p.required else "")
                for p in tool.params
            )
            lines.append(f"  - {name}({params_str}): {tool.description}")
        return "\n".join(lines)

    def has_tool(self, name: str) -> bool:
        """检查工具是否存在"""
        return name in self._tools

    # ============================================================
    # 统计
    # ============================================================

    def get_stats(self) -> dict:
        """获取工具注册统计"""
        categories = {}
        for tool in self._tools.values():
            cat = tool.category
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(tool.name)

        return {
            "total_tools": len(self._tools),
            "categories": categories,
            "tool_names": list(self._tools.keys()),
        }


# ============================================================
# 全局单例
# ============================================================

tool_registry = ToolRegistry()
