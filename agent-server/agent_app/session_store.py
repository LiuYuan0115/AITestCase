from __future__ import annotations

import hashlib
import json
import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


def _sha256(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def _stable_dumps(obj: Any) -> str:
    """Stable JSON stringify for cache keys."""
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


@dataclass
class Message:
    role: str
    content: str
    ts: int


class SessionStore:
    """
    In-memory session store (messages + doc store + result cache + pointers).

    - docId = sha256(content) (immutable content version)
    - logicalId = "current pointer" within a session (mutable pointer -> docId)
    """

    def __init__(self, *, max_rounds: int = 10, cache_ttl_sec: int = 60 * 60 * 6):
        self.max_rounds = max_rounds
        self.cache_ttl_sec = cache_ttl_sec

        self._lock = threading.RLock()

        # sessionId -> [Message...]
        self._sessions: Dict[str, List[Message]] = {}

        # docId -> doc record
        self._docs: Dict[str, Dict[str, Any]] = {}

        # sessionId -> set(docId)
        self._session_docs: Dict[str, Dict[str, int]] = {}  # docId -> createdAt

        # sessionId -> pointers (logicalId -> docId)
        self._pointers: Dict[str, Dict[str, str]] = {}

        # cacheKey -> {"value": dict, "ts": int}
        self._cache: Dict[str, Dict[str, Any]] = {}

    # ------------------------------------------------------------------
    # Session messages
    # ------------------------------------------------------------------

    def get(self, session_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            msgs = self._sessions.get(session_id, [])
            return [{"role": m.role, "content": m.content, "ts": m.ts} for m in msgs]

    def append(self, session_id: str, role: str, content: str) -> None:
        if not session_id:
            return
        with self._lock:
            msgs = self._sessions.setdefault(session_id, [])
            msgs.append(Message(role=role, content=content or "", ts=int(time.time())))
            # keep last N rounds (user+assistant = 2 messages per round)
            max_msgs = max(2, self.max_rounds * 2)
            if len(msgs) > max_msgs:
                self._sessions[session_id] = msgs[-max_msgs:]

    def clear(self, session_id: str) -> None:
        """清除指定会话的所有数据（消息、文档关联、指针）"""
        if not session_id:
            return
        with self._lock:
            self._sessions.pop(session_id, None)
            self._session_docs.pop(session_id, None)
            self._pointers.pop(session_id, None)

    # ------------------------------------------------------------------
    # Cache
    # ------------------------------------------------------------------

    def make_cache_key(self, payload: Dict[str, Any]) -> str:
        return "sha256:" + _sha256(_stable_dumps(payload))

    def cache_get(self, key: str) -> Optional[Dict[str, Any]]:
        if not key:
            return None
        with self._lock:
            ent = self._cache.get(key)
            if not ent:
                return None
            ts = ent.get("ts", 0)
            if self.cache_ttl_sec and (int(time.time()) - int(ts)) > int(self.cache_ttl_sec):
                # expired
                self._cache.pop(key, None)
                return None
            val = ent.get("value")
            return val if isinstance(val, dict) else None

    def cache_set(self, key: str, value: Dict[str, Any]) -> None:
        if not key:
            return
        with self._lock:
            self._cache[key] = {"ts": int(time.time()), "value": value or {}}

    # ------------------------------------------------------------------
    # DocStore
    # ------------------------------------------------------------------

    def put_doc(
        self,
        *,
        content: str,
        title: Optional[str] = None,
        kind: Optional[str] = None,
        session_id: Optional[str] = None,
        logical_id: Optional[str] = None,
        content_type: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Store a doc (dedupe by content hash). If (session_id + logical_id) is provided,
        automatically updates pointer logical_id -> docId for that session.
        """
        content = content or ""
        h = _sha256(content)
        doc_id = f"sha256:{h}"
        now = int(time.time())
        length = len(content)
        ctype = content_type or "text/markdown"

        with self._lock:
            is_new = False
            if doc_id not in self._docs:
                is_new = True
                self._docs[doc_id] = {
                    "docId": doc_id,
                    "hash": h,
                    "title": title,
                    "kind": kind,
                    "logicalId": logical_id,
                    "contentType": ctype,
                    "length": length,
                    "tags": tags or [],
                    "content": content,
                    "createdAt": now,
                }
            else:
                # allow backfill title/kind/logicalId/contentType/tags
                d = self._docs[doc_id]
                if title and not d.get("title"):
                    d["title"] = title
                if kind and not d.get("kind"):
                    d["kind"] = kind
                if logical_id and not d.get("logicalId"):
                    d["logicalId"] = logical_id
                if ctype and not d.get("contentType"):
                    d["contentType"] = ctype
                if tags:
                    exist = set(d.get("tags") or [])
                    for t in tags:
                        if t not in exist:
                            exist.add(t)
                    d["tags"] = list(exist)

            # bind to session
            if session_id:
                m = self._session_docs.setdefault(session_id, {})
                if doc_id not in m:
                    m[doc_id] = self._docs[doc_id].get("createdAt", now)

            # update pointer
            if session_id and logical_id:
                self.set_pointer(session_id, logical_id, doc_id)

            doc = self._docs[doc_id]
            return {
                "docId": doc_id,
                "hash": doc.get("hash"),
                "title": doc.get("title"),
                "kind": doc.get("kind"),
                "logicalId": logical_id or doc.get("logicalId"),
                "length": doc.get("length"),
                "contentType": doc.get("contentType"),
                "createdAt": doc.get("createdAt"),
                "isNew": is_new,
            }

    def get_doc(self, doc_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._docs.get(doc_id)

    def resolve_docs(self, doc_refs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for ref in doc_refs or []:
            did = (ref or {}).get("docId")
            if not did:
                continue
            d = self.get_doc(did)
            if d:
                out.append(d)
        return out

    def list_session_docs(self, session_id: str) -> List[Dict[str, Any]]:
        """Return doc metadata for a session (no content)."""
        with self._lock:
            ids = list((self._session_docs.get(session_id) or {}).items())
            # sort by createdAt desc
            ids.sort(key=lambda x: x[1], reverse=True)
            docs = []
            for did, _ts in ids:
                d = self._docs.get(did)
                if not d:
                    continue
                docs.append({
                    "docId": d.get("docId"),
                    "hash": d.get("hash"),
                    "title": d.get("title"),
                    "kind": d.get("kind"),
                    "logicalId": d.get("logicalId"),
                    "length": d.get("length"),
                    "contentType": d.get("contentType"),
                    "createdAt": d.get("createdAt"),
                })
            return docs

    def retrieve(self, doc_ids: List[str], query: str = "", top_k: int = 5) -> List[Tuple[str, str, float]]:
        """
        Minimal retrieval: keyword match paragraphs.
        Returns: [(doc_id, chunk, score), ...]
        """
        if not doc_ids:
            return []

        query = (query or "").strip()
        # no query -> return head of each doc
        if not query:
            results = []
            for did in doc_ids[:top_k]:
                doc = self.get_doc(did) or {}
                content = (doc.get("content") or "")[:2000]
                if content:
                    results.append((did, content, 1.0))
            return results

        query_lower = query.lower()
        query_words = [w for w in query_lower.split() if len(w) > 1] or [query_lower]

        results: List[Tuple[str, str, float]] = []
        for did in doc_ids:
            doc = self.get_doc(did) or {}
            content = doc.get("content") or ""
            if not content:
                continue
            paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
            for para in paragraphs[:80]:
                para_lower = para.lower()
                matched = sum(1 for w in query_words if w in para_lower)
                if matched <= 0:
                    continue
                score = matched / max(len(query_words), 1)
                results.append((did, para[:1500], float(score)))

        results.sort(key=lambda x: x[2], reverse=True)
        return results[:top_k]

    # ------------------------------------------------------------------
    # Pointers
    # ------------------------------------------------------------------

    def get_pointers(self, session_id: str) -> Dict[str, str]:
        with self._lock:
            return dict(self._pointers.get(session_id, {}) or {})

    def get_pointer(self, session_id: str, logical_id: str) -> Optional[str]:
        """获取单个 logicalId 对应的 docId"""
        with self._lock:
            pointers = self._pointers.get(session_id, {})
            return pointers.get(logical_id)

    def set_pointer(self, session_id: str, logical_id: str, doc_id: str) -> Dict[str, str]:
        if not session_id or not logical_id or not doc_id:
            return self.get_pointers(session_id)
        with self._lock:
            p = self._pointers.setdefault(session_id, {})
            p[logical_id] = doc_id
            return dict(p)

    def update_pointers(self, session_id: str, updates: Dict[str, str]) -> Dict[str, str]:
        with self._lock:
            p = self._pointers.setdefault(session_id, {})
            for k, v in (updates or {}).items():
                if k and v:
                    p[k] = v
            return dict(p)
