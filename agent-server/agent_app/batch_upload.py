"""
批量文件上传处理器
Week 7: 支持一次上传多个文件,并行处理
使用 ThreadPoolExecutor 实现并发上传,显著提升效率
"""
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from fastapi import UploadFile
import tempfile
import os
from pathlib import Path

from agent_app.file_processor import FileProcessor
from agent_app.config_manager import config


class BatchUploadProcessor:
    """批量文件上传处理器

    功能:
    1. 验证批量上传的文件数量和大小
    2. 并行处理多个文件
    3. 返回每个文件的处理结果
    4. 支持异步处理模式 (Week 8)
    """

    def __init__(self, session_store=None):
        """初始化批量上传处理器

        Args:
            session_store: SessionStore 实例 (可选，若提供则自动存储)
        """
        self.max_workers = config.BATCH_UPLOAD_PARALLEL_WORKERS
        self.max_files = config.BATCH_UPLOAD_MAX_FILES
        self.max_size_mb = config.BATCH_UPLOAD_MAX_SIZE_MB
        self.session_store = session_store

    def validate_batch(self, files: List[UploadFile]) -> Dict[str, Any]:
        """验证批量上传

        Args:
            files: 要上传的文件列表

        Returns:
            dict: 验证结果 {"valid": bool, "error": str}
        """
        # 检查文件数量
        if len(files) > self.max_files:
            return {
                "valid": False,
                "error": f"最多上传 {self.max_files} 个文件,当前: {len(files)} 个"
            }

        # 检查总文件大小
        total_size = 0
        for file in files:
            if hasattr(file, 'size') and file.size:
                total_size += file.size

        total_size_mb = total_size / 1024 / 1024

        if total_size_mb > self.max_size_mb:
            return {
                "valid": False,
                "error": f"总大小超过 {self.max_size_mb} MB,当前: {total_size_mb:.2f} MB"
            }

        # 检查文件类型
        allowed_types = config.get_allowed_upload_types()
        for file in files:
            if not file.filename:
                continue

            file_ext = file.filename.split('.')[-1].lower()
            if file_ext not in allowed_types:
                return {
                    "valid": False,
                    "error": f"不支持的文件类型: {file_ext},允许的类型: {', '.join(allowed_types)}"
                }

        return {"valid": True}

    def process_single_file(
        self,
        file: UploadFile,
        session_id: str,
        session_store=None,
        multimodal: bool = True,
        dpi: int = 150,
        max_pages: int = 20
    ) -> Dict[str, Any]:
        """处理单个文件

        Args:
            file: 上传的文件
            session_id: 会话 ID
            session_store: SessionStore 实例 (可选)
            multimodal: 是否启用多模态处理
            dpi: PDF 转图片分辨率
            max_pages: 最大处理页数

        Returns:
            dict: 处理结果
        """
        temp_file_path = None
        import io

        try:
            # 读取文件内容到临时文件
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp_file:
                # 读取上传的文件内容
                content = file.file.read()
                tmp_file.write(content)
                temp_file_path = tmp_file.name

            # 使用 FileProcessor.process_file 统一处理（支持多模态）
            file_obj = io.BytesIO(content)
            result = FileProcessor.process_file(
                file_obj,
                file.filename,
                auto_detect=True,
                use_ocr=True,
                multimodal=multimodal,
                dpi=dpi,
                max_pages=max_pages
            )

            if not result['success']:
                return {
                    "filename": file.filename,
                    "status": "failed",
                    "error": result.get('error', 'Unknown error'),
                    "message": f"处理失败: {result.get('error')}"
                }

            extracted_text = result['content']
            extracted_images = result.get('images') or []
            file_type = result['file_type']

            # 存储到 SessionStore (如果提供)
            doc_ref = None
            if session_store:
                doc_ref = session_store.put_doc(
                    content=extracted_text,
                    title=file.filename or "未命名文档",
                    kind="prd",
                    session_id=session_id,
                    images=extracted_images
                )

            return {
                "filename": file.filename,
                "status": "success",
                "docRef": doc_ref,
                "fileType": file_type,
                "size": len(extracted_text),
                "imageCount": len(extracted_images),
                "message": f"成功解析 {len(extracted_text)} 字符" + (f"，{len(extracted_images)} 页图片" if extracted_images else "")
            }

        except Exception as e:
            return {
                "filename": file.filename,
                "status": "failed",
                "error": str(e),
                "message": f"处理失败: {str(e)}"
            }

        finally:
            # 清理临时文件
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                except Exception:
                    pass

    def process_batch(
        self,
        files: List[UploadFile],
        session_id: str,
        session_store=None
    ) -> Dict[str, Any]:
        """并行处理批量文件

        Args:
            files: 文件列表
            session_id: 会话 ID
            session_store: SessionStore 实例 (可选)

        Returns:
            dict: 批量处理结果
        """
        # 验证批量上传
        validation = self.validate_batch(files)
        if not validation["valid"]:
            return {
                "status": "error",
                "message": validation["error"],
                "total": len(files),
                "success": 0,
                "failed": len(files),
                "results": []
            }

        # 并行处理文件
        results = []
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # 提交所有任务
            future_to_file = {
                executor.submit(
                    self.process_single_file,
                    file,
                    session_id,
                    session_store
                ): file
                for file in files
            }

            # 收集结果
            for future in as_completed(future_to_file):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    file = future_to_file[future]
                    results.append({
                        "filename": getattr(file, 'filename', 'unknown'),
                        "status": "failed",
                        "error": str(e)
                    })

        # 统计结果
        success_count = sum(1 for r in results if r["status"] == "success")
        failed_count = len(results) - success_count

        return {
            "status": "completed",
            "total": len(files),
            "success": success_count,
            "failed": failed_count,
            "results": results,
            "message": f"成功处理 {success_count}/{len(files)} 个文件"
        }


