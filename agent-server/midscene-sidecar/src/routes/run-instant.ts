/**
 * 混合模式后端路由 — 逐步执行即时操作 + 三层降级
 *
 * 核心逻辑：
 *   对每一步，依次尝试：
 *     第 1 层：即时操作（aiTap/aiInput/aiHover/...）
 *     第 2 层：aiAct 单步（只传这一步文本）
 *     第 3 层：aiAct + deepThink（启用深度思考再试一次）
 *     全部失败 → 返回精确错误：第 N 步失败 + 原因 + AI 建议
 *
 * 提供两个路由：
 *   POST /run-instant       — 同步返回全部结果
 *   POST /run-instant/stream — SSE 流式返回（实时显示进度）
 */

import { Router, type Request, type Response } from 'express';
import { PuppeteerAgent } from '@midscene/web/puppeteer';
import { launchBrowser, connectBrowser, closeBrowser, type BrowserSession } from '../browser/manager.js';
import type { InstantStep, InstantActionType } from '../utils/step-inference.js';
import { inferSteps, buildReadableFileId } from '../utils/step-inference.js';
import { generateMidsceneYaml } from '../utils/yaml-generator.js';
import {
  executeStepWithFallback,
  executeInstantAction,
  executeAssertionWithTripleStrategy,
  executeInlineAssert,
  extractSuggestion,
  resolveSmartCacheStrategy,
  type StepExecutionResult,
  type AssertionResult,
} from '../utils/execution-engine.js';
import { validateTestCase } from '../utils/testcase-validator.js';
import path from 'path';

export const runInstantRouter = Router();

// ===================== 用例校验端点 =====================

runInstantRouter.post('/validate-testcase', (req: Request, res: Response) => {
  const { testcase, mode } = req.body;
  if (!testcase) {
    res.status(400).json({ status: 'error', message: 'testcase is required' });
    return;
  }
  const result = validateTestCase(testcase, mode || 'mixed');
  res.json(result);
});

/** 请求参数 */
interface RunInstantRequest {
  url: string;
  /** 推断后的步骤列表（若为空，则从 rawSteps 推断） */
  steps?: InstantStep[];
  /** 原始步骤文本列表（和 steps 二选一） */
  rawSteps?: string[];
  assertions?: string[];
  /** 用例信息（用于命名/缓存/基线） */
  caseId?: string;
  caseName?: string;
  options: {
    useCDP?: boolean;
    cdpEndpoint?: string;
    headless?: boolean;
    cache?: { strategy: string; id: string };
    aiContext?: string;
    deepThink?: boolean;
    /** 从第 N 步开始执行（跳过前面的步骤，适合 "从此步重跑"） */
    startFromStep?: number;
  };
}

// ===================== 同步路由 =====================

