"""
统一 Prompt 管理器 - 合并 prompts.py 和原 prompt_manager.py

特性：
1. 统一管理所有 prompt 文件（system/templates/skills）
2. 支持缓存加载
3. 意图路由（闲聊 vs 生成）
4. 动态 prompt 组装
5. 兼容旧 API（过渡期）
"""

import os
from pathlib import Path
from typing import Dict, List, Optional, Literal
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

# 定义目录路径
PROMPTS_ROOT = Path(__file__).parent.parent / "prompts"
SYSTEM_DIR = PROMPTS_ROOT / "system"
TEMPLATES_DIR = PROMPTS_ROOT / "templates"
SKILLS_DIR = PROMPTS_ROOT / "skills"


class UnifiedPromptManager:
    """统一 Prompt 管理器 - 整合所有 Prompt 加载、意图检测、动态组装"""

    # ==========================================
    # 核心加载方法
    # ==========================================

    @classmethod
    @lru_cache(maxsize=100)
    def load(cls, category: str, name: str) -> str:
        """
        统一加载入口

        Args:
            category: "system" | "templates" | "skills"
            name: 文件名（不含.md）

        Returns:
            Prompt 内容

        Raises:
            FileNotFoundError: 如果文件不存在
        """
        dir_map = {
            "system": SYSTEM_DIR,
            "templates": TEMPLATES_DIR,
            "skills": SKILLS_DIR,
        }

        base_dir = dir_map.get(category)
        if not base_dir:
            raise ValueError(f"Unknown category: {category}")

        file_path = base_dir / f"{name}.md"

        if file_path.exists():
            try:
                content = file_path.read_text(encoding="utf-8").strip()
                logger.debug(f"Loaded prompt: {category}/{name}")
                return content
            except Exception as e:
                logger.error(f"Failed to load prompt {file_path}: {e}")
                raise

        raise FileNotFoundError(f"Prompt not found: {category}/{name} (path: {file_path})")

    @classmethod
    def load_safe(cls, category: str, name: str, default: str = "") -> str:
        """安全加载，失败时返回默认值"""
        try:
            return cls.load(category, name)
        except (FileNotFoundError, Exception) as e:
            logger.warning(f"Failed to load {category}/{name}, using default: {e}")
            return default

    # ==========================================
    # 便捷获取方法
    # ==========================================

    @classmethod
    def get_system_prompt(cls, role: str, task_type: Optional[str] = None) -> str:
        """
        获取角色系统 Prompt

        Args:
            role: 角色标识
                - pm: 产品经理
                - dev: 开发者
                - qa: QA 测试（同 testcase）
                - ui: UI 自动化
                - critic: 评估专家
                - prd: PRD 分析
                - testpoint: 测试点生成
                - testcase: 测试用例生成

        Returns:
            系统 Prompt 内容
        """
        role_map = {
            "pm": "pm_chat",
            "dev": "dev_chat",
            "qa": "testcase",
            "ui": "ui_agent",
            "critic": "critic",
            "prd": "prd_analysis",
            "testpoint": "testpoint",
            "testcase": "testcase",
        }
        name = role_map.get(role, role)
        return cls.load("system", name)

    @classmethod
    def get_template(cls, task_type: str) -> str:
        """
        获取任务模板 Prompt

        Args:
            task_type: 任务类型（testprd, testpoint, testcase, figma）

        Returns:
            模板内容
        """
        # 支持带前缀和不带前缀的调用
        if not task_type.startswith("ask_"):
            task_type = f"ask_{task_type}"
        return cls.load("templates", task_type)

    @classmethod
    def get_skill(cls, skill_name: str) -> str:
        """
        获取技能 Prompt

        Args:
            skill_name: 技能名称（qa_engineer, playwright, webapp_testing, evaluator）

        Returns:
            技能内容
        """
        # 兼容带下划线和不带下划线的调用
        normalized = skill_name.replace("-", "_")
        return cls.load("skills", normalized)

    @classmethod
    def get_critic_prompt(cls) -> str:
        """获取 Critic 评估 prompt（兼容旧 API）"""
        return cls.get_system_prompt("critic")

    # ==========================================
    # 动态 Prompt 组装
    # ==========================================

    @classmethod
    def build_prompt(
        cls,
        task_type: str,
        content: str,
        *,
        rag_context: Optional[str] = None,
        history_context: Optional[str] = None,
        skill_augments: Optional[List[str]] = None,
    ) -> str:
        """
        动态组装完整 Prompt

        Args:
            task_type: 任务类型 (testprd, testpoint, testcase等)
            content: 主要内容
            rag_context: RAG 检索的上下文
            history_context: 历史用例参考
            skill_augments: 需要注入的技能列表

        Returns:
            组装后的完整 Prompt
        """
        parts = []

        # 1. 技能增强（如有）
        if skill_augments:
            for skill in skill_augments:
                try:
                    skill_content = cls.get_skill(skill)
                    parts.append(f"## 技能参考: {skill}\n{skill_content}")
                except FileNotFoundError:
                    logger.warning(f"Skill not found: {skill}")

        # 2. 任务模板
        try:
            template = cls.get_template(task_type)
            parts.append(template)
        except FileNotFoundError:
            logger.warning(f"Template not found: {task_type}")

        # 3. RAG 上下文
        if rag_context:
            parts.append(f"\n## 参考规范\n{rag_context}")

        # 4. 历史参考
        if history_context:
            parts.append(f"\n## 历史用例参考\n{history_context}")

        # 5. 主要内容
        parts.append(f"\n## 当前任务\n{content}")

        return "\n\n".join(parts)

    @classmethod
    def build_rag_filter_prompt(cls, query: str, raw_context: str) -> str:
        """构建 RAG 过滤 prompt"""
        template = cls.load_safe("templates", "rag_filter", "")
        if template:
            return template.format(query=query, raw_context=raw_context)
        # 回退到内联模板
        return f"""请筛选出与以下查询直接相关的信息：

【用户查询】
{query}

【检索到的原始信息】
{raw_context}

【输出要求】
- 只输出筛选后的有效信息
- 保持原文的关键细节
- 如果全部无关，输出"无相关信息"
"""

    @classmethod
    def build_initial_prompt(
        cls,
        prd_text: str,
        rag_context: Optional[str] = None,
        task_type: str = "testcase"
    ) -> str:
        """构建首次生成的 prompt（兼容旧 API）"""
        parts = [
            "【任务目标】",
            f"基于以下 PRD 需求文档，生成完整的测试用例。",
            "",
            "【PRD 需求内容】",
            prd_text,
        ]

        if rag_context:
            parts.extend([
                "",
                "【参考知识库/规范】（请严格遵守）",
                rag_context,
            ])

        parts.extend([
            "",
            "请根据上述信息生成测试用例。",
        ])

        return "\n".join(parts)

    @classmethod
    def build_refinement_prompt(
        cls,
        user_instruction: str,
        rag_context: Optional[str] = None
    ) -> str:
        """构建多轮修改的 prompt（兼容旧 API）"""
        parts = [
            "【用户指令】",
            user_instruction,
        ]

        if rag_context:
            parts.extend([
                "",
                "【继续参考之前检索到的规范】",
                rag_context,
            ])

        parts.extend([
            "",
            "请根据用户指令修改测试用例。先说明你的修改思路，然后输出修改后的 JSON 数据。",
        ])

        return "\n".join(parts)

    @classmethod
    def build_evaluation_prompt(
        cls,
        prd_text: str,
        testcase_text: str,
        rag_context: Optional[str] = None,
        golden_cases: Optional[str] = None
    ) -> str:
        """构建评估 prompt（兼容旧 API）"""
        parts = [
            "【PRD 需求文档】",
            prd_text,
            "",
            "【待评估的测试用例】",
            testcase_text,
        ]

        if rag_context:
            parts.extend([
                "",
                "【参考规范】",
                rag_context,
            ])

        if golden_cases:
            parts.extend([
                "",
                "【标准参考用例】（用于对比）",
                golden_cases,
            ])

        parts.extend([
            "",
            "请对上述测试用例进行全面评估，输出评估报告。",
        ])

        return "\n".join(parts)

    # ==========================================
    # 意图路由
    # ==========================================

    INTENT_KEYWORDS = {
        "generate": ["生成", "创建", "写", "帮我生成", "请生成", "generate", "create", "write", "测试用例", "用例", "testcase"],
        "edit": ["修改", "编辑", "更新", "删除", "添加", "补充", "modify", "edit", "update", "delete", "add"],
        "analyze": ["分析", "评审", "检查", "评估", "review", "analyze", "check", "evaluate"],
    }

    @classmethod
    def detect_intent(cls, message: str) -> Literal["generate", "edit", "analyze", "chat"]:
        """
        检测用户意图

        Args:
            message: 用户消息

        Returns:
            意图类型: generate | edit | analyze | chat
        """
        msg_lower = message.lower()

        for intent, keywords in cls.INTENT_KEYWORDS.items():
            if any(kw in msg_lower for kw in keywords):
                return intent

        return "chat"

    # ==========================================
    # 工具方法
    # ==========================================

    @classmethod
    def list_all(cls) -> Dict[str, List[str]]:
        """列出所有可用 Prompt"""
        result = {"system": [], "templates": [], "skills": []}

        for category, dir_path in [
            ("system", SYSTEM_DIR),
            ("templates", TEMPLATES_DIR),
            ("skills", SKILLS_DIR),
        ]:
            if dir_path.exists():
                result[category] = sorted([f.stem for f in dir_path.glob("*.md")])

        return result

    @classmethod
    def list_available_prompts(cls) -> Dict[str, List[str]]:
        """列出所有可用的 prompt 文件（兼容旧 API）"""
        return cls.list_all()

    @classmethod
    def clear_cache(cls):
        """清除缓存"""
        cls.load.cache_clear()
        logger.info("Prompt cache cleared")


