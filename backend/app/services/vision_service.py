"""
视觉分析服务

封装摄像头帧的采集、预处理和视觉分析功能，
供 vision_node 调用获取场景理解。
"""

from typing import Optional
from app.config import settings


class VisionService:
    """
    视觉服务

    负责:
    - 摄像头帧的接收与缓存
    - 图像预处理（缩放、编码）
    - 调用视觉模型进行场景理解
    """

    def __init__(self):
        self._current_frame: Optional[bytes] = None
        self._frame_count: int = 0

    def update_frame(self, frame_data: bytes) -> None:
        """
        更新当前帧数据（由 WebSocket 接收回调）

        Args:
            frame_data: JPEG 编码的帧数据
        """
        self._current_frame = frame_data
        self._frame_count += 1

    def get_frame_summary(self) -> str:
        """
        获取当前帧的概要信息

        Returns:
            帧信息描述字符串
        """
        if self._current_frame is None:
            return "未获取到摄像头画面"
        return f"摄像头画面已就绪 (帧 #{self._frame_count}, {len(self._current_frame)} bytes)"

    def reset(self) -> None:
        """重置视觉服务状态"""
        self._current_frame = None
        self._frame_count = 0


# 全局单例
vision_service = VisionService()
