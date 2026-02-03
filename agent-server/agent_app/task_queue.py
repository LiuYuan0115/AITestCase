"""
异步任务队列
Week 7: 长时间任务异步执行,提升并发能力
支持任务提交、状态查询、结果获取
"""
import uuid
from typing import Callable, Any, Dict, Optional
from concurrent.futures import ThreadPoolExecutor, Future
from datetime import datetime
from threading import Lock

from agent_app.config_manager import config


class TaskQueue:
    """内存任务队列

    功能:
    1. 提交异步任务到线程池
    2. 查询任务执行状态
    3. 获取任务执行结果
    4. 任务超时控制
    """

    def __init__(self):
        """初始化任务队列"""
        self.executor = ThreadPoolExecutor(
            max_workers=config.QUEUE_MAX_WORKERS,
            thread_name_prefix="TaskQueue"
        )
        self.tasks: Dict[str, dict] = {}
        self.futures: Dict[str, Future] = {}
        self.lock = Lock()

    def submit(
        self,
        func: Callable,
        *args,
        task_name: Optional[str] = None,
        timeout: Optional[int] = None,
        **kwargs
    ) -> str:
        """提交异步任务

        Args:
            func: 要执行的函数
            *args: 函数位置参数
            task_name: 任务名称 (可选)
            timeout: 任务超时时间(秒),None 使用配置默认值
            **kwargs: 函数关键字参数

        Returns:
            str: 任务 ID
        """
        task_id = str(uuid.uuid4())

        # 使用配置的超时时间
        if timeout is None:
            timeout = config.QUEUE_TIMEOUT

        # 创建任务记录
        with self.lock:
            self.tasks[task_id] = {
                "task_id": task_id,
                "task_name": task_name or func.__name__,
                "status": "pending",
                "created_at": datetime.now().isoformat(),
                "started_at": None,
                "completed_at": None,
                "result": None,
                "error": None,
                "timeout": timeout,
                "progress": 0
            }

        # 提交任务到线程池
        future = self.executor.submit(
            self._run_task,
            task_id,
            func,
            *args,
            **kwargs
        )

        with self.lock:
            self.futures[task_id] = future

        return task_id

    def _run_task(self, task_id: str, func: Callable, *args, **kwargs):
        """执行任务 (内部方法)

        Args:
            task_id: 任务 ID
            func: 要执行的函数
            *args: 函数参数
            **kwargs: 函数关键字参数
        """
        try:
            # 更新状态为运行中
            with self.lock:
                self.tasks[task_id]["status"] = "running"
                self.tasks[task_id]["started_at"] = datetime.now().isoformat()
                self.tasks[task_id]["progress"] = 10

            # 执行任务
            result = func(*args, **kwargs)

            # 更新状态为完成
            with self.lock:
                self.tasks[task_id]["status"] = "completed"
                self.tasks[task_id]["completed_at"] = datetime.now().isoformat()
                self.tasks[task_id]["result"] = result
                self.tasks[task_id]["progress"] = 100

        except Exception as e:
            # 更新状态为失败
            with self.lock:
                self.tasks[task_id]["status"] = "failed"
                self.tasks[task_id]["completed_at"] = datetime.now().isoformat()
                self.tasks[task_id]["error"] = str(e)
                self.tasks[task_id]["progress"] = 0

    def get_status(self, task_id: str) -> Dict[str, Any]:
        """获取任务状态

        Args:
            task_id: 任务 ID

        Returns:
            dict: 任务状态信息
        """
        with self.lock:
            task = self.tasks.get(task_id)

        if not task:
            return {
                "task_id": task_id,
                "status": "not_found",
                "error": "任务不存在"
            }

        return task.copy()

    def get_result(self, task_id: str) -> Optional[Any]:
        """获取任务结果

        Args:
            task_id: 任务 ID

        Returns:
            Optional[Any]: 任务结果,任务未完成或失败返回 None
        """
        with self.lock:
            task = self.tasks.get(task_id)

        if not task:
            return None

        if task["status"] == "completed":
            return task["result"]

        return None

    def cancel(self, task_id: str) -> bool:
        """取消任务

        Args:
            task_id: 任务 ID

        Returns:
            bool: 是否成功取消
        """
        with self.lock:
            task = self.tasks.get(task_id)
            future = self.futures.get(task_id)

        if not task or not future:
            return False

        # 尝试取消任务
        if future.cancel():
            with self.lock:
                self.tasks[task_id]["status"] = "cancelled"
                self.tasks[task_id]["completed_at"] = datetime.now().isoformat()
            return True

        return False

    def get_all_tasks(self, status: Optional[str] = None) -> list:
        """获取所有任务

        Args:
            status: 过滤状态 (pending/running/completed/failed/cancelled)

        Returns:
            list: 任务列表
        """
        with self.lock:
            tasks = list(self.tasks.values())

        if status:
            tasks = [t for t in tasks if t["status"] == status]

        # 按创建时间倒序排序
        tasks.sort(key=lambda x: x["created_at"], reverse=True)

        return tasks

    def clear_completed_tasks(self) -> int:
        """清理已完成的任务

        Returns:
            int: 清理的任务数量
        """
        with self.lock:
            completed_ids = [
                task_id for task_id, task in self.tasks.items()
                if task["status"] in ["completed", "failed", "cancelled"]
            ]

            for task_id in completed_ids:
                del self.tasks[task_id]
                if task_id in self.futures:
                    del self.futures[task_id]

        return len(completed_ids)

    def get_stats(self) -> Dict[str, Any]:
        """获取队列统计信息

        Returns:
            dict: 统计信息
        """
        with self.lock:
            total = len(self.tasks)
            pending = sum(1 for t in self.tasks.values() if t["status"] == "pending")
            running = sum(1 for t in self.tasks.values() if t["status"] == "running")
            completed = sum(1 for t in self.tasks.values() if t["status"] == "completed")
            failed = sum(1 for t in self.tasks.values() if t["status"] == "failed")
            cancelled = sum(1 for t in self.tasks.values() if t["status"] == "cancelled")

        return {
            "total": total,
            "pending": pending,
            "running": running,
            "completed": completed,
            "failed": failed,
            "cancelled": cancelled,
            "max_workers": config.QUEUE_MAX_WORKERS,
            "backend": config.QUEUE_BACKEND
        }

    def shutdown(self, wait: bool = True):
        """关闭任务队列

        Args:
            wait: 是否等待所有任务完成
        """
        self.executor.shutdown(wait=wait)