runInstantRouter.post('/run-instant', async (req: Request, res: Response) => {
  const body = req.body as RunInstantRequest;
  const { url, assertions = [], options = {} as RunInstantRequest['options'] } = body;

  if (!url) {
    res.status(400).json({ status: 'error', message: 'url is required' });
    return;
  }

  // 解析步骤：优先使用已推断的 steps，否则从 rawSteps 推断
  let steps: InstantStep[] = body.steps || [];
  if (steps.length === 0 && body.rawSteps?.length) {
    steps = inferSteps(body.rawSteps);
  }
  if (steps.length === 0) {
    res.status(400).json({ status: 'error', message: 'steps or rawSteps is required' });
    return;
  }

  let session: BrowserSession | null = null;
  const startFromStep = options.startFromStep || 0;

  try {
    // 1. 连接或启动浏览器
    console.log(`[run-instant] 开始混合模式执行: ${steps.length} 步, 从第 ${startFromStep} 步开始`);
    if (options.useCDP) {
      session = await connectBrowser({ url, cdpEndpoint: options.cdpEndpoint });
    } else {
      session = await launchBrowser({ url, headless: options.headless ?? true });
    }

    // 2. 创建 Agent（smart 缓存策略自动解析）
    const agentConfig: Record<string, any> = {
      generateReport: true,
      autoPrintReportMsg: false,
    };
    if (options.cache) {
      const resolvedStrategy = resolveSmartCacheStrategy(
        options.cache.strategy || 'read-write',
        { cacheId: options.cache.id },
      );
      if (resolvedStrategy !== 'false') {
        agentConfig.cache = {
          strategy: resolvedStrategy,
          id: options.cache.id || 'default',
        };
      }
    }
    if (options.aiContext) {
      agentConfig.aiActContext = options.aiContext;
    }

    const agent = new PuppeteerAgent(session.page, agentConfig);
    const totalStart = Date.now();

    // 3. 逐步执行（含内联断言）
    const stepResults: StepExecutionResult[] = [];
    const inlineAssertionResults: AssertionResult[] = [];
    let lastFailedStep = -1;

    for (let i = 0; i < steps.length; i++) {
      // 跳过 startFromStep 之前的步骤
      if (i < startFromStep) {
        stepResults.push({
          stepIndex: i,
          type: steps[i].type,
          target: steps[i].target,
          value: steps[i].value,
          original: steps[i].original,
          success: true,
          method: 'instant',
          durationMs: 0,
        });
        continue;
      }

      console.log(`[run-instant] 执行步骤 ${i + 1}/${steps.length}: [${steps[i].type}] ${steps[i].original}`);

      // 内联断言步骤：在当前页面状态下直接执行断言，而不是走操作执行逻辑
      if (steps[i].type === 'assert') {
        const inlineResult = await executeInlineAssert(agent, steps[i].target || steps[i].original);
        stepResults.push({
          stepIndex: i,
          type: 'assert',
          target: steps[i].target,
          original: steps[i].original,
          success: inlineResult.success,
          method: 'instant',
          error: inlineResult.reason,
          durationMs: inlineResult.durationMs || 0,
        });
        // 内联断言也加入 assertionResults 以便结果展示
        inlineAssertionResults.push({
          expected: steps[i].target || steps[i].original,
          success: inlineResult.success,
          reason: inlineResult.reason,
        });
        if (!inlineResult.success) {
          lastFailedStep = i;
          console.log(`[run-instant] 内联断言 ${i + 1} 失败，终止执行`);
          break;
        }
        continue;
      }

      const result = await executeStepWithFallback(agent, steps[i], {
        cacheable: true,
        deepThink: options.deepThink,
      });
      stepResults.push({ stepIndex: i, ...result });

      if (!result.success) {
        lastFailedStep = i;
        console.log(`[run-instant] 步骤 ${i + 1} 失败，终止执行`);
        break;
      }
    }

    // [调试] 尾部断言前检查页面实际状态
    if (lastFailedStep < 0) {
      try {
        const pageObj = (agent as any).page;
        if (pageObj) {
          const currentUrl = await pageObj.url();
          const bodyText = await pageObj.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
          console.log(`[run-instant][debug] 断言前页面URL: ${currentUrl}`);
          console.log(`[run-instant][debug] 断言前页面内容: ${bodyText.substring(0, 200)}`);
        }
      } catch (debugErr: any) {
        console.log(`[run-instant][debug] 获取页面状态失败: ${debugErr.message}`);
      }
    }

    // 4. 执行尾部断言（三层策略: aiWaitFor → aiAssert → aiBoolean）
    // 尾部断言只在所有步骤（含内联断言）都通过后执行
    const assertionResults: AssertionResult[] = [...inlineAssertionResults];
    if (lastFailedStep < 0 && assertions.length > 0) {
      for (const expected of assertions) {
        const assertResult = await executeAssertionWithTripleStrategy(agent, expected);
        assertionResults.push(assertResult);
      }
    }

    // 5. 生成报告
    try {
      (agent as any).writeOutActionDumps?.();
    } catch {}

    const durationMs = Date.now() - totalStart;
    const passedSteps = stepResults.filter(s => s.success).length;
    const failedSteps = stepResults.filter(s => !s.success).length;

    const response = {
      status: lastFailedStep < 0 && assertionResults.every(a => a.success) ? 'passed' : 'failed',
      totalSteps: steps.length,
      passedSteps,
      failedSteps,
      durationMs,
      steps: stepResults,
      assertions: assertionResults,
      // 步骤和断言全部成功时，生成回归 YAML 供保存
      regressionYaml: lastFailedStep < 0 && assertionResults.every(a => a.success) && body.caseId
        ? generateMidsceneYaml({
          url,
          caseId: body.caseId || 'unknown',
          caseName: body.caseName || 'unnamed',
          steps,
          assertions,
        }) : undefined,
    };

    console.log(`[run-instant] 完成: ${response.status}, ${passedSteps}/${steps.length} 步成功, ${durationMs}ms`);
    res.json(response);

  } catch (e: any) {
    console.error(`[run-instant] 致命错误:`, e);
    res.status(500).json({ status: 'error', message: e.message || String(e) });
  } finally {
    if (session) {
      await closeBrowser(session);
    }
  }
});

