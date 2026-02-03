from __future__ import annotations

import hashlib
import os
import re
import json
from typing import Any, Dict, List, Optional, Tuple, TypedDict

from langgraph.graph import END, StateGraph

from agent_app.ask_config import AskTypeConfig, get_ask_config
from agent_app.session_store import SessionStore, ImprovedSessionStore


def _sha256(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


class DocRefMiss(RuntimeError):
    """Raised when a referenced docId is not present in DocStore."""
    def __init__(self, doc_id: str):
        super().__init__(f"DOCREF_MISS: {doc_id}")
        self.code = "DOCREF_MISS"
        self.docId = doc_id


class AdditionalPrdItem(TypedDict):
    title: str
    content: str


class DocRef(TypedDict, total=False):
    docId: str
    logicalId: str
    title: str
    hash: str
    kind: str  # main|aux|output
    length: int
    contentType: str
    createdAt: int


class AskState(TypedDict, total=False):
    # request
    sessionId: str
    code: str
    type: str
    text: str
    additionalPrds: List[AdditionalPrdItem]
    docRefs: List[DocRef]
    instruction: str
    targetLogicalId: str  # chat/edit target (optional)

    # runtime
    effectiveText: str
    messages: List[Dict[str, Any]]
    modelMessage: Any
    answer: str
    config: Any

    # docstore / optimization
    cacheKey: str
    cached: bool
    usedDocIds: List[str]
    storedDocRefs: List[DocRef]   # docs newly stored in this call (optional)
    usedDocRefs: List[DocRef]     # docs used to build prompt (always present)
    generatedDocRef: Optional[DocRef]

    # chat intent (for *_chat types)
    chatIntent: str               # analysis | edit
    updatedDocument: str          # full markdown when edit
    editSummary: str              # short summary when edit


def build_ask_graph(
    openai_client,
    model_name: str,
    session_store: Optional[SessionStore] = None,
    anthropic_client=None,
):
    """
    Natural language -> docRefs/text -> prompt -> call LLM -> store output -> pointers

    Compatibility:
    - Old: params.text + additionalPrds
    - New: docRefs-only (params.text can be empty)
    """
    session_store = session_store or SessionStore(max_rounds=10)

    def is_anthropic_model(model: str) -> bool:
        return isinstance(model, str) and (model.startswith("anthropic/") or "claude" in model.lower())

    def _strip_markdown_fence(text: str) -> str:
        if not text:
            return ""
        t = text.strip()
        if t.startswith("```"):
            t = re.sub(r"^```[a-zA-Z0-9_-]*\s*", "", t)
            t = re.sub(r"\s*```$", "", t)
        return t.strip()

    def _extract_json(text: str) -> Optional[dict]:
        """Extract first JSON object from a model output (tolerate leading/trailing text)."""
        if not text:
            return None
        t = text.strip()
        i, j = t.find("{"), t.rfind("}")
        if i == -1 or j == -1 or j <= i:
            return None
        try:
            return json.loads(t[i : j + 1])
        except Exception:
            return None

    # -------------------------
    # Chat intent helpers
    # -------------------------
    _EDIT_HINTS = [
        "修改","改成","替换","删除","删掉","加上","新增","补充","调整","润色","重写","改写","合并","整理",
        "rewrite","edit","update","remove","delete","add","insert","revise","polish"
    ]
    _ANALYSIS_HINTS = ["分析","解释","为什么","怎么","评审","review","风险","建议","对比","有什么问题","关注点"]

    def _quick_intent(user_input: str) -> str:
        t = (user_input or "").lower()
        if any(k.lower() in t for k in _EDIT_HINTS):
            return "edit"
        if any(k.lower() in t for k in _ANALYSIS_HINTS):
            return "analysis"
        return "unknown"

    def _build_chat_messages(
        stage_type: str, 
        doc_content: str, 
        user_input: str,
        candidates: Optional[List[Dict[str, Any]]] = None,  # ✅ 新增：候选文档列表
    ) -> List[Dict[str, Any]]:
        """
        Build chat messages for analysis/edit.
        If candidates is provided (multiple main docs), let model choose target.
        """
        stage_name = {
            "prd_chat": "PRD",
            "testpoint_chat": "测试点",
            "testcase_chat": "测试用例",
        }.get(stage_type, "文档")

        # ✅ 多候选模式：让模型选择目标文档
        if candidates and len(candidates) > 1:
            candidate_list = "\n".join([
                f"- logicalId=\"{c.get('logicalId', '')}\" 标题=\"{c.get('title', '')}\" (长度={len(c.get('content', ''))}字符)"
                for c in candidates
            ])
            
            system = f"""
你是资深测试/产品文档助手。用户 @ 引用了多个文档，你需要：
1. 判断用户意图（analysis 或 edit）
2. 确定用户最可能要操作的目标文档（targetLogicalId）

候选文档列表：
{candidate_list}

输出必须是严格 JSON（不要 markdown，不要代码块），格式如下：

{{
  "intent": "analysis" | "edit",
  "targetLogicalId": "...",           // 必填：你选择的目标文档 logicalId
  "reply": "...",
  "editSummary": "...",               // intent=edit 必填
  "updatedDocument": "..."            // intent=edit 必填，完整 Markdown
}}

注意：
- targetLogicalId 必须是候选列表中的某一个，不能自己编造
- 如果用户指令针对所有文档，也只能选一个作为主要操作目标
- updatedDocument 必须是"完整文档"，不是 patch
""".strip()

            # 拼接所有候选文档内容
            docs_content = ""
            for i, c in enumerate(candidates, 1):
                docs_content += f"\n--- 文档{i}: {c.get('logicalId', '')} ({c.get('title', '')}) ---\n"
                docs_content += (c.get("content") or "")[:8000]  # 每个文档限制8000字符
                docs_content += "\n"

            user = f"""[候选文档内容]
{docs_content}

[用户输入]
{user_input}
""".strip()

        else:
            # 单文档模式（原有逻辑）
            system = f"""
你是资深测试/产品文档助手。用户在聊天框输入内容，你需要判断用户意图：

- intent=\"analysis\"：用户只是想问问题/要建议/要解释。你只输出 reply，不修改文档。
- intent=\"edit\"：用户明确要你修改右侧当前{stage_name}文档。你必须输出修改后的完整文档 updatedDocument（Markdown），并给出简短 editSummary。

输出必须是严格 JSON（不要 markdown，不要代码块），格式如下：

{{
  \"intent\": \"analysis\" | \"edit\",
  \"reply\": \"...\",
  \"editSummary\": \"...\",              // intent=edit 必填
  \"updatedDocument\": \"...\"           // intent=edit 必填，完整 Markdown
}}

注意：
- 如果用户输入模糊，但可能会改文档，你可以先 intent=\"analysis\" 追问缺失信息（但 reply 要简短）。
- updatedDocument 必须是"完整文档"，不是 patch。
""".strip()

            user = f"""[当前右侧文档]
{doc_content}

[用户输入]
{user_input}
""".strip()

        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

    def _resolve_target_doc(state: AskState) -> Tuple[str, str]:
        """Return (target_logical_id, target_doc_content)."""
        sid = state.get("sessionId", "") or ""
        target_logical = (state.get("targetLogicalId") or "").strip()

        # 1) targetLogicalId -> pointer -> doc
        if target_logical and sid:
            did = session_store.get_pointer(sid, target_logical)
            if did:
                doc = session_store.get_doc(did)
                if doc and (doc.get("content") or ""):
                    return target_logical, doc["content"]

        # 2) fallback: docRefs kind=main
        for r in state.get("docRefs") or []:
            if (r.get("kind") or "").lower() == "main" and r.get("docId"):
                doc = session_store.get_doc(r["docId"])
                if doc and (doc.get("content") or ""):
                    return target_logical or (r.get("logicalId") or ""), doc["content"]

        # 3) fallback: state.text (chat 请求也可以直接携带当前文档内容)
        text = (state.get("text") or "").strip()
        if text:
            return target_logical, text

        return target_logical, ""

    def _resolve_all_main_candidates(state: AskState) -> List[Dict[str, Any]]:
        """
        ✅ 新增：获取所有 kind=main 的候选文档（用于多选模式）
        Returns: [{logicalId, title, content, docId}, ...]
        """
        candidates = []
        for r in state.get("docRefs") or []:
            if (r.get("kind") or "").lower() != "main":
                continue
            doc_id = r.get("docId")
            if not doc_id:
                continue
            doc = session_store.get_doc(doc_id)
            if not doc or not (doc.get("content") or ""):
                continue
            candidates.append({
                "logicalId": r.get("logicalId") or doc.get("logicalId") or "",
                "title": r.get("title") or doc.get("title") or "",
                "content": doc.get("content") or "",
                "docId": doc_id,
            })
        return candidates
    def _truncate_text(text: str, max_chars: int) -> str:
        if not text:
            return ""
        if len(text) <= max_chars:
            return text
        return text[:max_chars] + "\n\n...(内容已截断)"

    def _doc_to_ref(doc: Dict[str, Any], *, kind_override: Optional[str] = None, logical_override: Optional[str] = None) -> DocRef:
        return {
            "docId": doc.get("docId", ""),
            "hash": doc.get("hash", ""),
            "title": doc.get("title") or "",
            "kind": kind_override or doc.get("kind") or "",
            "logicalId": logical_override or doc.get("logicalId") or "",
            "length": int(doc.get("length") or 0),
            "contentType": doc.get("contentType") or "text/markdown",
            "createdAt": int(doc.get("createdAt") or 0),
        }

    # ---------------- Anthropic call ----------------

    def _call_anthropic(messages: List[Dict[str, Any]], model: str, max_tokens: int, temperature: float) -> str:
        if not anthropic_client:
            raise RuntimeError("Anthropic client not configured")

        system_content = ""
        chat_messages: List[Dict[str, str]] = []
        for m in messages:
            role = m.get("role")
            if role == "system":
                system_content += (m.get("content") or "") + "\n"
            elif role in ("user", "assistant"):
                chat_messages.append({"role": role, "content": m.get("content") or ""})

        # Prefer streaming when available; fall back to create
        if hasattr(anthropic_client, "messages") and hasattr(anthropic_client.messages, "stream"):
            out = ""
            with anthropic_client.messages.stream(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_content.strip() if system_content else None,
                messages=chat_messages,
            ) as stream:
                for t in stream.text_stream:
                    out += t
            return out

        # Fallback (non-stream)
        resp = anthropic_client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_content.strip() if system_content else None,
            messages=chat_messages,
        )
        # Anthropic returns content blocks
        try:
            return "".join([b.text for b in resp.content if getattr(b, "type", "") == "text"])
        except Exception:
            return str(resp)

    # ---------------- History summarizer ----------------

    def _summarize_history(history: List[Dict[str, Any]], model: str) -> str:
        if not history:
            return ""
        conv_lines = []
        for m in history[-20:]:
            role = m.get("role", "")
            content = (m.get("content") or "").strip()
            if not content:
                continue
            conv_lines.append(f"{role}: {content}")
        conv_text = "\n".join(conv_lines)

        summary_prompt = [
            {
                "role": "system",
                "content": (
                    "你是一个对话摘要助手。请将以下对话历史压缩为一段简洁的摘要（400字以内），"
                    "保留关键决策、约束、偏好和上下文信息。必须使用中文。"
                ),
            },
            {"role": "user", "content": conv_text[:8000]},
        ]

        try:
            if is_anthropic_model(model) and anthropic_client:
                return _call_anthropic(summary_prompt, model, 500, 0)
            resp = openai_client.chat.completions.create(
                model=model,
                messages=summary_prompt,
                max_tokens=500,
                temperature=0,
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception:
            return ""

    # ---------------- DocRefs builder ----------------

    def _build_docrefs_from_request(
        state: AskState, ask_type: str
    ) -> Tuple[Optional[str], List[str], List[DocRef], List[DocRef]]:
        """
        Returns:
        - main_doc_id
        - aux_doc_ids
        - stored_doc_refs: newly stored in this call (old protocol only)
        - used_doc_refs: all docs used to build prompt (main+aux)
        """
        session_id = state.get("sessionId", "")
        stored: List[DocRef] = []
        used: List[DocRef] = []

        main_doc_id: Optional[str] = None
        aux_doc_ids: List[str] = []

        # New protocol first: docRefs
        for r in state.get("docRefs") or []:
            did = (r or {}).get("docId")
            if not did:
                continue
            doc = session_store.get_doc(did)
            if not doc:
                raise DocRefMiss(did)
            kind = ((r or {}).get("kind") or doc.get("kind") or "").lower()
            logical = (r or {}).get("logicalId") or doc.get("logicalId") or ""
            ref = _doc_to_ref(doc, kind_override=kind, logical_override=logical)

            if kind == "main" and not main_doc_id:
                main_doc_id = did
            else:
                if did not in aux_doc_ids:
                    aux_doc_ids.append(did)
            used.append(ref)

        # Old protocol: params.text -> store as main if present
        text = (state.get("text") or "").strip()
        if text:
            # For stage0 compatibility: if testprd and no main yet, treat as raw_prd pointer.
            logical_id = "raw_prd" if (ask_type == "testprd" and not main_doc_id) else None
            put = session_store.put_doc(
                content=text,
                title=f"[main:{ask_type}]",
                kind="main",
                session_id=session_id or None,
                logical_id=logical_id,
                content_type="text/markdown",
                tags=["prd", "raw"] if logical_id == "raw_prd" else None,
            )
            did = put["docId"]
            if not main_doc_id:
                main_doc_id = did
            ref = {
                "docId": did,
                "hash": put.get("hash", ""),
                "title": put.get("title") or "",
                "kind": "main",
                "logicalId": put.get("logicalId") or logical_id or "",
                "length": int(put.get("length") or 0),
                "contentType": put.get("contentType") or "text/markdown",
                "createdAt": int(put.get("createdAt") or 0),
            }
            stored.append(ref)
            used.append(ref)

        # additionalPrds -> store as aux
        for item in state.get("additionalPrds") or []:
            title = (item.get("title") or "").strip() or "[aux]"
            content = item.get("content") or ""
            if not content.strip():
                continue
            put = session_store.put_doc(
                content=content,
                title=title,
                kind="aux",
                session_id=session_id or None,
                content_type="text/markdown",
                tags=["aux"],
            )
            did = put["docId"]
            if did not in aux_doc_ids:
                aux_doc_ids.append(did)
            ref = {
                "docId": did,
                "hash": put.get("hash", ""),
                "title": put.get("title") or "",
                "kind": "aux",
                "logicalId": put.get("logicalId") or "",
                "length": int(put.get("length") or 0),
                "contentType": put.get("contentType") or "text/markdown",
                "createdAt": int(put.get("createdAt") or 0),
            }
            stored.append(ref)
            used.append(ref)

        # ensure used main+aux order: main first
        if main_doc_id:
            main_doc = session_store.get_doc(main_doc_id)
            if main_doc:
                main_ref = _doc_to_ref(main_doc, kind_override="main")
                used = [main_ref] + [r for r in used if r.get("docId") != main_doc_id]

        return main_doc_id, aux_doc_ids, stored, used

    # ---------------- Context builder (budget + retrieve) ----------------

    def _format_doc_context(
        main_doc_id: Optional[str],
        aux_doc_ids: List[str],
        ask_type: str,
        instruction: str,
        cfg: Any,
    ) -> str:
        query = f"{ask_type} {instruction}".strip()
        max_total = int(getattr(cfg, "max_input_chars", 100000) or 100000)

        def make_excerpt(doc_id: str, max_chars: int, top_k: int) -> str:
            doc = session_store.get_doc(doc_id) or {}
            title = doc.get("title") or ""
            content = doc.get("content") or ""

            # 如果文档内容小于预算，直接使用完整内容（避免检索导致的信息丢失）
            if len(content) <= max_chars:
                if title:
                    return f"【{title}】\n{content}"
                return content

            # 文档较大时，尝试检索相关片段
            retrieved = session_store.retrieve([doc_id], query=query, top_k=top_k)
            chunks: List[str] = []
            for _did, ch, _sc in retrieved:
                if ch:
                    chunks.append(ch)

            body = ""
            if chunks:
                body = "\n\n---\n\n".join(chunks).strip()

            # Fallback: if retrieve returns nothing (or query too strict), use full content
            if not body and content:
                body = content

            body = _truncate_text(body, max_chars)

            if title:
                return f"【{title}】\n{body}"
            return body

        # budget: main 90%, aux 10% (确保大PRD不被截断)
        # 如果有辅助文档，主文档分配 80%，否则分配 100%
        if aux_doc_ids:
            max_main = int(max_total * 0.80)
        else:
            max_main = max_total  # 无辅助文档时，主文档可以使用全部预算
        max_aux_total = max_total - max_main
        max_aux_each = max(4000, int(max_aux_total / max(1, len(aux_doc_ids) or 1)))

        main_excerpt = make_excerpt(main_doc_id, max_main, top_k=8) if main_doc_id else ""
        aux_excerpts = [make_excerpt(did, max_aux_each, top_k=4) for did in aux_doc_ids[:8]]

        parts: List[str] = []

        if ask_type == "testprd":
            parts.append(f"[主PRD]\n{main_excerpt}\n[/主PRD]")
            if aux_excerpts:
                parts.append("[辅助PRD]\n" + "\n\n".join(aux_excerpts) + "\n[/辅助PRD]")
            if instruction:
                parts.append(f"[补充说明]\n{instruction}\n[/补充说明]")
        elif ask_type in ("testpoint", "testcase"):
            parts.append(f"[优化后PRD]\n{main_excerpt}\n[/优化后PRD]")
            if aux_excerpts:
                parts.append("[辅助PRD]\n" + "\n\n".join(aux_excerpts) + "\n[/辅助PRD]")
            if instruction:
                parts.append(f"[补充说明]\n{instruction}\n[/补充说明]")
        else:
            parts.append(main_excerpt)
            parts.extend(aux_excerpts)
            if instruction:
                parts.append(instruction)

        combined = "\n\n".join([p for p in parts if p and p.strip()]).strip()
        return _truncate_text(combined, max_total)

    # ---------------- Cache key ----------------

    def _compute_cache_key(state: AskState, cfg: Any, main_doc_id: Optional[str], aux_doc_ids: List[str]) -> str:
        session_id = state.get("sessionId", "")
        ask_type = (state.get("type") or "testprd").strip().lower()
        instruction = (state.get("instruction") or "").strip()
        code = (state.get("code") or "").strip()
        model = getattr(cfg, "model", None) or model_name

        prompt_text = cfg.get_prompt() if hasattr(cfg, "get_prompt") else ""
        prompt_hash = _sha256(prompt_text)

        def doc_hash(did: str) -> str:
            d = session_store.get_doc(did) or {}
            return (d.get("hash") or "")

        payload = {
            "v": 3,
            "session": session_id,
            "type": ask_type,
            "code": code,
            "model": model,
            "temperature": getattr(cfg, "temperature", None),
            "max_tokens": getattr(cfg, "max_tokens", None),
            "promptHash": prompt_hash,
            "mainHash": doc_hash(main_doc_id) if main_doc_id else "",
            "auxHashes": [doc_hash(d) for d in aux_doc_ids],
            "instruction": instruction,
        }
        return session_store.make_cache_key(payload)

    # ---------------- Nodes ----------------

    def build_prompt(state: AskState) -> AskState:
        ask_type = (state.get("type") or "testprd").strip().lower()
        cfg: AskTypeConfig = get_ask_config(ask_type)
        state["config"] = cfg
        # ---------------- chat types: analysis/edit with auto doc update ----------------
        if ask_type.endswith("_chat"):
            # chat mode relies on targetLogicalId (preferred) or docRefs(kind=main) to locate right-side doc.
            user_input = (state.get("instruction") or "").strip()
            if not user_input:
                state["answer"] = "请先输入你的问题或修改指令。"
                state["cached"] = True  # skip call_llm/finalize
                state["chatIntent"] = "analysis"
                state["storedDocRefs"] = []
                state["usedDocRefs"] = state.get("docRefs") or []
                state["generatedDocRef"] = None
                return state

            # ✅ 检查是否有多个 main 候选文档（@ 多选模式）
            main_candidates = _resolve_all_main_candidates(state)
            
            if len(main_candidates) > 1:
                # 多候选模式：让模型选择目标文档
                state["_chatCandidates"] = main_candidates  # 临时存储，供 call_llm 验证
                state["chatIntent"] = _quick_intent(user_input)
                state["messages"] = _build_chat_messages(
                    ask_type, 
                    "",  # doc_content 由 candidates 提供
                    user_input,
                    candidates=main_candidates,
                )
                state["effectiveText"] = user_input
                state["cacheKey"] = ""
                state["cached"] = False
                state["storedDocRefs"] = []
                state["usedDocRefs"] = state.get("docRefs") or []
                state["usedDocIds"] = [r.get("docId") for r in (state.get("usedDocRefs") or []) if r.get("docId")]
                return state
            else:
                # 单候选/无候选：走原有逻辑
                target_logical, doc_content = _resolve_target_doc(state)
                if not doc_content:
                    state["answer"] = "Error: 当前右侧文档为空或未入库，请先生成/保存一次后再编辑。"
                    state["cached"] = True
                    state["chatIntent"] = "analysis"
                    state["storedDocRefs"] = []
                    state["usedDocRefs"] = state.get("docRefs") or []
                    state["generatedDocRef"] = None
                    return state

                if target_logical:
                    state["targetLogicalId"] = target_logical

                state["chatIntent"] = _quick_intent(user_input)
                state["messages"] = _build_chat_messages(ask_type, doc_content, user_input)
                state["effectiveText"] = user_input
                # disable cache for chat to avoid stale doc edits
                state["cacheKey"] = ""
                state["cached"] = False
                state["storedDocRefs"] = []
                state["usedDocRefs"] = state.get("docRefs") or []
                state["usedDocIds"] = [r.get("docId") for r in (state.get("usedDocRefs") or []) if r.get("docId")]
                return state


        main_doc_id, aux_doc_ids, stored_refs, used_refs = _build_docrefs_from_request(state, ask_type)
        state["storedDocRefs"] = stored_refs
        state["usedDocRefs"] = used_refs
        state["usedDocIds"] = [r.get("docId") for r in used_refs if r.get("docId")]

        instruction = (state.get("instruction") or "").strip()
        effective = _format_doc_context(main_doc_id, aux_doc_ids, ask_type, instruction, cfg)
        state["effectiveText"] = effective

        # session history (optional)
        history_msgs: List[Dict[str, Any]] = []
        if getattr(cfg, "use_session_history", False):
            sid = state.get("sessionId", "")
            history_msgs = session_store.get(sid) if sid else []

        # summarize on overflow (optional)
        if history_msgs and getattr(cfg, "summarize_on_overflow", False):
            approx = sum(len(m.get("content") or "") for m in history_msgs) + len(effective)
            if approx > int(getattr(cfg, "max_input_chars", 100000) or 100000):
                summary = _summarize_history(history_msgs, getattr(cfg, "model", model_name) or model_name)
                history_msgs = [{"role": "system", "content": f"【历史摘要】\n{summary}"}] if summary else []

        system_prompt = cfg.get_prompt()

        # ========== Week 4: 历史用例自动参考 ==========
        # 对于测试用例生成，自动检索历史相似用例作为参考
        historical_context = ""
        use_history = os.getenv("USE_HISTORY_REFERENCE", "true").lower() == "true"

        if use_history and ask_type in ("testcase", "testpoint") and hasattr(session_store, "search_history"):
            print(f"📚 [知识库] 开始检索历史用例 (ask_type={ask_type}, USE_HISTORY_REFERENCE=true)")
            try:
                # 构建历史检索查询（使用 instruction + main_doc 部分内容）
                query_parts = []
                if instruction:
                    query_parts.append(instruction[:200])  # 限制长度
                if main_doc_id:
                    main_doc = session_store.get_doc(main_doc_id)
                    if main_doc and main_doc.get("content"):
                        query_parts.append(main_doc["content"][:300])  # 取前300字符

                if query_parts:
                    history_query = " ".join(query_parts)
                    print(f"📚 [知识库] 检索查询: {history_query[:100]}...")
                    history_results = session_store.search_history(history_query, top_k=2)

                    if history_results:
                        historical_cases = []
                        for i, record in enumerate(history_results, 1):
                            similarity = record.get("similarity", 0)
                            content = record.get("content", "")
                            metadata = record.get("metadata", {})
                            tags = metadata.get("tags", "")

                            # 限制每个历史用例的长度
                            if len(content) > 800:
                                content = content[:800] + "\n\n... (内容过长，已截断) ..."

                            historical_cases.append(
                                f"### 参考历史用例 {i}（相似度: {similarity:.2f}）\n"
                                f"{f'标签: {tags}\n' if tags else ''}"
                                f"{content}"
                            )

                        if historical_cases:
                            historical_context = "\n\n---\n\n## 📚 参考历史测试用例\n\n" + \
                                "以下是从历史库中检索到的相似测试用例，供参考（可复用测试思路、边界值设计等）：\n\n" + \
                                "\n\n".join(historical_cases) + "\n\n---\n\n"
                            # ✅ 添加日志：知识库检索成功
                            print(f"📚 [知识库] 检索到 {len(history_results)} 个历史用例，注入上下文长度: {len(historical_context)} 字符")
                            for i, record in enumerate(history_results, 1):
                                print(f"   - 历史用例 {i}: 相似度={record.get('similarity', 0):.2f}, 长度={len(record.get('content', ''))}字符")

            except Exception as e:
                print(f"⚠️  历史用例检索失败（将跳过）: {e}")
                historical_context = ""

        # 注入历史上下文到 system prompt
        if historical_context:
            system_prompt = system_prompt + historical_context
            print(f"📚 [知识库] 已将历史用例注入到 System Prompt")
        elif use_history and ask_type in ("testcase", "testpoint"):
            print(f"📚 [知识库] 未检索到相关历史用例（ask_type={ask_type}）")

        state["messages"] = [{"role": "system", "content": system_prompt}, *history_msgs, {"role": "user", "content": effective}]

        cache_key = _compute_cache_key(state, cfg, main_doc_id, aux_doc_ids)
        state["cacheKey"] = cache_key
        cached = session_store.cache_get(cache_key)
        if cached and isinstance(cached, dict) and cached.get("answer"):
            state["answer"] = cached.get("answer", "")
            state["cached"] = True
            # keep full closed-loop fields
            if cached.get("storedDocRefs") is not None:
                state["storedDocRefs"] = cached.get("storedDocRefs") or []
            if cached.get("usedDocRefs") is not None:
                state["usedDocRefs"] = cached.get("usedDocRefs") or state.get("usedDocRefs") or []
            if cached.get("generatedDocRef") is not None:
                state["generatedDocRef"] = cached.get("generatedDocRef")
            return state

        state["cached"] = False
        return state

    def call_llm(state: AskState) -> AskState:
        if state.get("cached"):
            return state

        cfg: Any = state.get("config") or get_ask_config(state.get("type", "testprd"))
        model = getattr(cfg, "model", None) or model_name
        max_tokens = int(getattr(cfg, "max_tokens", 2000) or 2000)
        temperature = float(getattr(cfg, "temperature", 0) or 0)

        ask_type = (state.get("type") or "testprd").strip().lower()

        try:
            # call model
            if is_anthropic_model(model) and anthropic_client:
                raw_content = _call_anthropic(state["messages"], model, max_tokens, temperature)
                raw_text = _strip_markdown_fence((raw_content or "").strip())
            else:
                resp = openai_client.chat.completions.create(
                    model=model,
                    messages=state["messages"],
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
                msg = resp.choices[0].message
                raw_text = _strip_markdown_fence((msg.content or "").strip())

            # chat: parse strict JSON and (optionally) persist updated doc
            if ask_type.endswith("_chat"):
                obj = _extract_json(raw_text) or {}
                intent = (obj.get("intent") or state.get("chatIntent") or "analysis").strip().lower()
                reply = (obj.get("reply") or "").strip()
                
                # ✅ 多候选模式：从模型响应中获取 targetLogicalId 并验证
                model_target_logical = (obj.get("targetLogicalId") or "").strip()
                candidates = state.get("_chatCandidates") or []
                
                if model_target_logical and candidates:
                    # 验证模型返回的 targetLogicalId 在候选列表中
                    valid_logical_ids = {c.get("logicalId", "") for c in candidates if c.get("logicalId")}
                    if model_target_logical in valid_logical_ids:
                        state["targetLogicalId"] = model_target_logical
                    else:
                        # 模型返回的 targetLogicalId 不在候选列表中，降级为 analysis
                        state["chatIntent"] = "analysis"
                        state["answer"] = f"⚠️ 模型选择的目标文档 '{model_target_logical}' 不在候选列表中。请明确指定要操作的文档。"
                        return state

                if intent != "edit":
                    state["chatIntent"] = "analysis"
                    # ✅ 返回模型选择的目标文档信息（便于前端显示）
                    if model_target_logical:
                        state["targetLogicalId"] = model_target_logical
                    state["answer"] = reply or raw_text or "OK"
                else:
                    updated = (obj.get("updatedDocument") or "").strip()
                    summary = (obj.get("editSummary") or "").strip()

                    if not updated:
                        state["chatIntent"] = "analysis"
                        state["answer"] = reply or "我理解你想修改文档，但缺少具体修改内容。请再明确要改哪里。"
                    else:
                        sid = state.get("sessionId", "") or ""
                        # ✅ 优先使用模型返回的 targetLogicalId
                        logical_id = model_target_logical or (state.get("targetLogicalId") or "").strip() or None

                        put = session_store.put_doc(
                            content=updated,
                            title=f"[edited:{ask_type}]",
                            kind="main",
                            session_id=sid or None,
                            logical_id=logical_id,
                            content_type="text/markdown",
                            tags=["main", "edited", ask_type],
                        )
                        doc = session_store.get_doc(put["docId"]) or {}
                        gen_ref = _doc_to_ref(
                            doc,
                            kind_override="main",
                            logical_override=logical_id or (doc.get("logicalId") or ""),
                        )

                        state["generatedDocRef"] = gen_ref
                        state["updatedDocument"] = updated
                        state["editSummary"] = summary
                        state["chatIntent"] = "edit"
                        state["targetLogicalId"] = logical_id or ""
                        state["answer"] = reply or (summary or "已更新文档。")
            else:
                state["answer"] = raw_text or "处理完成"
        except Exception as e:
            state["answer"] = f"Error: {str(e)}"
            return state

        # cache (partial; finalize will add generatedDocRef)
        ck = state.get("cacheKey", "")
        if ck:
            session_store.cache_set(
                ck,
                {
                    "answer": state.get("answer", ""),
                    "storedDocRefs": state.get("storedDocRefs", []),
                    "usedDocRefs": state.get("usedDocRefs", []),
                },
            )

        # session history (optional)
        if getattr(cfg, "use_session_history", False):
            sid = state.get("sessionId", "")
            if sid:
                session_store.append(sid, "user", (state.get("effectiveText") or "")[:3000])
                session_store.append(sid, "assistant", (state.get("answer") or "")[:3000])

        return state

    def finalize(state: AskState) -> AskState:
        ask_type = (state.get("type") or "testprd").strip().lower()
        # Chat types already handled in call_llm (analysis reply or in-place doc update)
        if ask_type.endswith("_chat"):
            return state
        sid = state.get("sessionId", "")
        answer = state.get("answer") or ""

        logical_map = {
            "testprd": "optimized_prd_current",
            "testpoint": "testpoints_current",
            "testcase": "testcases_current",
        }
        logical_id = logical_map.get(ask_type)

        if sid and answer and not answer.startswith("Error:"):
            put = session_store.put_doc(
                content=answer,
                title=f"[output:{ask_type}]",
                kind="output",
                session_id=sid,
                logical_id=logical_id,
                content_type="text/markdown",
                tags=["output", ask_type],
            )
            # doc record in store contains logicalId; ensure override with mapping
            doc = session_store.get_doc(put["docId"]) or {}
            gen_ref = _doc_to_ref(doc, kind_override="output", logical_override=logical_id)
            state["generatedDocRef"] = gen_ref

            # P1: 自动归档测试用例到历史库
            if ask_type == "testcase" and isinstance(session_store, ImprovedSessionStore):
                try:
                    archived = session_store.archive_to_history(
                        doc_id=put["docId"],
                        session_id=sid,
                        metadata={"tags": ["output", "testcase", "auto-archived"]}
                    )
                    if archived:
                        print(f"[ask_graph] Auto-archived testcase to history: {put['docId'][:16]}...")
                except Exception as e:
                    print(f"[ask_graph] Auto-archive failed: {e}")

            # update cache with generated ref
            ck = state.get("cacheKey", "")
            if ck:
                cached = session_store.cache_get(ck) or {}
                cached.update(
                    {
                        "answer": answer,
                        "storedDocRefs": state.get("storedDocRefs", []),
                        "usedDocRefs": state.get("usedDocRefs", []),
                        "generatedDocRef": gen_ref,
                    }
                )
                session_store.cache_set(ck, cached)

        return state

    g = StateGraph(AskState)
    g.add_node("build_prompt", build_prompt)
    g.add_node("call_llm", call_llm)
    g.add_node("finalize", finalize)

    g.set_entry_point("build_prompt")
    g.add_edge("build_prompt", "call_llm")
    g.add_edge("call_llm", "finalize")
    g.add_edge("finalize", END)

    return g.compile()
