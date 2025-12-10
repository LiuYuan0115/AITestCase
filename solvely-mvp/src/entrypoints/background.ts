export default defineBackground(() => {
  console.log('Solvely MVP Background Script Loaded');

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