async def process_batch_async(
        self,
        files: List[UploadFile],
        session_id: str,
        kind: str = None,
        use_ocr: bool = True,
        multimodal: bool = True,  # 默认启用多模态处理
        dpi: int = 150,
        max_pages: int = 20
    ) -> Dict[str, Any]:
        """异步批量处理文件 (Week 8)

        与 process_batch 类似，但支持 FastAPI 异步调用。
        内部仍使用线程池并行处理。

        Args:
            files: 文件列表
            session_id: 会话 ID
            kind: 文档类型 (可选)
            use_ocr: 是否使用 OCR
            multimodal: 是否启用多模态处理（将 PDF/图片转为 base64）
            dpi: PDF 转图片分辨率
            max_pages: 最大处理页数

        Returns:
            dict: 批量处理结果
        """
        import asyncio
        import io

        # 验证批量上传
        validation = self.validate_batch(files)
        if not validation["valid"]:
            return {
                "status": "error",
                "message": validation["error"],
                "total": len(files),
                "success": 0,
                "failed": len(files),
                "results": []
            }

        async def process_file_async(file: UploadFile) -> Dict[str, Any]:
            """异步处理单个文件"""
            try:
                # 读取文件内容
                file_content = await file.read()
                file_obj = io.BytesIO(file_content)

                # 获取文件类型
                file_type = FileProcessor.get_file_type(file.filename)

                # 处理文件（支持多模态）
                result = FileProcessor.process_file(
                    file_obj,
                    file.filename,
                    auto_detect=True,
                    use_ocr=use_ocr,
                    multimodal=multimodal,  # 启用多模态处理
                    dpi=dpi,
                    max_pages=max_pages
                )

                if not result['success']:
                    return {
                        "filename": file.filename,
                        "status": "failed",
                        "error": result.get('error', 'Unknown error'),
                        "message": f"处理失败: {result.get('error')}"
                    }

                extracted_text = result['content']
                extracted_images = result.get('images') or []  # 多模态图片

                # 存储到 SessionStore
                doc_ref = None
                if self.session_store:
                    doc_ref = self.session_store.put_doc(
                        content=extracted_text,
                        title=file.filename or "未命名文档",
                        kind=kind or file_type or "prd",
                        session_id=session_id,
                        content_type=file.content_type or "application/octet-stream",
                        tags=[file_type, "uploaded", "batch"] + (["multimodal"] if extracted_images else []),
                        images=extracted_images  # 保存多模态图片数据
                    )

                # 多模态信息
                multimodal_info = {}
                if extracted_images:
                    multimodal_info = {
                        "enabled": True,
                        "pageCount": len(extracted_images),
                        "mode": result['metadata'].get('mode', 'multimodal'),
                    }
                    print(f"📸 [批量上传-多模态] {file.filename}: {len(extracted_images)} 页图片已保存")

                return {
                    "filename": file.filename,
                    "status": "success",
                    "docRef": doc_ref,
                    "fileType": file_type,
                    "size": len(file_content),
                    "extractedLength": len(extracted_text),
                    "ocrUsed": result['metadata'].get('ocr_used', False),
                    "multimodal": multimodal_info if multimodal_info else None,
                    "message": f"成功解析 {len(extracted_text)} 字符" + (f"，{len(extracted_images)} 页图片" if extracted_images else "")
                }

            except Exception as e:
                return {
                    "filename": file.filename,
                    "status": "failed",
                    "error": str(e),
                    "message": f"处理失败: {str(e)}"
                }

        # 并发处理所有文件
        tasks = [process_file_async(file) for file in files]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 处理结果
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    "filename": files[i].filename if i < len(files) else "unknown",
                    "status": "failed",
                    "error": str(result),
                    "message": f"处理异常: {str(result)}"
                })
            else:
                processed_results.append(result)

        # 统计结果
        success_count = sum(1 for r in processed_results if r["status"] == "success")
        failed_count = len(processed_results) - success_count

        return {
            "status": "completed",
            "total": len(files),
            "success": success_count,
            "failed": failed_count,
            "results": processed_results,
            "message": f"成功处理 {success_count}/{len(files)} 个文件"
        }


# 给 BatchUploadProcessor 类添加异步方法
BatchUploadProcessor.process_batch_async = process_batch_async


# 全局批量上传处理器实例
batch_processor = BatchUploadProcessor()


# 工具函数
def get_batch_stats() -> Dict[str, Any]:
    """获取批量上传配置统计"""
    return {
        "max_files": config.BATCH_UPLOAD_MAX_FILES,
        "max_size_mb": config.BATCH_UPLOAD_MAX_SIZE_MB,
        "parallel_workers": config.BATCH_UPLOAD_PARALLEL_WORKERS,
        "allowed_types": config.get_allowed_upload_types()
    }


if __name__ == "__main__":
    # 打印配置信息
    stats = get_batch_stats()
    print("=" * 60)
    print("批量上传处理器配置")
    print("=" * 60)
    print(f"最大文件数: {stats['max_files']}")
    print(f"最大总大小: {stats['max_size_mb']} MB")
    print(f"并行工作线程: {stats['parallel_workers']}")
    print(f"允许的文件类型: {', '.join(stats['allowed_types'])}")
    print("=" * 60)
