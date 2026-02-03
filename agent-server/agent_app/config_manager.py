"""
统一配置管理器
整合所有环境变量配置，提供类型安全的配置访问接口
使用 python-dotenv 加载环境变量
"""
import os
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv


# 加载 .env 文件
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Config:
    """统一配置管理类"""

    # ========================================
    # 核心 API 配置
    # ========================================
    @property
    def OPENAI_API_KEY(self) -> str:
        return os.getenv("OPENAI_API_KEY", "")

    @property
    def OPENAI_BASE_URL(self) -> str:
        return os.getenv("OPENAI_BASE_URL", "https://zenmux.ai/api/v1")

    @property
    def ANTHROPIC_BASE_URL(self) -> str:
        return os.getenv("ANTHROPIC_BASE_URL", "https://zenmux.ai/api/anthropic")

    # ========================================
    # 模型配置
    # ========================================
    @property
    def DEFAULT_MODEL(self) -> str:
        return os.getenv("DEFAULT_MODEL", "anthropic/claude-haiku-4.5")

    @property
    def MODEL_PRD(self) -> str:
        return os.getenv("MODEL_PRD", "anthropic/claude-haiku-4.5")

    @property
    def MODEL_TESTCASE(self) -> str:
        return os.getenv("MODEL_TESTCASE", "anthropic/claude-haiku-4.5")

    @property
    def MODEL_UI(self) -> str:
        return os.getenv("MODEL_UI", "anthropic/claude-haiku-4.5")

    @property
    def MODEL_CHAT(self) -> str:
        return os.getenv("MODEL_CHAT", "anthropic/claude-haiku-4.5")

    @property
    def MODEL_ASK(self) -> str:
        return os.getenv("MODEL_ASK", "anthropic/claude-haiku-4.5")

    # ========================================
    # Ask 接口模型配置
    # ========================================
    @property
    def ASK_TESTPRD_MODEL(self) -> str:
        return os.getenv("ASK_TESTPRD_MODEL", "anthropic/claude-haiku-4.5")

    @property
    def ASK_TESTPOINT_MODEL(self) -> str:
        return os.getenv("ASK_TESTPOINT_MODEL", "anthropic/claude-haiku-4.5")

    @property
    def ASK_TESTCASE_MODEL(self) -> str:
        return os.getenv("ASK_TESTCASE_MODEL", "anthropic/claude-haiku-4.5")

    @property
    def ASK_FIGMA_MODEL(self) -> str:
        return os.getenv("ASK_FIGMA_MODEL", "anthropic/claude-haiku-4.5")

    @property
    def ASK_DEFAULT_MODEL(self) -> str:
        return os.getenv("ASK_DEFAULT_MODEL", "anthropic/claude-haiku-4.5")

    # ========================================
    # 功能开关
    # ========================================
    @property
    def USE_CHROMADB(self) -> bool:
        return os.getenv("USE_CHROMADB", "true").lower() == "true"

    @property
    def USE_QA_SKILL(self) -> bool:
        return os.getenv("USE_QA_SKILL", "true").lower() == "true"

    @property
    def USE_HISTORY_REFERENCE(self) -> bool:
        return os.getenv("USE_HISTORY_REFERENCE", "true").lower() == "true"

    @property
    def USE_LLM_CACHE(self) -> bool:
        return os.getenv("USE_LLM_CACHE", "true").lower() == "true"

    @property
    def USE_EMBEDDING_CACHE(self) -> bool:
        return os.getenv("USE_EMBEDDING_CACHE", "true").lower() == "true"

    @property
    def USE_PDF_CACHE(self) -> bool:
        return os.getenv("USE_PDF_CACHE", "true").lower() == "true"

    @property
    def USE_UI_SKILLS(self) -> bool:
        """是否在 UI Agent 中加载 Webapp Testing / Playwright Skills"""
        return os.getenv("USE_UI_SKILLS", "true").lower() == "true"

    @property
    def USE_ASYNC_QUEUE(self) -> bool:
        """是否启用异步任务队列"""
        return os.getenv("USE_ASYNC_QUEUE", "true").lower() == "true"

    # ========================================
    # ChromaDB 配置
    # ========================================
    @property
    def CHROMA_DB_PATH(self) -> str:
        return os.getenv("CHROMA_DB_PATH", "./data/chroma_db")

    @property
    def CHROMA_COLLECTION_SESSION(self) -> str:
        return os.getenv("CHROMA_COLLECTION_SESSION", "session_docs")

    @property
    def CHROMA_COLLECTION_HISTORY(self) -> str:
        return os.getenv("CHROMA_COLLECTION_HISTORY", "history_cases")

    @property
    def CHROMA_COLLECTION_KNOWLEDGE(self) -> str:
        return os.getenv("CHROMA_COLLECTION_KNOWLEDGE", "company_knowledge")

    @property
    def HF_ENDPOINT(self) -> str:
        return os.getenv("HF_ENDPOINT", "https://hf-mirror.com")

    # ========================================
    # 缓存配置
    # ========================================
    @property
    def CACHE_DIR(self) -> str:
        return os.getenv("CACHE_DIR", "./data/cache")

    @property
    def LLM_CACHE_TTL(self) -> int:
        return int(os.getenv("LLM_CACHE_TTL", "86400"))

    @property
    def EMBEDDING_CACHE_TTL(self) -> int:
        return int(os.getenv("EMBEDDING_CACHE_TTL", "604800"))

    @property
    def PDF_CACHE_TTL(self) -> int:
        return int(os.getenv("PDF_CACHE_TTL", "2592000"))

    @property
    def CACHE_MAX_SIZE_MB(self) -> int:
        return int(os.getenv("CACHE_MAX_SIZE_MB", "500"))

    # ========================================
    # 批量处理配置
    # ========================================
    @property
    def BATCH_UPLOAD_MAX_FILES(self) -> int:
        return int(os.getenv("BATCH_UPLOAD_MAX_FILES", "10"))

    @property
    def BATCH_UPLOAD_MAX_SIZE_MB(self) -> int:
        return int(os.getenv("BATCH_UPLOAD_MAX_SIZE_MB", "50"))

    @property
    def BATCH_UPLOAD_PARALLEL_WORKERS(self) -> int:
        return int(os.getenv("BATCH_UPLOAD_PARALLEL_WORKERS", "4"))

    # ========================================
    # 异步任务队列配置
    # ========================================
    @property
    def USE_ASYNC_QUEUE(self) -> bool:
        return os.getenv("USE_ASYNC_QUEUE", "true").lower() == "true"

    @property
    def QUEUE_BACKEND(self) -> str:
        return os.getenv("QUEUE_BACKEND", "memory")

    @property
    def QUEUE_MAX_WORKERS(self) -> int:
        return int(os.getenv("QUEUE_MAX_WORKERS", "4"))

    @property
    def QUEUE_TIMEOUT(self) -> int:
        return int(os.getenv("QUEUE_TIMEOUT", "300"))

    # ========================================
    # 文件上传配置
    # ========================================
    @property
    def UPLOAD_MAX_SIZE_MB(self) -> int:
        return int(os.getenv("UPLOAD_MAX_SIZE_MB", "20"))

    @property
    def UPLOAD_ALLOWED_TYPES(self) -> str:
        return os.getenv("UPLOAD_ALLOWED_TYPES", "pdf,png,jpg,jpeg,webp,txt,md")

    @property
    def UPLOAD_SAVE_PATH(self) -> str:
        return os.getenv("UPLOAD_SAVE_PATH", "./data/uploads")

    # ========================================
    # Tesseract OCR 配置
    # ========================================
    @property
    def TESSERACT_CMD(self) -> Optional[str]:
        cmd = os.getenv("TESSERACT_CMD")
        return cmd if cmd else None

    @property
    def TESSERACT_LANG(self) -> str:
        return os.getenv("TESSERACT_LANG", "chi_sim+eng")

    # ========================================
    # Evaluator 评估器配置
    # ========================================
    @property
    def EVALUATOR_MODEL(self) -> str:
        return os.getenv("EVALUATOR_MODEL", "anthropic/claude-haiku-4.5")

    @property
    def EVALUATOR_MIN_SCORE(self) -> int:
        return int(os.getenv("EVALUATOR_MIN_SCORE", "70"))

    @property
    def EVALUATOR_TIMEOUT(self) -> int:
        return int(os.getenv("EVALUATOR_TIMEOUT", "60"))

    # ========================================
    # 服务配置
    # ========================================
    @property
    def PORT(self) -> int:
        return int(os.getenv("PORT", "8000"))

    @property
    def HOST(self) -> str:
        return os.getenv("HOST", "0.0.0.0")

    @property
    def LOG_LEVEL(self) -> str:
        return os.getenv("LOG_LEVEL", "INFO")

    @property
    def CORS_ORIGINS(self) -> str:
        return os.getenv("CORS_ORIGINS", "*")

    # ========================================
    # 性能配置
    # ========================================
    @property
    def MAX_CONCURRENT_REQUESTS(self) -> int:
        return int(os.getenv("MAX_CONCURRENT_REQUESTS", "100"))

    @property
    def REQUEST_TIMEOUT(self) -> int:
        return int(os.getenv("REQUEST_TIMEOUT", "120"))

    @property
    def EMBEDDING_BATCH_SIZE(self) -> int:
        return int(os.getenv("EMBEDDING_BATCH_SIZE", "32"))

    # ========================================
    # 工具方法
    # ========================================
    def get_allowed_upload_types(self) -> list[str]:
        """获取允许上传的文件类型列表"""
        return [t.strip() for t in self.UPLOAD_ALLOWED_TYPES.split(",")]

    def get_cors_origins(self) -> list[str]:
        """获取 CORS 允许的源列表"""
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


