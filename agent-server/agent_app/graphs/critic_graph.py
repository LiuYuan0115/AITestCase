"""
Critic Graph - QA 验收评估 Agent
Phase 5: 独立的质检回路，借鉴 testcase_agent 的 Evaluator 设计

功能：
1. 覆盖度检测（Gap Analysis）
2. 逻辑一致性检查
3. 去重分析
4. 规范性验证
5. 风险点识别
6. 补充用例生成
"""

import json
import logging
from typing import TypedDict, List, Dict, Any, Optional, Literal
from langgraph.graph import StateGraph, END

from ..prompt_manager import PromptManager
from ..config import get_default_model, build_anthropic_client, is_anthropic_model

logger = logging.getLogger(__name__)


# ==========================================
# State Definition
# ==========================================

class CriticState(TypedDict, total=False):
    """Critic Agent 状态"""
    # 输入
    sessionId: str
    prdText: str
    testcaseText: str
    ragContext: Optional[str]
    goldenCases: Optional[str]
    includeRiskAnalysis: bool
    generateSupplementary: bool

    # 处理中间状态
    messages: List[Dict[str, Any]]
    rawResponse: str

    # 输出
    evaluationReport: Dict[str, Any]
    error: Optional[str]


# ==========================================
# Node Functions
# ==========================================

def build_context(state: CriticState) -> CriticState:
    """构建评估上下文"""
    logger.info(f"[CriticGraph] Building context for session {state.get('sessionId')}")

    # 构建评估 prompt
    evaluation_prompt = PromptManager.build_evaluation_prompt(
        prd_text=state.get("prdText", ""),
        testcase_text=state.get("testcaseText", ""),
        rag_context=state.get("ragContext"),
        golden_cases=state.get("goldenCases"),
    )

    # 获取系统 prompt
    system_prompt = PromptManager.get_critic_prompt()

    # 构建消息
    messages = [
        {"role": "user", "content": evaluation_prompt}
    ]

    return {
        **state,
        "messages": messages,
        "_system_prompt": system_prompt,
    }


def call_llm(state: CriticState) -> CriticState:
    """调用 LLM 进行评估"""
    logger.info("[CriticGraph] Calling LLM for evaluation")

    model_name = get_default_model()
    messages = state.get("messages", [])
    system_prompt = state.get("_system_prompt", PromptManager.get_critic_prompt())

    try:
        if is_anthropic_model(model_name):
            client = build_anthropic_client()

            # 转换消息格式
            anthropic_messages = [
                {"role": msg["role"], "content": msg["content"]}
                for msg in messages
            ]

            response = client.messages.create(
                model=model_name.replace("anthropic/", ""),
                max_tokens=4096,
                system=system_prompt,
                messages=anthropic_messages,
            )

            raw_response = response.content[0].text

        else:
            # OpenAI 兼容格式
            from ..config import build_openai_client
            client = build_openai_client()

            openai_messages = [{"role": "system", "content": system_prompt}]
            openai_messages.extend(messages)

            response = client.chat.completions.create(
                model=model_name,
                messages=openai_messages,
                max_tokens=4096,
                temperature=0.0,
            )

            raw_response = response.choices[0].message.content

        logger.info(f"[CriticGraph] LLM response length: {len(raw_response)}")

        return {
            **state,
            "rawResponse": raw_response,
        }

    except Exception as e:
        logger.exception(f"[CriticGraph] LLM call failed: {e}")
        return {
            **state,
            "error": str(e),
        }


def parse_evaluation(state: CriticState) -> CriticState:
    """解析评估结果"""
    raw_response = state.get("rawResponse", "")

    if not raw_response:
        return {
            **state,
            "error": "No response from LLM",
        }

    try:
        # 尝试提取 JSON
        json_match = None

        # 方法1: 查找 ```json ... ``` 块
        import re
        json_block = re.search(r'```json\s*([\s\S]*?)\s*```', raw_response)
        if json_block:
            json_match = json_block.group(1)

        # 方法2: 查找 { ... } 块
        if not json_match:
            brace_match = re.search(r'\{[\s\S]*\}', raw_response)
            if brace_match:
                json_match = brace_match.group(0)

        if json_match:
            report = json.loads(json_match)

            # 标准化字段
            evaluation_report = {
                "score": report.get("score", 0),
                "summary": report.get("summary", ""),
                "coverage_gap": report.get("coverage_gap", []),
                "logic_issues": report.get("logic_issues", []),
                "duplicates": report.get("duplicates", []),
                "suggestions": report.get("suggestions", []),
                "risk_points": report.get("risk_points", []),
                "supplementary_cases": report.get("supplementary_cases", []),
            }

            logger.info(f"[CriticGraph] Parsed evaluation report: score={evaluation_report['score']}")

            return {
                **state,
                "evaluationReport": evaluation_report,
            }

        else:
            # 无法解析 JSON，返回文本摘要
            logger.warning("[CriticGraph] Could not parse JSON, using text summary")
            return {
                **state,
                "evaluationReport": {
                    "score": 0,
                    "summary": raw_response[:500],
                    "coverage_gap": [],
                    "logic_issues": [],
                    "duplicates": [],
                    "suggestions": [],
                    "risk_points": [],
                    "supplementary_cases": [],
                },
                "error": "Could not parse structured response",
            }

    except json.JSONDecodeError as e:
        logger.error(f"[CriticGraph] JSON parse error: {e}")
        return {
            **state,
            "error": f"JSON parse error: {e}",
        }


