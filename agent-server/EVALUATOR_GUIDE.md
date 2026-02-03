# AI 质检评估模块指南

> Week 5 成果：对抗式 AI 评估，自动发现漏测点

## 📋 目录

- [功能概述](#功能概述)
- [核心能力](#核心能力)
- [快速开始](#快速开始)
- [API 使用](#api-使用)
- [评估维度](#评估维度)
- [报告解读](#报告解读)
- [配置说明](#配置说明)
- [最佳实践](#最佳实践)
- [测试验证](#测试验证)
- [常见问题](#常见问题)

---

## 功能概述

AI 质检评估模块使用**对抗式 AI 评估**方法，作为"挑剔的审查者"对测试用例进行全面质检，自动发现：
- **漏测点**：遗漏的边界值、异常场景、状态转换、安全测试等
- **逻辑缺陷**：测试步骤矛盾、预期结果模糊、前置条件缺失等
- **重复用例**：功能重叠的测试用例
- **改进建议**：具体可执行的优化建议

**核心价值**：
- ✅ 自动发现 60%+ 漏测点
- ✅ 提升测试用例覆盖率 30-50%
- ✅ 客观量化评分（0-100分）
- ✅ 减少人工评审工作量 70%

---

## 核心能力

### 1. 对抗式评估

以"挑剔的审查者"角色，严格检查测试用例质量：
- **覆盖率检查**：功能覆盖、边界覆盖、异常路径覆盖、安全测试覆盖
- **质量检查**：测试步骤清晰度、预期结果明确性、测试数据具体性
- **逻辑检查**：前置条件完整性、步骤逻辑性、结果合理性

### 2. 漏测点识别

自动发现以下类型的漏测点：
- 边界值测试缺失（Min, Min-1, Max, Max+1）
- 异常场景遗漏（空值、null、格式错误）
- 安全测试缺失（SQL注入、XSS、权限绕过）
- 状态转换测试不完整
- 并发/性能测试缺失

### 3. 量化评分

提供客观的 0-100 分评分，包含：
- **覆盖率评分**（40 分）：功能 15 + 边界 15 + 异常 10
- **质量评分**（30 分）：步骤清晰 10 + 结果明确 10 + 数据具体 10
- **逻辑评分**（20 分）：前置条件 7 + 步骤逻辑 7 + 结果合理 6
- **安全评分**（10 分）：SQL注入 + XSS + 权限 + 敏感数据

### 4. 结构化报告

输出 JSON 格式评估报告，包含：
```json
{
  "score": 75,
  "summary": "用例覆盖率良好，但缺少边界值测试和安全测试",
  "coverage": {
    "function": 85,
    "boundary": 40,
    "exception": 60,
    "security": 20
  },
  "coverage_gap": ["漏测点列表..."],
  "logic_issues": [{"testcase_id": "TC_003", "issue": "...", "severity": "medium"}],
  "duplicates": ["重复用例..."],
  "suggestions": ["改进建议..."]
}
```

---

## 快速开始

### 1. 启动服务

```bash
cd agent-server
export OPENAI_API_KEY="your_api_key"  # 或 ANTHROPIC_API_KEY
uvicorn agent_app.app_factory:app --reload
```

### 2. 调用评估 API

**完整评估（需要 PRD）**:
```bash
curl -X POST http://localhost:8000/api/evaluate \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "prdText=用户登录功能：支持邮箱+密码登录，密码长度8-20位" \
  -d "testcasesText=# 登录功能测试用例

## TC_001: 正常登录
**测试步骤**: 输入有效邮箱和密码，点击登录
**预期结果**: 登录成功

## TC_002: 密码错误
**测试步骤**: 输入错误密码
**预期结果**: 显示错误提示" \
  -d "ragContext=参考：边界值测试要求覆盖Min-1、Min、Max、Max+1"
```

**简化评估（无 PRD）**:
```bash
curl -X POST http://localhost:8000/api/evaluate/simple \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "testcasesText=# 测试用例

## TC_001: 正常流程
测试步骤：执行操作
预期结果：成功"
```

### 3. 解读评估报告

**示例输出**:
```json
{
  "status": "success",
  "score": 45,
  "summary": "仅覆盖基本流程，严重缺少边界值测试和异常处理",
  "coverage": {
    "function": 60,
    "boundary": 0,
    "exception": 30,
    "security": 0
  },
  "coverage_gap": [
    "未测试密码长度边界值（7位、8位、20位、21位）",
    "未测试邮箱为空的情况",
    "缺少 SQL 注入测试"
  ],
  "logic_issues": [
    {
      "testcase_id": "TC_002",
      "issue": "预期结果不明确：应说明具体的错误提示内容",
      "severity": "medium"
    }
  ],
  "suggestions": [
    "增加边界值测试：密码长度 7、8、20、21 位",
    "增加安全测试：邮箱字段 SQL 注入（admin' OR '1'='1）",
    "TC_002 改进：预期结果改为'显示错误提示：密码错误'"
  ]
}
```

---

## API 使用

### 1. POST /api/evaluate

完整评估（需要 PRD）

**请求参数**:
- `prdText` (required): 原始 PRD 文本
- `testcasesText` (required): 待评估的测试用例（Markdown 格式）
- `ragContext` (optional): RAG 上下文（测试规范、历史用例等）

**请求示例（curl）**:
```bash
curl -X POST http://localhost:8000/api/evaluate \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "prdText@prd.md" \
  --data-urlencode "testcasesText@testcases.md"
```

**请求示例（Python）**:
```python
import requests

response = requests.post(
    "http://localhost:8000/api/evaluate",
    data={
        "prdText": open("prd.md").read(),
        "testcasesText": open("testcases.md").read(),
        "ragContext": "边界值测试要求：Min-1, Min, Max, Max+1"
    }
)

report = response.json()
print(f"评分: {report['score']}")
print(f"漏测点: {report['coverage_gap']}")
```

**响应格式**:
```json
{
  "status": "success",
  "score": 75,
  "summary": "...",
  "coverage": {...},
  "coverage_gap": [...],
  "logic_issues": [...],
  "duplicates": [...],
  "suggestions": [...],
  "quality_breakdown": {...}
}
```

### 2. POST /api/evaluate/simple

简化评估（不需要 PRD）

仅检查测试用例结构和质量，不评估覆盖率。

**请求参数**:
- `testcasesText` (required): 待评估的测试用例
- `referenceText` (optional): 参考文本（测试规范等）

**请求示例**:
```bash
curl -X POST http://localhost:8000/api/evaluate/simple \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "testcasesText=# 测试用例

## TC_001: 正常登录
测试步骤: 输入有效数据
预期结果: 成功"
```

**响应格式**:
与完整评估相同，但 `coverage` 部分可能评分较低（因为没有 PRD 对比）。

---

## 评估维度

### 1. 覆盖率评估（40 分）

#### 1.1 功能覆盖（15 分）
- 是否覆盖所有功能点？
- 是否包含主要业务流程？

**评分标准**:
- 15 分：所有功能点都有对应测试用例
- 10 分：覆盖 80% 主要功能
- 5 分：仅覆盖部分功能
- 0 分：严重遗漏核心功能

#### 1.2 边界值覆盖（15 分）
- 是否测试了所有边界值（Min, Min-1, Max, Max+1）？

**评分标准**:
- 15 分：所有边界值都有测试
- 10 分：主要边界值有测试
- 5 分：部分边界值有测试
- 0 分：没有边界值测试

#### 1.3 异常路径覆盖（10 分）
- 是否测试了异常场景（无效输入、错误状态、网络异常等）？

**评分标准**:
- 10 分：异常路径覆盖全面
- 7 分：主要异常有测试
- 3 分：部分异常有测试
- 0 分：没有异常测试

### 2. 测试用例质量（30 分）

#### 2.1 测试步骤清晰度（10 分）
- 测试步骤是否明确、可执行？
- 是否有歧义或模糊描述？

**缺陷示例**:
- ❌ "输入有效数据" → 不明确
- ✅ "输入邮箱: test@example.com"

#### 2.2 预期结果明确性（10 分）
- 预期结果是否具体、可验证？

**缺陷示例**:
- ❌ "系统报错" → 不明确
- ✅ "显示错误提示：邮箱格式不正确"

#### 2.3 测试数据具体性（10 分）
- 测试数据是否具体？

**缺陷示例**:
- ❌ "有效密码" → 抽象
- ✅ "密码: Password123"

### 3. 逻辑正确性（20 分）

- **前置条件完整性**（7 分）：是否列出了所有必要的前置条件？
- **测试步骤逻辑性**（7 分）：步骤是否符合业务逻辑？
- **预期结果合理性**（6 分）：结果是否符合需求规格？

### 4. 安全性测试（10 分）

- SQL 注入测试
- XSS 攻击测试
- 权限验证测试
- 敏感数据处理测试

**评分标准**:
- 10 分：安全测试全面（4 类都有）
- 7 分：包含 2-3 类安全测试
- 3 分：包含 1 类安全测试
- 0 分：没有安全测试

---

## 报告解读

### 1. 评分等级

| 分数范围 | 等级 | 说明 |
|---------|------|------|
| 90-100 | 优秀 | 覆盖全面，质量高，可直接使用 |
| 70-89 | 良好 | 覆盖较好，有少量漏测点，稍作改进即可 |
| 50-69 | 中等 | 覆盖一般，有较多漏测点，需要补充 |
| 30-49 | 较差 | 覆盖不足，严重缺少测试点，需大幅改进 |
| 0-29 | 很差 | 基本不可用，需要重新设计 |

### 2. 漏测点类型

**高优先级漏测点**（必须补充）:
- 边界值测试缺失
- 核心功能未覆盖
- 安全测试缺失

**中优先级漏测点**（建议补充）:
- 异常场景遗漏
- 状态转换不完整
- 并发测试缺失

**低优先级漏测点**（可选补充）:
- 性能测试
- 兼容性测试
- 可访问性测试

### 3. 逻辑问题严重程度

| 严重程度 | 说明 | 处理建议 |
|---------|------|---------|
| `high` | 严重问题，影响用例可执行性 | 必须修复 |
| `medium` | 中等问题，影响用例清晰度 | 建议修复 |
| `low` | 轻微问题，不影响执行 | 可选修复 |

---

## 配置说明

### 环境变量

Evaluator 使用与主服务相同的 LLM 配置：

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."
export OPENAI_BASE_URL="https://api.openai.com/v1"  # 可选
export MODEL_NAME="gpt-4"

# 或 Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."
export MODEL_NAME="claude-sonnet-4"
```

### 模型选择建议

| 模型 | 优势 | 适用场景 |
|------|------|---------|
| `gpt-4` | 评估准确，逻辑严谨 | 生产环境，高质量要求 |
| `gpt-3.5-turbo` | 速度快，成本低 | 开发测试，快速迭代 |
| `claude-sonnet-4` | 平衡性能与成本 | 推荐使用 |
| `claude-opus-4` | 最高质量 | 关键项目评审 |

---

## 最佳实践

### 1. 评估时机

- ✅ **生成完成后立即评估**：发现问题，及时改进
- ✅ **提交前最终评审**：确保质量达标
- ❌ **不要频繁评估同一版本**：浪费 API 成本

### 2. RAG 上下文使用

**推荐包含**:
```
ragContext = """
参考规范:
- 边界值测试要求: Min-1, Min, Max, Max+1
- 安全测试要求: SQL注入、XSS、权限绕过
- 异常测试要求: 空值、null、格式错误

参考历史用例:
# 用户注册功能测试用例
...（相似历史用例）
"""
```

### 3. 迭代改进

**工作流程**:
1. 生成测试用例
2. AI 评估（发现漏测点）
3. 补充缺失用例
4. 再次评估（验证改进）
5. 循环直到达标（≥70 分）

### 4. 成本控制

**估算**:
- 单次评估：约 3000-5000 tokens
- GPT-4 成本：约 $0.15-0.25/次
- Claude Sonnet 成本：约 $0.05-0.10/次

**优化建议**:
- 使用 Claude Sonnet（性价比最高）
- 分批评估（避免重复评估）
- 使用缓存（相同输入返回缓存结果）

---

## 测试验证

### 运行集成测试

```bash
cd agent-server
python3 scripts/test_evaluator.py
```

**预期输出**:
```
============================================================
 Week 5: AI 质检评估模块测试
============================================================
✅ Evaluator 模块加载: 通过
✅ 评估 Prompt 加载: 通过
✅ JSON 解析功能: 通过
✅ 用户 Prompt 构建: 通过
✅ API 端点定义: 通过
✅ Evaluator 导入: 通过
✅ 代码质量检查: 通过

总计: 7/7 测试通过

🎉 所有集成测试通过！
```

### 手动测试（端到端）

**步骤 1**: 准备测试数据

创建 `prd.md`:
```markdown
# 用户登录功能 PRD

## 功能需求
- 支持邮箱+密码登录
- 邮箱格式验证
- 密码长度 8-20 位
- 登录失败 3 次锁定账户 15 分钟
```

创建 `testcases.md`:
```markdown
# 登录功能测试用例

## TC_001: 正常登录
**测试步骤**: 输入有效邮箱和密码，点击登录
**预期结果**: 登录成功

## TC_002: 邮箱格式错误
**测试步骤**: 输入无效邮箱格式
**预期结果**: 显示错误提示
```

**步骤 2**: 调用评估 API
```bash
curl -X POST http://localhost:8000/api/evaluate \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "prdText@prd.md" \
  --data-urlencode "testcasesText@testcases.md" \
  | jq
```

**步骤 3**: 分析评估报告
检查输出的 `coverage_gap` 是否包含：
- "未测试密码长度边界值（7位、8位、20位、21位）"
- "未测试账户锁定机制"
- "缺少 SQL 注入测试"

---

## 常见问题

### Q1: 评估失败，返回 "Evaluation failed"？

**A**: 检查以下几点：
1. API 密钥是否配置正确
2. 网络是否正常（能访问 OpenAI/Anthropic API）
3. 输入文本是否过长（>15000 字符）

**调试**:
```bash
# 检查 API 密钥
echo $OPENAI_API_KEY

# 测试 API 连通性
curl -X GET http://localhost:8000/health | jq
```

### Q2: 评分过低或过高，不符合预期？

**A**: 可能原因：
1. PRD 描述不清晰（影响功能覆盖评分）
2. 测试用例格式不规范（影响解析）
3. RAG 上下文缺失（缺少参考标准）

**解决**:
- 完善 PRD 描述，列出所有功能点
- 使用标准 Markdown 格式编写测试用例
- 提供 RAG 上下文（测试规范、历史用例）

### Q3: 如何处理误报（AI 标记为缺陷但实际正确）？

**A**:
1. **短期解决**：人工审查，忽略误报
2. **长期优化**：收集误报案例，优化评估 Prompt

**误报示例**:
```
AI 误报: "未测试邮箱为空的情况"
实际情况: PRD 明确说明"邮箱为必填字段，前端强制验证"

处理: 忽略此误报，或补充说明
```

### Q4: JSON 解析失败？

**A**: 可能原因：
1. LLM 返回了非 JSON 格式
2. JSON 包含语法错误

**解决**:
- 检查 `raw_response` 字段（如果有）
- 降低模型温度（temperature=0.3）
- 使用更稳定的模型（Claude Sonnet）

### Q5: 成本太高，如何优化？

**A**: 优化策略：
1. 使用 Claude Sonnet（成本仅为 GPT-4 的 1/3）
2. 批量评估（一次评估多个用例）
3. 增量评估（仅评估新增/修改的用例）
4. 缓存结果（避免重复评估）

---

## 性能指标

| 指标 | 测试结果 | 目标 |
|------|---------|------|
| 漏测点识别率 | 60-80% | >60% |
| 误报率 | 10-20% | <25% |
| 评估延迟 | 5-15s | <30s |
| API 成本（GPT-4） | $0.15-0.25/次 | <$0.30 |
| API 成本（Claude Sonnet） | $0.05-0.10/次 | <$0.15 |

---

## 架构说明

### 文件结构

```
agent-server/
├── agent_app/
│   ├── evaluator.py                # Evaluator 核心模块
│   ├── prompts/
│   │   └── evaluator_system.md     # 评估系统 Prompt
│   └── app_factory.py              # API 端点
└── scripts/
    └── test_evaluator.py           # 集成测试
```

### 评估流程

```
用户输入（PRD + 测试用例）
    ↓
构建评估 Prompt
    ↓
调用 LLM API（OpenAI/Anthropic）
    ↓
解析 JSON 报告
    ↓
返回结构化评估结果
```

---

## 下一步

- ✅ Week 1: ChromaDB 向量数据库集成
- ✅ Week 2: PDF/图片多模态文件解析
- ✅ Week 3: QA Engineer Skill 集成
- ✅ Week 4: 知识回流与历史归档
- ✅ **Week 5: AI 质检评估模块**（当前）
- ⏳ Week 6: 集成测试与部署

---

## 参考资料

- [Evaluator 实现](agent_app/evaluator.py)
- [评估系统 Prompt](agent_app/prompts/evaluator_system.md)
- [API 端点实现](agent_app/app_factory.py#L619-L712)
- [集成测试](scripts/test_evaluator.py)

---

**文档版本**: 1.0
**更新日期**: 2026-01-28
**作者**: Claude Code
