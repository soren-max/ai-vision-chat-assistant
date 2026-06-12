"""
Scene Memory Store — 视觉场景长期记忆存储

功能:
- 保存最近 10 轮视觉分析结果
- 追踪历史场景中的所有重要对象
- 场景摘要聚合与压缩
- 构造 Scene Context 供 reasoning/response 节点使用
- 场景类型统计与变化检测
"""

import json
import logging
import threading
import time
from collections import Counter, OrderedDict
from dataclasses import dataclass, field
from typing import Optional

from app.config import settings

# ============================================================
# Logger
# ============================================================

logger = logging.getLogger("scene_memory")
logger.setLevel(settings.LOG_LEVEL)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(
        logging.Formatter("[%(asctime)s] [%(name)s] %(levelname)s - %(message)s")
    )
    logger.addHandler(h)

# ============================================================
# 数据结构
# ============================================================

@dataclass
class SceneRecord:
    """单条场景记录"""
    timestamp: float            # 捕获时间戳
    scene_summary: str          # 场景一句话摘要
    key_objects: list[str]      # 主要检测到的物体名称
    people_count: int           # 人物数量
    scene_type: str             # 场景分类: office/outdoor/kitchen/...
    full_description: str       # 完整 Vision API 返回文本
    change_from_prev: str       # 与上一帧的变化描述

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "scene_summary": self.scene_summary,
            "key_objects": self.key_objects,
            "people_count": self.people_count,
            "scene_type": self.scene_type,
            "change_from_prev": self.change_from_prev,
        }

    def to_compact_str(self) -> str:
        """压缩为一行描述"""
        objects_str = "、".join(self.key_objects[:5]) if self.key_objects else "无"
        people = f"{self.people_count}人" if self.people_count > 0 else "无人"
        return (
            f"[{self.scene_type}] {self.scene_summary} | "
            f"物体: {objects_str} | {people}"
        )


@dataclass
class SceneContext:
    """构造完成的场景上下文 —— 供下游节点使用"""
    current_scene: str              # 当前场景描述
    recent_history: list[str]       # 最近 N 条压缩历史
    all_objects: list[str]          # 历史出现过的重要物体
    scene_type_trend: str           # 场景类型趋势
    has_changed: bool               # 场景是否发生变化
    compressed_context: str         # 压缩后的完整上下文文本


# ============================================================
# SceneMemoryStore
# ============================================================