def should_generate_supplementary(state: CriticState) -> Literal["generate", "finalize"]:
    """决定是否生成补充用例"""
    if state.get("error"):
        return "finalize"

    if not state.get("generateSupplementary", True):
        return "finalize"

    report = state.get("evaluationReport", {})
    coverage_gap = report.get("coverage_gap", [])

    # 如果有覆盖度缺失，生成补充用例
    if coverage_gap and len(coverage_gap) > 0:
        return "generate"

    return "finalize"


def generate_supplementary_cases(state: CriticState) -> CriticState:
    """生成补充用例"""
    logger.info("[CriticGraph] Generating supplementary test cases")

    report = state.get("evaluationReport", {})
    coverage_gap = report.get("coverage_gap", [])

    if not coverage_gap:
        return state

    # 构建生成补充用例的 prompt
    gap_list = "\n".join([f"- {gap}" for gap in coverage_gap])
    prompt = f"""基于以下覆盖度缺失，生成补充测试用例：

【覆盖度缺失】
{gap_list}

【原始 PRD】
{state.get('prdText', '')[:2000]}

请为每个缺失场景生成 1-2 个测试用例，使用标准 JSON 格式。
"""

    try:
        model_name = get_default_model()

        if is_anthropic_model(model_name):
            client = build_anthropic_client()
            response = client.messages.create(
                model=model_name.replace("anthropic/", ""),
                max_tokens=2048,
                system=PromptManager.QA_TESTCASE_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
            raw_cases = response.content[0].text
        else:
            from ..config import build_openai_client
            client = build_openai_client()
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": PromptManager.QA_TESTCASE_SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=2048,
                temperature=0.0,
            )
            raw_cases = response.choices[0].message.content

        # 提取用例描述
        supplementary = []

        # 尝试解析 JSON 数组
        import re
        json_match = re.search(r'\[[\s\S]*\]', raw_cases)
        if json_match:
            try:
                cases = json.loads(json_match.group(0))
                for case in cases:
                    if isinstance(case, dict):
                        desc = f"{case.get('module', '')}: {case.get('step', '')}"
                        supplementary.append(desc)
            except:
                pass

        if not supplementary:
            # 提取文本描述
            lines = raw_cases.split('\n')
            for line in lines:
                line = line.strip()
                if line.startswith('-') or line.startswith('•'):
                    supplementary.append(line[1:].strip())
                elif 'TC_' in line or '用例' in line:
                    supplementary.append(line)

        # 更新报告
        if supplementary:
            report["supplementary_cases"] = supplementary[:10]  # 最多10个

        return {
            **state,
            "evaluationReport": report,
        }

    except Exception as e:
        logger.error(f"[CriticGraph] Failed to generate supplementary cases: {e}")
        return state


def finalize(state: CriticState) -> CriticState:
    """最终处理"""
    logger.info("[CriticGraph] Finalizing evaluation")

    # 确保有评估报告
    if not state.get("evaluationReport"):
        state["evaluationReport"] = {
            "score": 0,
            "summary": state.get("error", "Evaluation failed"),
            "coverage_gap": [],
            "logic_issues": [],
            "duplicates": [],
            "suggestions": [],
            "risk_points": [],
            "supplementary_cases": [],
        }

    return state


# ==========================================
# Graph Construction
# ==========================================

def build_critic_graph() -> StateGraph:
    """构建 Critic Agent Graph"""
    workflow = StateGraph(CriticState)

    # 添加节点
    workflow.add_node("build_context", build_context)
    workflow.add_node("call_llm", call_llm)
    workflow.add_node("parse_evaluation", parse_evaluation)
    workflow.add_node("generate_supplementary", generate_supplementary_cases)
    workflow.add_node("finalize", finalize)

    # 设置入口
    workflow.set_entry_point("build_context")

    # 添加边
    workflow.add_edge("build_context", "call_llm")
    workflow.add_edge("call_llm", "parse_evaluation")

    # 条件边：是否生成补充用例
    workflow.add_conditional_edges(
        "parse_evaluation",
        should_generate_supplementary,
        {
            "generate": "generate_supplementary",
            "finalize": "finalize",
        }
    )

    workflow.add_edge("generate_supplementary", "finalize")
    workflow.add_edge("finalize", END)

    return workflow.compile()


# 全局实例
critic_graph = build_critic_graph()


# ==========================================
# Convenience Functions
# ==========================================

async def evaluate_testcases_full(
    prd_text: str,
    testcase_text: str,
    golden_cases: Optional[str] = None,
    rag_context: Optional[str] = None,
    include_risk_analysis: bool = True,
    generate_supplementary: bool = True,
) -> Dict[str, Any]:
    """
    完整评估测试用例

    Args:
        prd_text: PRD 需求文档
        testcase_text: 待评估的测试用例
        golden_cases: 标准参考用例（可选）
        rag_context: RAG 检索的规范上下文（可选）
        include_risk_analysis: 是否包含风险分析
        generate_supplementary: 是否生成补充用例

    Returns:
        评估报告字典
    """
    import asyncio

    # 准备输入状态
    initial_state: CriticState = {
        "sessionId": f"eval_{id(prd_text)}",
        "prdText": prd_text,
        "testcaseText": testcase_text,
        "ragContext": rag_context,
        "goldenCases": golden_cases,
        "includeRiskAnalysis": include_risk_analysis,
        "generateSupplementary": generate_supplementary,
    }

    # 运行 graph
    # LangGraph 的 invoke 是同步的，但我们在 async 函数中调用
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, critic_graph.invoke, initial_state)

    return result.get("evaluationReport", {})


def evaluate_testcases_sync(
    prd_text: str,
    testcase_text: str,
    **kwargs
) -> Dict[str, Any]:
    """同步版本的评估函数"""
    import asyncio
    return asyncio.run(evaluate_testcases_full(prd_text, testcase_text, **kwargs))