# ==========================================
# 兼容旧 API（过渡期，最终会删除）
# ==========================================

def load_prompt(env_key: str, default: str) -> str:
    """
    兼容 prompts.py 的 load_prompt 函数

    通过环境变量覆盖 prompt。
    支持两种方式：
    - PROMPT_XXX_FILE=/path/to/prompt.md  （推荐：长文本）
    - PROMPT_XXX="..."                  （短文本）
    """
    file_key = f"{env_key}_FILE"
    file_path = os.getenv(file_key)
    if file_path:
        try:
            return Path(file_path).expanduser().read_text(encoding="utf-8")
        except Exception as e:
            raise RuntimeError(f"Error: Failed to load prompt file {file_path}: {e}")

    val = os.getenv(env_key)
    if val:
        return val
    return default


def load_skill(skill_name: str) -> str:
    """兼容 prompts.py 的 load_skill 函数"""
    return UnifiedPromptManager.get_skill(skill_name)


def get_available_skills() -> List[str]:
    """兼容 prompts.py 的 get_available_skills 函数"""
    return UnifiedPromptManager.list_all().get("skills", [])


# ==========================================
# 便捷函数（新 API）
# ==========================================

def get_system_prompt(role: str, task_type: Optional[str] = None) -> str:
    """获取系统 Prompt"""
    return UnifiedPromptManager.get_system_prompt(role, task_type)


