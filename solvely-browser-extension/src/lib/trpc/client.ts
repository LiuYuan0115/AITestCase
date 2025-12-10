import { createTRPCProxyClient } from '@trpc/client';
import { chromeLink } from 'trpc-chrome/link';
import type { AppRouter } from '~/entrypoints/background/router';

// 创建一个可以管理的连接实例
let port: chrome.runtime.Port | null = null;
let trpcClient: ReturnType<typeof createTRPCProxyClient<AppRouter>> | null = null;

export function createTrpcClient() {
  if (trpcClient && port) {
    return trpcClient;
  }

  // Clean up existing port if any
  if (port) {
    try {
      port.disconnect();
    } catch (e) {
      console.log('Error disconnecting port:', e);
    }
  }

  port = chrome.runtime.connect();
  
  // 添加断开连接的监听器
  port.onDisconnect.addListener(() => {
    console.log(`Port disconnected, 原因：${chrome.runtime.lastError?.message}`);
    port = null;
    trpcClient = null;
  });

  trpcClient = createTRPCProxyClient<AppRouter>({
    links: [
      chromeLink({
        port,
      }),
    ],
  });

  return trpcClient;
}

// 修改导出方式，使用函数而不是常量
export function getTrpc() {
  return createTrpcClient();
}
