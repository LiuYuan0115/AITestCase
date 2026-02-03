#!/usr/bin/env python3
"""
数据迁移脚本：SessionStore → ImprovedSessionStore (ChromaDB)
将现有内存数据迁移到ChromaDB向量数据库
"""
import sys
import os
import json
import pickle
from datetime import datetime
from typing import Dict, List, Any

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent_app.session_store import SessionStore, ImprovedSessionStore


class DataMigrator:
    """数据迁移工具类"""

    def __init__(self):
        self.old_store = SessionStore()
        self.new_store = None  # 延迟初始化
        self.backup_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'data',
            'backups'
        )
        os.makedirs(self.backup_dir, exist_ok=True)

    def backup_old_store(self) -> str:
        """
        备份现有SessionStore数据到文件

        Returns:
            备份文件路径
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = os.path.join(self.backup_dir, f"session_store_backup_{timestamp}.pkl")

        backup_data = {
            'sessions': self.old_store._sessions,
            'docs': self.old_store._docs,
            'session_docs': self.old_store._session_docs,
            'pointers': self.old_store._pointers,
            'cache': self.old_store._cache,
            'timestamp': timestamp,
        }

        with open(backup_file, 'wb') as f:
            pickle.dump(backup_data, f)

        print(f"✅ 数据备份完成: {backup_file}")
        return backup_file

    def export_to_json(self) -> str:
        """
        导出数据为JSON格式（可读性更好）

        Returns:
            JSON文件路径
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        json_file = os.path.join(self.backup_dir, f"session_store_export_{timestamp}.json")

        export_data = {
            'sessions': {
                sid: [{'role': m.role, 'content': m.content, 'ts': m.ts}
                      for m in msgs]
                for sid, msgs in self.old_store._sessions.items()
            },
            'docs': self.old_store._docs,
            'session_docs': self.old_store._session_docs,
            'pointers': self.old_store._pointers,
            'timestamp': timestamp,
        }

        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)

        print(f"✅ 数据导出完成: {json_file}")
        return json_file

    def get_migration_stats(self) -> Dict[str, int]:
        """
        获取待迁移数据统计

        Returns:
            统计信息字典
        """
        stats = {
            'total_sessions': len(self.old_store._sessions),
            'total_docs': len(self.old_store._docs),
            'total_session_docs': sum(len(docs) for docs in self.old_store._session_docs.values()),
            'total_pointers': sum(len(ptrs) for ptrs in self.old_store._pointers.values()),
            'total_messages': sum(len(msgs) for msgs in self.old_store._sessions.values()),
        }
        return stats

    def migrate_documents(self) -> Dict[str, Any]:
        """
        迁移所有文档到ChromaDB

        Returns:
            迁移结果统计
        """
        print("\n=== 开始迁移文档到 ChromaDB ===")

        migrated_count = 0
        failed_count = 0
        failed_docs = []

        # 遍历所有文档
        for doc_id, doc in self.old_store._docs.items():
            try:
                # 获取文档内容
                content = doc.get('content', '')
                if not content or not content.strip():
                    print(f"⚠️  跳过空文档: {doc_id}")
                    continue

                # 提取元数据
                title = doc.get('title')
                kind = doc.get('kind')
                logical_id = doc.get('logicalId')
                content_type = doc.get('contentType')
                tags = doc.get('tags', [])

                # 查找该文档关联的session_id
                session_id = None
                for sid, docs_map in self.old_store._session_docs.items():
                    if doc_id in docs_map:
                        session_id = sid
                        break

                # 存储到ImprovedSessionStore
                result = self.new_store.put_doc(
                    content=content,
                    title=title,
                    kind=kind,
                    session_id=session_id,
                    logical_id=logical_id,
                    content_type=content_type,
                    tags=tags,
                )

                migrated_count += 1
                if migrated_count % 10 == 0:
                    print(f"   已迁移 {migrated_count} 个文档...")

            except Exception as e:
                failed_count += 1
                failed_docs.append({
                    'doc_id': doc_id,
                    'title': doc.get('title'),
                    'error': str(e)
                })
                print(f"❌ 文档迁移失败: {doc_id} - {e}")

        return {
            'migrated': migrated_count,
            'failed': failed_count,
            'failed_docs': failed_docs,
        }

    def verify_migration(self) -> Dict[str, Any]:
        """
        验证迁移结果

        Returns:
            验证结果
        """
        print("\n=== 验证迁移结果 ===")

        # 获取ChromaDB统计
        chroma_stats = self.new_store.get_collection_stats()
        print(f"ChromaDB 文档数: {chroma_stats}")

        # 对比原始数据
        old_doc_count = len(self.old_store._docs)
        new_doc_count = chroma_stats['session_docs']

        # 测试检索功能
        test_queries = [
            "登录功能",
            "测试用例",
            "用户界面",
        ]

        retrieval_tests = []
        for query in test_queries:
            # 获取所有文档ID
            all_doc_ids = list(self.old_store._docs.keys())
            if all_doc_ids:
                # 测试前3个文档
                test_doc_ids = all_doc_ids[:3]
                try:
                    results = self.new_store.retrieve(test_doc_ids, query, top_k=2)
                    retrieval_tests.append({
                        'query': query,
                        'results_count': len(results),
                        'success': len(results) > 0
                    })
                except Exception as e:
                    retrieval_tests.append({
                        'query': query,
                        'results_count': 0,
                        'success': False,
                        'error': str(e)
                    })

        return {
            'old_doc_count': old_doc_count,
            'new_doc_count': new_doc_count,
            'match': old_doc_count == new_doc_count,
            'chroma_stats': chroma_stats,
            'retrieval_tests': retrieval_tests,
        }

    def run_migration(self, skip_backup: bool = False) -> bool:
        """
        执行完整迁移流程

        Args:
            skip_backup: 是否跳过备份（仅用于测试）

        Returns:
            迁移是否成功
        """
        print("=" * 60)
        print(" SessionStore → ChromaDB 数据迁移")
        print("=" * 60)

        # 1. 获取统计信息
        stats = self.get_migration_stats()
        print("\n待迁移数据统计:")
        for key, value in stats.items():
            print(f"  - {key}: {value}")

        if stats['total_docs'] == 0:
            print("\n⚠️  没有需要迁移的文档")
            return True

        # 2. 备份原始数据
        if not skip_backup:
            print("\n=== 备份原始数据 ===")
            backup_file = self.backup_old_store()
            json_file = self.export_to_json()
        else:
            print("\n⚠️  跳过备份步骤（测试模式）")

        # 3. 初始化ImprovedSessionStore
        print("\n=== 初始化 ImprovedSessionStore ===")
        try:
            self.new_store = ImprovedSessionStore()
            print("✅ ImprovedSessionStore 初始化成功")
        except Exception as e:
            print(f"❌ ImprovedSessionStore 初始化失败: {e}")
            return False

        # 4. 迁移文档
        migration_result = self.migrate_documents()
        print(f"\n迁移结果:")
        print(f"  - 成功: {migration_result['migrated']}")
        print(f"  - 失败: {migration_result['failed']}")

        if migration_result['failed'] > 0:
            print(f"\n失败文档列表:")
            for failed in migration_result['failed_docs']:
                print(f"  - {failed['doc_id']}: {failed['error']}")

        # 5. 验证迁移
        verification = self.verify_migration()
        print(f"\n验证结果:")
        print(f"  - 原始文档数: {verification['old_doc_count']}")
        print(f"  - ChromaDB文档数: {verification['new_doc_count']}")
        print(f"  - 数量匹配: {'✅' if verification['match'] else '❌'}")

        print(f"\n检索功能测试:")
        for test in verification['retrieval_tests']:
            status = '✅' if test['success'] else '❌'
            print(f"  {status} 查询: '{test['query']}' - 返回 {test['results_count']} 条结果")

        # 6. 总结
        print("\n" + "=" * 60)
        print(" 迁移总结")
        print("=" * 60)

        success = (
            migration_result['failed'] == 0 and
            verification['match'] and
            all(t['success'] for t in verification['retrieval_tests'])
        )

        if success:
            print("🎉 数据迁移完成！所有检查通过。")
            print(f"\n备份文件:")
            if not skip_backup:
                print(f"  - Pickle: {backup_file}")
                print(f"  - JSON: {json_file}")
        else:
            print("⚠️  数据迁移完成，但存在问题。请检查上述日志。")

        return success


def main():
    """主函数"""
    migrator = DataMigrator()

    # 检查命令行参数
    skip_backup = '--skip-backup' in sys.argv

    success = migrator.run_migration(skip_backup=skip_backup)

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
