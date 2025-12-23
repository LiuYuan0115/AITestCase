# Ask 接口配置参考文档

本文档描述了 `/api/ask` 接口的所有配置项，包括模型参数、Prompt 配置、上下文管理策略。

---

## 配置概览

| 配置项 | testprd | testpoint | testcase | 说明 |
|--------|---------|-----------|----------|------|
| **model** | openai/gpt-4o | openai/gpt-4o | openai/gpt-4o | 使用的模型名称 |
| **temperature** | 0 | 0 | 0 | 生成随机性（0 = 确定性输出） |
| **max_tokens** | 50000 | 50000 | 50000 | 最大输出 token 数 |
| **thinking_budget** | 20000 | 20000 | 20000 | 思考预算（thinkingConfig） |
| **include_thoughts** | false | false | false | 是否返回思考过程 |
| **prompt_file** | ask_testprd.md | ask_testcase.md | ask_testcase.md | Prompt 文件名 |
| **use_session_history** | true | true | true | 是否带会话历史 |
| **max_history_rounds** | 10 | 10 | 10 | 最大保留历史轮数 |
| **max_input_chars** | 100000 | 100000 | 100000 | 输入文本最大字符数 |
| **summarize_on_overflow** | true | true | true | 超出上下文时是否总结处理 |

---

## 详细配置

### 1. 模型参数

```json
{
  "model": "openai/gpt-4o",
  "temperature": 0,
  "max_tokens": 50000,
  "thinkingConfig": {
    "includeThoughts": false,
    "thinkingBudget": 20000
  }
}
```

**说明：**
- `model`：模型名称，可通过 `.env` 覆盖
- `temperature`：0 表示确定性输出，适合生成结构化文档
- `max_tokens`：最大输出 token 数，50000 支持长文档输出
- `thinkingConfig`：思考配置（部分模型支持）
  - `includeThoughts`：是否在响应中包含思考过程
  - `thinkingBudget`：思考过程的 token 预算

---

### 2. Prompt 配置

| 类型 | Prompt 文件 | 用途 |
|------|-------------|------|
| testprd | `prompts/ask_testprd.md` | 优化需求文档 |
| testpoint | `prompts/ask_testcase.md` | 生成测试点 |
| testcase | `prompts/ask_testcase.md` | 生成测试点/测试用例 |

**文件位置：** `agent-server/prompts/`

---

### 3. 上下文管理

```json
{
  "use_session_history": true,
  "max_history_rounds": 10,
  "max_input_chars": 100000,
  "summarize_on_overflow": true
}
```

**说明：**
- `use_session_history`：是否在请求中加入会话历史
- `max_history_rounds`：最多保留最近 N 轮对话
- `max_input_chars`：输入文本超过此长度时截断
- `summarize_on_overflow`：当历史上下文过长时，自动调用模型生成摘要

**超出上下文处理流程：**
1. 计算历史消息总字符数
2. 如果超过 `max_input_chars / 2`，触发总结
3. 调用模型将历史压缩为 200 字以内的摘要
4. 摘要作为系统消息注入，保留关键决策和上下文

---

## 环境变量覆盖

可通过 `.env` 文件覆盖默认配置：

```env
# 模型配置
ASK_TESTPRD_MODEL=openai/gpt-4o
ASK_TESTPRD_TEMPERATURE=0
ASK_TESTPRD_MAX_TOKENS=50000
ASK_TESTPRD_THINKING_BUDGET=20000
ASK_TESTPRD_INCLUDE_THOUGHTS=false

ASK_TESTPOINT_MODEL=openai/gpt-4o
ASK_TESTPOINT_TEMPERATURE=0
ASK_TESTPOINT_MAX_TOKENS=50000
ASK_TESTPOINT_THINKING_BUDGET=20000

ASK_TESTCASE_MODEL=openai/gpt-4o
ASK_TESTCASE_TEMPERATURE=0
ASK_TESTCASE_MAX_TOKENS=50000
ASK_TESTCASE_THINKING_BUDGET=20000

# 默认模型（兜底）
ASK_DEFAULT_MODEL=openai/gpt-4o
```

---

## API 接口

### 查看配置概览

```bash
curl http://localhost:8000/api/ask/config
```

**响应示例：**
```json
{
  "status": "success",
  "configs": {
    "testprd": {
      "model": "openai/gpt-4o",
      "temperature": 0,
      "max_tokens": 50000,
      "thinking_budget": 20000,
      "include_thoughts": false,
      "prompt_file": "ask_testprd.md",
      "use_session_history": true,
      "max_history_rounds": 10,
      "max_input_chars": 100000,
      "summarize_on_overflow": true
    },
    "testpoint": { ... },
    "testcase": { ... }
  }
}
```

### 调用 Ask 接口

```bash
curl -X POST http://localhost:8000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "my-session-1",
    "type": "testprd",
    "params": {
      "text": "用户注册功能：支持邮箱和手机号注册..."
    }
  }'
```

**参数说明：**
- `sessionId`：会话 ID，用于保持上下文
- `type`：`testprd` | `testpoint` | `testcase`
- `params.text`：输入的需求/文档内容

---

## 文件结构

```
agent-server/
├── prompts/
│   ├── ask_testprd.md      # 优化需求文档的 Prompt
│   └── ask_testcase.md     # 生成测试点的 Prompt
├── agent_app/
│   ├── ask_config.py       # Ask 接口配置中心
│   └── graphs/
│       └── ask_graph.py    # Ask LangGraph 实现
└── ASK_CONFIG_REFERENCE.md # 本文档
```

---

## 修改指南

### 修改 Prompt
直接编辑 `prompts/ask_*.md` 文件，重启服务即可生效。

### 修改模型参数
在 `.env` 中添加对应的环境变量，重启服务生效。

### 修改上下文策略
编辑 `agent_app/ask_config.py` 中的 `_DEFAULT_CONFIGS` 字典。

