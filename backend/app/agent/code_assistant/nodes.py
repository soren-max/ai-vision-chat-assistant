"""
Code Assistant Agent — 4 个节点

流水线: ocr_node → code_parser_node → error_analysis_node → fix_generator_node
每个节点调用 DeepSeek-V4-Pro 处理上一节点的输出。
"""

import json
import logging
from typing import Dict, Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.config import settings
from app.agent.code_assistant.state import CodeAssistantState

# ============================================================
# Logger
# ============================================================

logger = logging.getLogger("code_assistant")
logger.setLevel(settings.LOG_LEVEL)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(
        logging.Formatter("[%(asctime)s] [%(name)s] %(levelname)s - %(message)s")
    )
    logger.addHandler(h)


# ============================================================
# LLM Factory
# ============================================================

def _make_llm(temperature: float = 0.3) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.DEEPSEEK_MODEL,
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
        temperature=temperature,
    )


def _parse_json_safe(raw: str) -> dict:
    """安全解析 LLM JSON 输出"""
    raw = raw.strip()
    for prefix in ("```json", "```"):
        if raw.startswith(prefix):
            raw = raw[len(prefix):].strip()
    if raw.endswith("```"):
        raw = raw[:-3].strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        import re
        m = re.search(r"\{[\s\S]*\}", raw)
        if m:
            return json.loads(m.group(0))
        return {"_raw": raw}


# ============================================================
# Node 1: OCR — 从 IDE 截图中提取文本
# ============================================================

OCR_SYSTEM_PROMPT = """你是一个专业的 IDE 截图 OCR 引擎。从截图中提取所有可见文本。

支持识别:
- VSCode: 代码编辑器、文件树、终端面板、Git 面板、问题面板
- PyCharm: 项目面板、编辑区、运行窗口、TODO 面板
- Terminal: 命令提示符、命令输出、错误堆栈

输出严格 JSON:
{
  "ide_type": "vscode",
  "panels": [
    {"name": "editor", "content": "def hello():\\n    print('hello')"},
    {"name": "terminal", "content": "$ python main.py\\nTraceback..."},
    {"name": "problems", "content": "Line 5: NameError..."}
  ],
  "full_text": "所有文本的拼接",
  "detected_language": "python"
}
"""


def ocr_node(state: CodeAssistantState) -> Dict[str, Any]:
    """
    【OCR 节点】从 IDE 截图中提取所有可见文本。

    模拟处理:
    - 如果没有截图数据 → 返回空
    - 有截图时 → 用 DeepSeek Vision 能力识别文本

    输入: screenshot_b64, ide_type
    输出: ocr_text
    """
    screenshot = state.get("screenshot_b64", "")
    ide_type = state.get("ide_type", "vscode")
    existing_ocr = state.get("ocr_text", "")
    scratchpad = state.get("scratchpad", [])

    # 已有 OCR 文本 → 直接透传
    if existing_ocr and existing_ocr != "无截图数据":
        logger.info(f"[ocr_node] OCR 文本已存在 ({len(existing_ocr)}字)，跳过")
        scratchpad.append(f"[ocr] 已有文本 ({len(existing_ocr)}字)，跳过")
        return {
            "ocr_text": existing_ocr,
            "scratchpad": scratchpad,
        }

    if not screenshot:
        logger.info("[ocr_node] 无截图数据，跳过")
        scratchpad.append("[ocr] 无截图数据")
        return {
            "ocr_text": "无截图数据",
            "scratchpad": scratchpad,
        }

    logger.info(f"[ocr_node] 开始 OCR | IDE={ide_type} | 截图大小={len(screenshot)}")

    llm = _make_llm(0.1)

    messages = [
        SystemMessage(content=OCR_SYSTEM_PROMPT),
        HumanMessage(content=f"IDE 类型: {ide_type}\n\n请从截图中提取所有可见文本。"),
    ]

    try:
        response = llm.invoke(messages)
        result = _parse_json_safe(response.content)
        ocr_text = result.get("full_text", response.content[:500])

        panels = result.get("panels", [])
        panel_names = [p.get("name", "?") for p in panels]
        lang = result.get("detected_language", "unknown")

        logger.info(f"[ocr_node] ✅ OCR 完成 | 面板={panel_names} | 语言={lang} | 文本={len(ocr_text)}字")
        scratchpad.append(f"[ocr] 识别面板: {panel_names} | 语言: {lang}")
    except Exception as e:
        ocr_text = f"OCR 失败: {str(e)}"
        logger.error(f"[ocr_node] ❌ {e}")
        scratchpad.append(f"[ocr] 错误: {str(e)[:60]}")

    return {
        "ocr_text": ocr_text,
        "scratchpad": scratchpad,
    }


