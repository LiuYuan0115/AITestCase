export default defineBackground(() => {
  console.log('Solvely MVP Background Script Loaded');

  // ================= 上传配置（内置默认值） =================
  // 说明：按你的要求，不在 UI 展示入口；扩展启动时自动写入缓存（若用户未配置过）
  const UPLOAD_CFG_STORAGE_KEY = 'SOLVELY_UPLOAD_CONFIG';
  const DEFAULT_UPLOAD_BASE = 'https://dev-webserver.solvely.ai';
  const DEFAULT_UPLOAD_TOKEN = '***REDACTED_TOKEN***';
  const DEFAULT_PLUGIN_UUID = '';

  const ensureUploadConfig = async () => {
    try {
      const res = await browser.storage.local.get(UPLOAD_CFG_STORAGE_KEY);
      const cfg = (res?.[UPLOAD_CFG_STORAGE_KEY] || {}) as any;
      // 只在缺失 token 时写入，避免覆盖用户已有配置
      if (!cfg?.token) {
        await browser.storage.local.set({
          [UPLOAD_CFG_STORAGE_KEY]: {
            base: DEFAULT_UPLOAD_BASE,
            token: DEFAULT_UPLOAD_TOKEN,
            pluginUuid: DEFAULT_PLUGIN_UUID,
          },
        });
      }
    } catch (e) {
      // 忽略写入失败
    }
  };

  // 异步执行，不阻塞其他逻辑
  ensureUploadConfig();

  // 允许点击扩展图标时打开侧边栏
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));

  browser.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'OPEN_SIDE_PANEL') {
      // 注意：在较新版本的 Chrome 中，打开侧边栏通常需要用户手势。
      // 这里我们尝试在接收到内容脚本的消息时打开。
      if (sender.tab?.id) {
        browser.sidePanel.open({ tabId: sender.tab.id }).catch((err) => {
            console.error("无法打开侧边栏", err);
        });
      }
    }
  });
});
