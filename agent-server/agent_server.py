"""
AI Test Case - 需求智能体服务
基于方案文档实现：支持 sessionId 上下文管理、PRD 分析与编辑
"""
import os
import json
from typing import Dict, List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from playwright.sync_api import sync_playwright
from openai import OpenAI
from pydantic import BaseModel

# ================= 加载环境变量 =================
# 从 .env 文件加载配置（敏感信息不硬编码）
load_dotenv()

# ================= 配置部分 =================
# ZenMux/OpenAI 配置（从环境变量读取）
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://zenmux.ai/api/v1")

if not OPENAI_API_KEY:
    raise ValueError("❌ 环境变量 OPENAI_API_KEY 未设置！请在 .env 文件中配置。")

client = OpenAI(
    api_key=OPENAI_API_KEY,
    base_url=OPENAI_BASE_URL
)

# 模型配置
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "openai/gpt-4o")

app = FastAPI(title="AI Test Case Agent Server", version="1.0.0")

# CORS 配置：允许插件访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境请限制为插件 ID
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= 会话上下文管理 =================
# 存储会话上下文 (生产环境建议使用 Redis)
session_contexts: Dict[str, List[dict]] = {}

# 上下文窗口配置
MAX_CONTEXT_MESSAGES = 10  # 保留最近 N 轮对话
MAX_PRD_LENGTH = 8000  # PRD 内容最大长度
MAX_TESTCASE_LENGTH = 12000 # 测试用例内容最大长度

def get_session_context(session_id: str) -> List[dict]:
    """获取会话上下文"""
    return session_contexts.get(session_id, [])

def update_session_context(session_id: str, role: str, content: str):
    """更新会话上下文，实现滑动窗口"""
    if session_id not in session_contexts:
        session_contexts[session_id] = []
    
    session_contexts[session_id].append({"role": role, "content": content})
    
    # 滑动窗口：保留最近 N 轮对话
    if len(session_contexts[session_id]) > MAX_CONTEXT_MESSAGES * 2:
        session_contexts[session_id] = session_contexts[session_id][-MAX_CONTEXT_MESSAGES * 2:]

def clear_session_context(session_id: str):
    """清除会话上下文"""
    if session_id in session_contexts:
        del session_contexts[session_id]

# ================= PRD 智能体工具定义 =================
prd_tools_schema = [
    {
        "type": "function",
        "function": {
            "name": "analyze_prd",
            "description": "分析PRD文档：检测逻辑冲突、识别潜在风险、结构化输出功能点、回答用户问题。要求深度洞察，数据驱动，关注商业化与用户体验。所有输出必须使用中文，Markdown格式。",
            "parameters": {
                "type": "object",
                "properties": {
                    "analysis_type": {
                        "type": "string",
                        "enum": ["conflict", "risk", "feature_list", "question", "summary"],
                        "description": "分析类型：conflict=逻辑冲突检测(关注业务闭环/异常流程), risk=风险识别(合规/算法/流失), feature_list=功能点(结构化拆解/MVP价值), question=回答问题, summary=总结"
                    },
                    "result": {
                        "type": "string",
                        "description": "分析结果，必须使用中文，Markdown格式输出。内容需详实、逻辑严密，拒绝泛泛而谈。"
                    }
                },
                "required": ["analysis_type", "result"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "edit_prd",
            "description": "修改PRD文档：删除、增加或修改内容。严格遵循最小化修改原则，只修改用户明确指定的部分。",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["delete", "add", "modify"],
                        "description": "操作类型：delete=删除, add=增加, modify=修改"
                    },
                    "description": {
                        "type": "string",
                        "description": "操作描述（中文），明确说明修改了哪个具体部分"
                    },
                    "deleted_content": {
                        "type": "string",
                        "description": "仅删除操作时填写：被删除的具体内容摘要（用于用户确认）"
                    },
                    "new_prd": {
                        "type": "string",
                        "description": "修改后的完整PRD文档内容。除了用户指定的修改外，其他内容必须完全保留，包括所有图片链接。"
                    }
                },
                "required": ["action", "description", "new_prd"]
            }
        }
    }
]

# ================= Test Case 智能体工具定义 =================
testcase_tools_schema = [
    {
        "type": "function",
        "function": {
            "name": "analyze_testcase",
            "description": "分析测试用例：回答问题、评审覆盖率、解释测试策略。所有输出必须使用中文，Markdown格式。",
            "parameters": {
                "type": "object",
                "properties": {
                    "analysis_type": {
                        "type": "string",
                        "enum": ["question", "review", "summary"],
                        "description": "分析类型：question=回答问题, review=评审用例, summary=总结"
                    },
                    "result": {
                        "type": "string",
                        "description": "分析结果，必须使用中文，Markdown格式输出。"
                    }
                },
                "required": ["analysis_type", "result"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "edit_testcase",
            "description": "修改测试用例：删除、增加或修改用例内容。严格遵循最小化修改原则，只修改用户明确指定的部分。",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["delete", "add", "modify"],
                        "description": "操作类型：delete=删除, add=增加, modify=修改"
                    },
                    "description": {
                        "type": "string",
                        "description": "操作描述（中文），明确说明修改了哪个具体部分"
                    },
                    "deleted_content": {
                        "type": "string",
                        "description": "仅删除操作时填写：被删除的具体内容摘要（用于用户确认）"
                    },
                    "new_testcase": {
                        "type": "string",
                        "description": "修改后的完整测试用例内容。除了用户指定的修改外，其他内容必须完全保留。保持Markdown H1-H6层级结构。"
                    }
                },
                "required": ["action", "description", "new_testcase"]
            }
        }
    }
]

