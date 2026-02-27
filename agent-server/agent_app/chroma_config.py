"""
ChromaDB 配置文件
Week 1: 向量数据库基础设施
"""
import os
from typing import List, Optional

# 配置 HuggingFace 镜像（解决国内网络问题）
# 必须在导入 sentence_transformers 之前设置
os.environ.setdefault('HF_ENDPOINT', 'https://hf-mirror.com')

from sentence_transformers import SentenceTransformer
import chromadb
from chromadb import PersistentClient

# 基础路径配置
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROMA_DB_PATH = os.path.join(BASE_DIR, 'data', 'chroma_db')

# Embedding 模型配置
EMBEDDING_MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'
EMBEDDING_DIMENSION = 384  # MiniLM-L12 的向量维度

# Collection 配置
COLLECTION_CONFIGS = {
    'session_docs': {
        'name': 'session_docs',
        'description': '会话文档集合 - 存储用户上传的PRD、需求文档等',
        'metadata': {"hnsw:space": "cosine"}  # 使用余弦相似度
    },
    'history_cases': {
        'name': 'history_cases',
        'description': '历史测试用例集合 - 已确认归档的测试用例',
        'metadata': {"hnsw:space": "cosine"}
    },
    'company_knowledge': {
        'name': 'company_knowledge',
        'description': '公司知识库集合 - 技术规范、测试标准等',
        'metadata': {"hnsw:space": "cosine"}
    }
}

# 检索配置
DEFAULT_TOP_K = 5  # 默认返回Top-5最相关文档
MAX_TOP_K = 20     # 最大返回数量


class ChromaConfig:
    """ChromaDB 配置管理器"""

    def __init__(self):
        self.db_path = CHROMA_DB_PATH
        self.embedding_model_name = EMBEDDING_MODEL_NAME
        self.embedding_dimension = EMBEDDING_DIMENSION
        self.collection_configs = COLLECTION_CONFIGS

        # 确保数据库目录存在
        os.makedirs(self.db_path, exist_ok=True)

    def get_client(self) -> PersistentClient:
        """
        获取 ChromaDB 客户端

        Note: ChromaDB 0.4.x 使用新的 API，无需 Settings 配置
        """
        return PersistentClient(path=self.db_path)

    def get_embedding_function(self):
        """获取 Embedding 函数（单例模式）"""
        if not hasattr(self, '_embedding_model'):
            self._embedding_model = SentenceTransformer(self.embedding_model_name)

        # 返回 ChromaDB 兼容的 EmbeddingFunction
        return ChromaEmbeddingFunction(self._embedding_model)


class ChromaEmbeddingFunction(chromadb.EmbeddingFunction):
    """
    自定义 Embedding 函数
    使用 sentence-transformers 生成向量
    """

    def __init__(self, model: SentenceTransformer):
        self.model = model

    def __call__(self, input: List[str]) -> List[List[float]]:
        """
        将文本列表转换为向量列表

        Args:
            input: 文本列表

        Returns:
            向量列表，每个向量是一个浮点数列表
        """
        # 确保输入是列表
        if isinstance(input, str):
            input = [input]

        try:
            # 使用 sentence-transformers 编码
            embeddings = self.model.encode(
                input,
                convert_to_numpy=True,
                show_progress_bar=False
            )

            # 转换为列表格式
            return embeddings.tolist()

        except Exception as e:
            print(f"[ChromaDB] Embedding 生成失败: {e}")
            # 返回零向量作为 Fallback
            return [[0.0] * EMBEDDING_DIMENSION for _ in input]


# 全局配置实例
chroma_config = ChromaConfig()


def get_chroma_client() -> PersistentClient:
    """获取 ChromaDB 客户端（便捷函数）"""
    return chroma_config.get_client()


def get_embedding_function():
    """获取 Embedding 函数（便捷函数）"""
    return chroma_config.get_embedding_function()