// ===================== SSE 流式路由 =====================

runInstantRouter.post('/run-instant/stream', async (req: Request, res: Response) => {
  const body = req.body as RunInstantRequest;
  const { url, assertions = [], options = {} as RunInstantRequest['options'] } = body;

  if (!url) {
    res.status(400).json({ status: 'error', message: 'url is required' });
    return;
  }

  let steps: InstantStep[] = body.steps || [];
  if (steps.length === 0 && body.rawSteps?.length) {
    steps = inferSteps(body.rawSteps);
  }
  if (steps.length === 0) {
    res.status(400).json({ status: 'error', message: 'steps or rawSteps is required' });
    return;
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  /** 发送 SSE 事件 */
  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let session: BrowserSession | null = null;
  const startFromStep = options.startFromStep || 0;

  // 心跳定时器：每 10 秒发送一次心跳，防止 SSE 连接因长时间无数据而超时
  const heartbeatInterval = setInterval(() => {
    try { res.write(`: heartbeat\n\n`); } catch {}
  }, 10_000);

  try {
    // 1. 连接浏览器
    sendEvent('status', { phase: 'browser', message: '正在连接浏览器...' });
    if (options.useCDP) {
      session = await connectBrowser({ url, cdpEndpoint: options.cdpEndpoint });
    } else {
      session = await launchBrowser({ url, headless: options.headless ?? true });
    }

    // 2. 创建 Agent（smart 缓存策略自动解析）
    const agentConfig: Record<string, any> = {
      generateReport: true,
      autoPrintReportMsg: false,
    };
    if (options.cache) {
      const resolvedStrategy = resolveSmartCacheStrategy(
        options.cache.strategy || 'read-write',
        { cacheId: options.cache.id },
      );
      if (resolvedStrategy !== 'false') {
        agentConfig.cache = {
          strategy: resolvedStrategy,
          id: options.cache.id || 'default',
        };
      }
    }
    if (options.aiContext) {
      agentConfig.aiActContext = options.aiContext;
    }

    const agent = new PuppeteerAgent(session.page, agentConfig);
    const totalStart = Date.now();
    sendEvent('status', { phase: 'ready', message: '浏览器就绪，开始逐步执行', totalSteps: steps.length });

    // 3. 逐步执行（含内联断言）
    const stepResults: StepExecutionResult[] = [];
    const inlineAssertionResults: AssertionResult[] = [];
    let lastFailedStep = -1;

    for (let i = 0; i < steps.length; i++) {
      if (i < startFromStep) {
        stepResults.push({
          stepIndex: i,
          type: steps[i].type,
          target: steps[i].target,
          value: steps[i].value,
          original: steps[i].original,
          success: true,
          method: 'instant',
          durationMs: 0,
        });
        continue;
      }

      // 通知前端：步骤开始
      sendEvent('step_start', {
        stepIndex: i,
        total: steps.length,
        type: steps[i].type,
        target: steps[i].target,
        original: steps[i].original,
      });

      // 内联断言步骤
      if (steps[i].type === 'assert') {
        const inlineResult = await executeInlineAssert(agent, steps[i].target || steps[i].original);
        const fullResult: StepExecutionResult = {
          stepIndex: i,
          type: 'assert',
          target: steps[i].target,
          original: steps[i].original,
          success: inlineResult.success,
          method: 'instant',
          error: inlineResult.reason,
          durationMs: inlineResult.durationMs || 0,
        };
        stepResults.push(fullResult);
        inlineAssertionResults.push({
          expected: steps[i].target || steps[i].original,
          success: inlineResult.success,
          reason: inlineResult.reason,
        });
        sendEvent('step_done', fullResult);
        // 内联断言的结果也发送一个 assert_done 事件，便于前端统一展示
        sendEvent('assert_done', {
          assertIndex: `inline-${i}`,
          expected: steps[i].target || steps[i].original,
          success: inlineResult.success,
          reason: inlineResult.reason,
        });
        if (!inlineResult.success) {
          lastFailedStep = i;
          break;
        }
        continue;
      }

      // 执行操作步骤（传入 onProgress 发送中间状态，防止前端感觉卡住）
      const result = await executeStepWithFallback(agent, steps[i], {
        cacheable: true,
        deepThink: options.deepThink,
        onProgress: (phase, detail) => {
          sendEvent('step_progress', {
            stepIndex: i,
            phase,
            message: detail || `步骤 ${i + 1} 正在执行...`,
            elapsedMs: Date.now() - totalStart,
          });
        },
      });
      const fullResult: StepExecutionResult = { stepIndex: i, ...result };
      stepResults.push(fullResult);

      if (result.success && result.method !== 'instant') {
        sendEvent('step_fallback', {
          stepIndex: i,
          from: 'instant',
          to: result.method,
          message: `步骤 ${i + 1} 即时操作失败，已通过 ${result.method} 完成`,
        });
      }

      sendEvent('step_done', fullResult);

      if (!result.success) {
        lastFailedStep = i;
        break;
      }
    }

    // 4. 执行尾部断言（三层策略: aiWaitFor → aiAssert → aiBoolean）
    const assertionResults: AssertionResult[] = [...inlineAssertionResults];
    if (lastFailedStep < 0 && assertions.length > 0) {
      for (let i = 0; i < assertions.length; i++) {
        const assertResult = await executeAssertionWithTripleStrategy(agent, assertions[i]);
        assertionResults.push(assertResult);
        sendEvent('assert_done', { assertIndex: i, ...assertResult });
      }
    }

    // 5. 生成报告
    try {
      (agent as any).writeOutActionDumps?.();
    } catch {}

    const durationMs = Date.now() - totalStart;
    const passedSteps = stepResults.filter(s => s.success).length;
    const allPassed = lastFailedStep < 0 && assertionResults.every(a => a.success);

    // 6. 发送最终结果
    sendEvent('done', {
      status: allPassed ? 'passed' : 'failed',
      totalSteps: steps.length,
      passedSteps,
      failedSteps: stepResults.filter(s => !s.success).length,
      durationMs,
      steps: stepResults,
      // 步骤和断言全部成功时，生成回归 YAML 供保存
      regressionYaml: allPassed && body.caseId ? generateMidsceneYaml({
        url,
        caseId: body.caseId || 'unknown',
        caseName: body.caseName || 'unnamed',
        steps,
        assertions,
      }) : undefined,
    });

  } catch (e: any) {
    console.error(`[run-instant/stream] 致命错误:`, e);
    sendEvent('error', { message: e.message || String(e) });
  } finally {
    clearInterval(heartbeatInterval);
    if (session) {
      await closeBrowser(session);
    }
    res.end();
  }
});