# 全局任务队列实例
task_queue = TaskQueue()


# 工具函数
def print_queue_stats():
    """打印队列统计信息"""
    stats = task_queue.get_stats()

    print("=" * 60)
    print("任务队列统计")
    print("=" * 60)
    print(f"总任务数: {stats['total']}")
    print(f"  - 等待中: {stats['pending']}")
    print(f"  - 运行中: {stats['running']}")
    print(f"  - 已完成: {stats['completed']}")
    print(f"  - 失败: {stats['failed']}")
    print(f"  - 已取消: {stats['cancelled']}")
    print(f"\n最大工作线程: {stats['max_workers']}")
    print(f"队列后端: {stats['backend']}")
    print("=" * 60)


if __name__ == "__main__":
    # 打印队列统计
    print_queue_stats()

    # 测试任务队列
    def test_task(n: int) -> int:
        """测试任务:计算平方"""
        import time
        time.sleep(1)
        return n * n

    print("\n提交测试任务...")
    task_id = task_queue.submit(test_task, 5, task_name="计算平方")
    print(f"任务 ID: {task_id}")

    import time
    time.sleep(0.5)

    status = task_queue.get_status(task_id)
    print(f"\n任务状态: {status['status']}")

    time.sleep(1)

    result = task_queue.get_result(task_id)
    print(f"任务结果: {result}")

    print("\n最终统计:")
    print_queue_stats()