# ============================================================
# Node 2: Code Parser — 提取代码块
# ============================================================

CODE_PARSER_PROMPT = """你是一个代码解析器。从 OCR 提取的文本中识别并提取代码块。

输出严格 JSON:
{
  "code_blocks": [
    {
      "language": "python",
      "code": "def hello():\\n    print('hello')",
      "line_range": "L1-L2",
      "file_path": "main.py"
    }
  ],
  "total_blocks": 1,
  "summary": "检测到 1 个 Python 代码块"
}
"""


def code_parser_node(state: CodeAssistantState) -> Dict[str, Any]:
    """
    【代码解析节点】从 OCR 文本中提取代码块。

    输入: ocr_text
    输出: code_blocks
    """
    ocr_text = state.get("ocr_text", "")
    scratchpad = state.get("scratchpad", [])

    if not ocr_text or ocr_text == "无截图数据":
        scratchpad.append("[parser] 无 OCR 文本，跳过")
        return {
            "code_blocks": [],
            "scratchpad": scratchpad,
        }

    logger.info(f"[parser] 开始解析 | OCR 文本={len(ocr_text)}字")
    llm = _make_llm(0.2)

    messages = [
        SystemMessage(content=CODE_PARSER_PROMPT),
        HumanMessage(content=ocr_text[:3000]),  # 截断以节省 token
    ]

    try:
        response = llm.invoke(messages)
        result = _parse_json_safe(response.content)
        blocks = result.get("code_blocks", [])

        logger.info(f"[parser] ✅ 提取 {len(blocks)} 个代码块")
        scratchpad.append(f"[parser] 提取 {len(blocks)} 个代码块")
    except Exception as e:
        blocks = []
        logger.error(f"[parser] ❌ {e}")
        scratchpad.append(f"[parser] 错误: {str(e)[:60]}")

    return {
        "code_blocks": blocks,
        "scratchpad": scratchpad,
    }


# ============================================================
# Node 3: Error Analysis — 分析代码错误
# ============================================================

ERROR_ANALYSIS_PROMPT = """你是一个资深代码审查专家。分析代码片段中的问题。

检查维度:
1. 语法错误 (syntax): 括号不匹配、缩进、拼写
2. 运行时错误 (runtime): NameError, TypeError, IndexError
3. 逻辑错误 (logic): 死循环、条件覆盖不全、空值未处理
4. 代码风格 (style): 命名不规范、过长函数、重复代码
5. 安全问题 (security): SQL注入、硬编码密码、路径遍历

输出严格 JSON:
{
  "errors": [
    {
      "error_type": "syntax",
      "severity": "error",
      "message": "第5行缺少冒号",
      "line_hint": "L5: if x > 0",
      "code_snippet": "if x > 0\\n    print('hello')"
    }
  ],
  "error_count": 1,
  "overall_assessment": "代码存在1个语法错误需要修复"
}
"""


def error_analysis_node(state: CodeAssistantState) -> Dict[str, Any]:
    """
    【错误分析节点】分析提取的代码块，检测错误。

    输入: code_blocks, ocr_text
    输出: errors
    """
    code_blocks = state.get("code_blocks", [])
    ocr_text = state.get("ocr_text", "")
    scratchpad = state.get("scratchpad", [])

    if not code_blocks:
        scratchpad.append("[analyzer] 无代码块，跳过")
        return {
            "errors": [],
            "scratchpad": scratchpad,
        }

    # 构建分析输入
    blocks_text = "\n\n".join(
        f"--- {b.get('file_path', '?' )} : {b.get('line_range', '?')} ---\n{b.get('code', '')}"
        for b in code_blocks
    )

    logger.info(f"[analyzer] 开始分析 | {len(code_blocks)} 个代码块")
    llm = _make_llm(0.3)

    messages = [
        SystemMessage(content=ERROR_ANALYSIS_PROMPT),
        HumanMessage(content=f"代码:\n{blocks_text[:3000]}\n\nOCR 完整文本:\n{ocr_text[:1000]}"),
    ]

    try:
        response = llm.invoke(messages)
        result = _parse_json_safe(response.content)
        errors = result.get("errors", [])

        severity_counts = {}
        for e in errors:
            sev = e.get("severity", "info")
            severity_counts[sev] = severity_counts.get(sev, 0) + 1

        logger.info(f"[analyzer] ✅ 检测到 {len(errors)} 个问题 | {severity_counts}")
        scratchpad.append(f"[analyzer] {len(errors)} 个问题: {severity_counts}")
    except Exception as e:
        errors = []
        logger.error(f"[analyzer] ❌ {e}")
        scratchpad.append(f"[analyzer] 错误: {str(e)[:60]}")

    return {
        "errors": errors,
        "scratchpad": scratchpad,
    }


