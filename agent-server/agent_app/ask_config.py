"""
Ask 接口配置中心

包含：模型参数、Prompt 配置、上下文管理策略
支持 .env 覆盖
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Dict, Optional, Any
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()

# ============================================================================
# Prompt 文件路径（相对于 agent-server 目录）
# ============================================================================
PROMPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts")


@lru_cache(maxsize=64)
def _load_prompt_file(filename: str) -> str:
    """从 prompts 目录加载 prompt 文件（带缓存，减少磁盘 IO）"""
    filepath = os.path.join(PROMPTS_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read().strip()
    raise FileNotFoundError(f"Error: Prompt file not found: {filepath}")


# ============================================================================
# 各类型配置
# ============================================================================
@dataclass
class AskTypeConfig:
    """单个 ask 类型的配置"""

    # 模型参数
    model: str = "anthropic/claude-sonnet-4"
    temperature: float = 0.0
    max_tokens: int = 50000
    thinking_budget: int = 2000  # thinkingConfig.thinkingBudget
    include_thoughts: bool = False  # thinkingConfig.includeThoughts

    # Prompt 配置
    prompt_file: Optional[str] = None  # prompts 目录下的文件名
    prompt_text: str = ""  # 如果不用文件，直接填 prompt 文本

    # 上下文配置
    use_session_history: bool = True  # 是否带会话历史
    max_history_rounds: int = 10  # 最大保留轮数
    max_input_chars: int = 50000  # 输入文本最大字符数（超出截断）
    summarize_on_overflow: bool = True  # 超出上下文时是否总结处理

    def get_prompt(self) -> str:
        """获取系统 prompt（优先读文件）"""
        if self.prompt_file:
            return _load_prompt_file(self.prompt_file)
        return self.prompt_text


# ============================================================================
# 默认配置（各 type 的配置）
# 支持通过 .env 覆盖，如：ASK_TESTPRD_MODEL=gpt-4o
# ============================================================================
_DEFAULT_CONFIGS: Dict[str, AskTypeConfig] = {
    "testprd": AskTypeConfig(
        model=os.getenv("ASK_TESTPRD_MODEL", "anthropic/claude-sonnet-4"),
        temperature=float(os.getenv("ASK_TESTPRD_TEMPERATURE", "0")),
        max_tokens=int(os.getenv("ASK_TESTPRD_MAX_TOKENS", "10000")),
        thinking_budget=int(os.getenv("ASK_TESTPRD_THINKING_BUDGET", "2000")),
        include_thoughts=os.getenv("ASK_TESTPRD_INCLUDE_THOUGHTS", "false").lower() == "true",
        prompt_file="ask_testprd.md",
        use_session_history=True,
        max_history_rounds=10,
        max_input_chars=20000,
        summarize_on_overflow=True,
    ),
    "testpoint": AskTypeConfig(
        model=os.getenv("ASK_TESTPOINT_MODEL", "anthropic/claude-sonnet-4"),
        temperature=float(os.getenv("ASK_TESTPOINT_TEMPERATURE", "0")),
        max_tokens=int(os.getenv("ASK_TESTPOINT_MAX_TOKENS", "10000")),
        thinking_budget=int(os.getenv("ASK_TESTPOINT_THINKING_BUDGET", "5000")),
        include_thoughts=os.getenv("ASK_TESTPOINT_INCLUDE_THOUGHTS", "false").lower() == "true",
        prompt_file="ask_testpoint.md",  # testpoint 使用专用 prompt（支持更明确的"测试点"输出约束）
        use_session_history=True,
        max_history_rounds=10,
        max_input_chars=20000,
        summarize_on_overflow=True,
    ),
    "testcase": AskTypeConfig(
        model=os.getenv("ASK_TESTCASE_MODEL", "anthropic/claude-sonnet-4"),
        temperature=float(os.getenv("ASK_TESTCASE_TEMPERATURE", "0")),
        max_tokens=int(os.getenv("ASK_TESTCASE_MAX_TOKENS", "20000")),
        thinking_budget=int(os.getenv("ASK_TESTCASE_THINKING_BUDGET", "5000")),
        include_thoughts=os.getenv("ASK_TESTCASE_INCLUDE_THOUGHTS", "false").lower() == "true",
        prompt_file="ask_testcase.md",
        use_session_history=True,
        max_history_rounds=10,
        max_input_chars=20000,
        summarize_on_overflow=True,
    ),
    "figma": AskTypeConfig(
        model=os.getenv("ASK_FIGMA_MODEL", "anthropic/claude-sonnet-4"),
        temperature=float(os.getenv("ASK_FIGMA_TEMPERATURE", "0")),
        max_tokens=int(os.getenv("ASK_FIGMA_MAX_TOKENS", "4000")),
        thinking_budget=int(os.getenv("ASK_FIGMA_THINKING_BUDGET", "2000")),
        include_thoughts=os.getenv("ASK_FIGMA_INCLUDE_THOUGHTS", "false").lower() == "true",
        prompt_file="ask_figma.md",
        use_session_history=False,  # Figma解析不需要历史
        max_history_rounds=0,
        max_input_chars=5000,
        summarize_on_overflow=False,
    ),
}

# 默认配置（兜底）
_FALLBACK_CONFIG = AskTypeConfig(
    model=os.getenv("ASK_DEFAULT_MODEL", "anthropic/claude-sonnet-4"),
    temperature=0.0,
    max_tokens=50000,
    thinking_budget=20000,
    include_thoughts=False,
    prompt_text="你是一个智能助手。必须使用中文回复，输出 Markdown。",
    use_session_history=True,
    max_history_rounds=10,
    max_input_chars=20000,
    summarize_on_overflow=True,
)


def get_ask_config(ask_type: str) -> AskTypeConfig:
    """
    根据 ask_type 获取配置

    支持的类型：testprd, testpoint, testcase
    不匹配时返回默认配置
    """
    t = (ask_type or "").strip().lower()
    return _DEFAULT_CONFIGS.get(t, _FALLBACK_CONFIG)


# ============================================================================
# 配置概览（用于调试/文档）
# ============================================================================
def get_all_configs_summary() -> Dict[str, Any]:
    """
    返回所有配置的概览（用于 /health 或调试）
    """
    summary = {}
    for t, cfg in _DEFAULT_CONFIGS.items():
        summary[t] = {
            "model": cfg.model,
            "temperature": cfg.temperature,
            "max_tokens": cfg.max_tokens,
            "thinking_budget": cfg.thinking_budget,
            "include_thoughts": cfg.include_thoughts,
            "prompt_file": cfg.prompt_file,
            "use_session_history": cfg.use_session_history,
            "max_history_rounds": cfg.max_history_rounds,
            "max_input_chars": cfg.max_input_chars,
            "summarize_on_overflow": cfg.summarize_on_overflow,
        }
    return summary
