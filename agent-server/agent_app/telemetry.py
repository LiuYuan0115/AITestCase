"""
Telemetry - 可观测性数据收集
Phase 7: 收集和暴露运行时指标

收集指标：
- attachments_count: 附件数量
- attachments_types: 附件类型列表
- file_parse_duration_ms: 解析耗时
- prompt_length_chars: prompt 长度
- rag_chunks_used: RAG 使用的 chunks 数
- input_tokens / output_tokens: Token 统计
- error_code / error_message: 失败原因
"""

import time
import uuid
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict
from threading import Lock
from contextlib import contextmanager

logger = logging.getLogger(__name__)


@dataclass
class RequestTelemetry:
    """单次请求的遥测数据"""
    request_id: str
    session_id: Optional[str] = None
    endpoint: str = ""
    method: str = "POST"
    start_time: float = field(default_factory=time.time)
    end_time: Optional[float] = None

    # 阶段耗时（毫秒）
    phases: Dict[str, int] = field(default_factory=dict)

    # 附件信息
    attachments_count: int = 0
    attachments_types: List[str] = field(default_factory=list)
    attachments_total_size: int = 0

    # 解析信息
    file_parse_duration_ms: int = 0
    files_parsed: int = 0

    # Prompt 信息
    prompt_length_chars: int = 0
    system_prompt_length: int = 0
    user_prompt_length: int = 0

    # Token 统计
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0

    # RAG 信息
    rag_enabled: bool = False
    rag_chunks_retrieved: int = 0
    rag_chunks_used: int = 0
    rag_query_duration_ms: int = 0

    # 结果信息
    status: str = "pending"  # pending, success, error
    error_code: Optional[str] = None
    error_message: Optional[str] = None

    # 自定义属性
    custom: Dict[str, Any] = field(default_factory=dict)

    @property
    def duration_ms(self) -> int:
        if self.end_time is None:
            return int((time.time() - self.start_time) * 1000)
        return int((self.end_time - self.start_time) * 1000)

    def mark_phase(self, phase_name: str, duration_ms: int):
        """记录阶段耗时"""
        self.phases[phase_name] = duration_ms

    def mark_error(self, code: str, message: str):
        """标记错误"""
        self.status = "error"
        self.error_code = code
        self.error_message = message

    def mark_success(self):
        """标记成功"""
        self.status = "success"
        self.end_time = time.time()

    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            "request_id": self.request_id,
            "session_id": self.session_id,
            "endpoint": self.endpoint,
            "method": self.method,
            "duration_ms": self.duration_ms,
            "phases": self.phases,
            "attachments": {
                "count": self.attachments_count,
                "types": self.attachments_types,
                "total_size": self.attachments_total_size,
            },
            "parsing": {
                "duration_ms": self.file_parse_duration_ms,
                "files_parsed": self.files_parsed,
            },
            "prompt": {
                "total_length": self.prompt_length_chars,
                "system_length": self.system_prompt_length,
                "user_length": self.user_prompt_length,
            },
            "tokens": {
                "input": self.input_tokens,
                "output": self.output_tokens,
                "total": self.total_tokens,
            },
            "rag": {
                "enabled": self.rag_enabled,
                "chunks_retrieved": self.rag_chunks_retrieved,
                "chunks_used": self.rag_chunks_used,
                "query_duration_ms": self.rag_query_duration_ms,
            },
            "status": self.status,
            "error": {
                "code": self.error_code,
                "message": self.error_message,
            } if self.error_code else None,
            "custom": self.custom,
            "timestamp": datetime.fromtimestamp(self.start_time).isoformat(),
        }


