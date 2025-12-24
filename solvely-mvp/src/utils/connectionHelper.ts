/**
 * Content Script 连接辅助工具
 * 
 * 解决以下场景的连接问题：
 * - 页面刷新后 content script 未就绪
 * - 安装/重载扩展后已打开的页面
 * - Tab 切换后首次通信
 */

import { browser } from 'wxt/browser';

// 重试配置
const RETRY_DELAYS = [200, 500, 1000, 2000]; // 指数退避延迟（毫秒）
const MAX_RETRIES = RETRY_DELAYS.length;

/**
 * 等待指定毫秒
 */
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 获取当前活动 Tab
 */
export const getActiveTab = async (): Promise<chrome.tabs.Tab | null> => {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch {
    return null;
  }
};

/**
 * 检查 Tab 是否可以注入（http/https 页面）
 */
export const isInjectableTab = (tab: chrome.tabs.Tab | null): boolean => {
  if (!tab?.url) return false;
  return tab.url.startsWith('http://') || tab.url.startsWith('https://');
};

/**
 * 发送 PING 检测 content script 是否就绪
 */
export const pingContentScript = async (tabId: number): Promise<boolean> => {
  try {
    const response = await browser.tabs.sendMessage(tabId, { type: 'PING' });
    return response?.ok === true;
  } catch {
    return false;
  }
};

/**
 * 请求 background 注入 content script
 */
export const requestInjectContentScript = async (tabId: number, url?: string): Promise<boolean> => {
  try {
    const response = await browser.runtime.sendMessage({
      type: 'ENSURE_CONTENT_SCRIPT',
      tabId,
      url
    });
    return response?.success === true;
  } catch {
    return false;
  }
};

/**
 * 确保与 content script 的连接已建立
 * 
 * 流程：
 * 1. 获取当前活动 Tab
 * 2. 尝试 PING content script
 * 3. 如果失败，请求注入并重试
 * 4. 重试多次后仍失败则抛出错误
 * 
 * @returns 连接成功的 tabId
 * @throws Error 如果连接最终失败
 */
export const ensureConnection = async (): Promise<number> => {
  const tab = await getActiveTab();
  
  if (!tab?.id) {
    throw new Error('无法获取当前页面，请确保有活动的浏览器标签页');
  }

  if (!isInjectableTab(tab)) {
    throw new Error('当前页面不支持内容提取（仅支持 http/https 网页）');
  }

  const tabId = tab.id;

  // 首次尝试 PING
  if (await pingContentScript(tabId)) {
    console.log(`[连接] Tab ${tabId} 已就绪`);
    return tabId;
  }

  console.log(`[连接] Tab ${tabId} 未就绪，尝试注入...`);

  // 请求注入
  await requestInjectContentScript(tabId, tab.url);

  // 重试 PING（带退避）
  for (let i = 0; i < MAX_RETRIES; i++) {
    await wait(RETRY_DELAYS[i]);
    
    if (await pingContentScript(tabId)) {
      console.log(`[连接] Tab ${tabId} 注入成功（重试 ${i + 1} 次）`);
      return tabId;
    }
    
    console.log(`[连接] 重试 ${i + 1}/${MAX_RETRIES}...`);
  }

  // 最终失败
  throw new Error('页面连接失败，请刷新页面后重试');
};

/**
 * 安全发送消息到 content script（带自动重连）
 * 
 * @param message 要发送的消息
 * @param retryOnFail 连接失败时是否自动重试
 * @returns 响应数据
 */
export const sendMessageToContent = async <T = any>(
  message: any,
  retryOnFail = true
): Promise<T> => {
  try {
    const tabId = await ensureConnection();
    const response = await browser.tabs.sendMessage(tabId, message);
    return response as T;
  } catch (err: any) {
    // 如果是"连接不存在"错误且允许重试，尝试一次完整重连
    if (retryOnFail && err?.message?.includes('Could not establish connection')) {
      console.log('[连接] 检测到连接断开，尝试重连...');
      const tabId = await ensureConnection();
      return await browser.tabs.sendMessage(tabId, message) as T;
    }
    throw err;
  }
};

/**
 * 获取当前 Tab 的 URL
 */
export const getCurrentTabUrl = async (): Promise<string> => {
  const tab = await getActiveTab();
  return tab?.url || '';
};

