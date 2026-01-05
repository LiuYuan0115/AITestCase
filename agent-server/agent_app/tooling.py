"""
工具 schema 与工具执行（LangGraph 节点会调用这里）
"""

import json
from typing import Any, Dict, Optional


# ======== PRD 工具 schema（沿用你原来的 JSON schema）========
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


# ======== UI Agent 工具 schema（增强版：支持断言、自愈） ========
ui_agent_tools_schema = [
        {
        "type": "function",
        "function": {
            "name": "browser_action",
            "description": """执行浏览器操作（基于Playwright）。用于分析页面、执行测试或获取信息。

## 选择器语法（推荐按优先级使用）：
1. `testid:xxx` - 使用 data-testid 属性（最稳定）
2. `extid:xxx` - 使用 data-ext-id 属性（插件专用）
3. `role:button,name:登录` - 使用角色+名称（语义化）
4. `aria:提交` - 使用 aria-label
5. `label:用户名` / `placeholder:请输入` - 表单字段
6. `text:登录` - 文本定位（谨慎使用）
7. CSS 选择器 - 最后手段

## 执行策略（由执行器实现）：
- 自动等待页面稳定（domcontentloaded）
- 自动等待元素可见并滚动到视图
- 失败自动截图并有限重试（建议 2-3 次）
- 对插件注入场景建议优先使用 testid/extid""",
            "parameters": {
                "type": "object",
                "properties": {
                    "action_type": {
                        "type": "string",
                        "enum": [
                            "navigate",
                            "click",
                            "fill",
                            "press",
                            "get_content",
                            "screenshot",
                            "evaluate",
                            "hover",
                            "select",
                            "assert",
                            "wait"
                        ],
                        "description": "操作类型"
                    },
                    "url": {
                        "type": "string",
                        "description": "navigate 操作的目标 URL（可为绝对或相对）"
                    },
                    "selector": {
                        "type": "string",
                        "description": "click/fill/hover/select/assert 操作的目标选择器（支持 testid/extid/role/aria/label/placeholder/text/CSS）"
                    },
                    "text": {
                        "type": "string",
                        "description": "fill 操作要输入的文本"
                    },
                    "key": {
                        "type": "string",
                        "description": "press 操作要按下的键（如 Enter、Tab、ArrowDown）。若未提供，可复用 text/value 字段"
                    },
                    "option": {
                        "type": "string",
                        "description": "select 操作要选择的 option 值或文本"
                    },
                    "js_code": {
                        "type": "string",
                        "description": "evaluate 要执行的 JavaScript 代码"
                    },
                    "full_page": {
                        "type": "boolean",
                        "description": "screenshot 是否截全页（默认 true）"
                    },
                    "timeout_ms": {
                        "type": "integer",
                        "description": "本次操作超时时间（毫秒），可选"
                    },
                    "wait_time_ms": {
                        "type": "integer",
                        "description": "wait 操作等待时间（毫秒）"
                    },
                    "assert_type": {
                        "type": "string",
                        "enum": [
                            "url_contains",
                            "url_equals",
                            "text_visible",
                            "text_hidden",
                            "element_visible",
                            "element_hidden",
                            "element_count"
                        ],
                        "description": "断言类型"
                    },
                    "expected": {
                        "description": "断言期望值：url/text 为字符串；element_count 为数字",
                        "oneOf": [
                            {"type": "string"},
                            {"type": "number"},
                            {"type": "integer"}
                        ]
                    },
                    "note": {
                        "type": "string",
                        "description": "可选备注（用于报告/调试）"
                    }
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
                    "doc_type": {"type": "string", "enum": ["plan", "report"], "description": "文档类型：plan=测试计划, report=测试报告"},
                    "content": {"type": "string", "description": "完整的Markdown格式文档内容"},
                    "description": {"type": "string", "description": "操作描述（中文），例如：已生成测试计划"}
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
                    "analysis_type": {"type": "string", "enum": ["question", "suggestion", "explanation", "action_result"]},
                    "result": {"type": "string", "description": "响应内容，必须使用中文，Markdown格式输出。"}
                },
                "required": ["analysis_type", "result"]
            }
        }
    }
]


def parse_first_tool_call(message: Any) -> Optional[Dict[str, Any]]:
    """
    从 OpenAI message 中提取第一个 tool_call（兼容 OpenAI SDK 对象）
    """
    tool_calls = getattr(message, "tool_calls", None)
    if not tool_calls:
        return None

    first = tool_calls[0]
    func = first.function
    return {
        "tool_call_id": getattr(first, "id", None),
        "name": getattr(func, "name", None),
        "arguments": getattr(func, "arguments", "{}"),
    }


def execute_prd_tool(tool_name: str, arguments_json: str, current_prd: str) -> Dict[str, Any]:
    """
    执行 PRD 工具（其实就是解析 LLM 返回的结构化结果）
    """
    args = json.loads(arguments_json or "{}")

    if tool_name == "analyze_prd":
        return {
            "type": "query",
            "response": args.get("result", "分析完成"),
        }

    if tool_name == "edit_prd":
        action = args.get("action", "modify")
        description = args.get("description", "已修改")
        deleted_content = args.get("deleted_content", "")
        new_prd = args.get("new_prd", current_prd)

        if action == "delete" and deleted_content:
            description = f"{description}\n\n**已删除内容摘要**：\n> {deleted_content[:200]}{'...' if len(deleted_content) > 200 else ''}"

        return {
            "type": action,
            "response": description,
            "newPrd": new_prd,
        }

    return {
        "type": "query",
        "response": "未识别的工具调用",
    }


def execute_testcase_tool(tool_name: str, arguments_json: str, current_testcase: str) -> Dict[str, Any]:
    args = json.loads(arguments_json or "{}")

    if tool_name == "analyze_testcase":
        return {
            "type": "query",
            "response": args.get("result", "分析完成"),
        }

    if tool_name == "edit_testcase":
        action = args.get("action", "modify")
        description = args.get("description", "已修改")
        deleted_content = args.get("deleted_content", "")
        new_testcase = args.get("new_testcase", current_testcase)

        if action == "delete" and deleted_content:
            description = f"{description}\n\n**已删除内容摘要**：\n> {deleted_content[:200]}{'...' if len(deleted_content) > 200 else ''}"

        return {
            "type": action,
            "response": description,
            "newTestcase": new_testcase,
        }

    return {
        "type": "query",
        "response": "未识别的工具调用",
    }


