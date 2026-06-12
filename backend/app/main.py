"""
FastAPI 应用主入口

初始化 FastAPI 应用，注册 LangGraph Agent 驱动的路由、中间件和事件处理器。
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.services.stt_service import stt_service

# 创建 FastAPI 实例
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI Vision Chat Assistant - 基于 LangGraph 的视觉语音对话助手",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ---- 跨域中间件 ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- 启动事件 ----
@app.on_event("startup")
async def startup():
    """应用启动时初始化 LangGraph Agent"""
    print(f"[{settings.APP_NAME} v{settings.APP_VERSION}] 启动中...")
    print(f"  LangGraph Agent: 已就绪")
    print(f"  大模型: {settings.DEEPSEEK_MODEL}")
    print(f"  STT 引擎: {settings.STT_ENGINE} (语言: {settings.STT_LANGUAGE})")
    print(f"  Vision 分析: {settings.VISION_MAX_DIMENSION}px, JPEG Q={settings.VISION_JPEG_QUALITY}")

    # 检查 API Key 是否已配置
    if settings.DEEPSEEK_API_KEY:
        print(f"  Vision 服务: 已配置 ✓")
    else:
        print(f"  Vision 服务: 未配置 DEEPSEEK_API_KEY（不可用）")

    if settings.OPENAI_API_KEY:
        print(f"  STT 服务: 已配置 ✓")
    else:
        print(f"  STT 服务: 未配置 OPENAI_API_KEY（Whisper 不可用）")

    print(f"  文档地址: http://{settings.HOST}:{settings.PORT}/api/docs")
    print(f"  调试模式: {settings.DEBUG}")


@app.on_event("shutdown")
async def shutdown():
    """应用关闭时的清理逻辑"""
    print(f"[{settings.APP_NAME}] 服务关闭")


# ========== 系统路由 ==========

@app.get("/api/health", tags=["系统"])
async def health_check():
    """健康检查接口"""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "agent": "langgraph",
    }


@app.get("/api/info", tags=["系统"])
async def app_info():
    """获取应用配置信息"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "architecture": "LangGraph StateGraph",
        "deepseek_model": settings.DEEPSEEK_MODEL,
        "stt_engine": settings.STT_ENGINE,
        "stt_language": settings.STT_LANGUAGE,
        "stt_ready": stt_service.is_ready,
        "tts_engine": settings.TTS_ENGINE,
    }


# ========== 注册业务路由 ==========

from app.routers import chat, stt, vision, multimodal, tts, optimize, code_assistant, watch

app.include_router(chat.router)
app.include_router(stt.router)
app.include_router(vision.router)
app.include_router(multimodal.router)
app.include_router(tts.router)
app.include_router(optimize.router)
app.include_router(code_assistant.router)
app.include_router(watch.router)