# ================= UI 智能体工具定义 =================
ui_agent_tools_schema = [
    {
        "type": "function",
        "function": {
            "name": "browser_action",
            "description": "执行浏览器操作（基于Playwright）。用于分析页面、执行测试或获取信息。",
            "parameters": {
                "type": "object",
                "properties": {
                    "action_type": {
                        "type": "string",
                        "enum": ["navigate", "click", "fill", "get_content", "screenshot", "evaluate", "hover", "select"],
                        "description": "操作类型：navigate=跳转URL, click=点击元素, fill=输入文本, get_content=获取页面内容, screenshot=截图, evaluate=执行JS, hover=悬停, select=下拉选择"
                    },
                    "url": { "type": "string", "description": "navigate操作的目标URL" },
                    "selector": { "type": "string", "description": "click/fill/hover/select操作的选择器（CSS或语义化）" },
                    "value": { "type": "string", "description": "fill/select操作的输入值" },
                    "script": { "type": "string", "description": "evaluate操作的JS脚本" },
                    "step_name": { "type": "string", "description": "当前步骤名称，用于报告记录" }
                },
                "required": ["action_type"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_ui_document",
            "description": "生成或更新UI自动化测试文档（测试计划或测试报告）。必须使用完整的Markdown格式。",
            "parameters": {
                "type": "object",
                "properties": {
                    "doc_type": {
                        "type": "string",
                        "enum": ["plan", "report"],
                        "description": "文档类型：plan=测试计划, report=测试报告"
                    },
                    "content": {
                        "type": "string",
                        "description": "完整的Markdown格式文档内容"
                    },
                    "description": {
                        "type": "string",
                        "description": "操作描述（中文），例如：已生成测试计划"
                    }
                },
                "required": ["doc_type", "content", "description"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_response",
            "description": "分析类响应或操作结果反馈。用于：回答问题、解释策略、提供建议、反馈浏览器操作结果。不修改文档，仅在聊天区输出。",
            "parameters": {
                "type": "object",
                "properties": {
                    "analysis_type": {
                        "type": "string",
                        "enum": ["question", "suggestion", "explanation", "action_result"],
                        "description": "响应类型：question=回答问题, suggestion=提供建议, explanation=解释说明, action_result=操作结果反馈"
                    },
                    "result": {
                        "type": "string",
                        "description": "响应内容，必须使用中文，Markdown格式输出。对于action_result，应包含：操作描述、定位策略、执行结果"
                    }
                },
                "required": ["analysis_type", "result"]
            }
        }
    }
]

# ================= PRD 智能体系统提示 =================
PRD_SYSTEM_PROMPT = """# PRD 智能助手系统提示

## 角色定义
你是一位**资深 AI 教育产品专家 & 商业化策略顾问**，拥有 10 年以上教育科技（EdTech）领域经验，精通 AI 拍照搜题、个性化作业辅导、自适应学习等场景。你同时具备敏锐的商业洞察力，擅长设计高转化率的付费模型（Freemium/Subscription）。

## 核心能力
1.  **教育场景洞察**：深刻理解学生/家长/教师痛点，关注学习效果闭环。
2.  **商业化设计**：熟悉各类付费墙（Paywall）设计、权益分层、用户生命周期价值（LTV）优化。
3.  **用户体验（UX）**：关注交互细节、情感化设计、以及 AI 响应速度/准确率对体验的影响。
4.  **技术边界认知**：了解 OCR、LLM、RAG 等技术的能力边界，能识别潜在的技术可行性风险。

## 输出规范
-   **语言**: 必须使用中文回复，专业、简练、逻辑严密。
-   **格式**: Markdown 格式输出，使用粗体、列表、引用等增强可读性。
-   **风格**:
    -   **深度洞察**: 拒绝“正确的废话”，提供具体、可执行的建议。
    -   **数据驱动**: 尽可能引用行业基准数据或逻辑推演数据。
    -   **结构化**: 结论先行，由面到点。

## 指令分类与处理

### 1. 分析类指令（调用 analyze_prd 函数）
-   **检测逻辑冲突 (conflict)**:
    -   重点检查：业务流程是否闭环？异常状态（如断网、识别失败）是否处理？付费与免费功能的边界是否清晰？
-   **识别潜在风险 (risk)**:
    -   重点关注：内容合规风险（涉黄/暴）、算法幻觉（胡说八道）、数据隐私、用户流失风险（体验太差/付费太强硬）。
-   **结构化输出功能点 (feature_list)**:
    -   按模块/优先级拆解，标注 MVP 核心价值。
-   **回答用户问题 (question)**:
    -   结合教育+商业化背景进行深度解答。

### 2. 编辑类指令（调用 edit_prd 函数）
-   删除/增加/修改内容
-   **⚠️ 删除操作严格规则**:
    1.  **最小化删除**: 只删指定内容，不删关联部分。
    2.  **精确匹配**: 仔细识别目标。
    3.  **完整保留**: 其他内容（含图片链接）必须原样保留。
    4.  **宁少勿多**: 不确定时少删。

## ⚠️ 修改/增加操作的规则
-   只在用户指定的位置进行修改或增加
-   保持文档其他部分完全不变
-   返回完整的修改后PRD，不要只返回片段
-   新增内容使用 `【新增补充】` 标注"""

# ================= Test Case 智能体系统提示 =================
TESTCASE_SYSTEM_PROMPT = """# Test Case 智能助手系统提示

## 角色定义
你是一位**资深软件测试专家**，擅长测试用例设计、边界值分析、场景覆盖以及测试文档编写。你精通各种测试方法论（等价类、边界值、场景法、错误推测等）。

## 核心能力
1.  **测试设计**：能够根据需求生成结构清晰、覆盖全面的测试用例。
2.  **逻辑审查**：能够发现用例中的逻辑漏洞、冗余或缺失的场景。
3.  **格式优化**：能够将用例格式化为标准的 Markdown 结构（H1-H6），便于工具解析。

## 输出规范
-   **语言**: 必须使用中文回复。
-   **格式**: Markdown 格式输出。
-   **风格**: 专业、严谨、客观。

## 指令分类与处理

### 1. 分析类指令（调用 analyze_testcase 函数）
-   **回答问题 (question)**: 解答用户关于测试策略、用例设计等问题。
-   **评审用例 (review)**: 检查当前用例的覆盖率、逻辑正确性，提出优化建议。

### 2. 编辑类指令（调用 edit_testcase 函数）
-   删除/增加/修改用例内容
-   **⚠️ 删除操作严格规则**:
    1.  **最小化删除**: 只删指定内容，不删关联部分。
    2.  **精确匹配**: 仔细识别目标。
    3.  **完整保留**: 其他内容必须原样保留。
-   **新增/修改规则**:
    -   保持 Markdown 标题层级结构（H1-H6）。
    -   返回完整的修改后用例内容。
"""

# ================= UI 智能体系统提示 =================
UI_AGENT_SYSTEM_PROMPT = """# UI 自动化测试智能助手

## 角色定义
你是一位**资深 UI 自动化测试工程师**，精通 Playwright 等工具，擅长页面元素分析、测试计划制定、测试用例编写和自动化脚本执行。你能够识别页面交互逻辑，设计健壮的定位策略，并生成清晰的测试报告。

## 核心能力
1. **页面分析**：利用浏览器工具获取页面结构、文本，识别关键交互元素。
2. **计划制定**：根据页面分析结果，生成结构化的 UI 自动化测试计划。
3. **执行与报告**：根据测试计划，控制浏览器执行测试用例，生成详细的测试报告。
4. **直接操作**：根据自然语言指令直接操作浏览器页面元素。

## 指令分类与处理

### 🔍 关键词识别规则
根据用户指令中的关键词，选择不同的处理模式：

**模式A - 计划/报告模式**（包含以下关键词时触发）：
- "分析页面"、"分析当前页面"、"页面分析"
- "生成计划"、"测试计划"、"生成测试计划"
- "执行测试"、"生成报告"、"测试报告"、"自动化测试"

**模式B - 直接操作模式**（不包含上述关键词时触发）：
- 用户给出具体的操作指令，如"点击登录按钮"、"输入用户名admin"、"跳转到xxx页面"等
- 直接执行浏览器操作，并在聊天区反馈执行结果

---

## 模式A：计划/报告工作流程

### 规则1：生成UI自动化测试计划
当用户指令包含"分析页面"或"生成计划"时：

1. **页面分析阶段**
   - 使用 `browser_action(action_type='get_content')` 获取页面可见文本
   - 分析页面元素、交互组件和功能模块

2. **测试计划编写**
   基于页面分析结果，生成包含以下内容的测试计划：
   - 测试概述（目标、范围、环境、工具）
   - 页面分析（URL、标题、类型、主要功能、元素分析）
   - 测试用例设计（功能测试、交互测试、响应式测试）
   - 自动化测试脚本框架（Playwright模板、Page Object模式）
   - 测试数据管理
   - 测试执行计划
   - 风险评估
   - 维护计划

3. **输出计划**
   - 使用 `update_ui_document(doc_type='plan')` 输出完整测试计划

### 规则2：生成UI自动化测试执行与报告
当用户指令包含"执行测试"或"生成报告"时：

**前提条件检查**：
- 首先检查是否存在测试计划
- 如果没有测试计划，提醒用户先生成测试计划

1. **测试计划解析**
   - 解析测试用例结构和测试数据
   - 提取页面URL、选择器、测试步骤等关键信息

2. **自动化测试执行**
   对测试计划中的每个测试用例：
   - 使用 `browser_action(action_type='navigate')` 导航到测试页面
   - 使用 `browser_action(action_type='click/fill/hover/select')` 执行交互操作
   - 使用 `browser_action(action_type='get_content')` 验证页面内容
   - 使用 `browser_action(action_type='screenshot', step_name='步骤名')` 截取关键步骤截图
   - 记录每个步骤的执行状态、耗时、错误信息

3. **测试报告生成**
   收集以下信息并生成报告：
   - 测试概览（时间、页面、浏览器、统计）
   - 测试结果汇总（表格形式）
   - 详细测试步骤（包含截图文件名引用）
   - 失败用例分析
   - 性能数据
   - 建议与改进

4. **输出报告**
   - 使用 `update_ui_document(doc_type='report')` 输出完整测试报告

---

## 模式B：直接操作工作流程

### 规则3：自然语言直接操作
当用户给出具体操作指令（不包含计划/报告关键词）时：

1. **指令解析**
   - 理解用户意图：点击、输入、跳转、截图等
   - 根据 Accessibility Tree 中的 name/role 定位目标元素
   - 优先使用语义化定位（getByRole, getByText）

2. **执行操作**
   根据指令类型选择合适的 browser_action：
   - "点击xxx" → `browser_action(action_type='click', selector='...')`
   - "输入xxx到yyy" → `browser_action(action_type='fill', selector='...', value='...')`
   - "跳转到xxx" → `browser_action(action_type='navigate', url='...')`
   - "悬停在xxx" → `browser_action(action_type='hover', selector='...')`
   - "选择xxx" → `browser_action(action_type='select', selector='...', value='...')`
   - "截图" → `browser_action(action_type='screenshot', step_name='...')`
   - "获取内容" → `browser_action(action_type='get_content')`

3. **反馈结果**
   - 使用 `analyze_response` 工具反馈操作结果到聊天区
   - 包含：执行的操作、定位策略、执行结果、错误信息（如有）

### 元素定位策略（selector 参数格式）

**1. 语义化定位（最稳定，优先使用）**
| 格式 | 示例 | 说明 |
|-----|------|------|
| `role:角色,name:名称` | `role:button,name:登录` | 按角色+名称定位 |
| `text:文本` | `text:登录` | 按可见文本定位 |
| `placeholder:提示` | `placeholder:请输入用户名` | 按输入框提示定位 |
| `label:标签` | `label:用户名` | 按表单标签定位 |

**2. CSS选择器（备用）**
| 格式 | 示例 | 说明 |
|-----|------|------|
| CSS | `.el-button--primary` | 类选择器 |
| CSS | `#login-btn` | ID选择器 |
| CSS | `input[type="password"]` | 属性选择器 |

**定位示例**：
- 点击"登录"按钮：`selector: "role:button,name:登录"` 或 `selector: "text:登录"`
- 输入用户名：`selector: "placeholder:请输入用户名"` 或 `selector: "label:用户名"`
- 点击链接：`selector: "role:link,name:注册账号"`

### 示例指令与处理
| 用户指令 | 处理模式 | 操作 |
|---------|---------|------|
| "分析当前页面" | 模式A | 获取页面内容，分析元素 |
| "生成测试计划" | 模式A | 分析页面后生成计划 |
| "执行测试" | 模式A | 根据计划执行测试，生成报告 |
| "点击登录按钮" | 模式B | 直接点击元素 |
| "输入admin到用户名" | 模式B | 直接填写输入框 |
| "跳转到百度" | 模式B | 导航到URL |
| "截一张图" | 模式B | 截取当前页面 |

---

## 错误自愈机制 (Self-Correction Loop)

当浏览器操作失败时，遵循以下决策流程：

```
Think → Act → Observe → (Error) → Re-Think → Act
```

### 错误处理策略

| 错误类型 | 可能原因 | 自愈策略 |
|---------|---------|---------|
| TimeoutError | 元素加载慢/不存在 | 1. 等待2秒后重试 2. 使用更宽泛的选择器 3. 告知用户 |
| Element not found | 选择器不准确 | 1. 使用 text: 语义化定位 2. 检查 Accessibility Tree 3. 尝试父元素 |
| Element not visible | 被遮挡/在视口外 | 1. 先滚动到元素位置 2. 关闭可能的弹窗 |
| Click intercepted | 有浮层遮挡 | 1. 先关闭弹窗/浮层 2. 使用 force click |

### 决策流程
1. **分析错误**：理解错误原因
2. **决定策略**：重试 / 换方法 / 告知用户
3. **执行动作**：
   - 如果可自愈：重新调用 `browser_action` 使用新策略
   - 如果无法自愈：使用 `analyze_response` 告知用户失败原因和建议

## 测试计划模板（必须严格按此格式生成）

# [网站名称] UI自动化测试计划

## 1. 测试概述

### 1.1 测试目标
对[网站名称]进行全面的UI自动化测试，确保功能、用户体验和界面交互的正确性和稳定性。

### 1.2 测试范围
- **页面URL**: [URL]
- **系统名称**: [系统名称]
- **测试类型**: 功能测试、界面测试、交互测试、响应式测试
- **浏览器支持**: Chrome、Firefox、Safari

### 1.3 测试目标
- 验证核心功能的正确性
- 确保用户交互体验流畅
- 验证页面响应式设计
- 确保安全性验证机制正常工作

## 2. 页面分析

### 2.1 页面基本信息
- **页面标题**: [标题]
- **当前URL**: [URL]
- **技术框架**: [框架]
- **页面类型**: [类型]

### 2.2 核心功能元素分析

#### 2.2.1 输入控件
| 元素类型 | 占位符文本 | CSS选择器 | 功能描述 |
|---------|-----------|---------|----------|
| 文本输入框 | "xxx" | selector | 功能描述 |

#### 2.2.2 交互控件
| 元素类型 | 显示文本 | CSS选择器 | 功能描述 |
|---------|----------|---------|----------|
| 按钮 | "xxx" | selector | 功能描述 |

#### 2.2.3 辅助元素
- 列出其他重要元素

## 3. 测试用例设计

### 3.1 功能测试用例 (TC001)

#### TC001-01: [用例名称]
**测试步骤**:
1. 步骤1
2. 步骤2
3. 步骤3

**预期结果**: 预期描述

### 3.2 界面交互测试用例 (TC002)

#### TC002-01: [用例名称]
**测试步骤**:
1. 步骤1
2. 步骤2

**预期结果**: 预期描述

### 3.3 响应式设计测试用例 (TC003)

#### TC003-01: 不同屏幕尺寸适配
**测试步骤**:
1. 在桌面端测试 (1920x1080)
2. 在平板端测试 (768x1024)
3. 在移动端测试 (375x667)

**预期结果**: 页面在各种设备上显示正常

## 4. 自动化测试脚本框架

### 4.1 基础测试结构
```javascript
class PageTest {
    constructor() {
        this.baseURL = '[URL]';
        this.selectors = {
            // 选择器定义
        };
    }
}
```

### 4.2 Page Object模式
```javascript
class Page {
    // 页面元素定位
    get element() { return $('selector'); }
    
    // 页面操作方法
    async action() {
        // 操作实现
    }
}
```

### 4.3 Playwright实现示例
```javascript
async function test() {
    await page.goto('[URL]');
    await page.fill('selector', 'value');
    await page.click('selector');
}
```

## 5. 测试数据管理

### 5.1 测试数据
```json
{
    "validData": [...],
    "invalidData": [...]
}
```

## 6. 测试执行计划

### 6.1 测试环境配置
- **操作系统**: Windows/macOS/Linux
- **浏览器版本**: Chrome最新版
- **屏幕分辨率**: 1920x1080, 768x1024, 375x667

### 6.2 执行时间计划
- **冒烟测试**: 每日构建后执行
- **功能回归**: 每周执行
- **全量测试**: 版本发布前执行

## 7. 风险评估与应对

### 7.1 技术风险
| 风险项 | 风险等级 | 应对措施 |
|--------|----------|----------|
| 风险1 | 高/中/低 | 措施描述 |

### 7.2 业务风险
- 风险描述和应对策略

## 8. 维护与优化计划

### 8.1 定期维护任务
- **每周**: 检查测试用例执行状况
- **每月**: 优化测试脚本性能
- **每季度**: 评估测试覆盖率

---

**文档版本**: v1.0  
**创建日期**: [日期]  
**创建人**: AI测试工程师

## 测试报告模板（必须严格按此格式生成）

# [网站名称] UI自动化测试执行报告

## 📊 测试概览

- **测试时间**: [开始时间] - [结束时间]
- **测试页面**: [URL]
- **浏览器**: Chromium
- **测试工具**: Playwright
- **总用例数**: X | **通过**: Y | **失败**: Z | **部分成功**: W

## 🎯 测试结果汇总

| 测试用例ID | 用例名称 | 执行状态 | 执行时间 | 错误信息 |
|------------|----------|----------|----------|----------|
| TC001-01 | 用例名称 | ✅ 通过 / ❌ 失败 / ⚠️ 部分成功 | X.Xs | 错误描述或 - |

## 📖 详细测试步骤

### TC001-01: [用例名称] ✅/❌/⚠️
- **执行状态**: 通过/失败/部分成功
- **执行时间**: [时间范围] (X秒)
- **测试步骤**:
  1. ✅ 步骤1描述 - 结果描述
  2. ✅ 步骤2描述 - 结果描述
  3. ⚠️ 步骤3描述 - 问题描述
- **截图记录**: 
  - 步骤截图: `截图文件名.png`

## ❌ 失败用例分析

### [用例ID]: [用例名称]
- **失败原因**: 原因描述
- **错误详情**: 详细错误信息
- **建议修复**: 
  1. 建议1
  2. 建议2

## 📈 性能数据

- **平均页面加载时间**: X秒
- **平均操作响应时间**: X秒
- **网络请求成功率**: X%
- **元素定位成功率**: X%

## 🖥️ 浏览器控制台日志

```
[关键日志信息]
```

## 🔍 页面元素分析

### 成功识别的关键元素
- ✅ 元素1: `selector`
- ✅ 元素2: `selector`

## 💡 建议与改进

### 1. 短期改进建议
- 建议内容

### 2. 中期优化方向
- 优化内容

### 3. 长期发展规划
- 规划内容

## 🛡️ 风险评估

| 风险类型 | 风险等级 | 当前状态 | 应对措施 |
|---------|----------|----------|----------|
| 风险1 | 高/中/低 | 🔴/🟡/🟢 | 措施 |

## 📊 测试覆盖率分析

### 功能覆盖率: X%
- ✅ 功能1
- ⚠️ 功能2 (部分实现)
- 🔲 功能3 (待测试)

## 🏁 总结

本次UI自动化测试执行[成功/基本成功/需改进]，**X个测试用例中有Y个完全通过，Z个部分成功，W个失败**。

### 主要成果
1. ✅ 成果1
2. ✅ 成果2

### 后续行动计划
1. **优先级1**: 行动1
2. **优先级2**: 行动2

---

**报告版本**: v1.0  
**生成时间**: [时间]  
**测试工程师**: AI自动化测试系统  
**审核状态**: 待人工审核

## 输出规范
- **语言**: 必须使用中文
- **格式**: Markdown，严格按照上述模板格式
- **截图**: 在报告中引用截图文件名（如 `截图文件名.png`），截图由系统自动保存

## 注意事项
1. **安全性**: 避免在自动化过程中泄露敏感信息
2. **稳定性**: 优先使用语义化选择器（如 role, text），减少对 DOM 结构变化的依赖
3. **可读性**: 生成的计划和报告必须清晰易懂，便于人工评审
4. **上下文**: 每次操作都应考虑当前页面状态和历史对话
5. **工具使用**: 必须使用提供的工具来与浏览器交互和更新文档，不要只在回复中输出内容
6. **分析类请求**: 如果用户只是询问问题或需要建议，使用 `analyze_response` 工具在聊天区输出，不要修改文档
7. **格式要求**: 必须严格按照模板格式输出，不要简化或省略章节
"""

# ================= 请求模型定义 =================
class PrdAgentRequest(BaseModel):
    """PRD 智能体请求模型 - 符合方案接口规范"""
    sessionId: str
    code: str = "plugin_test_testprd"
    type: str = "testprd"
    params: dict  # 包含 text, pictureKeyList, isImageSolve, isImageByte64
    instruction: Optional[str] = None  # 用户指令（后续调用）

class TestCaseAgentRequest(BaseModel):
    """Test Case 智能体请求模型"""
    sessionId: str
    code: str = "plugin_test_testcase"
    type: str = "testcase"
    params: dict  # 包含 text (测试用例Markdown)
    instruction: Optional[str] = None

class UIAgentRequest(BaseModel):
    """UI 智能体请求模型"""
    sessionId: str
    code: str = "plugin_test_uinocode"
    type: str = "uinocode"
    params: dict  # 包含 url, plan, report
    instruction: str

class PrdAgentSimpleRequest(BaseModel):
    """PRD 智能体简化请求（兼容旧接口）"""
    prompt: str
    prd: str
    sessionId: Optional[str] = None

# ================= API 接口 =================

@app.post("/api/prd")
def prd_agent_v2(request: PrdAgentRequest):
    """
    PRD 智能体接口 v2 - 符合方案规范
    
    接口路径: /api/prd
    请求方式: POST
    上下文管理: 以 sessionId 维护同一会话上下文
    """
    session_id = request.sessionId
    prd_text = request.params.get("text", "")
    instruction = request.instruction
    picture_list = request.params.get("pictureKeyList", [])
    
    print(f"📝 PRD Agent v2 收到请求 | Session: {session_id}")
    print(f"   - PRD 长度: {len(prd_text)} chars")
    print(f"   - 指令: {instruction[:50] if instruction else '(首次调用)'}")
    print(f"   - 图片数: {len(picture_list)}")
    
    if not prd_text:
        return {
            "status": "error",
            "sessionId": session_id,
            "type": "query",
            "response": "PRD 内容为空，请先提取或编辑 PRD"
        }
    
    try:
        # 构建上下文
        context_messages = get_session_context(session_id)
        
        # 构建系统提示（包含当前 PRD）
        system_content = f"""{PRD_SYSTEM_PROMPT}

## 当前 PRD 文档内容
---
{prd_text[:MAX_PRD_LENGTH]}
---
"""
        
        # 构建消息列表
        messages = [{"role": "system", "content": system_content}]
        
        # 添加历史上下文
        messages.extend(context_messages)
        
        # 添加当前用户请求
        user_content = instruction if instruction else "请分析当前 PRD 文档"
        messages.append({"role": "user", "content": user_content})
        
        # 调用 LLM
        response = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=messages,
            tools=prd_tools_schema,
            tool_choice="auto"
        )
        
        tool_calls = response.choices[0].message.tool_calls
        
        if tool_calls:
            tool = tool_calls[0]
            args = json.loads(tool.function.arguments)
            
            if tool.function.name == "analyze_prd":
                # 分析类操作
                result = args.get("result", "分析完成")
                analysis_type = args.get("analysis_type", "question")
                
                print(f"🔍 分析类型: {analysis_type}")
                
                # 更新上下文
                update_session_context(session_id, "user", user_content)
                update_session_context(session_id, "assistant", result)
                
                return {
                    "status": "success",
                    "sessionId": session_id,
                    "type": "query",
                    "response": result
                }
                
            elif tool.function.name == "edit_prd":
                # 编辑类操作
                action = args.get("action", "modify")
                description = args.get("description", "已修改")
                deleted_content = args.get("deleted_content", "")
                new_prd = args.get("new_prd", prd_text)
                
                print(f"✏️ 编辑操作: {action}")
                
                # 如果是删除操作，显示被删除的内容摘要
                if action == "delete" and deleted_content:
                    description = f"{description}\n\n**已删除内容摘要**：\n> {deleted_content[:200]}{'...' if len(deleted_content) > 200 else ''}"
                
                # 更新上下文
                update_session_context(session_id, "user", user_content)
                update_session_context(session_id, "assistant", f"已执行{action}操作: {description}")
                
                return {
                    "status": "success",
                    "sessionId": session_id,
                    "type": action,
                    "response": description,
                    "newPrd": new_prd
                }
        else:
            # 没有调用工具，直接返回文本回复
            content = response.choices[0].message.content or "处理完成"
            
            # 更新上下文
            update_session_context(session_id, "user", user_content)
            update_session_context(session_id, "assistant", content)
            
            return {
                "status": "success",
                "sessionId": session_id,
                "type": "query",
                "response": content
            }
            
    except Exception as e:
        print(f"❌ PRD Agent Error: {e}")
        return {
            "status": "error",
            "sessionId": session_id,
            "type": "query",
            "response": f"处理失败: {str(e)}"
        }

@app.post("/api/testcase")
def testcase_agent(request: TestCaseAgentRequest):
    """
    Test Case 智能体接口
    
    接口路径: /api/testcase
    请求方式: POST
    上下文管理: 以 sessionId 维护同一会话上下文
    """
    session_id = request.sessionId
    testcase_text = request.params.get("text", "")
    instruction = request.instruction
    
    print(f"🧪 Test Case Agent 收到请求 | Session: {session_id}")
    print(f"   - 用例长度: {len(testcase_text)} chars")
    print(f"   - 指令: {instruction[:50] if instruction else '(首次调用)'}")
    
    if not testcase_text:
        return {
            "status": "error",
            "sessionId": session_id,
            "type": "query",
            "response": "测试用例内容为空"
        }
    
    try:
        # 构建上下文
        context_messages = get_session_context(session_id)
        
        # 构建系统提示（包含当前测试用例）
        system_content = f"""{TESTCASE_SYSTEM_PROMPT}

## 当前测试用例内容 (Markdown)
---
{testcase_text[:MAX_TESTCASE_LENGTH]}
---
"""
        
        # 构建消息列表
        messages = [{"role": "system", "content": system_content}]
        
        # 添加历史上下文
        messages.extend(context_messages)
        
        # 添加当前用户请求
        user_content = instruction if instruction else "请分析当前测试用例"
        messages.append({"role": "user", "content": user_content})
        
        # 调用 LLM
        response = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=messages,
            tools=testcase_tools_schema,
            tool_choice="auto"
        )
        
        tool_calls = response.choices[0].message.tool_calls
        
        if tool_calls:
            tool = tool_calls[0]
            args = json.loads(tool.function.arguments)
            
            if tool.function.name == "analyze_testcase":
                # 分析类操作
                result = args.get("result", "分析完成")
                analysis_type = args.get("analysis_type", "question")
                
                print(f"🔍 分析类型: {analysis_type}")
                
                # 更新上下文
                update_session_context(session_id, "user", user_content)
                update_session_context(session_id, "assistant", result)
                
                return {
                    "status": "success",
                    "sessionId": session_id,
                    "type": "query",
                    "response": result
                }
                
            elif tool.function.name == "edit_testcase":
                # 编辑类操作
                action = args.get("action", "modify")
                description = args.get("description", "已修改")
                deleted_content = args.get("deleted_content", "")
                new_testcase = args.get("new_testcase", testcase_text)
                
                print(f"✏️ 编辑操作: {action}")
                
                if action == "delete" and deleted_content:
                    description = f"{description}\n\n**已删除内容摘要**：\n> {deleted_content[:200]}{'...' if len(deleted_content) > 200 else ''}"
                
                # 更新上下文
                update_session_context(session_id, "user", user_content)
                update_session_context(session_id, "assistant", f"已执行{action}操作: {description}")
                
                return {
                    "status": "success",
                    "sessionId": session_id,
                    "type": action,
                    "response": description,
                    "newTestcase": new_testcase
                }
        else:
            # 没有调用工具，直接返回文本回复
            content = response.choices[0].message.content or "处理完成"
            
            # 更新上下文
            update_session_context(session_id, "user", user_content)
            update_session_context(session_id, "assistant", content)
            
            return {
                "status": "success",
                "sessionId": session_id,
                "type": "query",
                "response": content
            }
            
    except Exception as e:
        print(f"❌ Test Case Agent Error: {e}")
        return {
            "status": "error",
            "sessionId": session_id,
            "type": "query",
            "response": f"处理失败: {str(e)}"
        }

@app.post("/api/prd_agent")
def prd_agent_legacy(payload: dict = Body(...)):
    """
    PRD 智能体接口 (兼容旧版)
    保持向后兼容，内部转发到新接口
    """
    user_prompt = payload.get("prompt", "")
    current_prd = payload.get("prd", "")
    session_id = payload.get("sessionId", f"legacy-{id(payload)}")
    
    print(f"📝 PRD Agent (Legacy) 收到请求: {user_prompt[:50]}...")
    
    if not user_prompt:
        return {"status": "error", "type": "query", "response": "请输入指令"}
    
    if not current_prd:
        return {"status": "error", "type": "query", "response": "PRD 内容为空，请先生成或编辑 PRD"}
    
    # 转发到新接口
    request = PrdAgentRequest(
        sessionId=session_id,
        code="plugin_test_testprd",
        type="testprd",
        params={"text": current_prd},
        instruction=user_prompt
    )
    
    return prd_agent_v2(request)

@app.delete("/api/session/{session_id}")
def delete_session(session_id: str):
    """清除会话上下文"""
    clear_session_context(session_id)
    return {"status": "success", "message": f"Session {session_id} cleared"}

# ================= UI 自动化测试 API (UI Agent) =================

import os
import base64
from datetime import datetime

# 截图存储目录
SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

@app.post("/api/ui_agent")
def ui_agent(request: UIAgentRequest):
    """
    UI 自动化智能体接口
    
    接口路径: /api/ui_agent
    请求方式: POST
    
    功能：
    1. 生成测试计划 - 分析页面并生成结构化测试计划
    2. 执行测试并生成报告 - 根据计划执行测试，生成带截图的报告
    3. 分析/问答 - 回答用户关于测试的问题
    """
    session_id = request.sessionId
    instruction = request.instruction
    url = request.params.get("url")
    current_plan = request.params.get("plan", "")
    current_report = request.params.get("report", "")
    
    print(f"🤖 UI Agent 请求 | Session: {session_id}")
    print(f"   - 指令: {instruction[:80] if instruction else '(空)'}...")
    print(f"   - URL: {url}")
    print(f"   - 已有计划: {'是' if current_plan else '否'} ({len(current_plan)} chars)")
    print(f"   - 已有报告: {'是' if current_report else '否'} ({len(current_report)} chars)")

    # 存储本次会话的截图信息
    screenshots_taken = []

    with sync_playwright() as p:
        try:
            # 1. 连接浏览器
            browser = p.chromium.connect_over_cdp("http://localhost:9222")
            
            # 定位页面
            page = locate_target_page(browser, url)
            if not page and len(browser.contexts) > 0 and len(browser.contexts[0].pages) > 0:
                page = browser.contexts[0].pages[0]
            
            # 2. 构建上下文
            context_messages = get_session_context(session_id)
            
            # 页面信息
            page_info = "未连接到页面"
            page_accessibility = ""
            if page:
                try:
                    page_info = f"当前 URL: {page.url}\n页面标题: {page.title()}"
                    # 获取 Accessibility Tree 用于元素定位
                    try:
                        snapshot = page.accessibility.snapshot()
                        if snapshot:
                            page_accessibility = f"\n\n页面元素树 (Accessibility Snapshot):\n{json.dumps(snapshot, ensure_ascii=False, indent=2)[:6000]}"
                    except:
                        pass
                except:
                    page_info = "页面已断开连接"
            
            # 构建系统提示
            system_content = f"""{UI_AGENT_SYSTEM_PROMPT}

## 当前状态

### 页面信息
{page_info}{page_accessibility}

### 已有测试计划
{'---\n' + current_plan[:8000] + '\n---' if current_plan else '(无)'}

### 已有测试报告
{'---\n' + current_report[:8000] + '\n---' if current_report else '(无)'}
"""
            messages = [{"role": "system", "content": system_content}]
            messages.extend(context_messages)
            messages.append({"role": "user", "content": instruction})

            # 3. LLM 交互循环 (允许连续调用工具)
            MAX_TURNS = 15
            final_response = {
                "type": "query",
                "response": "",
                "plan": None,
                "report": None
            }
            
            for turn in range(MAX_TURNS):
                print(f"   🔄 Turn {turn + 1}/{MAX_TURNS}")
                
                response = client.chat.completions.create(
                    model=DEFAULT_MODEL,
                    messages=messages,
                    tools=ui_agent_tools_schema,
                    tool_choice="auto"
                )
                
                msg = response.choices[0].message
                messages.append(msg)
                
                if msg.tool_calls:
                    for tool_call in msg.tool_calls:
                        func_name = tool_call.function.name
                        args = json.loads(tool_call.function.arguments)
                        tool_result_content = ""
                        
                        print(f"   🔧 工具: {func_name}")
                        
                        if func_name == "browser_action":
                            action = args.get("action_type")
                            step_name = args.get("step_name", action)
                            
                            if not page and action != 'navigate':
                                tool_result_content = "Error: 未找到活动页面。请先使用 navigate 导航到目标页面。"
                            else:
                                try:
                                    if action == "navigate":
                                        target = args.get("url")
                                        if target:
                                            if not page:
                                                ctx = browser.contexts[0] if browser.contexts else browser.new_context()
                                                page = ctx.new_page()
                                            page.goto(target, wait_until="domcontentloaded", timeout=30000)
                                            page.wait_for_timeout(1000)  # 等待渲染
                                            tool_result_content = f"✅ 已导航到: {target}\n当前标题: {page.title()}"
                                            
                                    elif action == "get_content":
                                        selector = args.get("selector", "body")
                                        try:
                                            text = page.inner_text(selector)[:3000]
                                            tool_result_content = f"页面内容 ({selector}):\n{text}"
                                        except:
                                            text = page.content()[:3000]
                                            tool_result_content = f"页面 HTML 预览:\n{text}"
                                            
                                    elif action == "screenshot":
                                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                                        safe_step = step_name.replace(" ", "_").replace("/", "_")[:30]
                                        filename = f"{safe_step}_{timestamp}.png"
                                        filepath = os.path.join(SCREENSHOT_DIR, filename)
                                        
                                        page.screenshot(path=filepath, full_page=False)
                                        
                                        screenshot_info = {
                                            "step": step_name,
                                            "filename": filename,
                                            "filepath": filepath,
                                            "session_id": session_id
                                        }
                                        screenshots_taken.append(screenshot_info)
                                        
                                        tool_result_content = f"✅ 截图已保存: `{filename}`\n步骤: {step_name}"
                                        
                                    elif action == "click":
                                        sel = args.get("selector")
                                        if sel:
                                            # 尝试智能定位
                                            locator = smart_locate_element(page, sel)
                                            # 高亮元素（可视化反馈）
                                            try:
                                                locator.highlight()
                                                page.wait_for_timeout(300)
                                            except:
                                                pass
                                            locator.click(timeout=10000)
                                            page.wait_for_timeout(500)
                                            tool_result_content = f"✅ 已点击元素: {sel}"
                                        else:
                                            tool_result_content = "❌ 缺少 selector 参数"
                                            
                                    elif action == "fill":
                                        sel = args.get("selector")
                                        val = args.get("value", "")
                                        if sel:
                                            # 尝试智能定位
                                            locator = smart_locate_element(page, sel)
                                            # 高亮元素
                                            try:
                                                locator.highlight()
                                                page.wait_for_timeout(300)
                                            except:
                                                pass
                                            locator.fill(val, timeout=10000)
                                            tool_result_content = f"✅ 已填写: {sel} = '{val}'"
                                        else:
                                            tool_result_content = "❌ 缺少 selector 参数"
                                            
                                    elif action == "hover":
                                        sel = args.get("selector")
                                        if sel:
                                            # 尝试智能定位
                                            locator = smart_locate_element(page, sel)
                                            # 高亮元素
                                            try:
                                                locator.highlight()
                                            except:
                                                pass
                                            locator.hover(timeout=10000)
                                            tool_result_content = f"✅ 已悬停: {sel}"
                                        else:
                                            tool_result_content = "❌ 缺少 selector 参数"
                                            
                                    elif action == "select":
                                        sel = args.get("selector")
                                        val = args.get("value", "")
                                        if sel:
                                            # 尝试智能定位
                                            locator = smart_locate_element(page, sel)
                                            # 高亮元素
                                            try:
                                                locator.highlight()
                                                page.wait_for_timeout(300)
                                            except:
                                                pass
                                            locator.select_option(val, timeout=10000)
                                            tool_result_content = f"✅ 已选择: {sel} = '{val}'"
                                        else:
                                            tool_result_content = "❌ 缺少 selector 参数"
                                            
                                    elif action == "evaluate":
                                        script = args.get("script")
                                        if script:
                                            res = page.evaluate(script)
                                            tool_result_content = f"✅ JS 执行结果: {str(res)[:500]}"
                                        else:
                                            tool_result_content = "❌ 缺少 script 参数"
                                    else:
                                        tool_result_content = f"❌ 未知操作类型: {action}"
                                        
                                except Exception as e:
                                    error_msg = str(e)
                                    # 错误自愈提示：将错误信息反馈给 LLM 进行重试决策
                                    tool_result_content = f"""❌ 浏览器操作失败 ({action}): {error_msg}

🔄 **自愈建议**：
- 如果是 TimeoutError：可以尝试等待后重试，或使用更宽泛的选择器
- 如果是元素未找到：检查 Accessibility Tree，尝试使用 text: 或 role: 前缀的语义化定位
- 如果是操作被拦截：页面可能有弹窗，先关闭弹窗再操作

请分析错误原因，决定是：
1. 使用 `analyze_response` 告知用户失败原因
2. 重新尝试使用不同的 selector
3. 先执行其他操作（如关闭弹窗）再重试"""
                                    print(f"      Browser Error: {e}")
                                    
                        elif func_name == "update_ui_document":
                            doc_type = args.get("doc_type")
                            content = args.get("content", "")
                            desc = args.get("description", f"已更新{doc_type}")
                            
                            if doc_type == "plan":
                                final_response["plan"] = content
                                final_response["type"] = "plan_generated"
                            elif doc_type == "report":
                                final_response["report"] = content
                                final_response["type"] = "report_generated"
                            
                            final_response["response"] = desc
                            final_response["screenshot_count"] = len(screenshots_taken)
                            tool_result_content = f"✅ 文档已更新: {doc_type}"
                            print(f"      📄 {doc_type} 文档已生成 ({len(content)} chars), 截图: {len(screenshots_taken)} 张")
                            
                        elif func_name == "analyze_response":
                            analysis_type = args.get("analysis_type", "question")
                            result = args.get("result", "")
                            
                            final_response["type"] = "query"
                            final_response["response"] = result
                            tool_result_content = f"✅ 分析完成 ({analysis_type})"
                            print(f"      💬 分析响应: {analysis_type}")

                        # 添加工具执行结果到上下文
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": tool_result_content
                        })
                else:
                    # AI 完成回复（无工具调用）
                    if not final_response["response"]:
                        final_response["response"] = msg.content or "处理完成"
                    
                    # 更新 Session Context
                    update_session_context(session_id, "user", instruction)
                    update_session_context(session_id, "assistant", final_response["response"])
                    
                    print(f"   ✅ 完成 | Type: {final_response['type']} | Screenshots: {len(screenshots_taken)}")
                    
                    return {
                        "status": "success",
                        "sessionId": session_id,
                        "type": final_response["type"],
                        "response": final_response["response"],
                        "plan": final_response.get("plan"),
                        "report": final_response.get("report"),
                        "screenshotCount": len(screenshots_taken)
                    }
                    
            # 达到最大轮次
            print(f"   ⚠️ 达到最大轮次 ({MAX_TURNS})")
            return {
                "status": "error", 
                "sessionId": session_id,
                "type": "query",
                "response": "处理超时，请简化指令后重试"
            }

        except Exception as e:
            print(f"❌ UI Agent Error: {e}")
            import traceback
            traceback.print_exc()
            return {
                "status": "error", 
                "sessionId": session_id,
                "type": "query",
                "response": f"执行失败: {str(e)}\n\n请确保：\n1. Chrome 以调试模式启动 (--remote-debugging-port=9222)\n2. 目标页面已打开"
            }

