/**
 * 本地 Agent 地址（强制本地模式）
 *
 * 规则：
 * - 只允许 http(s)://localhost 或 http(s)://127.0.0.1
 * - 其余地址一律回退到 http://localhost:8000
 *
 * 目的：防止开发环境误连公司服务/远程服务
 */
export function getLocalAgentUrl(): string {
  const fallback = 'http://localhost:8000';
  const raw = (import.meta as any).env?.VITE_LOCAL_AGENT_URL as string | undefined;

  if (!raw) return fallback;

  try {
    const url = new URL(raw);
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return url.origin;
    }

    // 强制回退：错误信息用英文（便于排查）
    console.warn(`Error: VITE_LOCAL_AGENT_URL must be localhost/127.0.0.1, got ${url.origin}. Falling back to ${fallback}.`);
    return fallback;
  } catch (e: any) {
    console.warn(`Error: Invalid VITE_LOCAL_AGENT_URL: ${raw}. Falling back to ${fallback}.`);
    return fallback;
  }
}


