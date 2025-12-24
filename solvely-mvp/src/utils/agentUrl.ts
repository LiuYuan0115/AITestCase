/**
 * Agent 服务地址（支持远程/本地自动切换）
 *
 * 自动模式（推荐）：
 * - npm run dev   → 自动使用本地 (localhost:8000)
 * - npm run build → 自动使用远程 (线上 API)
 *
 * 手动覆盖（优先级最高）：
 * - VITE_USE_REMOTE=true  → 强制使用远程
 * - VITE_USE_REMOTE=false → 强制使用本地
 *
 * 环境变量说明：
 * - VITE_REMOTE_AGENT_URL: 远程服务地址
 * - VITE_REMOTE_API_KEY: 远程服务 API Key
 * - VITE_LOCAL_AGENT_URL: 本地服务地址（默认 http://localhost:8000）
 */

// 是否使用远程服务
export function isRemoteMode(): boolean {
  const env = (import.meta as any).env;
  
  // 1. 手动覆盖：VITE_USE_REMOTE 优先级最高
  const useRemoteOverride = env?.VITE_USE_REMOTE as string | undefined;
  if (useRemoteOverride === 'true') return true;
  if (useRemoteOverride === 'false') return false;
  
  // 2. 自动模式：根据构建模式判断
  // - import.meta.env.PROD = true  → npm run build（正式包）
  // - import.meta.env.DEV = true   → npm run dev（开发包）
  const isProduction = env?.PROD === true || env?.MODE === 'production';
  
  console.log(`🔧 构建模式: ${isProduction ? 'production（正式包）' : 'development（开发包）'}`);
  
  return isProduction;
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