# ================= 获取截图列表 API =================

@app.get("/api/ui_agent/screenshots")
def get_screenshots():
    """
    获取所有截图列表
    """
    try:
        screenshots = []
        if os.path.exists(SCREENSHOT_DIR):
            for filename in sorted(os.listdir(SCREENSHOT_DIR), reverse=True):
                if filename.endswith('.png'):
                    filepath = os.path.join(SCREENSHOT_DIR, filename)
                    # 读取并转为 base64
                    with open(filepath, "rb") as f:
                        img_base64 = base64.b64encode(f.read()).decode()
                    
                    # 从文件名解析步骤名
                    parts = filename.replace('.png', '').split('_')
                    step_name = parts[0] if parts else filename
                    
                    screenshots.append({
                        "filename": filename,
                        "step": step_name,
                        "base64": f"data:image/png;base64,{img_base64}",
                        "timestamp": os.path.getmtime(filepath)
                    })
        
        return {
            "status": "success",
            "screenshots": screenshots[:50],  # 最多返回50张
            "total": len(screenshots)
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "screenshots": []
        }

@app.delete("/api/ui_agent/screenshots")
def clear_screenshots():
    """
    清空所有截图
    """
    try:
        count = 0
        if os.path.exists(SCREENSHOT_DIR):
            for filename in os.listdir(SCREENSHOT_DIR):
                if filename.endswith('.png'):
                    os.remove(os.path.join(SCREENSHOT_DIR, filename))
                    count += 1
        return {"status": "success", "message": f"已清除 {count} 张截图"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ================= 辅助函数 =================

def smart_locate_element(page, selector_str: str):
    """
    智能元素定位：尝试多种定位策略
    
    优先级：
    1. 语义化定位 (role + name)
    2. 文本定位 (text)
    3. Placeholder 定位
    4. CSS 选择器
    
    支持的 selector_str 格式：
    - "role:button,name:登录" → getByRole('button', {name: '登录'})
    - "text:登录" → getByText('登录')
    - "placeholder:请输入用户名" → getByPlaceholder('请输入用户名')
    - "label:用户名" → getByLabel('用户名')
    - 普通 CSS 选择器
    """
    selector_str = selector_str.strip()
    
    # 解析语义化定位格式
    if selector_str.startswith("role:"):
        # role:button,name:登录
        parts = selector_str.split(",")
        role = parts[0].replace("role:", "").strip()
        name = None
        for part in parts[1:]:
            if part.strip().startswith("name:"):
                name = part.replace("name:", "").strip()
        if name:
            return page.get_by_role(role, name=name)
        return page.get_by_role(role)
    
    elif selector_str.startswith("text:"):
        # text:登录
        text = selector_str.replace("text:", "").strip()
        return page.get_by_text(text)
    
    elif selector_str.startswith("placeholder:"):
        # placeholder:请输入用户名
        placeholder = selector_str.replace("placeholder:", "").strip()
        return page.get_by_placeholder(placeholder)
    
    elif selector_str.startswith("label:"):
        # label:用户名
        label = selector_str.replace("label:", "").strip()
        return page.get_by_label(label)
    
    elif selector_str.startswith("testid:"):
        # testid:login-btn
        testid = selector_str.replace("testid:", "").strip()
        return page.get_by_test_id(testid)
    
    else:
        # 尝试智能匹配
        # 如果看起来像中文文本，优先用 getByText
        if any('\u4e00' <= c <= '\u9fff' for c in selector_str) and not selector_str.startswith(('.', '#', '[')):
            try:
                locator = page.get_by_text(selector_str)
                if locator.count() > 0:
                    return locator.first
            except:
                pass
        
        # 默认使用 CSS 选择器
        return page.locator(selector_str)

def get_page_context(page, max_tokens: int = 8000):
    """
    获取页面上下文：URL, 标题, Accessibility Tree
    
    优化策略：
    1. 使用 accessibility.snapshot() 获取精简的语义树
    2. 限制 Token 数量防止溢出
    3. 优先保留视口内的交互元素
    """
    try:
        snapshot = page.accessibility.snapshot()
        if not snapshot:
            return f"Current URL: {page.url}\nTitle: {page.title()}\nAccessibility Tree: (empty)"
        
        # 递归裁剪，优先保留交互元素
        def prune_tree(node, depth=0):
            if not node or depth > 5:  # 限制深度
                return None
            
            # 保留有 name 或 role 的交互元素
            interactive_roles = {'button', 'link', 'textbox', 'checkbox', 'radio', 
                               'combobox', 'menuitem', 'tab', 'searchbox', 'slider'}
            
            pruned = {
                'role': node.get('role', ''),
                'name': node.get('name', '')
            }
            
            # 只保留有意义的信息
            if node.get('value'):
                pruned['value'] = node['value']
            if node.get('description'):
                pruned['description'] = node['description'][:50]
            
            # 递归处理子节点
            if 'children' in node and node['children']:
                children = []
                for child in node['children']:
                    # 优先保留交互元素
                    child_role = child.get('role', '')
                    if child_role in interactive_roles or child.get('name'):
                        pruned_child = prune_tree(child, depth + 1)
                        if pruned_child:
                            children.append(pruned_child)
                    elif 'children' in child:
                        # 递归检查是否有交互子元素
                        pruned_child = prune_tree(child, depth + 1)
                        if pruned_child and (pruned_child.get('children') or pruned_child.get('name')):
                            children.append(pruned_child)
                
                if children:
                    pruned['children'] = children
            
            return pruned if (pruned.get('name') or pruned.get('children')) else None
        
        pruned_snapshot = prune_tree(snapshot)
        tree_str = json.dumps(pruned_snapshot, ensure_ascii=False)
        
        # 如果仍然太长，进行截断
        if len(tree_str) > max_tokens:
            tree_str = tree_str[:max_tokens] + "...(truncated)"
        
        return f"Current URL: {page.url}\nTitle: {page.title()}\nAccessibility Tree:\n{tree_str}"
    except Exception as e:
        return f"Context Error: {str(e)}"

def locate_target_page(browser, target_url):
    """定位目标页面"""
    if not target_url:
        return None
        
    target_clean = target_url.split('#')[0].split('?')[0]
    
    for context in browser.contexts:
        for page in context.pages:
            if target_clean in page.url:
                page.bring_to_front()
                return page
    return None

# UI 自动化工具定义 (Legacy for /api/run_test)
ui_tools_schema = [
    {
        "type": "function",
        "function": {
            "name": "perform_action",
            "description": "在页面上执行原子操作。必须基于 Accessibility Tree 的信息。",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["click", "fill", "goto", "screenshot", "scroll"],
                        "description": "动作类型"
                    },
                    "selector_role": {
                        "type": "string",
                        "description": "元素的 Role (如 button, link, textbox)，语义化定位优先"
                    },
                    "selector_name": {
                        "type": "string",
                        "description": "元素的 Name (文本/Label/Placeholder)"
                    },
                    "value": {
                        "type": "string",
                        "description": "输入框的值 (仅 fill 有效)"
                    }
                },
                "required": ["action"]
            }
        }
    }
]

