export default defineBackground(() => {
  console.log('Solvely MVP Background Script Loaded');

  // ================= 上传配置（内置默认值） =================
  const UPLOAD_CFG_STORAGE_KEY = 'SOLVELY_UPLOAD_CONFIG';
  const DEFAULT_UPLOAD_BASE = 'https://dev-webserver.solvely.ai';
  const DEFAULT_UPLOAD_TOKEN = '***REDACTED_TOKEN***';
  const DEFAULT_PLUGIN_UUID = '';

  const ensureUploadConfig = async () => {
    try {
      const res = await browser.storage.local.get(UPLOAD_CFG_STORAGE_KEY);
      const cfg = (res?.[UPLOAD_CFG_STORAGE_KEY] || {}) as any;
      if (!cfg?.token) {
        await browser.storage.local.set({
          [UPLOAD_CFG_STORAGE_KEY]: {
            base: DEFAULT_UPLOAD_BASE,
            token: DEFAULT_UPLOAD_TOKEN,
            pluginUuid: DEFAULT_PLUGIN_UUID,
          },
        });
      }
    } catch (e) {}
  };

  ensureUploadConfig();

  // ================= Content Script 注入相关 =================
  
  /**
   * 检查 URL 是否可以注入 content script
   * 排除 chrome:// / edge:// / about: / file: 等受保护页面
   */
  const isInjectableUrl = (url: string | undefined): boolean => {
    if (!url) return false;
    // 只允许 http/https 页面
    return url.startsWith('http://') || url.startsWith('https://');
  };

  /**
   * 向指定 tab 注入 content script
   * 如果已注入则跳过（通过 PING 检测）
   */
  const injectContentScriptToTab = async (tabId: number, url?: string): Promise<boolean> => {
    if (!isInjectableUrl(url)) {
      console.log(`[注入] 跳过不可注入的页面: ${url}`);
      return false;
    }

    try {
      // 先尝试 PING，检测是否已注入
      const response = await browser.tabs.sendMessage(tabId, { type: 'PING' }).catch(() => null) as { ok?: boolean } | null;
      if (response?.ok) {
        console.log(`[注入] Tab ${tabId} 已有 Content Script`);
        return true;
      }
    } catch {
      // PING 失败，说明需要注入
    }

    try {
      // 执行注入
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/content.js']
      });
      console.log(`[注入] Tab ${tabId} 注入成功`);
      return true;
    } catch (err) {
      console.warn(`[注入] Tab ${tabId} 注入失败:`, err);
      return false;
    }
  };

  /**
   * 遍历所有现有 tab，注入 content script
   * 用于安装/更新扩展后的初始化
   */
  const injectToAllExistingTabs = async () => {
    try {
      const tabs = await browser.tabs.query({});
      console.log(`[注入] 检查 ${tabs.length} 个已打开的 Tab`);
      
      for (const tab of tabs) {
        if (tab.id && isInjectableUrl(tab.url)) {
          await injectContentScriptToTab(tab.id, tab.url);
        }
      }
    } catch (err) {
      console.error('[注入] 遍历 Tab 失败:', err);
    }
  };

  // ================= 事件监听 =================

  // 1. 扩展安装/更新时，注入到所有已打开的 Tab
  browser.runtime.onInstalled.addListener((details) => {
    console.log(`[事件] 扩展 ${details.reason}`);
    // 稍微延迟，确保扩展完全就绪
    setTimeout(() => {
      injectToAllExistingTabs();
    }, 500);
  });

  // 2. Tab 加载完成时，确保注入（处理页面刷新场景）
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && isInjectableUrl(tab.url)) {
      // 延迟一点，确保页面 DOM 就绪
      setTimeout(() => {
        injectContentScriptToTab(tabId, tab.url);
      }, 200);
    }
  });

  // 3. 允许点击扩展图标时打开侧边栏
  (browser.sidePanel as any).setPanelBehavior({ openPanelOnActionClick: true }).catch((error: any) => console.error(error));

  // 4. 消息处理
  browser.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
    // 打开侧边栏
    if (message.type === 'OPEN_SIDE_PANEL') {
      if (sender.tab?.id) {
        (browser.sidePanel as any).open({ tabId: sender.tab.id }).catch((err: any) => {
          console.error("无法打开侧边栏", err);
        });
      }
      return;
    }

    // Sidepanel 请求注入 content script
    if (message.type === 'ENSURE_CONTENT_SCRIPT') {
      const { tabId, url } = message;
      injectContentScriptToTab(tabId, url).then((success) => {
        sendResponse({ success });
      });
      return true; // 异步响应
    }
  });
});
