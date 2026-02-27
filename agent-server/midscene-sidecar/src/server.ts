import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { runTestcaseRouter } from './routes/run-testcase.js';
import { runStepsRouter } from './routes/run-steps.js';
import { reportRouter } from './routes/report.js';
import { screenshotRouter } from './routes/screenshot.js';
import { runTestcaseStreamRouter } from './routes/run-testcase-stream.js';
import { cacheRouter } from './routes/cache.js';
// ★ 三模式执行 + 回归测试路由
import { runInstantRouter } from './routes/run-instant.js';
import { runYamlRouter } from './routes/run-yaml.js';
import { regressionRouter } from './routes/regression.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3100', 10);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.use(healthRouter);
app.use(runTestcaseRouter);
app.use(runTestcaseStreamRouter);
app.use(runStepsRouter);
app.use(reportRouter);
app.use(screenshotRouter);
app.use(cacheRouter);
// ★ 三模式执行 + 回归测试路由
app.use(runInstantRouter);
app.use(runYamlRouter);
app.use(regressionRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Sidecar Error]', err);
  res.status(500).json({ status: 'error', message: err.message });
});

/**
 * 预热 AI 模型连接
 * 第一次通过代理调用 Gemini API 时，TLS 连接建立经常不稳定（被对端关闭）。
 * 在服务启动时先做一次轻量调用，提前建立代理/TLS 连接，
 * 后续正式执行时就不会因为"冷启动"而超时失败。
 *
 * 使用 child_process 调用 curl 命令完成预热，最简单可靠，
 * 因为 curl 天然支持 HTTP 代理且和系统行为一致。
 */
async function warmupAIConnection(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL;
  const proxyUrl = process.env.MIDSCENE_OPENAI_HTTP_PROXY;

  if (!apiKey || !baseUrl) {
    console.log('[Warmup] 跳过预热：缺少 API 配置');
    return;
  }

  console.log('[Warmup] 正在预热 AI 模型连接...');
  const startTime = Date.now();
  const maxRetries = 3;

  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  // 用 GET /models 接口（最轻量）来预热连接
  const targetUrl = `${baseUrl.replace(/\/$/, '')}/models?key=${apiKey}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const args = [
        '-s',              // 静默模式
        '-o', '/dev/null', // 丢弃响应体
        '-w', '%{http_code}', // 只输出状态码
        '--connect-timeout', '15',
        '--max-time', '30',
      ];
      if (proxyUrl) {
        args.push('-x', proxyUrl);
      }
      args.push(targetUrl);

      const { stdout } = await execFileAsync('curl', args, { timeout: 35000 });
      const statusCode = parseInt(stdout.trim(), 10);
      const elapsed = Date.now() - startTime;

      if (statusCode >= 200 && statusCode < 500) {
        console.log(`[Warmup] 预热成功 (HTTP ${statusCode}, ${elapsed}ms, 第 ${attempt} 次尝试)`);
        return;
      } else {
        console.warn(`[Warmup] 响应异常 HTTP ${statusCode} (第 ${attempt} 次, ${elapsed}ms)`);
      }
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      console.warn(`[Warmup] 第 ${attempt} 次尝试失败 (${elapsed}ms): ${err.message || err}`);
    }

    // 重试前等待
    if (attempt < maxRetries) {
      const delay = attempt * 2000;
      console.log(`[Warmup] ${delay}ms 后重试...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  console.warn('[Warmup] 预热未成功，首次执行可能较慢。请检查代理和 API 配置。');
}

app.listen(PORT, () => {
  console.log(`[Midscene Sidecar] Running on http://localhost:${PORT}`);
  console.log(`[Midscene Sidecar] Model: ${process.env.MIDSCENE_MODEL_NAME}`);
  console.log(`[Midscene Sidecar] Proxy: ${process.env.MIDSCENE_OPENAI_HTTP_PROXY || 'none'}`);
  console.log(`[Midscene Sidecar] Gemini adapter: ${process.env.MIDSCENE_USE_GEMINI === '1' ? 'enabled' : 'disabled'}`);

  // 异步预热，不阻塞服务启动
  warmupAIConnection().catch(err => {
    console.warn('[Warmup] 预热过程出错:', err.message);
  });
});