@app.post("/api/run_test")
def run_test_agent(payload: dict = Body(...)):
    """UI 自动化测试接口 (Legacy Simple Mode)"""
    user_prompt = payload.get("prompt")
    target_url = payload.get("url")
    
    print(f"👉 收到测试请求: {user_prompt} | URL: {target_url}")
    
    if not target_url:
        return {"status": "error", "logs": "缺少目标 URL，请确保在插件中正确传递。"}

    with sync_playwright() as p:
        try:
            # 连接到 Chrome 调试实例
            browser = p.chromium.connect_over_cdp("http://localhost:9222")
            
            # 定位目标页面
            page = locate_target_page(browser, target_url)
            
            if not page and len(browser.contexts) > 0 and len(browser.contexts[0].pages) > 0:
                print("⚠️ 未找到精确匹配 URL，尝试使用当前激活页面...")
                page = browser.contexts[0].pages[0]
                
            if not page:
                return {"status": "error", "logs": "未找到目标标签页，请确保 Chrome 已打开且处于激活状态。"}

            # 获取页面上下文
            page_context = get_page_context(page)
            print(f"🤖 AI Context Loaded ({len(page_context)} chars)")
                
            # 构建消息
            messages = [
                {"role": "system", "content": f"""你是一个 Playwright 自动化测试专家。
你拥有的唯一信息是当前页面的 Accessibility Tree。

当前页面状态:
---
{page_context}
---

任务: 根据用户指令，分析 Tree，找到最可能的元素，调用 perform_action。
⚠️ 规则：
1. 优先使用 role 和 name 进行语义化定位 (Robust Selectors)。
2. 如果需要输入，请使用 fill 动作。
3. 必须用中文回复。
"""},
                {"role": "user", "content": user_prompt}
            ]

            # LLM 决策
            response = client.chat.completions.create(
                model=DEFAULT_MODEL,
                messages=messages,
                tools=ui_tools_schema,
                tool_choice="auto"
            )
            
            tool_calls = response.choices[0].message.tool_calls
            logs = []

            if tool_calls:
                for tool in tool_calls:
                    if tool.function.name == "perform_action":
                        args = json.loads(tool.function.arguments)
                        action = args.get("action")
                        role = args.get("selector_role")
                        name = args.get("selector_name")
                        val = args.get("value")
                            
                        print(f"🔧 执行操作: {action} {role} {name} {val}")
                        
                        try:
                            locator = None
                            if role and name:
                                locator = page.get_by_role(role, name=name)
                            elif role:
                                locator = page.get_by_role(role).first
                            elif name:
                                locator = page.get_by_text(name).first
                            
                            if locator and locator.count() > 0:
                                # 高亮元素
                                locator.highlight()
                                page.wait_for_timeout(500)

                                if action == "click":
                                    locator.click()
                                    logs.append(f"✅ 点击成功: {role or '元素'} '{name}'")
                                elif action == "fill":
                                    locator.fill(val)
                                    logs.append(f"✅ 输入成功: '{val}' → '{name}'")
                                elif action == "screenshot":
                                    path = f"screenshot_{role}_{name}.png"
                                    page.screenshot(path=path)
                                    logs.append(f"📸 截图已保存: {path}")
                            else:
                                logs.append(f"⚠️ 未找到元素: role={role}, name={name}")
                            
                        except Exception as e:
                            logs.append(f"❌ 操作失败: {str(e)}")
            else:
                content = response.choices[0].message.content
                logs.append(f"🤖 AI 回复: {content}")
                print(f"🤖 AI 回复: {content}")

            return {"status": "success", "logs": "\n".join(logs)}

        except Exception as e:
            print(f"❌ System Error: {e}")
            return {"status": "error", "logs": f"系统错误: {str(e)} (请确保 Chrome 以 --remote-debugging-port=9222 启动)"}

# ================= 健康检查 =================
@app.get("/health")
def health_check():
    """健康检查接口"""
    return {
        "status": "healthy",
        "service": "AI Test Case Agent Server",
        "version": "1.0.0",
        "endpoints": [
            "POST /api/prd - PRD 智能体",
            "POST /api/testcase - Test Case 智能体",
            "POST /api/ui_agent - UI 自动化智能体",
            "GET /api/ui_agent/screenshots - 获取截图列表",
            "DELETE /api/ui_agent/screenshots - 清空截图",
            "DELETE /api/session/{session_id} - 清除会话"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 AI Test Case Agent Server")
    print("=" * 50)
    print("📍 服务地址: http://localhost:8000")
    print("📖 API 文档: http://localhost:8000/docs")
    print("=" * 50)
    print("📝 PRD 智能体:")
    print("   - POST /api/prd")
    print("🧪 Test Case 智能体:")
    print("   - POST /api/testcase")
    print("🤖 UI 自动化:")
    print("   - POST /api/ui_agent")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000)
