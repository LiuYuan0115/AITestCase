# LangGraph 实战：PM/DEV Chat-only 从 0 到上线（基于本项目）

本文用你当前项目做一次“真实业务目标”的完整落地：**插件 PM/DEV 纯聊天统一走本地 Agent（LangGraph）**。

---

## 1. 目标与边界

- **目标**：让插件里 PM/DEV 的聊天不再直连远程 `ask()`，而是统一调用本地 `agent-server` 的 `/api/chat`。
- **边界**：
  - 本次 chat-only 先做“连续对话 + 角色提示词差异”，不引入复杂工具调用（后面扩展会教）。
  - 会话上下文先用内存（`SessionStore`），后续可换 Redis/Checkpointer。

---

## 2. 后端：LangGraph 的最小闭环

### 2.1 State 设计（最重要）

文件：`agent_app/graphs/chat_graph.py`

State（状态）是你整条链路的“数据契约”，建议遵循：
- **输入字段**：`sessionId / role / userMessage`
- **运行字段**：`messages / modelMessage`
- **输出字段**：`result.reply`

这样未来你加工具、加检索、加分支，只是给 State 增字段，而不是到处改函数参数。

### 2.2 Node（节点）写法

这里是 3 个最小节点：
- `build_prompt`：根据 role 选择系统提示词 + 拼接历史上下文 + 拼接当前用户输入
- `call_llm`：调用模型拿到 `assistant` 消息
- `finalize`：把 content 收敛到 `result.reply`

### 2.3 Edge（边）与图结构

本次是线性图：

`build_prompt -> call_llm -> finalize -> END`

当你想扩展为“多工具循环”时，才需要 `conditional_edges` 与 loop。

---

## 3. 后端：接口对接（保持前端低成本）

### 3.1 新增接口

文件：`agent_app/app_factory.py`

新增：
- `POST /api/chat`：输入 `{sessionId, role, message}`，输出 `{status, sessionId, reply}`

约束：
- role 只允许 `pm | dev`
- message 为空直接返回英文错误：`Error: message is empty.`

### 3.2 会话连续性

每次调用后：
- `session_store.append(sessionId, "user", message)`
- `session_store.append(sessionId, "assistant", reply)`

这就是“连续对话”的最小实现。

---

## 4. 前端：把 chat-only 统一切到本地 Agent

### 4.1 新增 API 封装

文件：`solvely-mvp/src/api.ts`

新增 `chatAgent()`：
- 调 `LOCAL_AGENT_URL/api/chat`
- 成功返回 `reply`
- 失败返回英文 `Error: ...`

### 4.2 UI 接线

文件：`solvely-mvp/src/entrypoints/sidepanel/App.vue`

chat-only 发送逻辑从：
- `ask()`（远程/流式）

改为：
- `chatAgent()`（本地 LangGraph）

这样 PM/DEV 体验更稳定，也便于你后续在本地 Agent 加能力（工具/RAG/可控工作流）。

---

## 5. 下一步怎么扩展（你会真正“学会”）

### 5.1 给 chat-only 增加“工具调用”

你可以按 PRD/TestCase 的方式：
1. 在 `agent_app/tooling.py` 里定义 tool schema
2. 在 `chat_graph.py` 增加：
   - `call_llm` 使用 `tools=...`
   - 增加 `route`：有 tool_calls 就走 `handle_tool`
   - `handle_tool` 执行工具并把 tool 结果 append 到 `messages`，然后 loop 回 `call_llm`

图会变成：

`build_prompt -> call_llm -> (handle_tool -> call_llm)* -> finalize`

### 5.2 把会话从内存换成持久化

当前：`agent_app/session_store.py` 只是 dict。

推荐替换路线：
- **轻量**：Redis（你自己控制 TTL）
- **LangGraph 原生**：Checkpointer（更适合复杂图与断点恢复）

### 5.3 多角色多图的最佳实践

当 PM/DEV/QA 差异越来越大时：
- 让每个角色有自己的 graph（可复用子图）
- 对外统一 `/api/chat`，内部根据 role 路由到不同 graph

---

## 6. 如何验证

1. 启动本地 agent-server（保持原方式）：
   - `cd agent-server && ./run_agent.sh`
2. 插件端加载 `.output/chrome-mv3`
3. 选择角色 PM/DEV，发一句话
4. 后端命中 `/api/chat`，且会话能持续（第二句话能记住上一句）


