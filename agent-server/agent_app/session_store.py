"""
会话上下文存储（当前使用内存字典，后续可替换 Redis）
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List


Message = dict  # OpenAI messages 结构：{"role": "...", "content": "...", ...}


@dataclass
class SessionStore:
    """
    简单会话存储：
    - 每个 sessionId 保存最近 N 轮对话（user/assistant 交替）
    - 生产环境建议换 Redis 或 LangGraph Checkpointer
    """

    max_rounds: int = 10
    _contexts: Dict[str, List[Message]] = None

    def __post_init__(self) -> None:
        if self._contexts is None:
            self._contexts = {}

    def get(self, session_id: str) -> List[Message]:
        return self._contexts.get(session_id, [])

    def append(self, session_id: str, role: str, content: str) -> None:
        if session_id not in self._contexts:
            self._contexts[session_id] = []
        self._contexts[session_id].append({"role": role, "content": content})

        # 滑动窗口：保留最近 max_rounds*2 条消息
        max_messages = self.max_rounds * 2
        if len(self._contexts[session_id]) > max_messages:
            self._contexts[session_id] = self._contexts[session_id][-max_messages:]

    def clear(self, session_id: str) -> None:
        if session_id in self._contexts:
            del self._contexts[session_id]


