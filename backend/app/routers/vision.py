"""
Vision 路由

提供视觉分析 REST API 端点。
POST /api/vision/analyze — 上传摄像头截图，返回结构化场景分析
"""

import logging
from fastapi import APIRouter, HTTPException

from app.services.vision_analysis_service import vision_analysis_service
from app.models.schemas import VisionRequest, VisionResponse

# ============================================================
# Logger
# ============================================================

logger = logging.getLogger("vision_router")

# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api/vision", tags=["视觉分析"])


@router.post("/analyze", response_model=VisionResponse, summary="分析摄像头截图")
async def analyze_image(request: VisionRequest) -> VisionResponse:
    """
    视觉分析接口

    接收 Base64 编码的摄像头截图，调用 DeepSeek-V4-Pro Vision 进行多维度分析，
    返回结构化的场景描述。

    分析维度:
    - **scene**:         场景整体描述（环境、光线、布局）
    - **objects**:       主要物体列表（名称、置信度、位置）
    - **people**:        人物信息（姿态、动作、表情、衣着）
    - **screen_content**: 屏幕显示内容
    - **risk_content**:  风险内容识别
    - **summary**:       一句话总结

    **使用示例**:
    ```bash
    curl -X POST http://localhost:8000/api/vision/analyze \\
         -H "Content-Type: application/json" \\
         -d '{"session_id":"test","image":"/9j/4AAQ..."}'
    ```
    """
    # ---- 1. 校验 ----
    if not request.image or not request.image.strip():
        raise HTTPException(status_code=400, detail="图像数据为空")

    logger.info(
        f"收到视觉分析请求 | session={request.session_id} | "
        f"图像长度={len(request.image)}"
    )

    # ---- 2. 调用分析服务 ----
    try:
        result = await vision_analysis_service.analyze(
            image_b64=request.image,
            user_prompt=request.prompt,
        )
    except ValueError as e:
        logger.error(f"视觉分析参数错误: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"视觉分析运行时错误: {e}")
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception(f"视觉分析未预期错误: {e}")
        raise HTTPException(status_code=500, detail=f"视觉分析服务异常: {str(e)}")

    # ---- 3. 组装响应 ----
    return _build_response(result)


# ============================================================
# 响应构建
# ============================================================

def _build_response(data: dict) -> VisionResponse:
    """
    将服务层返回的字典转换为 Pydantic VisionResponse。

    处理缺失字段、类型转换等容错逻辑。
    """
    from app.models.schemas import DetectedObject, DetectedPerson

    objects = []
    for obj in data.get("objects", []) or []:
        try:
            objects.append(
                DetectedObject(
                    name=obj.get("name", "未知"),
                    confidence=min(1.0, max(0.0, float(obj.get("confidence", 0)))),
                    position=obj.get("position", ""),
                )
            )
        except (ValueError, TypeError):
            # 跳过格式异常的单个物体
            continue

    people = []
    for p in data.get("people", []) or []:
        try:
            people.append(
                DetectedPerson(
                    count=int(p.get("count", 0)),
                    pose=p.get("pose", ""),
                    action=p.get("action", ""),
                    expression=p.get("expression", ""),
                    attire=p.get("attire", ""),
                )
            )
        except (ValueError, TypeError):
            continue

    return VisionResponse(
        scene=data.get("scene", ""),
        objects=objects,
        people=people,
        screen_content=data.get("screen_content", ""),
        risk_content=data.get("risk_content", []) or [],
        summary=data.get("summary", ""),
    )