# 全局配置实例
config = Config()


# 配置验证函数
def validate_config() -> dict:
    """验证配置有效性"""
    errors = []
    warnings = []

    # 验证 API Key
    if not config.OPENAI_API_KEY or config.OPENAI_API_KEY == "your_api_key_here":
        errors.append("OPENAI_API_KEY 未设置或使用默认值")

    # 验证缓存目录
    cache_dir = config.CACHE_DIR
    if not os.path.exists(cache_dir):
        warnings.append(f"缓存目录 {cache_dir} 不存在，将自动创建")

    # 验证 ChromaDB 路径
    chroma_path = config.CHROMA_DB_PATH
    if not os.path.exists(chroma_path):
        warnings.append(f"ChromaDB 目录 {chroma_path} 不存在，将自动创建")

    # 验证模型配置
    models = [
        config.DEFAULT_MODEL,
        config.MODEL_PRD,
        config.MODEL_TESTCASE,
        config.MODEL_UI,
        config.MODEL_CHAT,
        config.MODEL_ASK
    ]
    unique_models = set(models)
    if len(unique_models) > 3:
        warnings.append(f"使用了 {len(unique_models)} 个不同的模型，可能增加成本")

    # 验证端口
    if config.PORT < 1024 or config.PORT > 65535:
        errors.append(f"端口 {config.PORT} 无效，应在 1024-65535 之间")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings
    }