class SceneMemoryStore:
    """
    视觉场景长期记忆存储

    每个会话独立维护记忆，线程安全。
    """

    def __init__(self, max_rounds: int = 10):
        self._max_rounds = max_rounds
        self._store: dict[str, list[SceneRecord]] = {}
        self._global_objects: dict[str, OrderedDict[str, float]] = {}
        self._lock = threading.Lock()

    # ============================================================
    # 写入
    # ============================================================

    def save(
        self,
        session_id: str,
        vision_text: str,
    ) -> SceneRecord:
        """
        解析并保存一条视觉分析结果。

        Args:
            session_id:   会话标识
            vision_text:  Vision API 返回的结构化文本

        Returns:
            创建的 SceneRecord
        """
        with self._lock:
            records = self._get_or_create(session_id)
            prev = records[-1] if records else None

            # 解析视觉文本
            record = self._parse_vision_text(vision_text, prev)

            # 时间戳
            record.timestamp = time.time()

            # 新增
            records.append(record)

            # LRU 淘汰
            while len(records) > self._max_rounds:
                removed = records.pop(0)
                logger.debug(
                    f"[{session_id}] 淘汰场景: {removed.to_compact_str()}"
                )

            # 更新全局物体列表
            self._update_global_objects(session_id, record.key_objects)

            logger.info(
                f"[{session_id}] 场景记忆保存 | "
                f"轮数={len(records)}/{self._max_rounds} | "
                f"类型={record.scene_type} | "
                f"物体={record.key_objects} | "
                f"人物={record.people_count}"
            )

            return record

    # ============================================================
    # 读取 + 构造上下文
    # ============================================================

    def build_scene_context(self, session_id: str) -> SceneContext:
        """
        构造 Scene Context —— 供 reasoning_node 和 response_node 使用。

        包含:
        - 当前场景
        - 最近 N 条压缩历史
        - 历史重要物体
        - 场景类型趋势
        - 变化检测
        """
        with self._lock:
            records = self._store.get(session_id, [])

        if not records:
            return SceneContext(
                current_scene="",
                recent_history=[],
                all_objects=[],
                scene_type_trend="无场景数据",
                has_changed=False,
                compressed_context="无历史场景记录",
            )

        # 当前场景
        current = records[-1]

        # 压缩历史（排除当前）
        history = [
            r.to_compact_str()
            for r in records[-6:-1]   # 最近 5 条（不含当前）
        ]

        # 全局重要物体（出现 2 次以上视为重要）
        all_objects = self.get_important_objects(session_id, min_occurrences=2)

        # 场景类型趋势
        type_counter = Counter(r.scene_type for r in records)
        top_type = type_counter.most_common(1)[0][0] if type_counter else "未知"
        type_dist = " → ".join(r.scene_type for r in records[-5:])

        # 变化检测
        has_changed = bool(current.change_from_prev)

        # 压缩上下文文本
        lines = [
            f"📍 当前: {current.to_compact_str()}",
            f"🕐 最近: " + (" | ".join(history) if history else "首次场景"),
            f"📦 重要物体: " + ("、".join(all_objects[:8]) if all_objects else "无"),
            f"📊 场景趋势: {type_dist} (主导: {top_type})",
        ]
        if has_changed:
            lines.insert(1, f"⚠️ 变化: {current.change_from_prev}")

        compressed = "\n".join(lines)

        logger.debug(
            f"[{session_id}] SceneContext 构建 | "
            f"历史={len(history)}条 | 物体={len(all_objects)}个"
        )

        return SceneContext(
            current_scene=current.scene_summary,
            recent_history=history,
            all_objects=all_objects,
            scene_type_trend=type_dist,
            has_changed=has_changed,
            compressed_context=compressed,
        )

    # ============================================================
    # 查询
    # ============================================================

    def get_recent(self, session_id: str, n: int = 5) -> list[SceneRecord]:
        """获取最近 N 条场景记录"""
        with self._lock:
            records = self._store.get(session_id, [])
        return records[-n:]

    def get_important_objects(
        self, session_id: str, min_occurrences: int = 2
    ) -> list[str]:
        """
        获取重要物体列表 —— 在历史中出现超过 min_occurrences 次的物体。

        按最近出现时间排序。
        """
        with self._lock:
            obj_map = self._global_objects.get(session_id, OrderedDict())

        # 按出现次数过滤 + 按最近时间排序
        return [
            name
            for name, last_seen in
            sorted(obj_map.items(), key=lambda x: x[1], reverse=True)
        ]

    def get_object_counts(self, session_id: str) -> dict[str, int]:
        """获取历史物体出现次数统计（从全局物体 map 派生）"""
        with self._lock:
            records = self._store.get(session_id, [])

        counter: Counter[str] = Counter()
        for r in records:
            for obj in r.key_objects:
                counter[obj] += 1
        return dict(counter.most_common(20))

    def length(self, session_id: str) -> int:
        """获取会话场景记录数"""
        with self._lock:
            return len(self._store.get(session_id, []))

    def clear(self, session_id: str) -> None:
        """清除会话所有场景记忆"""
        with self._lock:
            self._store.pop(session_id, None)
            self._global_objects.pop(session_id, None)
            logger.info(f"[{session_id}] 场景记忆已清除")

    # ============================================================
    # 统计
    # ============================================================

    def get_stats(self, session_id: str) -> dict:
        """获取记忆存储统计"""
        records = self.get_recent(session_id, n=999)
        objects = self.get_important_objects(session_id)
        scene_types = Counter(r.scene_type for r in records)

        return {
            "session_id": session_id,
            "total_scenes": len(records),
            "max_scenes": self._max_rounds,
            "unique_objects": len(objects),
            "important_objects": objects[:10],
            "dominant_scene_type": scene_types.most_common(1)[0][0] if scene_types else "未知",
            "scene_type_distribution": dict(scene_types),
            "last_scene_time": records[-1].timestamp if records else 0,
        }

    # ============================================================
    # 内部方法
    # ============================================================

    def _get_or_create(self, session_id: str) -> list[SceneRecord]:
        if session_id not in self._store:
            self._store[session_id] = []
        return self._store[session_id]

    def _update_global_objects(
        self, session_id: str, objects: list[str]
    ) -> None:
        """更新全局物体追踪表"""
        if session_id not in self._global_objects:
            self._global_objects[session_id] = OrderedDict()

        now = time.time()
        obj_map = self._global_objects[session_id]

        for obj in objects:
            obj = obj.strip().lower()
            if obj:
                obj_map[obj] = now
                obj_map.move_to_end(obj)

        # 限制最多追踪 50 个物体
        while len(obj_map) > 50:
            obj_map.popitem(last=False)

    def _parse_vision_text(
        self,
        vision_text: str,
        prev_record: Optional[SceneRecord],
    ) -> SceneRecord:
        """
        从 Vision API 返回文本中提取结构化信息。

        尝试解析 JSON，失败则使用规则提取。
        """
        objects: list[str] = []
        scene_summary = ""
        people_count = 0
        scene_type = "unknown"

        # 尝试 JSON 解析
        try:
            data = json.loads(vision_text)
            scene_summary = data.get("summary", data.get("scene", ""))
            raw_objects = data.get("objects", [])
            if isinstance(raw_objects, list):
                objects = [
                    obj["name"] if isinstance(obj, dict) else str(obj)
                    for obj in raw_objects
                ]
            people_data = data.get("people", [])
            if isinstance(people_data, list):
                people_count = sum(
                    p.get("count", 0) if isinstance(p, dict) else 1
                    for p in people_data
                )
        except (json.JSONDecodeError, TypeError):
            # 规则提取：从文本中解析
            objects = self._extract_objects_from_text(vision_text)
            # 取前 100 字符作为摘要
            scene_summary = vision_text[:100].strip()

        # 场景类型推断
        scene_type = self._classify_scene_type(vision_text, objects)

        # 变化检测
        change_desc = ""
        if prev_record:
            change_desc = self._detect_change(prev_record, objects, scene_type)

        return SceneRecord(
            timestamp=0,   # 由 save() 覆盖
            scene_summary=scene_summary,
            key_objects=objects,
            people_count=people_count,
            scene_type=scene_type,
            full_description=vision_text,
            change_from_prev=change_desc,
        )

    @staticmethod
    def _extract_objects_from_text(text: str) -> list[str]:
        """从非 JSON 文本中提取物体名称，移除去重和清理"""
        import re

        # 先移除置信度括号: xxx(0.95) → xxx
        cleaned = re.sub(r"\([\d.]+\s*\)", "", text)
        cleaned = re.sub(r"（[\d.]+\s*）", "", cleaned)

        patterns = [
            r"物体[：:]\s*([^。\n]+)",
            r"检测[到出][：:]\s*([^。\n]+)",
            r"objects?[：:]\s*([^。\n]+)",
            r"([\w\u4e00-\u9fff]{2,})\s*\(置信度[^)]+\)",
        ]
        found = []
        for pat in patterns:
            matches = re.findall(pat, cleaned, re.IGNORECASE)
            for m in matches:
                items = re.split(r"[,，、]", m)
                for item in items:
                    item = item.strip()
                    # 移除残留括号内容
                    item = re.sub(r"\([^)]*\)", "", item).strip()
                    item = re.sub(r"（[^）]*）", "", item).strip()
                    if item and len(item) >= 2:
                        found.append(item)

        return list(dict.fromkeys(found))[:10]

    @staticmethod
    def _classify_scene_type(text: str, objects: list[str]) -> str:
        """根据文本和物体推断场景类型"""
        text_lower = text.lower()
        obj_names = " ".join(objects).lower()

        type_keywords = {
            "office": ["办公", "office", "电脑", "laptop", "键盘", "keyboard", "工位", "会议室"],
            "outdoor": ["户外", "outdoor", "天空", "sky", "树木", "tree", "街道", "马路"],
            "kitchen": ["厨房", "kitchen", "冰箱", "灶台", "微波炉", "水槽"],
            "living_room": ["客厅", "沙发", "电视", "茶几", "遥控器"],
            "classroom": ["教室", "classroom", "黑板", "白板", "讲台"],
            "coding": ["代码", "code", "IDE", "VS Code", "终端", "terminal"],
        }

        scores: Counter[str] = Counter()
        for stype, keywords in type_keywords.items():
            for kw in keywords:
                if kw in text_lower or kw in obj_names:
                    scores[stype] += 1

        return scores.most_common(1)[0][0] if scores else "general"

    @staticmethod
    def _detect_change(
        prev: SceneRecord,
        current_objects: list[str],
        current_type: str,
    ) -> str:
        """检测与上一帧的变化"""
        changes = []

        # 物体变化
        added = set(current_objects) - set(prev.key_objects)
        removed = set(prev.key_objects) - set(current_objects)

        if added:
            changes.append(f"新增: {', '.join(added)}")
        if removed:
            changes.append(f"移除: {', '.join(removed)}")
        if current_type != prev.scene_type:
            changes.append(f"场景切换: {prev.scene_type} → {current_type}")

        return "; ".join(changes) if changes else "场景保持稳定"


# ============================================================
# 全局单例
# ============================================================

scene_memory_store = SceneMemoryStore(max_rounds=10)
