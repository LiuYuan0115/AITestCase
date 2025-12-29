"""
配置与客户端初始化
"""

import os
from dotenv import load_dotenv
from openai import OpenAI
from anthropic import Anthropic


# ================= 加载环境变量 =================
load_dotenv()


def build_openai_client() -> OpenAI:
    """
    构造 OpenAI SDK 客户端（兼容 ZenMux / OpenAI 兼容网关）
    """
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL", "https://zenmux.ai/api/v1")

    if not api_key:
        raise ValueError("Error: OPENAI_API_KEY is not set. Please configure it in .env")

    return OpenAI(api_key=api_key, base_url=base_url)


def build_anthropic_client() -> Anthropic:
    """
    构造 Anthropic SDK 客户端（通过 ZenMux 网关）
    """
    api_key = os.getenv("OPENAI_API_KEY")  # 复用同一个 API Key
    base_url = os.getenv("ANTHROPIC_BASE_URL", "https://zenmux.ai/api/anthropic")

    if not api_key:
        raise ValueError("Error: OPENAI_API_KEY is not set. Please configure it in .env")

    return Anthropic(api_key=api_key, base_url=base_url)


def get_default_model() -> str:
    return os.getenv("DEFAULT_MODEL", "anthropic/claude-sonnet-4")


def get_model_for(agent_key: str) -> str:
    """
    按接口/智能体维度选择模型。

    规则（优先级从高到低）：
    1) MODEL_{AGENT_KEY}  （如 MODEL_PRD）
    2) DEFAULT_MODEL
    3) anthropic/claude-sonnet-4.5
    """
    key = (agent_key or "").strip().upper()
    if key:
        specific = os.getenv(f"MODEL_{key}")
        if specific:
            return specific
    return get_default_model()


def is_anthropic_model(model: str) -> bool:
    """判断是否为 Anthropic 模型"""
    return model.startswith("anthropic/") or "claude" in model.lower()


