/**
 * Agent 服务地址（支持远程/本地切换）
 *
 * 环境变量说明：
 * - VITE_USE_REMOTE: 是否使用远程服务 (true/false)
 * - VITE_REMOTE_AGENT_URL: 远程服务地址
 * - VITE_REMOTE_API_KEY: 远程服务 API Key
 * - VITE_LOCAL_AGENT_URL: 本地服务地址（默认 http://localhost:8000）
 *
 * 切换方式：
 * - 远程部署：设置 VITE_USE_REMOTE=true
 * - 本地调试：设置 VITE_USE_REMOTE=false 或不设置
 */

// 是否使用远程服务
export function isRemoteMode(): boolean {
  const useRemote = (import.meta as any).env?.VITE_USE_REMOTE as string | undefined;
  return useRemote === 'true';
}

// 获取 Agent 服务地址
export function getAgentUrl(): string {
  const localFallback = 'http://localhost:8000';

  // 远程模式
  if (isRemoteMode()) {
    const remoteUrl = (import.meta as any).env?.VITE_REMOTE_AGENT_URL as string | undefined;
    if (remoteUrl) {
      try {
        const url = new URL(remoteUrl);
        console.log(`🌐 使用远程 Agent: ${url.origin}`);
        return url.origin;
      } catch (e) {
        console.warn(`Error: Invalid VITE_REMOTE_AGENT_URL: ${remoteUrl}. Falling back to local.`);
      }
    } else {
      console.warn('Error: VITE_USE_REMOTE=true but VITE_REMOTE_AGENT_URL not set. Falling back to local.');
    }
  }

  // 本地模式
  const localUrl = (import.meta as any).env?.VITE_LOCAL_AGENT_URL as string | undefined;
  if (!localUrl) return localFallback;

  try {
    const url = new URL(localUrl);
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      console.log(`🏠 使用本地 Agent: ${url.origin}`);
      return url.origin;
    }
    console.warn(`Error: VITE_LOCAL_AGENT_URL must be localhost/127.0.0.1, got ${url.origin}. Falling back to ${localFallback}.`);
    return localFallback;
  } catch (e: any) {
    console.warn(`Error: Invalid VITE_LOCAL_AGENT_URL: ${localUrl}. Falling back to ${localFallback}.`);
    return localFallback;
  }
}

// 获取远程 API Key（仅远程模式下返回）
export function getRemoteApiKey(): string | undefined {
  if (!isRemoteMode()) return undefined;
  return (import.meta as any).env?.VITE_REMOTE_API_KEY as string | undefined;
}

// 构建请求 Headers（自动注入 API Key）
export function buildHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };

  const apiKey = getRemoteApiKey();
  if (apiKey) {
    headers['X-Api-Key'] = apiKey;
  }

  return headers;
}

// 兼容旧代码：保留原函数名
export function getLocalAgentUrl(): string {
  return getAgentUrl();
}


