import type { Tabs } from 'webextension-polyfill';

/**
 * 打开指定的页面，或者指定的主站path
 * @param {string} path 是一个完整链接或者是一个path，例如/home
 * @param {boolean} newTab 是否创建新标签页
 * @returns 
 */
export async function goToSolvely(path: string, newTab: boolean = false): Promise<Tabs.Tab | void > {
    const SOLVELY_HOSTS = {
        'solvely.ai': 'https://solvely.ai', // 生产环境
        'dev.solvely.ai': 'https://dev.solvely.ai', // 测试环境
        'localhost:5173': 'http://localhost:5173', // 本地开发环境
        '127.0.0.1:5173': 'http://127.0.0.1:5173' // 本地开发环境
    };
    const solvelyUrls = Object.values(SOLVELY_HOSTS).map(url => `${url}/*`);
    const DEFAULT_URL = `${SOLVELY_HOSTS['solvely.ai']}${path}`;
    console.log('[web extension] goToSolvely', path, DEFAULT_URL);
    try {
        // 查找已打开的 Solvely 标签页
        const openTabs = await browser.tabs.query({ url: solvelyUrls });

        // 如果没有打开的 Solvely 标签页，创建新标签页
        if (openTabs.length === 0) {
            console.log('[web extension] goToSolvely 没有打开的 Solvely 标签页，创建新标签页：', DEFAULT_URL);
            return await browser.tabs.create({ url: DEFAULT_URL }) as Tabs.Tab;
        }

        // 如果强调必须使用新tab，则直接创建新标签页打开，不走后续的update逻辑
        if(newTab) {
            return await browser.tabs.create({ url: DEFAULT_URL }) as Tabs.Tab;
        }

        const getTargetUrl = (currentUrl: string) => {
            const host = new URL(currentUrl || '').host;
            return `${SOLVELY_HOSTS[host as keyof typeof SOLVELY_HOSTS] || SOLVELY_HOSTS['solvely.ai']}${path}`;
        };

        const [ activeTab ] = await browser.tabs.query({ active: true, currentWindow: true });
        // 如果当前标签页是 Solvely，直接更新 URL
        if (activeTab.id && openTabs.some(tab => tab.id === activeTab.id)) {
            const url = getTargetUrl(activeTab.url!);
            console.log('[web extension] goToSolvely 当前标签页是Solvely，直接更新 URL：', url);
            await browser.tabs.update(activeTab.id, { url });
            return activeTab as Tabs.Tab;
        }
        
        // 否则激活第一个 Solvely 标签页并更新 URL
        const firstSolvelyTab = openTabs[0];
        if (firstSolvelyTab.id) {
            const url = getTargetUrl(firstSolvelyTab.url!);
            console.log('[web extension] goToSolvely 激活第一个 Solvely 标签页并更新 URL：', url);
            await browser.tabs.update(firstSolvelyTab.id, {
                active: true,
                url
            });
            return firstSolvelyTab as Tabs.Tab;
        }

        // 兜底方案：创建新标签页
        console.log('[web extension] goToSolvely 兜底方案：创建新标签页：', DEFAULT_URL);
        return await browser.tabs.create({ url: DEFAULT_URL }) as Tabs.Tab;
    } catch (error) {
        console.error('第一层的错误 Failed to open Solvely :', error)
        /**
         * 降级处理：尝试使用 window.open 或 browser.tabs.create
         */
        try {
            /**
             * 在background脚本中，无window对象，所以会报
             * ReferenceError: window is not defined
             */
            if (window?.open) {
                console.log('[web extension] goToSolvely 使用 window.open 打开：', DEFAULT_URL);
                window.open(DEFAULT_URL, '_blank');
            }
        } catch (error) {
            console.error('第二层的错误 Failed to open Solvely:', error);
            try {
                /**
                 * 如果报错`ReferenceError: window is not defined`
                 * 则尝试使用browser.tabs.create
                 */
                if (browser?.tabs?.create) {
                    console.log('[web extension] goToSolvely open报错，使用browser.tabs.create打开：', DEFAULT_URL);
                    return await browser.tabs.create({ url: DEFAULT_URL }) as Tabs.Tab;
                }
            } catch (error) {
                console.error('第三层的错误 Failed to open Solvely:', error);
            }
        }
    }
}

export async function goToLogin() {
    const currentWindow = await browser.windows.getLastFocused()
    const params = {
      url: `${import.meta.env.VITE_SOLVELY_URL}/login-ext`,
      type: 'popup' as const,
      width: 500,
      height: 690,
      left: 100,
      top: 100,
      focused: true,
    }
    if (
      currentWindow &&
      currentWindow.left !== undefined &&
      currentWindow.top !== undefined &&
      currentWindow.width !== undefined &&
      currentWindow.height !== undefined
    ) {

      params.left = Math.max(
        0,
        Math.round(currentWindow.left + (currentWindow.width - params.width) / 2)
      )
      params.top = Math.max(
        0,
        Math.round(currentWindow.top + (currentWindow.height - params.height) / 2)
      )
    }
    return browser.windows.create(params)
  }