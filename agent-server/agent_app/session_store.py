from __future__ import annotations

import hashlib
import json
import threading
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

# ChromaDB imports for ImprovedSessionStore
try:
    from .chroma_config import get_chroma_client, get_embedding_function, COLLECTION_CONFIGS
    CHROMA_AVAILABLE = True
except ImportError:
    try:
        # Fallback for direct script execution
        from agent_app.chroma_config import get_chroma_client, get_embedding_function, COLLECTION_CONFIGS
        CHROMA_AVAILABLE = True
    except ImportError:
        CHROMA_AVAILABLE = False


def _sha256(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def auto_classify_doc(content: str, title: str = "", logical_id: str = "", kind: str = "") -> str:
    """
    自动分类文档

    Args:
        content: 文档内容
        title: 文档标题
        logical_id: 逻辑 ID
        kind: 文档类型 (main/aux/output)

    Returns:
        分类: prd/测试用例/测试点/其他
    """
    # 合并用于检测的文本
    check_text = f"{title} {logical_id} {content[:2000]}".lower()

    # 基于 logical_id 判断
    if logical_id:
        lid = logical_id.lower()
        if 'testcase' in lid or 'test_case' in lid or '用例' in lid:
            return "测试用例"
        if 'testpoint' in lid or 'test_point' in lid or '测试点' in lid:
            return "测试点"
        if 'prd' in lid or 'raw_prd' in lid:
            return "prd"

    # 基于 kind 判断
    if kind == 'output':
        # output 通常是生成的测试用例或测试点
        if '测试用例' in check_text or 'testcase' in check_text or '用例编号' in check_text:
            return "测试用例"
        if '测试点' in check_text or 'testpoint' in check_text:
            return "测试点"

    # 基于标题判断
    if title:
        title_lower = title.lower()
        if '测试用例' in title_lower or 'testcase' in title_lower:
            return "测试用例"
        if '测试点' in title_lower or 'testpoint' in title_lower:
            return "测试点"
        if 'prd' in title_lower or '需求' in title_lower or '产品文档' in title_lower:
            return "prd"

    # 基于内容关键词判断
    if '用例编号' in check_text or '测试步骤' in check_text or '预期结果' in check_text:
        return "测试用例"
    if '测试点' in check_text and ('覆盖' in check_text or '验证' in check_text):
        return "测试点"
    if '需求描述' in check_text or '功能需求' in check_text or '业务需求' in check_text:
        return "prd"

    # 基于 kind 的默认分类
    if kind == 'main':
        return "prd"
    if kind == 'aux':
        return "prd"  # 辅助文档通常也是参考资料，归为 prd

    return "其他"


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
        images: Optional[List[Dict[str, Any]]] = None,  # Week 8: 多模态图片数据
        category: Optional[str] = None,  # 文档分类: prd/测试用例/测试点/其他
        pdf_base64: Optional[str] = None,  # Gemini: PDF 原始 base64 数据
    ) -> Dict[str, Any]:
        """
        Store a doc (dedupe by content hash). If (session_id + logical_id) is provided,
        automatically updates pointer logical_id -> docId for that session.

        Args:
            content: 文档文本内容
            title: 文档标题
            kind: 文档类型 (main/aux/output)
            session_id: 会话 ID
            logical_id: 逻辑 ID（指针）
            content_type: 内容类型
            tags: 标签列表
            images: 多模态图片数据列表 [{base64, media_type, page_num, width, height}]
            category: 文档分类（如不提供则自动分类）
            pdf_base64: PDF 原始 base64 数据（Gemini 模型直传用）
        """
        content = content or ""
        h = _sha256(content)
        doc_id = f"sha256:{h}"
        now = int(time.time())
        length = len(content)
        ctype = content_type or "text/markdown"

        # 自动分类（如果未提供）
        if not category:
            category = auto_classify_doc(content, title or "", logical_id or "", kind or "")

        with self._lock:
            is_new = False
            if doc_id not in self._docs:
                is_new = True
                self._docs[doc_id] = {
                    "docId": doc_id,
                    "hash": h,
                    "title": title,
                    "kind": kind,
                    "category": category,  # 文档分类
                    "logicalId": logical_id,
                    "contentType": ctype,
                    "length": length,
                    "tags": tags or [],
                    "content": content,
                    "createdAt": now,
                    "images": images or [],  # Week 8: 存储图片数据
                    "pdf_base64": pdf_base64,  # Gemini: PDF 原始数据
                    "multimodal": bool((images and len(images) > 0) or pdf_base64),
                }
            else:
                # allow backfill title/kind/logicalId/contentType/tags/images/category
                d = self._docs[doc_id]
                if title and not d.get("title"):
                    d["title"] = title
                if kind and not d.get("kind"):
                    d["kind"] = kind
                if category and not d.get("category"):
                    d["category"] = category
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
                # 补充图片数据（如果之前没有）
                if images and not d.get("images"):
                    d["images"] = images
                    d["multimodal"] = True
                # 补充 PDF 原始数据（如果之前没有）
                if pdf_base64 and not d.get("pdf_base64"):
                    d["pdf_base64"] = pdf_base64
                    d["multimodal"] = True

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
                "category": doc.get("category"),  # 返回分类
                "logicalId": logical_id or doc.get("logicalId"),
                "length": doc.get("length"),
                "contentType": doc.get("contentType"),
                "createdAt": doc.get("createdAt"),
                "isNew": is_new,
            }

    def get_doc(self, doc_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._docs.get(doc_id)

    def delete_doc(self, doc_id: str, session_id: Optional[str] = None) -> bool:
        """
        Delete a document from the store.

        Args:
            doc_id: Document ID to delete
            session_id: Optional session ID to clean up session association

        Returns:
            True if document was deleted, False if not found
        """
        with self._lock:
            if doc_id not in self._docs:
                return False

            # Remove from docs
            del self._docs[doc_id]

            # Remove from session_docs if session_id provided
            if session_id and session_id in self._session_docs:
                if doc_id in self._session_docs[session_id]:
                    del self._session_docs[session_id][doc_id]

            # Also check all sessions for this doc_id
            for docs_map in self._session_docs.values():
                if doc_id in docs_map:
                    del docs_map[doc_id]

            return True

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
                    "category": d.get("category"),  # 文档分类
                    "logicalId": d.get("logicalId"),
                    "length": d.get("length"),
                    "contentType": d.get("contentType"),
                    "createdAt": d.get("createdAt"),
                    "multimodal": d.get("multimodal", False),  # 是否多模态文档
                })
            return docs

    def list_all_docs(self, limit: int = 100, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Return all documents metadata (no content).

        Args:
            limit: Maximum number of documents to return
            category: Optional category/kind filter

        Returns:
            List of document metadata sorted by createdAt desc
        """
        with self._lock:
            docs = []
            for doc_id, d in self._docs.items():
                # Filter by category/kind if specified
                if category and d.get("kind") != category:
                    continue
                docs.append({
                    "docId": d.get("docId"),
                    "hash": d.get("hash"),
                    "title": d.get("title"),
                    "kind": d.get("kind"),
                    "category": d.get("kind"),  # Alias for frontend compatibility
                    "logicalId": d.get("logicalId"),
                    "length": d.get("length"),
                    "contentType": d.get("contentType"),
                    "createdAt": d.get("createdAt"),
                    "tags": d.get("tags", []),
                })
            # Sort by createdAt desc
            docs.sort(key=lambda x: x.get("createdAt", 0), reverse=True)
            return docs[:limit]

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


# ==============================================================================
# ImprovedSessionStore with ChromaDB Vector Storage
# ==============================================================================


class ImprovedSessionStore(SessionStore):
    """
    Enhanced SessionStore with ChromaDB vector storage for semantic retrieval.

    Features:
    - Backward compatible with SessionStore (inherits all methods)
    - Vector similarity search using ChromaDB
    - Three separate collections: session_docs, history_cases, company_knowledge
    - Embedding cache to avoid redundant vectorization
    - Dual storage: in-memory (for compatibility) + persistent ChromaDB
    """

    def __init__(self, *, max_rounds: int = 10, cache_ttl_sec: int = 60 * 60 * 6):
        super().__init__(max_rounds=max_rounds, cache_ttl_sec=cache_ttl_sec)

        if not CHROMA_AVAILABLE:
            raise RuntimeError(
                "ChromaDB is not available. Install with: pip install chromadb sentence-transformers"
            )

        # Initialize ChromaDB client
        self.chroma_client = get_chroma_client()
        self.embedding_function = get_embedding_function()

        # Create/get collections
        self.docs_collection = self._create_collection("session_docs")
        self.history_collection = self._create_collection("history_cases")
        self.knowledge_collection = self._create_collection("company_knowledge")

        # Embedding cache: {text_hash: embedding_vector}
        self._embedding_cache: Dict[str, List[float]] = {}

    def _create_collection(self, collection_key: str):
        """
        Create or get a ChromaDB collection.

        Args:
            collection_key: Key in COLLECTION_CONFIGS (e.g., 'session_docs')

        Returns:
            ChromaDB Collection object
        """
        config = COLLECTION_CONFIGS.get(collection_key)
        if not config:
            raise ValueError(f"Unknown collection key: {collection_key}")

        collection = self.chroma_client.get_or_create_collection(
            name=config['name'],
            embedding_function=self.embedding_function,
            metadata=config['metadata']
        )
        return collection

    def _get_cached_embedding(self, text: str) -> Optional[List[float]]:
        """Get cached embedding or return None."""
        text_hash = _sha256(text)
        return self._embedding_cache.get(text_hash)

    def _cache_embedding(self, text: str, embedding: List[float]) -> None:
        """Cache an embedding vector."""
        text_hash = _sha256(text)
        self._embedding_cache[text_hash] = embedding

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
        images: Optional[List[Dict[str, Any]]] = None,  # Week 8: 多模态图片数据
        category: Optional[str] = None,  # 文档分类: prd/测试用例/测试点/其他
        pdf_base64: Optional[str] = None,  # Gemini: PDF 原始 base64 数据
    ) -> Dict[str, Any]:
        """
        Store document in both in-memory store and ChromaDB.

        Override of SessionStore.put_doc() with vector storage.

        Args:
            content: 文档文本内容
            title: 文档标题
            kind: 文档类型 (main/aux/output)
            session_id: 会话 ID
            logical_id: 逻辑 ID（指针）
            content_type: 内容类型
            tags: 标签列表
            images: 多模态图片数据列表 [{base64, media_type, page_num, width, height}]
            category: 文档分类（如不提供则自动分类）
            pdf_base64: PDF 原始 base64 数据（Gemini 模型直传用）
        """
        # First, store in parent class (in-memory)
        result = super().put_doc(
            content=content,
            title=title,
            kind=kind,
            session_id=session_id,
            logical_id=logical_id,
            content_type=content_type,
            tags=tags,
            images=images,  # Week 8: 传递图片数据
            category=category,  # 传递分类
            pdf_base64=pdf_base64,  # Gemini: 传递 PDF 原始数据
        )

        doc_id = result["docId"]
        content = content or ""

        if not content.strip():
            return result

        # Store in ChromaDB
        try:
            # Prepare metadata
            metadata = {
                "title": title or "",
                "kind": kind or "unknown",
                "category": result.get("category") or "其他",  # 文档分类
                "session_id": session_id or "",
                "logical_id": logical_id or "",
                "content_type": content_type or "text/markdown",
                "tags": json.dumps(tags or []),
                "created_at": result.get("createdAt", int(time.time())),
            }

            # Add to session_docs collection
            self.docs_collection.add(
                documents=[content],
                metadatas=[metadata],
                ids=[doc_id]
            )

            # Cache the embedding (ChromaDB already computed it)
            # Note: We can't directly get the embedding from ChromaDB after add,
            # but it's already computed internally. We'll cache on retrieve.

        except Exception as e:
            # Log error but don't fail (fallback to in-memory)
            print(f"[ImprovedSessionStore] ChromaDB add failed: {e}")

        return result

    def retrieve(self, doc_ids: List[str], query: str = "", top_k: int = 5) -> List[Tuple[str, str, float]]:
        """
        Vector similarity search using ChromaDB.

        Override of SessionStore.retrieve() with semantic search.

        Args:
            doc_ids: List of document IDs to search within
            query: Search query
            top_k: Number of results to return

        Returns:
            List of (doc_id, chunk, similarity_score) tuples
        """
        if not doc_ids:
            return []

        query = (query or "").strip()

        # No query -> fallback to parent (head of each doc)
        if not query:
            return super().retrieve(doc_ids, query, top_k)

        try:
            # Vector search using ChromaDB
            # Note: We query without filtering by doc_ids, then filter results
            # ChromaDB's where clause filters by metadata, not IDs
            results = self.docs_collection.query(
                query_texts=[query],
                n_results=min(top_k * 3, 30),  # Get more candidates for filtering
                include=["documents", "metadatas", "distances"]
            )

            # Process results
            retrieved: List[Tuple[str, str, float]] = []

            if not results or not results.get('ids') or not results['ids'][0]:
                # Fallback to keyword search if no vector results
                return super().retrieve(doc_ids, query, top_k)

            for idx, (doc_id, doc_text, distance) in enumerate(zip(
                results['ids'][0],
                results['documents'][0],
                results['distances'][0]
            )):
                # ChromaDB returns distance (lower is better)
                # Convert to similarity score (higher is better)
                # Using: similarity = 1 / (1 + distance)
                similarity = 1.0 / (1.0 + float(distance))

                # Filter by doc_ids if provided
                if doc_ids and doc_id not in doc_ids:
                    continue

                retrieved.append((doc_id, doc_text, similarity))

            # Sort by similarity (descending) and limit
            retrieved.sort(key=lambda x: x[2], reverse=True)
            return retrieved[:top_k]

        except Exception as e:
            # Fallback to parent keyword search on error
            print(f"[ImprovedSessionStore] ChromaDB query failed: {e}")
            return super().retrieve(doc_ids, query, top_k)

    def get_doc(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        Get document by ID, checking both in-memory store and ChromaDB.

        Override of SessionStore.get_doc() to also check ChromaDB collections
        when document is not found in memory.
        """
        # First try in-memory (parent implementation)
        doc = super().get_doc(doc_id)
        if doc:
            return doc

        # Try ChromaDB collections
        try:
            # Check session_docs collection
            result = self.docs_collection.get(
                ids=[doc_id],
                include=["documents", "metadatas"]
            )
            if result and result.get("ids") and len(result["ids"]) > 0:
                content = result["documents"][0] if result.get("documents") else ""
                metadata = result["metadatas"][0] if result.get("metadatas") else {}
                return {
                    "docId": doc_id,
                    "content": content,
                    "title": metadata.get("title", ""),
                    "kind": metadata.get("kind", "unknown"),
                    "logicalId": metadata.get("logical_id", ""),
                    "contentType": metadata.get("content_type", "text/markdown"),
                    "createdAt": metadata.get("created_at", 0),
                    "tags": json.loads(metadata.get("tags", "[]")),
                    "source": "session_docs",
                }

            # Check history_cases collection
            result = self.history_collection.get(
                ids=[doc_id],
                include=["documents", "metadatas"]
            )
            if result and result.get("ids") and len(result["ids"]) > 0:
                content = result["documents"][0] if result.get("documents") else ""
                metadata = result["metadatas"][0] if result.get("metadatas") else {}
                return {
                    "docId": doc_id,
                    "content": content,
                    "title": metadata.get("title", ""),
                    "kind": metadata.get("kind", "history"),
                    "logicalId": metadata.get("logical_id", ""),
                    "contentType": metadata.get("content_type", "text/markdown"),
                    "createdAt": metadata.get("created_at", 0),
                    "tags": json.loads(metadata.get("tags", "[]")),
                    "source": "history_cases",
                }

            # Check company_knowledge collection
            result = self.knowledge_collection.get(
                ids=[doc_id],
                include=["documents", "metadatas"]
            )
            if result and result.get("ids") and len(result["ids"]) > 0:
                content = result["documents"][0] if result.get("documents") else ""
                metadata = result["metadatas"][0] if result.get("metadatas") else {}
                return {
                    "docId": doc_id,
                    "content": content,
                    "title": metadata.get("title", ""),
                    "kind": metadata.get("kind", "knowledge"),
                    "logicalId": metadata.get("logical_id", ""),
                    "contentType": metadata.get("content_type", "text/markdown"),
                    "createdAt": metadata.get("created_at", 0),
                    "tags": json.loads(metadata.get("tags", "[]")),
                    "source": "company_knowledge",
                }

        except Exception as e:
            print(f"[ImprovedSessionStore] ChromaDB get_doc failed: {e}")

        return None

    def delete_doc(self, doc_id: str, session_id: Optional[str] = None) -> bool:
        """
        Delete a document from both in-memory store and ChromaDB.

        Override of SessionStore.delete_doc() to also delete from ChromaDB collections.

        Args:
            doc_id: Document ID to delete
            session_id: Optional session ID to clean up session association

        Returns:
            True if document was deleted from at least one location
        """
        deleted = False

        # First delete from parent (in-memory)
        if super().delete_doc(doc_id, session_id):
            deleted = True
            print(f"[ImprovedSessionStore] Deleted from memory: {doc_id[:30]}...")

        # Then delete from ChromaDB collections
        # ChromaDB's delete() does NOT throw if the id doesn't exist,
        # so we check existence first with get() then delete.
        collections = [
            ("session_docs", self.docs_collection),
            ("history_cases", self.history_collection),
            ("company_knowledge", self.knowledge_collection),
        ]

        for col_name, collection in collections:
            try:
                # Check if doc exists in this collection before deleting
                existing = collection.get(ids=[doc_id])
                if existing and existing.get("ids") and len(existing["ids"]) > 0:
                    collection.delete(ids=[doc_id])
                    deleted = True
                    print(f"[ImprovedSessionStore] Deleted from {col_name}: {doc_id[:30]}...")
            except Exception as e:
                print(f"[ImprovedSessionStore] Failed to delete from {col_name}: {e}")

        if not deleted:
            print(f"[ImprovedSessionStore] Doc not found in any store: {doc_id[:30]}...")

        return deleted

    def archive_to_history(
        self,
        doc_id: str,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Archive a confirmed test case to history collection.

        Args:
            doc_id: Document ID to archive
            session_id: Session ID (optional)
            metadata: Additional metadata (tags, etc.)

        Returns:
            True if successful, False otherwise
        """
        doc = self.get_doc(doc_id)
        if not doc:
            return False

        content = doc.get("content", "")
        if not content.strip():
            return False

        try:
            # Generate unique history ID
            history_id = f"history_{uuid.uuid4().hex[:12]}"

            # Prepare metadata
            archive_metadata = {
                "source_doc_id": doc_id,
                "source_session_id": session_id or "",
                "title": doc.get("title", ""),
                "kind": doc.get("kind", "testcase"),
                "type": "history",
                "archived_at": datetime.now().isoformat(),
                "tags": json.dumps((metadata or {}).get("tags", [])),
            }

            # Add to history collection
            self.history_collection.add(
                documents=[content],
                metadatas=[archive_metadata],
                ids=[history_id]
            )

            return True

        except Exception as e:
            print(f"[ImprovedSessionStore] Archive failed: {e}")
            return False

    def search_history(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Search historical test cases.

        Args:
            query: Search query
            top_k: Number of results

        Returns:
            List of history records with metadata
        """
        if not query.strip():
            return []

        try:
            results = self.history_collection.query(
                query_texts=[query],
                n_results=top_k,
                include=["documents", "metadatas", "distances"]
            )

            history_records = []

            if not results or not results.get('ids') or not results['ids'][0]:
                return []

            for doc_id, doc_text, metadata, distance in zip(
                results['ids'][0],
                results['documents'][0],
                results['metadatas'][0],
                results['distances'][0]
            ):
                similarity = 1.0 / (1.0 + float(distance))

                history_records.append({
                    "id": doc_id,
                    "content": doc_text,
                    "metadata": metadata,
                    "similarity": similarity,
                })

            return history_records

        except Exception as e:
            print(f"[ImprovedSessionStore] History search failed: {e}")
            return []

    def get_collection_stats(self) -> Dict[str, int]:
        """
        Get statistics for all collections.

        Returns:
            Dict with collection names and document counts
        """
        try:
            return {
                "session_docs": self.docs_collection.count(),
                "history_cases": self.history_collection.count(),
                "company_knowledge": self.knowledge_collection.count(),
            }
        except Exception as e:
            print(f"[ImprovedSessionStore] Stats retrieval failed: {e}")
            return {
                "session_docs": 0,
                "history_cases": 0,
                "company_knowledge": 0,
            }

    def list_all_docs(
        self,
        limit: int = 100,
        category: Optional[str] = None,
        include_knowledge: bool = True
    ) -> List[Dict[str, Any]]:
        """
        List all documents from ChromaDB collections.

        Enhanced version that queries ChromaDB for comprehensive results.

        Args:
            limit: Maximum number of documents to return
            category: Optional category/kind filter
            include_knowledge: Whether to include company knowledge docs

        Returns:
            List of document metadata sorted by createdAt desc
        """
        all_docs: List[Dict[str, Any]] = []

        try:
            # Query session_docs collection
            session_results = self.docs_collection.get(
                limit=limit,
                include=["metadatas"]
            )

            if session_results and session_results.get("ids"):
                for doc_id, metadata in zip(
                    session_results["ids"],
                    session_results["metadatas"] or [{}] * len(session_results["ids"])
                ):
                    kind = metadata.get("kind", "unknown")
                    if category and kind != category:
                        continue

                    all_docs.append({
                        "docId": doc_id,
                        "title": metadata.get("title", ""),
                        "kind": kind,
                        "category": kind,
                        "logicalId": metadata.get("logical_id", ""),
                        "contentType": metadata.get("content_type", "text/markdown"),
                        "createdAt": metadata.get("created_at", 0),
                        "tags": json.loads(metadata.get("tags", "[]")),
                        "source": "session_docs",
                    })

            # Query company_knowledge collection if requested
            if include_knowledge:
                knowledge_results = self.knowledge_collection.get(
                    limit=limit,
                    include=["metadatas"]
                )

                if knowledge_results and knowledge_results.get("ids"):
                    for doc_id, metadata in zip(
                        knowledge_results["ids"],
                        knowledge_results["metadatas"] or [{}] * len(knowledge_results["ids"])
                    ):
                        kind = metadata.get("kind", "knowledge")
                        if category and kind != category:
                            continue

                        all_docs.append({
                            "docId": doc_id,
                            "title": metadata.get("title", ""),
                            "kind": kind,
                            "category": kind,
                            "logicalId": metadata.get("logical_id", ""),
                            "contentType": metadata.get("content_type", "text/markdown"),
                            "createdAt": metadata.get("created_at", 0),
                            "tags": json.loads(metadata.get("tags", "[]")),
                            "source": "company_knowledge",
                        })

            # Sort by createdAt desc
            all_docs.sort(key=lambda x: x.get("createdAt", 0), reverse=True)
            return all_docs[:limit]

        except Exception as e:
            print(f"[ImprovedSessionStore] list_all_docs failed: {e}")
            # Fallback to parent implementation
            return super().list_all_docs(limit=limit, category=category)

    # ==================================================================
    # 知识库专用方法
    # ==================================================================

    def put_knowledge_doc(
        self,
        *,
        content: str,
        title: Optional[str] = None,
        category: Optional[str] = None,
        content_type: Optional[str] = None,
        tags: Optional[List[str]] = None,
        images: Optional[List[Dict[str, Any]]] = None,
        pdf_base64: Optional[str] = None,  # Gemini: PDF 原始 base64 数据
    ) -> Dict[str, Any]:
        """
        直接存储文档到 company_knowledge collection（知识库专用）

        Args:
            content: 文档文本内容
            title: 文档标题
            category: 文档分类
            content_type: 内容类型
            tags: 标签列表
            images: 多模态图片数据
            pdf_base64: PDF 原始 base64 数据（Gemini 模型直传用）

        Returns:
            文档引用信息
        """
        content = content or ""
        h = _sha256(content)
        doc_id = f"sha256:{h}"
        now = int(time.time())

        # 自动分类（如果未提供）
        if not category:
            category = auto_classify_doc(content, title or "", "", "knowledge")

        try:
            # 准备 metadata
            metadata = {
                "title": title or "",
                "kind": "knowledge",
                "category": category,
                "content_type": content_type or "text/markdown",
                "tags": json.dumps(tags or []),
                "created_at": now,
            }

            # 检查是否已存在
            existing = self.knowledge_collection.get(ids=[doc_id])
            is_new = not (existing and existing.get("ids") and len(existing["ids"]) > 0)

            if is_new:
                # 直接添加到 company_knowledge collection
                self.knowledge_collection.add(
                    documents=[content],
                    metadatas=[metadata],
                    ids=[doc_id]
                )
            else:
                # 更新已存在的文档
                self.knowledge_collection.update(
                    ids=[doc_id],
                    documents=[content],
                    metadatas=[metadata]
                )

            # 同时存入内存（兼容性）
            with self._lock:
                if doc_id not in self._docs:
                    self._docs[doc_id] = {
                        "docId": doc_id,
                        "hash": h,
                        "title": title,
                        "kind": "knowledge",
                        "category": category,
                        "contentType": content_type or "text/markdown",
                        "length": len(content),
                        "tags": tags or [],
                        "content": content,
                        "createdAt": now,
                        "images": images or [],
                        "pdf_base64": pdf_base64,  # Gemini: PDF 原始数据
                        "multimodal": bool(images or pdf_base64),
                        "source": "company_knowledge",
                    }

            return {
                "docId": doc_id,
                "hash": h,
                "title": title,
                "kind": "knowledge",
                "category": category,
                "length": len(content),
                "contentType": content_type or "text/markdown",
                "createdAt": now,
                "isNew": is_new,
                "source": "company_knowledge",
            }

        except Exception as e:
            print(f"[ImprovedSessionStore] Knowledge add failed: {e}")
            raise

    # ==================================================================
    # 批量删除方法
    # ==================================================================

    def batch_delete_docs(
        self,
        doc_ids: List[str],
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        批量删除文档

        Args:
            doc_ids: 文档 ID 列表
            session_id: 可选会话 ID

        Returns:
            删除结果统计
        """
        results = {
            "total": len(doc_ids),
            "deleted": 0,
            "failed": 0,
            "errors": []
        }

        for doc_id in doc_ids:
            try:
                if self.delete_doc(doc_id, session_id):
                    results["deleted"] += 1
                else:
                    results["failed"] += 1
                    results["errors"].append({"docId": doc_id, "error": "未找到"})
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({"docId": doc_id, "error": str(e)})

        return results

    # ==================================================================
    # 分类管理方法
    # ==================================================================

    # 默认分类（不可删除/修改）
    DEFAULT_CATEGORIES = ['prd', '测试用例', '测试点', '其他']

    def _get_categories_file_path(self) -> str:
        """获取分类配置文件路径"""
        import os
        return os.path.join(
            os.path.dirname(__file__),
            '..', 'data', 'custom_categories.json'
        )

    def _load_custom_categories(self) -> List[str]:
        """从文件加载自定义分类"""
        import os
        categories_file = self._get_categories_file_path()
        try:
            if os.path.exists(categories_file):
                with open(categories_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"[ImprovedSessionStore] Load categories failed: {e}")
        return []

    def _save_custom_categories(self, categories: List[str]) -> None:
        """保存自定义分类到文件"""
        import os
        categories_file = self._get_categories_file_path()
        try:
            os.makedirs(os.path.dirname(categories_file), exist_ok=True)
            with open(categories_file, 'w', encoding='utf-8') as f:
                json.dump(categories, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[ImprovedSessionStore] Save categories failed: {e}")

    def get_all_categories(self) -> List[str]:
        """获取所有分类（默认 + 自定义）"""
        custom = self._load_custom_categories()
        return self.DEFAULT_CATEGORIES + custom

    def add_category(self, name: str) -> bool:
        """添加自定义分类"""
        name = name.strip()
        if not name:
            return False
        all_cats = self.get_all_categories()
        if name in all_cats:
            return False  # 已存在
        custom = self._load_custom_categories()
        custom.append(name)
        self._save_custom_categories(custom)
        return True

    def update_category(self, old_name: str, new_name: str) -> bool:
        """更新自定义分类名称"""
        old_name = old_name.strip()
        new_name = new_name.strip()
        if not new_name:
            return False
        if old_name in self.DEFAULT_CATEGORIES:
            return False  # 不能修改默认分类
        custom = self._load_custom_categories()
        if old_name not in custom:
            return False
        if new_name in self.get_all_categories():
            return False  # 新名称已存在

        idx = custom.index(old_name)
        custom[idx] = new_name
        self._save_custom_categories(custom)

        # 更新所有使用该分类的文档
        self._update_docs_category(old_name, new_name)
        return True

    def delete_category(self, name: str, move_to: str = '其他') -> bool:
        """删除自定义分类，将文档移动到指定分类"""
        name = name.strip()
        if name in self.DEFAULT_CATEGORIES:
            return False  # 不能删除默认分类
        custom = self._load_custom_categories()
        if name not in custom:
            return False

        custom.remove(name)
        self._save_custom_categories(custom)

        # 将该分类下的文档移动到目标分类
        self._update_docs_category(name, move_to)
        return True

    def _update_docs_category(self, old_category: str, new_category: str) -> None:
        """更新所有使用指定分类的文档"""
        try:
            # 更新 company_knowledge collection
            results = self.knowledge_collection.get(
                where={"category": old_category},
                include=["metadatas"]
            )
            if results and results.get("ids"):
                for doc_id, metadata in zip(results["ids"], results["metadatas"]):
                    metadata["category"] = new_category
                    self.knowledge_collection.update(
                        ids=[doc_id],
                        metadatas=[metadata]
                    )

            # 更新 session_docs collection
            results = self.docs_collection.get(
                where={"category": old_category},
                include=["metadatas"]
            )
            if results and results.get("ids"):
                for doc_id, metadata in zip(results["ids"], results["metadatas"]):
                    metadata["category"] = new_category
                    self.docs_collection.update(
                        ids=[doc_id],
                        metadatas=[metadata]
                    )

            # 更新内存中的文档
            with self._lock:
                for doc in self._docs.values():
                    if doc.get("category") == old_category:
                        doc["category"] = new_category

        except Exception as e:
            print(f"[ImprovedSessionStore] Update docs category failed: {e}")
