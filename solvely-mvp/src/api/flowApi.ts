/**
 * 可视化测试流程 API
 * 
 * 提供以下接口：
 * - executeFlow: 执行流程
 * - getFlowStatus: 获取执行状态（SSE）
 * - getFlowResult: 获取执行结果
 * - getTemplates: 获取模板列表
 * - getTemplate: 获取模板详情
 * - saveTemplate: 保存模板
 * - deleteTemplate: 删除模板
 */

import { getAgentUrl, buildHeaders } from '@/utils/agentUrl';
import type {
  FlowConfig,
  FlowResult,
  FlowOptions,
  ExecuteFlowRequest,
  ExecuteFlowResponse,
  TemplateListResponse,
  SaveTemplateRequest,
  SaveTemplateResponse,
  StepResult,
} from '@/types/flow';

// Agent 服务器地址
const AGENT_URL = getAgentUrl();

// ==================== 流程执行 ====================

/**
 * 执行可视化测试流程
 * 
 * @param flow 流程配置
 * @param variables 变量值
 * @param options 执行选项覆盖
 * @returns 任务 ID
 */
export async function executeFlow(
  flow: FlowConfig,
  variables: Record<string, string>,
  options?: Partial<FlowOptions>,
  sessionId?: string
): Promise<ExecuteFlowResponse> {
  const body: ExecuteFlowRequest = {
    flow,
    variables,
    options: options ? { ...flow.options, ...options } : undefined,
  };

  if (sessionId) {
    (body as any).sessionId = sessionId;
  }

  try {
    const response = await fetch(`${AGENT_URL}/api/flow/execute`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[flowApi] executeFlow error:', error);
    return {
      status: 'error',
      taskId: '',
      message: error.message || 'Failed to execute flow',
    };
  }
}

/**
 * 获取流程执行状态（SSE 流式）
 * 
 * @param taskId 任务 ID
 * @param onStatus 状态回调
 * @returns 取消函数
 */
export function subscribeFlowStatus(
  taskId: string,
  onStatus: (status: {
    taskId: string;
    status: string;
    progress: number;
    currentStep?: string;
    stepResult?: StepResult;
  }) => void
): () => void {
  const eventSource = new EventSource(`${AGENT_URL}/api/flow/status/${taskId}`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onStatus(data);
      
      // 完成或出错时关闭连接
      if (data.status === 'completed' || data.status === 'error') {
        eventSource.close();
      }
    } catch (e) {
      console.error('[flowApi] SSE parse error:', e);
    }
  };

  eventSource.onerror = (error) => {
    console.error('[flowApi] SSE error:', error);
    eventSource.close();
  };

  // 返回取消函数
  return () => {
    eventSource.close();
  };
}

/**
 * 获取流程执行结果
 * 
 * @param taskId 任务 ID
 * @returns 流程执行结果
 */
export async function getFlowResult(taskId: string): Promise<{
  status: 'success' | 'error';
  result?: FlowResult;
  message?: string;
}> {
  try {
    const response = await fetch(`${AGENT_URL}/api/flow/result/${taskId}`, {
      method: 'GET',
      headers: buildHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[flowApi] getFlowResult error:', error);
    return {
      status: 'error',
      message: error.message || 'Failed to get flow result',
    };
  }
}

// ==================== 模板管理 ====================

/**
 * 获取所有模板（预置 + 用户）
 * 
 * @param sessionId 会话 ID（可选，用于获取用户模板）
 * @returns 模板列表
 */
export async function getTemplates(sessionId?: string): Promise<TemplateListResponse> {
  try {
    const url = sessionId
      ? `${AGENT_URL}/api/flow/templates?session_id=${encodeURIComponent(sessionId)}`
      : `${AGENT_URL}/api/flow/templates`;

    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[flowApi] getTemplates error:', error);
    return {
      status: 'error',
      templates: [],
    };
  }
}

/**
 * 获取模板详情
 * 
 * @param templateId 模板 ID
 * @param sessionId 会话 ID（可选）
 * @returns 模板配置
 */
export async function getTemplate(
  templateId: string,
  sessionId?: string
): Promise<{ status: 'success' | 'error'; template?: FlowConfig; message?: string }> {
  try {
    const url = sessionId
      ? `${AGENT_URL}/api/flow/templates/${templateId}?session_id=${encodeURIComponent(sessionId)}`
      : `${AGENT_URL}/api/flow/templates/${templateId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[flowApi] getTemplate error:', error);
    return {
      status: 'error',
      message: error.message || 'Failed to get template',
    };
  }
}

/**
 * 保存用户模板
 * 
 * @param template 模板配置
 * @param sessionId 会话 ID（可选）
 * @returns 保存结果
 */
export async function saveTemplate(
  template: FlowConfig,
  sessionId?: string
): Promise<SaveTemplateResponse> {
  try {
    const body: SaveTemplateRequest = {
      template,
      sessionId,
    };

    const response = await fetch(`${AGENT_URL}/api/flow/templates`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[flowApi] saveTemplate error:', error);
    return {
      status: 'error',
      templateId: '',
      message: error.message || 'Failed to save template',
    };
  }
}

/**
 * 删除用户模板
 * 
 * @param templateId 模板 ID
 * @param sessionId 会话 ID（可选）
 * @returns 删除结果
 */
export async function deleteTemplate(
  templateId: string,
  sessionId?: string
): Promise<{ status: 'success' | 'error'; message?: string }> {
  try {
    const url = sessionId
      ? `${AGENT_URL}/api/flow/templates/${templateId}?session_id=${encodeURIComponent(sessionId)}`
      : `${AGENT_URL}/api/flow/templates/${templateId}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: buildHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('[flowApi] deleteTemplate error:', error);
    return {
      status: 'error',
      message: error.message || 'Failed to delete template',
    };
  }
}

// ==================== 工具函数 ====================

/**
 * 轮询获取流程结果（适用于不支持 SSE 的场景）
 * 
 * @param taskId 任务 ID
 * @param onProgress 进度回调
 * @param interval 轮询间隔（毫秒）
 * @param timeout 超时时间（毫秒）
 * @returns 流程执行结果
 */
export async function pollFlowResult(
  taskId: string,
  onProgress?: (progress: number) => void,
  interval = 1000,
  timeout = 120000
): Promise<FlowResult | null> {
  const startTime = Date.now();
  let progress = 0;

  while (Date.now() - startTime < timeout) {
    const result = await getFlowResult(taskId);

    if (result.status === 'success' && result.result) {
      onProgress?.(100);
      return result.result;
    }

    // 模拟进度增长
    progress = Math.min(95, progress + 5);
    onProgress?.(progress);

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  console.error('[flowApi] pollFlowResult timeout');
  return null;
}
