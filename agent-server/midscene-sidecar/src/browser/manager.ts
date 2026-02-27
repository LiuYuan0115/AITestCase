import puppeteer, { type Browser, type Page } from 'puppeteer';

export interface BrowserSession {
  browser: Browser;
  page: Page;
  isCDP: boolean;  // true = connected via CDP (disconnect only), false = launched (close)
}

// CDP 会话缓存：避免每次请求都重新建立 WebSocket 连接
let cachedCDPSession: BrowserSession | null = null;
let cachedCDPEndpoint: string = '';

/**
 * Connect to an existing Chrome browser via CDP (Chrome DevTools Protocol).
 *
 * Chrome must be started with --remote-debugging-port=9222.
 * Uses disconnect() instead of close() to keep user's browser alive.
 *
 * 关键：CDP 模式必须完全禁止视口修改，否则会导致：
 *   - 侧边栏（Side Panel）布局畸形
 *   - 页面内容溢出或试图全屏
 *   - Midscene 截图不准确
 */
export async function connectBrowser(options: {
  url?: string;
  cdpEndpoint?: string;
}): Promise<BrowserSession> {
  const endpoint = options.cdpEndpoint || 'http://localhost:9222';

  // 尝试复用已缓存的 CDP 会话（同一 endpoint 且连接仍然有效）
  if (cachedCDPSession && cachedCDPEndpoint === endpoint) {
    try {
      const pages = await cachedCDPSession.browser.pages();
      if (pages.length > 0) {
        // 连接仍然有效，复用
        let page = cachedCDPSession.page;

        // 重新匹配目标页面（用户可能已切换 tab）
        if (options.url && pages.length > 0) {
          try {
            const targetHost = new URL(options.url).hostname;
            const match = pages.find(p => {
              try { return new URL(p.url()).hostname === targetHost; } catch { return false; }
            });
            if (match) page = match;
          } catch {}
        }

        cachedCDPSession.page = page;
        console.log(`[browser] Reusing cached CDP session. Page: ${page.url()}`);
        return cachedCDPSession;
      }
    } catch {
      // 缓存的连接已失效，清除并重新建立
      console.log(`[browser] Cached CDP session expired, reconnecting...`);
      cachedCDPSession = null;
    }
  }

  // 1. Get WebSocket URL from Chrome's debugging endpoint
  console.log(`[browser] Connecting via CDP: ${endpoint}`);
  const res = await fetch(`${endpoint}/json/version`);
  const data = await res.json() as { webSocketDebuggerUrl: string };
  const wsEndpoint = data.webSocketDebuggerUrl;

  // 2. Connect to browser
  //    ★ defaultViewport: null 是关键 — 告诉 Puppeteer 不要修改任何视口设置
  //    不设置此选项时，Puppeteer 会默认应用 800x600 视口，触发设备模拟
  const browser = await puppeteer.connect({
    browserWSEndpoint: wsEndpoint,
    defaultViewport: null,
  });

  // 3. Smart page selection: find tab matching the target URL
  const pages = await browser.pages();
  let page = pages[0] || await browser.newPage();

  if (options.url && pages.length > 0) {
    try {
      const targetHost = new URL(options.url).hostname;
      const match = pages.find(p => {
        try { return new URL(p.url()).hostname === targetHost; } catch { return false; }
      });
      if (match) page = match;
    } catch {
      // URL parsing failed, use first page
    }
  }

  // 4. Navigate if needed
  if (options.url) {
    const currentHost = (() => { try { return new URL(page.url()).hostname; } catch { return ''; } })();
    const targetHost = (() => { try { return new URL(options.url).hostname; } catch { return ''; } })();
    if (currentHost !== targetHost) {
      await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    }
  }

  // 5. 通过 CDP 协议清除任何残留的设备模拟覆盖
  //    防止之前的 Puppeteer 会话留下的 Device Metrics Override
  try {
    const client = (page as any)._client?.() || (page as any)._client;
    if (client) {
      await client.send('Emulation.clearDeviceMetricsOverride');
      console.log(`[browser] Cleared device metrics override`);
    }
  } catch {
    // 部分 Puppeteer 版本可能不支持，忽略
  }

  // 6. 拦截 page.setViewport()，防止 Midscene SDK 内部修改视口
  //    PuppeteerAgent 在截图/执行过程中可能调用 setViewport，
  //    在 CDP 模式下必须阻止，否则会破坏用户浏览器布局
  if (!(page as any).__viewportBlocked) {
    const originalSetViewport = page.setViewport.bind(page);
    (page as any).__originalSetViewport = originalSetViewport;
    page.setViewport = async (viewport: any) => {
      console.log(`[browser] setViewport blocked in CDP mode (requested: ${viewport?.width}x${viewport?.height})`);
    };
    (page as any).__viewportBlocked = true;
  }

  console.log(`[browser] CDP connected (viewport fully protected). Page: ${page.url()}`);

  const session = { browser, page, isCDP: true };
  // 缓存 CDP 会话以供后续请求复用
  cachedCDPSession = session;
  cachedCDPEndpoint = endpoint;

  return session;
}

/**
 * Launch a fresh browser instance (isolated, for headless or testing).
 */
export async function launchBrowser(options: {
  url: string;
  headless?: boolean;
  viewport?: { width: number; height: number };
}): Promise<BrowserSession> {
  const { url, headless = true, viewport = { width: 1280, height: 800 } } = options;

  console.log(`[browser] Launching ${headless ? 'headless' : 'headed'} browser`);
  const browser = await puppeteer.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      `--window-size=${viewport.width},${viewport.height}`,
    ],
  });

  const page = await browser.newPage();
  await page.setViewport(viewport);

  if (url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  }

  return { browser, page, isCDP: false };
}

/**
 * Safely close/disconnect browser session.
 * CDP mode: 保持连接（缓存复用），不断开。
 * Launch mode: close browser entirely.
 */
export async function closeBrowser(session: BrowserSession): Promise<void> {
  try {
    if (session.isCDP) {
      // CDP: 保持连接，缓存复用。不调用 disconnect()，下次请求可以直接使用。
      console.log('[browser] CDP session kept alive (cached for reuse)');
    } else {
      // Launched: close everything
      await session.page.close().catch(() => {});
      await session.browser.close();
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * 强制断开 CDP 会话（用于手动清理或服务关闭时）
 */
export async function forceDisconnectCDP(): Promise<void> {
  if (cachedCDPSession) {
    try {
      console.log('[browser] Force disconnecting CDP session');
      await cachedCDPSession.browser.disconnect();
    } catch {}
    cachedCDPSession = null;
    cachedCDPEndpoint = '';
  }
}
