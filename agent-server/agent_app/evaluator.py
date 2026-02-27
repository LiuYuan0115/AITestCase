"""
AI 测试用例质检评估模块
Week 5: 对抗式 AI 评估，自动发现漏测点
Week 7: 集成 LLM 响应缓存，减少重复调用
"""

import json
import re
from typing import Dict, Any, Optional
from pathlib import Path
from agent_app.cache_manager import llm_cache


class Evaluator:
    """
    测试用例质检评估器

    使用对抗式 AI 评估测试用例质量，自动发现：
    - 漏测点（边界值、异常、安全等）
    - 逻辑缺陷（步骤矛盾、结果模糊）
    - 重复用例
    - 改进建议
    """

    def __init__(self, openai_client=None, anthropic_client=None, model_name: str = "gpt-4"):
        """
        初始化 Evaluator

        Args:
            openai_client: OpenAI 客户端（可选）
            anthropic_client: Anthropic 客户端（可选）
            model_name: 使用的模型名称
        """
        self.openai_client = openai_client
        self.anthropic_client = anthropic_client
        self.model_name = model_name

        # 加载评估系统 Prompt
        self.system_prompt = self._load_evaluator_prompt()

    def _load_evaluator_prompt(self) -> str:
        """加载评估系统 Prompt（Phase 6: 使用新的统一目录结构）"""
        try:
            # 新路径: prompts/skills/evaluator.md
            prompt_path = Path(__file__).parent.parent / "prompts" / "skills" / "evaluator.md"
            if prompt_path.exists():
                return prompt_path.read_text(encoding="utf-8")
            # 兼容旧路径
            old_path = Path(__file__).parent / "prompts" / "evaluator_system.md"
            if old_path.exists():
                return old_path.read_text(encoding="utf-8")
            raise FileNotFoundError(f"Evaluator prompt not found at {prompt_path} or {old_path}")
        except Exception as e:
            raise RuntimeError(f"Failed to load evaluator prompt: {e}")

    @llm_cache(ttl=86400)  # 缓存24小时
    def evaluate_testcases(
        self,
        prd_text: str,
        testcases_text: str,
        rag_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        评估测试用例质量

        Args:
            prd_text: 原始 PRD 文本
            testcases_text: 待评估的测试用例（Markdown 格式）
            rag_context: 可选的 RAG 上下文（测试规范、历史用例等）

        Returns:
            评估报告字典，包含：
            - score: 总分（0-100）
            - summary: 一句话总结
            - coverage: 覆盖率评估
            - coverage_gap: 漏测点列表
            - logic_issues: 逻辑问题列表
            - duplicates: 重复用例列表
            - suggestions: 改进建议列表
            - quality_breakdown: 质量分数拆解
        """
        if not prd_text or not prd_text.strip():
            return {
                "status": "error",
                "message": "PRD text is empty"
            }

        if not testcases_text or not testcases_text.strip():
            return {
                "status": "error",
                "message": "Test cases text is empty"
            }

        # 构建用户 Prompt
        user_prompt = self._build_user_prompt(prd_text, testcases_text, rag_context)

        # 调用 LLM 评估
        try:
            response_text = self._call_llm(user_prompt)

            # 解析 JSON 报告
            report = self._parse_json_report(response_text)

            if report:
                report["status"] = "success"
                return report
            else:
                return {
                    "status": "error",
                    "message": "Failed to parse evaluation report",
                    "raw_response": response_text
                }

        except Exception as e:
            return {
                "status": "error",
                "message": f"Evaluation failed: {str(e)}"
            }

    def _build_user_prompt(
        self,
        prd_text: str,
        testcases_text: str,
        rag_context: Optional[str] = None
    ) -> str:
        """构建用户 Prompt"""
        prompt_parts = []

        # PRD 部分
        prompt_parts.append("## 【原始 PRD】\n\n")
        prompt_parts.append(prd_text[:5000])  # 限制长度
        if len(prd_text) > 5000:
            prompt_parts.append("\n\n... (内容过长，已截断) ...")

        # 测试用例部分
        prompt_parts.append("\n\n## 【待评审测试用例】\n\n")
        prompt_parts.append(testcases_text[:10000])  # 限制长度
        if len(testcases_text) > 10000:
            prompt_parts.append("\n\n... (内容过长，已截断) ...")

        # RAG 上下文部分（可选）
        if rag_context and rag_context.strip():
            prompt_parts.append("\n\n## 【参考规范和历史用例】\n\n")
            prompt_parts.append(rag_context[:3000])
            if len(rag_context) > 3000:
                prompt_parts.append("\n\n... (内容过长，已截断) ...")

        # 评估指令
        prompt_parts.append("\n\n---\n\n")
        prompt_parts.append("请对上述测试用例进行全面评估，找出所有漏测点、逻辑缺陷和质量问题。")
        prompt_parts.append("输出严格的 JSON 格式评估报告（不要包含任何额外文本或 Markdown 代码块标记）。")

        return "".join(prompt_parts)

    def _call_llm(self, user_prompt: str) -> str:
        """调用 LLM 进行评估"""
        # 优先使用 Anthropic（如果可用）
        if self.anthropic_client and self._is_anthropic_model(self.model_name):
            return self._call_anthropic(user_prompt)
        elif self.openai_client:
            return self._call_openai(user_prompt)
        else:
            raise RuntimeError("No LLM client available (OpenAI or Anthropic)")

    def _is_anthropic_model(self, model_name: str) -> bool:
        """判断是否为 Anthropic 模型"""
        anthropic_models = ["claude", "sonnet", "opus", "haiku"]
        return any(m in model_name.lower() for m in anthropic_models)

    def _call_anthropic(self, user_prompt: str) -> str:
        """调用 Anthropic API"""
        try:
            response = self.anthropic_client.messages.create(
                model=self.model_name,
                max_tokens=4000,
                system=self.system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )

            # 提取文本内容
            if response.content and len(response.content) > 0:
                return response.content[0].text
            else:
                raise RuntimeError("Empty response from Anthropic API")

        except Exception as e:
            raise RuntimeError(f"Anthropic API call failed: {e}")

    def _call_openai(self, user_prompt: str) -> str:
        """调用 OpenAI API"""
        try:
            response = self.openai_client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=4000,
                temperature=0.3,  # 降低温度，使评估更客观
            )

            return response.choices[0].message.content

        except Exception as e:
            raise RuntimeError(f"OpenAI API call failed: {e}")

    def _parse_json_report(self, response_text: str) -> Optional[Dict[str, Any]]:
        """
        解析 JSON 评估报告

        支持两种格式：
        1. 纯 JSON
        2. Markdown 代码块包裹的 JSON
        """
        if not response_text or not response_text.strip():
            return None

        # 尝试直接解析
        try:
            return json.loads(response_text.strip())
        except json.JSONDecodeError:
            pass

        # 尝试从 Markdown 代码块中提取 JSON
        # 匹配 ```json ... ``` 或 ``` ... ```
        json_block_pattern = r'```(?:json)?\s*(\{[\s\S]*?\})\s*```'
        match = re.search(json_block_pattern, response_text)

        if match:
            json_text = match.group(1)
            try:
                return json.loads(json_text)
            except json.JSONDecodeError:
                pass

        # 尝试查找第一个 { 到最后一个 }
        try:
            start = response_text.index('{')
            end = response_text.rindex('}') + 1
            json_text = response_text[start:end]
            return json.loads(json_text)
        except (ValueError, json.JSONDecodeError):
            pass

        return None

    @llm_cache(ttl=86400)  # 缓存24小时
    def evaluate_simple(
        self,
        testcases_text: str,
        reference_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        简化评估（不需要 PRD）

        仅检查测试用例结构和质量，不评估覆盖率

        Args:
            testcases_text: 待评估的测试用例
            reference_text: 可选的参考文本（测试规范等）

        Returns:
            简化的评估报告
        """
        # 构建简化的 PRD
        simple_prd = "评估测试用例的结构、逻辑和质量（无具体需求规格）"

        return self.evaluate_testcases(
            prd_text=simple_prd,
            testcases_text=testcases_text,
            rag_context=reference_text
        )
