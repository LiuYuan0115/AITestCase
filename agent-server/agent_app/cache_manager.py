"""
缓存管理器
提供三层缓存系统：LLM 响应缓存、Embedding 向量缓存、PDF 解析缓存
使用装饰器模式简化集成，支持 TTL 过期策略
"""
import hashlib
import json
import pickle
import os
from pathlib import Path
from typing import Any, Optional, Callable
from functools import wraps
from datetime import datetime, timedelta
from agent_app.config_manager import config


class CacheManager:
    """统一缓存管理器

    提供三种类型的缓存：
    1. LLM 缓存：缓存 LLM API 响应，避免重复调用
    2. Embedding 缓存：缓存向量化结果，加速检索
    3. PDF 缓存：缓存 PDF 解析结果，避免重复解析
    """

    def __init__(self):
        """初始化缓存管理器，创建缓存目录结构"""
        self.cache_dir = Path(config.CACHE_DIR)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # 三个独立的缓存目录
        self.llm_cache_dir = self.cache_dir / "llm"
        self.embedding_cache_dir = self.cache_dir / "embedding"
        self.pdf_cache_dir = self.cache_dir / "pdf"

        for cache_dir in [self.llm_cache_dir, self.embedding_cache_dir, self.pdf_cache_dir]:
            cache_dir.mkdir(exist_ok=True)

    @staticmethod
    def _compute_hash(data: Any) -> str:
        """计算数据哈希值

        Args:
            data: 需要计算哈希的数据（字符串或可序列化对象）

        Returns:
            str: MD5 哈希值（32位十六进制字符串）
        """
        if isinstance(data, str):
            return hashlib.md5(data.encode('utf-8')).hexdigest()
        else:
            return hashlib.md5(json.dumps(data, sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()

    def _get_cache_path(self, cache_type: str, key: str) -> Path:
        """获取缓存文件路径

        Args:
            cache_type: 缓存类型（llm/embedding/pdf）
            key: 缓存键（哈希值）

        Returns:
            Path: 缓存文件的完整路径
        """
        cache_dirs = {
            "llm": self.llm_cache_dir,
            "embedding": self.embedding_cache_dir,
            "pdf": self.pdf_cache_dir
        }
        return cache_dirs[cache_type] / f"{key}.pkl"

    def _is_cache_valid(self, cache_path: Path, ttl: int) -> bool:
        """检查缓存是否有效（存在且未过期）

        Args:
            cache_path: 缓存文件路径
            ttl: 有效期（秒）

        Returns:
            bool: 缓存是否有效
        """
        if not cache_path.exists():
            return False

        # 检查是否过期
        mtime = datetime.fromtimestamp(cache_path.stat().st_mtime)
        if datetime.now() - mtime > timedelta(seconds=ttl):
            # 删除过期缓存
            try:
                cache_path.unlink()
            except Exception:
                pass
            return False

        return True

    def get(self, cache_type: str, key: str, ttl: int) -> Optional[Any]:
        """获取缓存数据

        Args:
            cache_type: 缓存类型
            key: 缓存键
            ttl: 有效期（秒）

        Returns:
            Optional[Any]: 缓存的数据，不存在或过期返回 None
        """
        cache_path = self._get_cache_path(cache_type, key)

        if not self._is_cache_valid(cache_path, ttl):
            return None

        try:
            with open(cache_path, 'rb') as f:
                return pickle.load(f)
        except Exception as e:
            # 缓存文件损坏，删除并返回 None
            try:
                cache_path.unlink()
            except Exception:
                pass
            return None

    def set(self, cache_type: str, key: str, value: Any):
        """设置缓存数据

        Args:
            cache_type: 缓存类型
            key: 缓存键
            value: 要缓存的数据
        """
        cache_path = self._get_cache_path(cache_type, key)

        try:
            with open(cache_path, 'wb') as f:
                pickle.dump(value, f)
        except Exception as e:
            print(f"⚠️ 缓存写入失败: {e}")

    def clear(self, cache_type: Optional[str] = None):
        """清除缓存

        Args:
            cache_type: 要清除的缓存类型，None 表示清除所有
        """
        if cache_type:
            cache_dir = getattr(self, f"{cache_type}_cache_dir")
            for file in cache_dir.glob("*.pkl"):
                try:
                    file.unlink()
                except Exception:
                    pass
        else:
            for file in self.cache_dir.rglob("*.pkl"):
                try:
                    file.unlink()
                except Exception:
                    pass

    def get_cache_stats(self) -> dict:
        """获取缓存统计信息

        Returns:
            dict: 各类型缓存的统计信息
        """
        stats = {}
        for cache_type in ["llm", "embedding", "pdf"]:
            cache_dir = getattr(self, f"{cache_type}_cache_dir")
            files = list(cache_dir.glob("*.pkl"))
            total_size = sum(f.stat().st_size for f in files if f.exists())
            stats[cache_type] = {
                "count": len(files),
                "size_mb": round(total_size / 1024 / 1024, 2)
            }

        # 总计
        stats["total"] = {
            "count": sum(s["count"] for s in stats.values() if isinstance(s, dict)),
            "size_mb": sum(s["size_mb"] for s in stats.values() if isinstance(s, dict))
        }

        return stats


# 全局缓存管理器实例
cache_manager = CacheManager()


# ========================================
# 装饰器：LLM 缓存
# ========================================
def llm_cache(ttl: Optional[int] = None):
    """LLM 响应缓存装饰器

    用于缓存 LLM API 调用结果，避免重复调用

    Args:
        ttl: 缓存有效期（秒），None 使用配置文件中的默认值

    Usage:
        @llm_cache(ttl=86400)
        def evaluate_testcases(self, prd, cases):
            # LLM API 调用
            return result
    """
    if ttl is None:
        ttl = config.LLM_CACHE_TTL

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 检查是否启用缓存
            if not config.USE_LLM_CACHE:
                return func(*args, **kwargs)

            # 构建缓存键（基于函数名和参数）
            cache_key_data = {
                "func": func.__name__,
                "args": str(args),
                "kwargs": str(sorted(kwargs.items()))
            }
            cache_key = cache_manager._compute_hash(cache_key_data)

            # 尝试从缓存读取
            cached = cache_manager.get("llm", cache_key, ttl)
            if cached is not None:
                return cached

            # 调用原函数
            result = func(*args, **kwargs)

            # 存储到缓存
            cache_manager.set("llm", cache_key, result)

            return result
        return wrapper
    return decorator


# ========================================
# 装饰器：Embedding 缓存
# ========================================
def embedding_cache(ttl: Optional[int] = None):
    """Embedding 缓存装饰器

    用于缓存向量化结果，支持批量处理

    Args:
        ttl: 缓存有效期（秒），None 使用配置文件中的默认值

    Usage:
        @embedding_cache(ttl=604800)
        def encode(self, texts):
            return self.model.encode(texts)
    """
    if ttl is None:
        ttl = config.EMBEDDING_CACHE_TTL

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(texts, *args, **kwargs):
            # 检查是否启用缓存
            if not config.USE_EMBEDDING_CACHE:
                return func(texts, *args, **kwargs)

            # 批量处理：分离已缓存和未缓存的文本
            is_list = isinstance(texts, list)
            text_list = texts if is_list else [texts]

            results = []
            uncached_texts = []
            uncached_indices = []

            for i, text in enumerate(text_list):
                cache_key = cache_manager._compute_hash(text)
                cached = cache_manager.get("embedding", cache_key, ttl)

                if cached is not None:
                    results.append(cached)
                else:
                    uncached_texts.append(text)
                    uncached_indices.append(i)

            # 调用原函数处理未缓存的文本
            if uncached_texts:
                new_embeddings = func(uncached_texts, *args, **kwargs)

                # 确保返回的是列表
                if not isinstance(new_embeddings, list):
                    new_embeddings = [new_embeddings]

                # 缓存新生成的 embedding
                for text, embedding in zip(uncached_texts, new_embeddings):
                    cache_key = cache_manager._compute_hash(text)
                    cache_manager.set("embedding", cache_key, embedding)

                # 合并结果（保持原始顺序）
                for idx, embedding in zip(uncached_indices, new_embeddings):
                    results.insert(idx, embedding)

            return results if is_list else results[0]
        return wrapper
    return decorator


# ========================================
# 装饰器：PDF 解析缓存
# ========================================
def pdf_cache(ttl: Optional[int] = None):
    """PDF 解析缓存装饰器

    用于缓存 PDF 文件解析结果

    Args:
        ttl: 缓存有效期（秒），None 使用配置文件中的默认值

    Usage:
        @pdf_cache(ttl=2592000)
        def extract_pdf_text(self, file_path):
            # PDF 解析逻辑
            return text
    """
    if ttl is None:
        ttl = config.PDF_CACHE_TTL

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(file_path, *args, **kwargs):
            # 检查是否启用缓存
            if not config.USE_PDF_CACHE:
                return func(file_path, *args, **kwargs)

            # 使用文件内容哈希作为缓存键
            try:
                with open(file_path, 'rb') as f:
                    file_hash = hashlib.md5(f.read()).hexdigest()
            except Exception:
                # 文件读取失败，直接调用原函数
                return func(file_path, *args, **kwargs)

            cache_key = f"{file_hash}_{func.__name__}"
            cached = cache_manager.get("pdf", cache_key, ttl)

            if cached is not None:
                return cached

            # 调用原函数
            result = func(file_path, *args, **kwargs)

            # 存储到缓存
            cache_manager.set("pdf", cache_key, result)

            return result
        return wrapper
    return decorator


# ========================================
# 工具函数
# ========================================
def print_cache_stats():
    """打印缓存统计信息"""
    stats = cache_manager.get_cache_stats()

    print("=" * 60)
    print("缓存统计信息")
    print("=" * 60)

    for cache_type in ["llm", "embedding", "pdf"]:
        info = stats[cache_type]
        print(f"{cache_type.upper():12s}: {info['count']:4d} 项  |  {info['size_mb']:6.2f} MB")

    print("-" * 60)
    total = stats["total"]
    print(f"{'总计':12s}: {total['count']:4d} 项  |  {total['size_mb']:6.2f} MB")
    print("=" * 60)


def clear_all_cache():
    """清除所有缓存"""
    cache_manager.clear()
    print("✓ 已清除所有缓存")


def clear_cache_by_type(cache_type: str):
    """按类型清除缓存

    Args:
        cache_type: llm/embedding/pdf
    """
    if cache_type not in ["llm", "embedding", "pdf"]:
        print(f"✗ 无效的缓存类型: {cache_type}")
        return

    cache_manager.clear(cache_type)
    print(f"✓ 已清除 {cache_type} 缓存")


# 如果直接运行此文件，打印缓存统计
if __name__ == "__main__":
    print_cache_stats()