def build_rag_filter_prompt(query: str, raw_context: str) -> str:
    """构建 RAG 过滤 Prompt"""
    return UnifiedPromptManager.build_rag_filter_prompt(query, raw_context)


def detect_intent(message: str) -> str:
    """检测用户意图"""
    return UnifiedPromptManager.detect_intent(message)


# ==========================================
# 模块级别懒加载常量（兼容 prompts.py 的导入方式）
# ==========================================

def _get_prd_system_prompt():
    return UnifiedPromptManager.get_system_prompt("prd")

def _get_testpoint_system_prompt():
    return UnifiedPromptManager.get_system_prompt("testpoint")

def _get_testcase_system_prompt():
    return UnifiedPromptManager.get_system_prompt("testcase")

def _get_ui_agent_system_prompt():
    return UnifiedPromptManager.get_system_prompt("ui")

def _get_pm_chat_system_prompt():
    return UnifiedPromptManager.get_system_prompt("pm")

def _get_dev_chat_system_prompt():
    return UnifiedPromptManager.get_system_prompt("dev")


_PROMPT_GETTERS = {
    "PRD_SYSTEM_PROMPT": _get_prd_system_prompt,
    "TESTPOINT_SYSTEM_PROMPT": _get_testpoint_system_prompt,
    "TESTCASE_SYSTEM_PROMPT": _get_testcase_system_prompt,
    "UI_AGENT_SYSTEM_PROMPT": _get_ui_agent_system_prompt,
    "PM_CHAT_SYSTEM_PROMPT": _get_pm_chat_system_prompt,
    "DEV_CHAT_SYSTEM_PROMPT": _get_dev_chat_system_prompt,
}


def __getattr__(name: str):
    """模块级别的 __getattr__，支持懒加载常量"""
    if name in _PROMPT_GETTERS:
        return _PROMPT_GETTERS[name]()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


# 导出原 PromptManager 类名作为别名（兼容 critic_graph.py）
PromptManager = UnifiedPromptManager
