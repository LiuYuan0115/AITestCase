import { Router, type Request, type Response } from 'express';
import { launchBrowser, closeBrowser } from '../browser/manager.js';

export const screenshotRouter = Router();

/**
 * POST /screenshot — Take a headless screenshot of a URL.
 *
 * Always uses headless mode (never CDP). Used for:
 * - Page analysis before test case generation
 * - URL-based test case generation (user provides URL, AI generates cases)
 *
 * Request: { url: string, fullPage?: boolean, viewport?: { width, height } }
 * Response: { screenshot: "data:image/png;base64,..." }
 */
screenshotRouter.post('/screenshot', async (req: Request, res: Response) => {
  const { url, fullPage = true, viewport } = req.body as {
    url: string;
    fullPage?: boolean;
    viewport?: { width: number; height: number };
  };

  if (!url) {
    res.status(400).json({ status: 'error', message: 'url is required' });
    return;
  }

  let session = null;
  try {
    console.log(`[screenshot] Capturing: ${url}`);
    session = await launchBrowser({
      url,
      headless: true,  // Always headless for screenshots
      viewport: viewport || { width: 1280, height: 800 },
    });

    // Wait a bit for dynamic content to render
    await new Promise(r => setTimeout(r, 1500));

    const screenshotBuffer = await session.page.screenshot({
      encoding: 'base64',
      fullPage,
      type: 'png',
    });

    const base64 = `data:image/png;base64,${screenshotBuffer}`;
    console.log(`[screenshot] Done: ${url} (${(base64.length / 1024).toFixed(0)}KB)`);

    res.json({ screenshot: base64, url, title: await session.page.title() });

  } catch (e: any) {
    console.error(`[screenshot] Error:`, e.message);
    res.status(500).json({ status: 'error', message: e.message });
  } finally {
    if (session) {
      await closeBrowser(session);
    }
  }
});