class TelemetryCollector:
    """遥测数据收集器"""

    def __init__(self, max_history: int = 1000):
        self._history: List[RequestTelemetry] = []
        self._current: Dict[str, RequestTelemetry] = {}
        self._max_history = max_history
        self._lock = Lock()

        # 聚合统计
        self._stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "total_tokens": 0,
            "total_duration_ms": 0,
            "endpoints": defaultdict(int),
            "error_codes": defaultdict(int),
        }

    def start_request(
        self,
        endpoint: str,
        session_id: Optional[str] = None,
        method: str = "POST",
    ) -> str:
        """开始记录请求"""
        request_id = str(uuid.uuid4())[:8]
        telemetry = RequestTelemetry(
            request_id=request_id,
            session_id=session_id,
            endpoint=endpoint,
            method=method,
        )

        with self._lock:
            self._current[request_id] = telemetry
            self._stats["total_requests"] += 1
            self._stats["endpoints"][endpoint] += 1

        return request_id

    def get_current(self, request_id: str) -> Optional[RequestTelemetry]:
        """获取当前请求的遥测数据"""
        return self._current.get(request_id)

    def end_request(self, request_id: str) -> Optional[RequestTelemetry]:
        """结束记录请求"""
        with self._lock:
            telemetry = self._current.pop(request_id, None)

            if telemetry:
                telemetry.end_time = time.time()

                # 更新聚合统计
                if telemetry.status == "success":
                    self._stats["successful_requests"] += 1
                else:
                    self._stats["failed_requests"] += 1
                    if telemetry.error_code:
                        self._stats["error_codes"][telemetry.error_code] += 1

                self._stats["total_tokens"] += telemetry.total_tokens
                self._stats["total_duration_ms"] += telemetry.duration_ms

                # 添加到历史
                self._history.append(telemetry)

                # 限制历史大小
                if len(self._history) > self._max_history:
                    self._history = self._history[-self._max_history:]

            return telemetry

    @contextmanager
    def track_phase(self, request_id: str, phase_name: str):
        """跟踪阶段耗时"""
        telemetry = self.get_current(request_id)
        start = time.time()
        try:
            yield telemetry
        finally:
            if telemetry:
                duration_ms = int((time.time() - start) * 1000)
                telemetry.mark_phase(phase_name, duration_ms)

    def get_history(
        self,
        limit: int = 100,
        session_id: Optional[str] = None,
        endpoint: Optional[str] = None,
    ) -> List[Dict]:
        """获取历史记录"""
        with self._lock:
            history = list(self._history)

        if session_id:
            history = [t for t in history if t.session_id == session_id]

        if endpoint:
            history = [t for t in history if t.endpoint == endpoint]

        # 按时间倒序
        history.sort(key=lambda t: t.start_time, reverse=True)

        return [t.to_dict() for t in history[:limit]]

    def get_stats(self) -> Dict:
        """获取聚合统计"""
        with self._lock:
            avg_duration = 0
            if self._stats["total_requests"] > 0:
                avg_duration = self._stats["total_duration_ms"] / self._stats["total_requests"]

            return {
                "total_requests": self._stats["total_requests"],
                "successful_requests": self._stats["successful_requests"],
                "failed_requests": self._stats["failed_requests"],
                "success_rate": (
                    self._stats["successful_requests"] / self._stats["total_requests"] * 100
                    if self._stats["total_requests"] > 0 else 0
                ),
                "total_tokens": self._stats["total_tokens"],
                "avg_duration_ms": int(avg_duration),
                "endpoints": dict(self._stats["endpoints"]),
                "error_codes": dict(self._stats["error_codes"]),
                "active_requests": len(self._current),
            }

    def get_request(self, request_id: str) -> Optional[Dict]:
        """获取单个请求的遥测数据"""
        # 先查当前
        telemetry = self._current.get(request_id)
        if telemetry:
            return telemetry.to_dict()

        # 再查历史
        with self._lock:
            for t in reversed(self._history):
                if t.request_id == request_id:
                    return t.to_dict()

        return None

    def clear_history(self):
        """清除历史"""
        with self._lock:
            self._history.clear()


# 全局遥测收集器
_collector: Optional[TelemetryCollector] = None


def get_telemetry_collector() -> TelemetryCollector:
    """获取全局遥测收集器"""
    global _collector
    if _collector is None:
        _collector = TelemetryCollector()
    return _collector


# ==========================================
# 便捷函数
# ==========================================

def start_telemetry(endpoint: str, session_id: Optional[str] = None) -> str:
    """开始遥测"""
    return get_telemetry_collector().start_request(endpoint, session_id)


def get_telemetry(request_id: str) -> Optional[RequestTelemetry]:
    """获取遥测数据"""
    return get_telemetry_collector().get_current(request_id)


def end_telemetry(request_id: str) -> Optional[RequestTelemetry]:
    """结束遥测"""
    return get_telemetry_collector().end_request(request_id)


def track_phase(request_id: str, phase_name: str):
    """跟踪阶段"""
    return get_telemetry_collector().track_phase(request_id, phase_name)


def record_tokens(request_id: str, input_tokens: int, output_tokens: int):
    """记录 Token 使用"""
    telemetry = get_telemetry(request_id)
    if telemetry:
        telemetry.input_tokens = input_tokens
        telemetry.output_tokens = output_tokens
        telemetry.total_tokens = input_tokens + output_tokens


def record_rag(
    request_id: str,
    chunks_retrieved: int,
    chunks_used: int,
    query_duration_ms: int = 0,
):
    """记录 RAG 使用"""
    telemetry = get_telemetry(request_id)
    if telemetry:
        telemetry.rag_enabled = True
        telemetry.rag_chunks_retrieved = chunks_retrieved
        telemetry.rag_chunks_used = chunks_used
        telemetry.rag_query_duration_ms = query_duration_ms


def record_attachments(
    request_id: str,
    count: int,
    types: List[str],
    total_size: int = 0,
):
    """记录附件信息"""
    telemetry = get_telemetry(request_id)
    if telemetry:
        telemetry.attachments_count = count
        telemetry.attachments_types = types
        telemetry.attachments_total_size = total_size


def record_prompt(
    request_id: str,
    system_length: int = 0,
    user_length: int = 0,
):
    """记录 Prompt 长度"""
    telemetry = get_telemetry(request_id)
    if telemetry:
        telemetry.system_prompt_length = system_length
        telemetry.user_prompt_length = user_length
        telemetry.prompt_length_chars = system_length + user_length


def record_error(request_id: str, code: str, message: str):
    """记录错误"""
    telemetry = get_telemetry(request_id)
    if telemetry:
        telemetry.mark_error(code, message)
