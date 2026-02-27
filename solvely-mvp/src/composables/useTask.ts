/**
 * useTask - 异步任务管理
 * Phase 6: 支持长时间任务的创建、查询、流式输出
 */

import { ref, computed, onUnmounted } from 'vue';
import { getLocalAgentUrl } from '../utils/agentUrl';

/** 任务状态 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

/** 任务类型 */
export type TaskType =
  | 'chat'
  | 'parse_pdf'
  | 'parse_image'
  | 'compose_pdf'
  | 'evaluate'
  | 'generate'
  | 'ui_automation';

/** 任务进度 */
export interface TaskProgress {
  current: number;
  total: number;
  message: string;
}

/** 任务信息 */
export interface TaskInfo {
  task_id: string;
  type: TaskType;
  status: TaskStatus;
  params: Record<string, any>;
  session_id?: string;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  result?: any;
  error?: string;
  progress: TaskProgress;
}

/** 流式数据块 */
export interface StreamChunk {
  chunk?: string;
  progress?: TaskProgress;
  done?: boolean;
  status?: TaskStatus;
  result?: any;
  error?: string;
}

/** useTask 选项 */
export interface UseTaskOptions {
  /** 是否自动轮询状态 */
  autoPolling?: boolean;
  /** 轮询间隔（毫秒） */
  pollingInterval?: number;
  /** 流式输出回调 */
  onStreamChunk?: (chunk: string) => void;
  /** 进度更新回调 */
  onProgress?: (progress: TaskProgress) => void;
  /** 任务完成回调 */
  onComplete?: (result: any) => void;
  /** 任务失败回调 */
  onError?: (error: string) => void;
}

const DEFAULT_OPTIONS: UseTaskOptions = {
  autoPolling: false,
  pollingInterval: 1000,
};

/**
 * 异步任务管理 composable
 */
export function useTask(options: UseTaskOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 状态
  const currentTask = ref<TaskInfo | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const streamContent = ref('');

  // 轮询定时器
  let pollingTimer: number | null = null;
  // SSE 连接
  let eventSource: EventSource | null = null;

  // 计算属性
  const isRunning = computed(() =>
    currentTask.value?.status === 'running' || currentTask.value?.status === 'pending'
  );

  const isCompleted = computed(() =>
    currentTask.value?.status === 'completed'
  );

  const progress = computed(() =>
    currentTask.value?.progress ?? { current: 0, total: 100, message: '' }
  );

  const progressPercentage = computed(() => {
    const p = progress.value;
    if (p.total === 0) return 0;
    return Math.min(100, Math.round((p.current / p.total) * 100));
  });

  /**
   * 创建任务
   */
  async function createTask(
    type: TaskType,
    params: Record<string, any>,
    sessionId?: string
  ): Promise<string | null> {
    isLoading.value = true;
    error.value = null;
    streamContent.value = '';

    try {
      const baseUrl = await getLocalAgentUrl();
      const response = await fetch(`${baseUrl}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          params,
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      currentTask.value = data;

      // 如果启用自动轮询
      if (opts.autoPolling) {
        startPolling(data.task_id);
      }

      return data.task_id;
    } catch (e: any) {
      error.value = e.message || 'Failed to create task';
      opts.onError?.(error.value!);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 获取任务状态
   */
  async function getTaskStatus(taskId: string): Promise<TaskInfo | null> {
    try {
      const baseUrl = await getLocalAgentUrl();
      const response = await fetch(`${baseUrl}/api/jobs/${taskId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      currentTask.value = data;

      // 触发回调
      if (data.progress) {
        opts.onProgress?.(data.progress);
      }

      if (data.status === 'completed') {
        opts.onComplete?.(data.result);
        stopPolling();
      } else if (data.status === 'failed' || data.status === 'timeout') {
        opts.onError?.(data.error || 'Task failed');
        stopPolling();
      }

      return data;
    } catch (e: any) {
      error.value = e.message || 'Failed to get task status';
      return null;
    }
  }

  /**
   * 取消任务
   */
  async function cancelTask(taskId?: string): Promise<boolean> {
    const id = taskId || currentTask.value?.task_id;
    if (!id) return false;

    try {
      const baseUrl = await getLocalAgentUrl();
      const response = await fetch(`${baseUrl}/api/jobs/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      stopPolling();
      closeStream();

      if (currentTask.value?.task_id === id) {
        currentTask.value.status = 'cancelled';
      }

      return true;
    } catch (e: any) {
      error.value = e.message || 'Failed to cancel task';
      return false;
    }
  }

  /**
   * 开始流式接收
   */
  async function startStream(taskId: string): Promise<void> {
    closeStream();

    const baseUrl = await getLocalAgentUrl();
    const url = `${baseUrl}/api/jobs/${taskId}/stream`;

    eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data: StreamChunk = JSON.parse(event.data);

        if (data.chunk) {
          streamContent.value += data.chunk;
          opts.onStreamChunk?.(data.chunk);
        }

        if (data.progress) {
          if (currentTask.value) {
            currentTask.value.progress = data.progress;
          }
          opts.onProgress?.(data.progress);
        }

        if (data.done) {
          if (currentTask.value) {
            currentTask.value.status = data.status || 'completed';
            currentTask.value.result = data.result;
          }

          if (data.status === 'completed') {
            opts.onComplete?.(data.result);
          } else if (data.error) {
            opts.onError?.(data.error);
          }

          closeStream();
        }
      } catch (e) {
        console.error('[useTask] Failed to parse stream data:', e);
      }
    };

    eventSource.onerror = (e) => {
      console.error('[useTask] Stream error:', e);
      error.value = 'Stream connection error';
      opts.onError?.('Stream connection error');
      closeStream();
    };
  }

  /**
   * 关闭流式连接
   */
  function closeStream(): void {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  /**
   * 开始轮询
   */
  function startPolling(taskId: string): void {
    stopPolling();

    pollingTimer = window.setInterval(async () => {
      const task = await getTaskStatus(taskId);
      if (task && !['pending', 'running'].includes(task.status)) {
        stopPolling();
      }
    }, opts.pollingInterval);
  }

  /**
   * 停止轮询
   */
  function stopPolling(): void {
    if (pollingTimer !== null) {
      window.clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }

  /**
   * 重置状态
   */
  function reset(): void {
    stopPolling();
    closeStream();
    currentTask.value = null;
    error.value = null;
    streamContent.value = '';
    isLoading.value = false;
  }

  // 清理
  onUnmounted(() => {
    stopPolling();
    closeStream();
  });

  return {
    // 状态
    currentTask,
    isLoading,
    error,
    streamContent,

    // 计算属性
    isRunning,
    isCompleted,
    progress,
    progressPercentage,

    // 方法
    createTask,
    getTaskStatus,
    cancelTask,
    startStream,
    closeStream,
    startPolling,
    stopPolling,
    reset,
  };
}

/**
 * 获取任务列表
 */
export async function fetchTaskList(sessionId?: string): Promise<TaskInfo[]> {
  try {
    const baseUrl = await getLocalAgentUrl();
    const url = new URL(`${baseUrl}/api/jobs`);
    if (sessionId) {
      url.searchParams.set('session_id', sessionId);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (e) {
    console.error('[useTask] Failed to fetch task list:', e);
    return [];
  }
}

export default useTask;