# ============================================================
# Node 4: Fix Generator — 生成修复建议
# ============================================================

FIX_GENERATOR_PROMPT = """你是一个代码修复专家。为检测到的每个错误生成修复建议。

输出严格 JSON:
{
  "fixes": [
    {
      "error_ref": "第5行缺少冒号",
      "fix_description": "在 if 语句末尾添加冒号",
      "original_code": "if x > 0\\n    print('hello')",
      "fixed_code": "if x > 0:\\n    print('hello')",
      "explanation": "Python 中每个 if 语句需要以冒号结尾"
    }
  ],
  "total_fixes": 1,
  "summary": "共 1 处需要修复"
}
"""


def fix_generator_node(state: CodeAssistantState) -> Dict[str, Any]:
    """
    【修复生成节点】为检测到的错误生成修复方案。

    输入: errors, code_blocks
    输出: fix_suggestions, final_response
    """
    errors = state.get("errors", [])
    code_blocks = state.get("code_blocks", [])
    scratchpad = state.get("scratchpad", [])

    if not errors:
        final = _build_final_report([], code_blocks, state.get("ocr_text", ""))
        scratchpad.append("[fixer] 无错误，生成通过报告")
        return {
            "fix_suggestions": [],
            "final_response": final,
            "scratchpad": scratchpad,
        }

    # 构建错误摘要
    errors_text = "\n".join(
        f"[{e.get('severity','?')}] {e.get('message','')} @ {e.get('line_hint','?')}"
        for e in errors
    )
    blocks_text = "\n\n".join(
        b.get("code", "") for b in code_blocks
    )

    logger.info(f"[fixer] 生成修复 | {len(errors)} 个错误")
    llm = _make_llm(0.4)

    messages = [
        SystemMessage(content=FIX_GENERATOR_PROMPT),
        HumanMessage(content=f"错误列表:\n{errors_text}\n\n代码:\n{blocks_text[:2000]}"),
    ]

    try:
        response = llm.invoke(messages)
        result = _parse_json_safe(response.content)
        fixes = result.get("fixes", [])

        logger.info(f"[fixer] ✅ 生成 {len(fixes)} 个修复方案")
        scratchpad.append(f"[fixer] 生成 {len(fixes)} 个修复")
    except Exception as e:
        fixes = []
        logger.error(f"[fixer] ❌ {e}")
        scratchpad.append(f"[fixer] 错误: {str(e)[:60]}")

    # 构建最终报告
    final = _build_final_report(fixes, code_blocks, state.get("ocr_text", ""))

    return {
        "fix_suggestions": fixes,
        "final_response": final,
        "scratchpad": scratchpad,
    }


# ============================================================
# 最终报告生成
# ============================================================

def _build_final_report(
    fixes: list,
    code_blocks: list,
    ocr_text: str,
) -> str:
    """构建格式化的最终分析报告"""
    ide_hint = "VSCode" if "vscode" in ocr_text.lower() else "IDE"

    if not fixes and not code_blocks:
        return f"## 📊 Code Analysis Report\n\n未检测到代码内容。请确认 {ide_hint} 截图包含代码区域。"

    if not fixes:
        block_count = len(code_blocks)
        langs = set(b.get("language", "?") for b in code_blocks)
        return (
            f"## ✅ Code Analysis Report\n\n"
            f"检测到 **{block_count}** 个代码块（{', '.join(langs)}），"
            f"未发现明显错误。代码看起来没有问题！"
        )

    # 按严重程度分组
    groups = {}
    for i, fix in enumerate(fixes):
        sev = fix.get("severity", "info")
        groups.setdefault(sev, []).append(fix)

    lines = [
        f"## 📊 Code Analysis Report\n",
        f"共检测到 **{len(fixes)}** 个问题：\n",
    ]

    sev_order = ["critical", "error", "warning", "info"]
    for sev in sev_order:
        if sev not in groups:
            continue
        g = groups[sev]
        emoji = {"critical": "🔴", "error": "🟠", "warning": "🟡", "info": "🔵"}.get(sev, "⚪")
        lines.append(f"### {emoji} {sev.upper()} ({len(g)})\n")

        for fix in g:
            lines.append(
                f"**{fix.get('error_ref', '?')}**\n"
                f"- 修复: {fix.get('fix_description', '?')}\n"
                f"- 原始: `{fix.get('original_code', '?')[:80]}`\n"
                f"- 建议: `{fix.get('fixed_code', '?')[:80]}`\n"
                f"- 原因: {fix.get('explanation', '?')}\n"
            )

    return "\n".join(lines)