def print_config_summary():
    """打印配置摘要"""
    print("=" * 60)
    print("AI Test Case Agent Server - 配置摘要")
    print("=" * 60)
    print(f"服务地址: {config.HOST}:{config.PORT}")
    print(f"默认模型: {config.DEFAULT_MODEL}")
    print(f"ChromaDB: {'启用' if config.USE_CHROMADB else '禁用'} ({config.CHROMA_DB_PATH})")
    print(f"LLM 缓存: {'启用' if config.USE_LLM_CACHE else '禁用'} (TTL: {config.LLM_CACHE_TTL}s)")
    print(f"QA Skill: {'启用' if config.USE_QA_SKILL else '禁用'}")
    print(f"异步队列: {'启用' if config.USE_ASYNC_QUEUE else '禁用'} (Workers: {config.QUEUE_MAX_WORKERS})")
    print(f"批量上传: 最大 {config.BATCH_UPLOAD_MAX_FILES} 文件 / {config.BATCH_UPLOAD_MAX_SIZE_MB}MB")
    print("=" * 60)

    # 验证配置
    validation = validate_config()
    if validation["errors"]:
        print("\n[错误]")
        for error in validation["errors"]:
            print(f"  ✗ {error}")

    if validation["warnings"]:
        print("\n[警告]")
        for warning in validation["warnings"]:
            print(f"  ⚠ {warning}")

    if validation["valid"] and not validation["warnings"]:
        print("\n✓ 配置验证通过")
    print()


# 如果直接运行此文件，打印配置摘要
if __name__ == "__main__":
    print_config_summary()
