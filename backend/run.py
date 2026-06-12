"""
启动脚本

提供开发环境下的便捷启动方式。
生产环境建议使用: uvicorn app.main:app --host 0.0.0.0 --port 8000
"""

import uvicorn
from app.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,    # 开发模式自动重载
        log_level=settings.LOG_LEVEL.lower(),
    )
