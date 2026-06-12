"""
Code Assistant 路由

POST /api/code/analyze — IDE 截图分析
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.agent.code_assistant.graph import code_assistant_graph
from app.agent.code_assistant.state import CodeAssistantState

logger = logging.getLogger("code_assistant_router")
router = APIRouter(prefix="/api/code", tags=["代码助手"])


class CodeAnalysisRequest(BaseModel):
    screenshot_b64: str = Field("", description="Base64 编码的 IDE 截图")
    ide_type: str = Field("vscode", description="IDE 类型: vscode / pycharm / terminal")
    user_question: str = Field("", description="额外问题（可选）")


class CodeAnalysisResponse(BaseModel):
    final_response: str = Field(..., description="分析报告")
    code_blocks_count: int = Field(0)
    errors_count: int = Field(0)
    fixes_count: int = Field(0)


@router.post("/analyze", response_model=CodeAnalysisResponse, summary="分析 IDE 截图")
async def analyze_ide(request: CodeAnalysisRequest):
    """
    Code Assistant — IDE 截图分析

    流水线: OCR → 代码提取 → 错误分析 → 修复建议

    支持 IDE:
    - **VSCode**: 编辑器、终端、问题面板
    - **PyCharm**: 项目面板、编辑区、运行窗口
    - **Terminal**: 命令输出、错误堆栈
    """
    state: CodeAssistantState = {
        "screenshot_b64": request.screenshot_b64,
        "ide_type": request.ide_type,
        "user_question": request.user_question,
        "ocr_text": "",
        "code_blocks": [],
        "errors": [],
        "fix_suggestions": [],
        "final_response": "",
        "session_id": "default",
        "scratchpad": [],
    }

    try:
        result = await code_assistant_graph.ainvoke(state)
    except Exception as e:
        logger.error(f"Code Assistant 执行失败: {e}")
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")

    return CodeAnalysisResponse(
        final_response=result.get("final_response", "分析失败"),
        code_blocks_count=len(result.get("code_blocks", [])),
        errors_count=len(result.get("errors", [])),
        fixes_count=len(result.get("fix_suggestions", [])),
    )
