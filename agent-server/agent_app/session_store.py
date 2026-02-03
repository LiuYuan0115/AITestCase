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
                    "logicalId": d.get("logicalId"),
                    "length": d.get("length"),
                    "contentType": d.get("contentType"),
                    "createdAt": d.get("createdAt"),
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
    ) -> Dict[str, Any]:
        """
        Store document in both in-memory store and ChromaDB.

        Override of SessionStore.put_doc() with vector storage.
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

        # Then delete from ChromaDB collections
        try:
            # Try to delete from session_docs collection
            try:
                self.docs_collection.delete(ids=[doc_id])
                deleted = True
                print(f"[ImprovedSessionStore] Deleted from session_docs: {doc_id[:20]}...")
            except Exception:
                pass  # Not in this collection

            # Try to delete from history_cases collection
            try:
                self.history_collection.delete(ids=[doc_id])
                deleted = True
                print(f"[ImprovedSessionStore] Deleted from history_cases: {doc_id[:20]}...")
            except Exception:
                pass  # Not in this collection

            # Try to delete from company_knowledge collection
            try:
                self.knowledge_collection.delete(ids=[doc_id])
                deleted = True
                print(f"[ImprovedSessionStore] Deleted from company_knowledge: {doc_id[:20]}...")
            except Exception:
                pass  # Not in this collection

        except Exception as e:
            print(f"[ImprovedSessionStore] ChromaDB delete failed: {e}")

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
