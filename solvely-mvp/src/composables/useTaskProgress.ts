/**
 * useTaskProgress - 任务进度跟踪 Composable
 * Week 8: 支持 SSE 实时进度推送和轮询两种模式
 */
import { ref, onUnmounted, computed } from 'vue';
import { getAgentUrl } from '../utils/agentUrl';

const AGENT_URL = getAgentUrl();

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'not_found';

export interface TaskState {
  task_id: string;
  task_name?: string;
  status: TaskStatus;
  progress: number;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  result?: any;
  error?: string;
}

export interface UseTaskProgressOptions {
  /**
   * 使用 SSE 模式 (推荐)
   * 如果为 false，则使用轮询模式
   */
  useSSE?: boolean;
  /**
   * 轮询间隔 (毫秒)，仅在轮询模式下生效
   */
  pollInterval?: number;
  /**
   * 任务完成时的回调
   */
  onComplete?: (result: any) => void;
  /**
   * 任务失败时的回调
   */
  onError?: (error: string) => void;
}

/**
 * 任务进度跟踪 Composable
 *
 * @example
 * ```ts
 * const { taskState, isRunning, startTracking, stopTracking } = useTaskProgress();
 *
 * // 开始跟踪任务
 * startTracking('task-id-123', { useSSE: true });
 *
 * // 在模板中使用
 * <div v-if="isRunning">
 *   <progress :value="taskState.progress" max="100"></progress>
 * </div>
 * ```
 */
export function useTaskProgress(options: UseTaskProgressOptions = {}) {
  const {
    useSSE = true,
    pollInterval = 1000,
    onComplete,
    onError
  } = options;

  const taskState = ref<TaskState>({
    task_id: '',
    status: 'pending',
    progress: 0
  });

  const isRunning = computed(() =>
    ['pending', 'running'].includes(taskState.value.status)
  );

  const isCompleted = computed(() =>
    taskState.value.status === 'completed'
  );

  const isFailed = computed(() =>
    taskState.value.status === 'failed'
  );

  let eventSource: EventSource | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * 使用 SSE 跟踪任务进度
   */
  function trackWithSSE(taskId: string) {
    // 清理之前的连接
    stopTracking();

    eventSource = new EventSource(`${AGENT_URL}/api/tasks/${taskId}/stream`);

    eventSource.addEventListener('pending', handleEvent);
    eventSource.addEventListener('running', handleEvent);
    eventSource.addEventListener('completed', handleEvent);
    eventSource.addEventListener('failed', handleEvent);
    eventSource.addEventListener('cancelled', handleEvent);
    eventSource.addEventListener('not_found', handleEvent);

    eventSource.onerror = (e) => {
      console.error('[useTaskProgress] SSE error:', e);
      // SSE 错误时回退到轮询
      stopTracking();
      trackWithPolling(taskId);
    };
  }

  /**
   * 处理 SSE 事件
   */
  function handleEvent(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data) as TaskState;
      taskState.value = data;

      // 任务完成或失败，关闭连接
      if (data.status === 'completed') {
        onComplete?.(data.result);
        stopTracking();
      } else if (data.status === 'failed') {
        onError?.(data.error || 'Unknown error');
        stopTracking();
      } else if (data.status === 'cancelled' || data.status === 'not_found') {
        stopTracking();
      }
    } catch (e) {
      console.error('[useTaskProgress] Parse error:', e);
    }
  }

  /**
   * 使用轮询跟踪任务进度
   */
  function trackWithPolling(taskId: string) {
    // 清理之前的定时器
    if (pollTimer) {
      clearInterval(pollTimer);
    }

    async function poll() {
      try {
        const res = await fetch(`${AGENT_URL}/api/tasks/${taskId}`);
        const data = await res.json() as TaskState;
        taskState.value = data;

        // 任务完成或失败，停止轮询
        if (data.status === 'completed') {
          onComplete?.(data.result);
          stopTracking();
        } else if (data.status === 'failed') {
          onError?.(data.error || 'Unknown error');
          stopTracking();
        } else if (data.status === 'cancelled' || data.status === 'not_found') {
          stopTracking();
        }
      } catch (e) {
        console.error('[useTaskProgress] Poll error:', e);
      }
    }

    // 立即执行一次
    poll();

    // 开始轮询
    pollTimer = setInterval(poll, pollInterval);
  }

  /**
   * 开始跟踪任务
   */
  function startTracking(taskId: string, trackOptions?: { useSSE?: boolean }) {
    const shouldUseSSE = trackOptions?.useSSE ?? useSSE;

    taskState.value = {
      task_id: taskId,
      status: 'pending',
      progress: 0
    };

    if (shouldUseSSE) {
      trackWithSSE(taskId);
    } else {
      trackWithPolling(taskId);
    }
  }

  /**
   * 停止跟踪
   */
  function stopTracking() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /**
   * 取消任务
   */
  async function cancelTask(): Promise<boolean> {
    if (!taskState.value.task_id) {
      return false;
    }

    try {
      const res = await fetch(`${AGENT_URL}/api/tasks/${taskState.value.task_id}`, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (data.status === 'success') {
        taskState.value.status = 'cancelled';
        stopTracking();
        return true;
      }
      return false;
    } catch (e) {
      console.error('[useTaskProgress] Cancel error:', e);
      return false;
    }
  }

  // 组件卸载时清理
  onUnmounted(() => {
    stopTracking();
  });

  return {
    taskState,
    isRunning,
    isCompleted,
    isFailed,
    startTracking,
    stopTracking,
    cancelTask
  };
}

/**
 * 提交异步评估任务
 *
 * @param prdText PRD 文本
 * @param testcasesText 测试用例文本
 * @param ragContext 可选的 RAG 上下文
 * @returns 任务 ID
 */
export async function submitAsyncEvaluation(
  prdText: string,
  testcasesText: string,
  ragContext?: string
): Promise<string> {
  const formData = new FormData();
  formData.append('prdText', prdText);
  formData.append('testcasesText', testcasesText);
  if (ragContext) {
    formData.append('ragContext', ragContext);
  }

  const res = await fetch(`${AGENT_URL}/api/evaluate/async`, {
    method: 'POST',
    body: formData
  });

  const data = await res.json();

  if (data.status !== 'submitted') {
    throw new Error(data.message || 'Failed to submit evaluation');
  }

  return data.taskId;
}

export default useTaskProgress;
