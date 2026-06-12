"""
Code Assistant Agent — 状态定义

工作流: Screenshot → OCR → Code Extract → Error Analysis → Fix Suggestion
"""

from typing import TypedDict, List


class CodeBlock(TypedDict):
    """提取的代码块"""
    language: str        # python / javascript / bash / ...
    code: str            # 实际代码内容
    line_range: str      # 在截图中的位置，如 "L10-L25"
    file_path: str       # 推断的文件名（如有）


class DetectedError(TypedDict):
    """检测到的错误"""
    error_type: str       # syntax / runtime / logic / style / security
    severity: str         # critical / error / warning / info
    message: str          # 错误描述
    line_hint: str        # 出错行提示
    code_snippet: str     # 相关代码片段


class FixSuggestion(TypedDict):
    """修复建议"""
    error_ref: str        # 对应 error.message
    fix_description: str  # 修复说明
    original_code: str    # 原代码
    fixed_code: str       # 修复后的代码
    explanation: str      # 解释为什么这样修复


class CodeAssistantState(TypedDict):
    """
    Code Assistant 状态 — 驱动 OCR → Parse → Analyze → Fix 流水线
    """
    # 输入
    screenshot_b64: str          # Base64 编码的 IDE 截图
    ide_type: str                # vscode / pycharm / terminal
    user_question: str           # 用户额外提问（可选）

    # 中间产物
    ocr_text: str                # OCR 提取的原始文本
    code_blocks: List[dict]      # 解析出的代码块列表
    errors: List[dict]           # 检测到的错误列表
    fix_suggestions: List[dict]  # 生成的修复建议

    # 输出
    final_response: str          # 最终回复（格式化的分析报告）

    # 内部
    session_id: str
    scratchpad: List[str]
