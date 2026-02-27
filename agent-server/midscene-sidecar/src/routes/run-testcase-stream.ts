import { Router, type Request, type Response } from 'express';
import { PuppeteerAgent } from '@midscene/web/puppeteer';
import { launchBrowser, connectBrowser, closeBrowser, type BrowserSession } from '../browser/manager.js';
import { getFileUploadActions } from '../actions/file-upload-action.js';
import { inferSteps, type InstantStep } from '../utils/step-inference.js';
import { generateMidsceneYaml } from '../utils/yaml-generator.js';
import {
  executeStepWithFallback,
  executeInstantAction,
  executeAssertionWithTripleStrategy,
  shouldDisableCache,
  resolveSmartCacheStrategy,
} from '../utils/execution-engine.js';
import fs from 'fs';
import path from 'path';

// shouldDisableCache 已统一到 utils/execution-engine.ts

// ===================== 文件上传工具函数 =====================

/** 从 scenario 文本和 testData 中提取文件路径 */
function extractFilePaths(scenario: string, testData?: Record<string, string>): string[] {
  const paths: string[] = [];
  const uploadFiles = testData?.uploadFiles || testData?.dragFiles || '';
  if (uploadFiles) {
    paths.push(...uploadFiles.split(',').map(p => p.trim()).filter(Boolean));
  }
  const pathRegex = /[（(]((?:\/|~\/)[^）)]+)[）)]/g;
  let match;
  while ((match = pathRegex.exec(scenario)) !== null) {
    const filePath = match[1].trim();
    if (fs.existsSync(filePath)) {
      paths.push(filePath);
    } else {
      console.warn(`[file-upload] 文件不存在: ${filePath}`);
    }
  }
  return [...new Set(paths)];
}

/** 判断 scenario 是否为拖拽上传场景 */
function isDragDropScenario(scenario: string, testData?: Record<string, string>): boolean {
  if (testData?.dragFiles) return true;
  return /拖拽|拖放|drag.?and.?drop|drag.?drop|拖动.*上传|拖入/i.test(scenario);
}

/** 获取 MIME 类型 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
    '.pdf': 'application/pdf', '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain', '.csv': 'text/csv', '.json': 'application/json',
    '.zip': 'application/zip', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

/** 通过 Puppeteer page.evaluate 模拟文件拖入，支持 AI 定位坐标 */
async function simulateFileDrop(
  page: any,
  filePaths: string[],
  dropTargetSelector?: string,
  dropCoords?: { x: number; y: number },
): Promise<void> {
  const fileDataList = filePaths.map(fp => ({
    name: path.basename(fp),
    mimeType: getMimeType(fp),
    base64: fs.readFileSync(fp).toString('base64'),
  }));
  console.log(`[file-upload] 模拟拖拽上传 ${fileDataList.length} 个文件到页面`);
  if (dropCoords) {
    console.log(`[file-upload] 使用 AI 定位坐标: (${dropCoords.x}, ${dropCoords.y})`);
  }
  await page.evaluate(async (
    files: Array<{ name: string; mimeType: string; base64: string }>,
    selector: string | undefined,
    coords: { x: number; y: number } | undefined,
  ) => {
    function base64ToUint8Array(base64: string): Uint8Array {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
    const dataTransfer = new DataTransfer();
    for (const f of files) {
      const bytes = base64ToUint8Array(f.base64);
      const file = new File([bytes as unknown as BlobPart], f.name, { type: f.mimeType });
      dataTransfer.items.add(file);
    }
    let dropTarget: Element | null = null;
    // ★ 优先使用 aiLocate 返回的精确坐标定位元素
    if (coords) {
      dropTarget = document.elementFromPoint(coords.x, coords.y);
    }
    if (!dropTarget && selector) dropTarget = document.querySelector(selector);
    if (!dropTarget) {
      const candidates = [
        '[class*="drop"]', '[class*="upload"]', '[class*="dropzone"]',
        '[class*="drag"]', '[data-testid*="upload"]', '[data-testid*="drop"]',
        'input[type="file"]', '.upload-area', '.drop-area', '.file-drop',
      ];
      for (const sel of candidates) {
        dropTarget = document.querySelector(sel);
        if (dropTarget) break;
      }
    }
    if (!dropTarget) dropTarget = document.body;
    const eventInit: any = { dataTransfer, bubbles: true, cancelable: true };
    if (coords) {
      eventInit.clientX = coords.x;
      eventInit.clientY = coords.y;
    }
    dropTarget.dispatchEvent(new DragEvent('dragenter', eventInit));
    dropTarget.dispatchEvent(new DragEvent('dragover', eventInit));
    dropTarget.dispatchEvent(new DragEvent('drop', eventInit));
    dropTarget.dispatchEvent(new DragEvent('dragleave', eventInit));
  }, fileDataList, dropTargetSelector, dropCoords);
  await new Promise(r => setTimeout(r, 2000));
  console.log(`[file-upload] 拖拽上传模拟完成`);
}

/** 从 scenario 文本中移除文件路径部分 */
function cleanScenarioForAI(scenario: string): string {
  return scenario.replace(/[（(](?:\/|~\/)[^）)]+[）)]/g, '').trim();
}

export const runTestcaseStreamRouter = Router();

/**
 * POST /run-testcase/stream — SSE streaming execution.
 *
 * Same logic as /run-testcase but pushes each step's status via SSE events.
 * Frontend uses EventSource to receive real-time timeline updates.
 *
 * Events:
 *   step_start  — { type, description }
 *   screenshot  — { base64 }
 *   step_done   — { type, success, durationMs, error? }
 *   assert_done — { expected, success, reason? }
 *   done        — { status, durationMs, reportFile?, results }
 *   error       — { message }
 */
runTestcaseStreamRouter.post('/run-testcase/stream', async (req: Request, res: Response) => {
  const { url, testcase, options = {} } = req.body;

  if (!url || !testcase?.scenario) {
    res.status(400).json({ status: 'error', message: 'url and testcase.scenario are required' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let session: BrowserSession | null = null;

  try {
    send('status', { message: 'Connecting to browser...' });

    if (options.useCDP) {
      session = await connectBrowser({ url, cdpEndpoint: options.cdpEndpoint });
    } else {
      session = await launchBrowser({ url, headless: options.headless ?? true });
    }

    send('status', { message: 'Browser connected. Creating Midscene agent...' });

    const agentConfig: Record<string, any> = {
      generateReport: true,
      autoPrintReportMsg: false,
      // ★ onTaskStartTip 回调：AI 规划的每个子步骤开始时推送可读描述到前端
      onTaskStartTip: (tip: string) => {
        send('step_tip', { message: tip });
        console.log(`[run-testcase-stream] 子步骤: ${tip}`);
      },
    };

    // ★ defineAction / customActions：当用例包含文件路径时，注入文件上传自定义动作
    const preFilePaths = extractFilePaths(testcase.scenario, testcase.testData);
    if (preFilePaths.length > 0) {
      agentConfig.customActions = getFileUploadActions();
      console.log(`[run-testcase-stream] 已注入文件上传自定义动作 (FileUpload, FileDrop)`);
      send('status', { message: '已加载文件上传自定义动作' });
    }

    if (options.cache) {
      const rawStrategy = options.cache.strategy || 'read-write';
      const resolvedStrategy = resolveSmartCacheStrategy(rawStrategy, {
        cacheId: options.cache.id,
        scenario: testcase.scenario,
      });
      if (resolvedStrategy !== 'false') {
        agentConfig.cache = { strategy: resolvedStrategy, id: options.cache.id || 'default' };
      }
    }

    // ★ 多模型策略：为规划/定位/数据提取分别配置不同模型
    const planningModelName = process.env.MIDSCENE_PLANNING_MODEL_NAME;
    const planningModelBaseUrl = process.env.MIDSCENE_PLANNING_MODEL_BASE_URL;
    const planningModelApiKey = process.env.MIDSCENE_PLANNING_MODEL_API_KEY;
    const insightModelName = process.env.MIDSCENE_INSIGHT_MODEL_NAME;
    const insightModelBaseUrl = process.env.MIDSCENE_INSIGHT_MODEL_BASE_URL;
    const insightModelApiKey = process.env.MIDSCENE_INSIGHT_MODEL_API_KEY;

    if (planningModelName) {
      agentConfig.planningModelConfig = {
        model: planningModelName,
        ...(planningModelBaseUrl ? { baseURL: planningModelBaseUrl } : {}),
        ...(planningModelApiKey ? { apiKey: planningModelApiKey } : {}),
      };
      console.log(`[run-testcase-stream] Planning 模型: ${planningModelName}`);
    }
    if (insightModelName) {
      agentConfig.insightModelConfig = {
        model: insightModelName,
        ...(insightModelBaseUrl ? { baseURL: insightModelBaseUrl } : {}),
        ...(insightModelApiKey ? { apiKey: insightModelApiKey } : {}),
      };
      console.log(`[run-testcase-stream] Insight 模型: ${insightModelName}`);
    }

    const contextParts: string[] = [];
    if (options.aiContext) contextParts.push(options.aiContext);
    if (testcase.preconditions) contextParts.push(`Background: ${testcase.preconditions}`);
    if (contextParts.length > 0) agentConfig.aiActContext = contextParts.join('. ');

    const agent = new PuppeteerAgent(session.page, agentConfig);

    const results: { steps: any[]; assertions: any[]; extractions: any[] } = {
      steps: [], assertions: [], extractions: [],
    };

    const startTime = Date.now();

    // cacheable 精细控制（提到外层，降级块也需要）
    const cacheableFromTestData = testcase.testData?.cacheable !== 'false';
    const cacheableForAct = cacheableFromTestData && !shouldDisableCache(testcase.scenario);

    try {
      // 提取文件路径 + 判断场景类型
      const filePaths = extractFilePaths(testcase.scenario, testcase.testData);
      const isDragDrop = isDragDropScenario(testcase.scenario, testcase.testData);
      if (!cacheableForAct) {
        console.log(`[run-testcase-stream] 该场景禁用缓存 (动态内容或 testData.cacheable=false)`);
      }

      // deepThink 选项：复杂场景启用深度思考规划
      const deepThinkOpt = options.deepThink === true ? true : undefined;
      if (deepThinkOpt) {
        console.log(`[run-testcase-stream] deepThink 已启用`);
        send('status', { message: 'deepThink 模式已启用，AI 将进行更深入的规划' });
      }

      send('step_start', { type: 'aiAct', description: testcase.scenario });

      const actStart = Date.now();

      if (filePaths.length > 0 && isDragDrop) {
        // ★ 拖拽上传模式
        console.log(`[run-testcase-stream] 拖拽上传模式: ${filePaths.join(', ')}`);
        send('status', { message: `拖拽上传: ${filePaths.map(f => path.basename(f)).join(', ')}` });
        const dropTarget = testcase.testData?.dropTarget;

        // ★ aiLocate：先用 AI 精确定位上传/拖拽区域的坐标
        let dropCoords: { x: number; y: number } | undefined;
        try {
          const located = await (agent as any).aiLocate?.('文件上传或拖拽区域');
          if (located?.center) {
            dropCoords = { x: located.center[0], y: located.center[1] };
            console.log(`[run-testcase-stream] aiLocate 定位成功: (${dropCoords.x}, ${dropCoords.y})`);
            send('status', { message: `AI 定位拖拽区域: (${dropCoords.x}, ${dropCoords.y})` });
          }
        } catch (locateErr: any) {
          console.warn(`[run-testcase-stream] aiLocate 定位失败，回退: ${locateErr.message}`);
        }

        await simulateFileDrop(session.page, filePaths, dropTarget, dropCoords);

        // 拖拽后如果还有其他操作
        const cleanedScenario = cleanScenarioForAI(testcase.scenario);
        if (cleanedScenario && !/^功能测试[:：]?\s*拖拽文件上传/i.test(cleanedScenario)) {
          await agent.aiAct(cleanedScenario, { cacheable: cacheableForAct, deepThink: deepThinkOpt });
        }

      } else if (filePaths.length > 0) {
        // ★ 点击上传模式
        console.log(`[run-testcase-stream] 点击上传模式: ${filePaths.join(', ')}`);
        send('status', { message: `点击上传: ${filePaths.map(f => path.basename(f)).join(', ')}` });
        const cleanedScenario = cleanScenarioForAI(testcase.scenario);
        await agent.aiAct(cleanedScenario || testcase.scenario, {
          cacheable: cacheableForAct,
          fileChooserAccept: filePaths,
          deepThink: deepThinkOpt,
        });

      } else {
        // ★ 普通场景
        await agent.aiAct(testcase.scenario, { cacheable: cacheableForAct, deepThink: deepThinkOpt });
      }

      const actDuration = Date.now() - actStart;

      results.steps.push({ phase: 'scenario', success: true });

      // Take screenshot after action
      try {
        const screenshotBase64 = await session.page.screenshot({ encoding: 'base64', type: 'png' });
        send('screenshot', { base64: `data:image/png;base64,${screenshotBase64}` });
      } catch {}

      send('step_done', { type: 'aiAct', success: true, durationMs: actDuration, description: testcase.scenario });

      // ★ recordToReport：aiAct 完成后记录截图到 Midscene 报告，方便事后排查
      try {
        await (agent as any).recordToReport?.('场景执行完成', {
          content: testcase.scenario.substring(0, 100),
        });
        console.log(`[run-testcase-stream] recordToReport: 已记录场景执行截图`);
      } catch (reportErr: any) {
        console.warn(`[run-testcase-stream] recordToReport 警告: ${reportErr.message}`);
      }

      // ★ evaluateJavaScript：在 aiAct 之后、aiAssert 之前执行页面内 JS
      if (testcase.testData?.evaluateJs) {
        send('step_start', { type: 'evaluateJs', description: testcase.testData.evaluateJs.substring(0, 80) });
        try {
          const jsResult = await (agent as any).evaluateJavaScript?.(testcase.testData.evaluateJs);
          results.extractions.push({ type: 'js_eval', data: jsResult });
          send('step_done', { type: 'evaluateJs', success: true, data: jsResult });
          console.log(`[run-testcase-stream] JS 执行结果:`, jsResult);
        } catch (jsErr: any) {
          results.extractions.push({ type: 'js_eval', error: jsErr.message });
          send('step_done', { type: 'evaluateJs', success: false, error: jsErr.message });
          console.warn(`[run-testcase-stream] evaluateJavaScript 失败: ${jsErr.message}`);
        }
      }

      // aiAssert — visual assertions
      if (testcase.expectedResults?.length > 0) {
        for (const expected of testcase.expectedResults) {
          send('step_start', { type: 'aiAssert', description: expected });

          const assertStart = Date.now();
          try {
            // ★ domIncluded：当 testData 指定时，让 aiAssert 同时获取 DOM 信息辅助判断
            if (testcase.testData?.domIncluded === 'true') {
              await (agent as any).aiAssert(expected, { domIncluded: true });
            } else {
              await agent.aiAssert(expected);
            }
            const assertDuration = Date.now() - assertStart;
            results.assertions.push({ expected, success: true });
            send('assert_done', { expected, success: true, durationMs: assertDuration });
          } catch (e: any) {
            const assertDuration = Date.now() - assertStart;
            results.assertions.push({ expected, success: false, reason: e.message });
            send('assert_done', { expected, success: false, reason: e.message, durationMs: assertDuration });
          }
        }
      }

      // aiQuery — data extraction (optional)
      if (testcase.extractSchema) {
        send('step_start', { type: 'aiQuery', description: testcase.extractSchema });
        try {
          // ★ domIncluded：当 testData 指定时，让 aiQuery 同时获取 DOM 信息
          let data: any;
          if (testcase.testData?.domIncluded === 'true') {
            data = await (agent as any).aiQuery(testcase.extractSchema, { domIncluded: true });
          } else {
            data = await agent.aiQuery(testcase.extractSchema);
          }
          results.extractions.push({ schema: testcase.extractSchema, data });
          send('step_done', { type: 'aiQuery', success: true, description: testcase.extractSchema });
        } catch (e: any) {
          results.extractions.push({ schema: testcase.extractSchema, error: e.message });
          send('step_done', { type: 'aiQuery', success: false, error: e.message });
        }
      }

    } catch (e: any) {
      send('step_done', { type: 'aiAct', success: false, error: e.message, description: testcase.scenario });

      // ★ 执行失败时删除该用例的缓存文件，防止错误规划被复用
      if (options.cache?.id) {
        const cacheFile = path.resolve(
          process.env.MIDSCENE_CACHE_DIR || './midscene_run/cache',
          `${options.cache.id}.cache.yaml`
        );
        try {
          if (fs.existsSync(cacheFile)) {
            fs.unlinkSync(cacheFile);
            console.log(`[run-testcase-stream] 已清除失败用例缓存: ${cacheFile}`);
            send('status', { message: `已清除失败用例缓存` });
          }
        } catch (cleanErr: any) {
          console.warn(`[run-testcase-stream] 清除缓存文件失败: ${cleanErr.message}`);
        }
      }

      // ★ 自由模式自动降级：aiAct 整段失败后，如果有步骤信息，自动降级到逐步执行
      if (testcase.steps && testcase.steps.length > 0) {
        console.log(`[run-testcase-stream] ★ 自动降级: 切换为逐步即时操作执行 (${testcase.steps.length} 步)`);
        send('mode_fallback', {
          from: 'free',
          to: 'mixed',
          reason: `aiAct 执行失败，自动切换逐步执行: ${e.message}`,
        });

        const instantSteps = inferSteps(testcase.steps);
        let degradeSuccess = true;
        const degradeStepResults: any[] = [];

        for (let i = 0; i < instantSteps.length; i++) {
          const step = instantSteps[i];
          const stepStart = Date.now();

          send('step_start', {
            type: step.type,
            description: step.original,
            stepIndex: i,
            total: instantSteps.length,
            isDegraded: true,
          });

          // 使用共享执行引擎（三层降级）
          const result = await executeStepWithFallback(agent, step, { cacheable: cacheableForAct });
          const stepResult = {
            stepIndex: i, type: step.type, original: step.original,
            success: result.success, method: result.method, error: result.error,
            durationMs: result.durationMs,
          };
          degradeStepResults.push(stepResult);

          if (result.success && result.method !== 'instant') {
            send('step_fallback', {
              stepIndex: i,
              from: 'instant',
              to: result.method,
              message: `步骤 ${i + 1} 即时操作失败，已通过 ${result.method} 完成`,
            });
          }

          send('step_done', { ...stepResult, isDegraded: true });

          if (!result.success) {
            degradeSuccess = false;
            break;
          }
        }

        if (degradeSuccess) {
          results.steps.push({ phase: 'scenario-degraded', success: true });
          (results as any).degraded = true;
          (results as any).degradeSteps = degradeStepResults;
          console.log(`[run-testcase-stream] ★ 降级成功！逐步执行全部通过`);
        } else {
          results.steps.push({
            phase: 'scenario-degraded', success: false,
            error: `降级执行失败: ${degradeStepResults.find(s => !s.success)?.error}`,
          });
          (results as any).degraded = true;
          (results as any).degradeSteps = degradeStepResults;
        }
      } else {
        // 没有步骤可降级
        results.steps.push({ phase: 'scenario', success: false, error: e.message });
      }
    }

    // ★ 执行成功后，清理缓存中未使用的旧条目
    const scenarioSuccess = results.steps.every((s: any) => s.success);
    if (scenarioSuccess) {
      try {
        await (agent as any).flushCache?.({ cleanUnused: true });
        console.log(`[run-testcase-stream] 缓存已清理无用条目`);
      } catch (flushErr: any) {
        console.warn(`[run-testcase-stream] flushCache 警告: ${flushErr.message}`);
      }
    }

    const durationMs = Date.now() - startTime;

    // Flush report
    let reportFilePath: string | undefined;
    try {
      (agent as any).writeOutActionDumps?.();
      reportFilePath = (agent as any).reportFile;
    } catch {}

    const allPassed = results.assertions.every(a => a.success) && results.steps.every(s => s.success);

    // 降级成功后也生成回归 YAML，供前端保存为基线
    let regressionYaml: string | undefined;
    if (allPassed && (results as any).degraded && testcase.steps?.length > 0 && testcase.caseId) {
      try {
        const instantSteps = inferSteps(testcase.steps);
        regressionYaml = generateMidsceneYaml({
          url,
          caseId: testcase.caseId || 'unknown',
          caseName: testcase.name || 'unnamed',
          steps: instantSteps,
          assertions: testcase.expectedResults || [],
        });
        console.log(`[run-testcase-stream] 降级成功，已生成回归 YAML`);
      } catch (yamlErr: any) {
        console.warn(`[run-testcase-stream] 生成回归 YAML 失败: ${yamlErr.message}`);
      }
    }

    send('done', {
      status: allPassed ? 'passed' : 'failed',
      testcaseName: testcase.name || 'unnamed',
      durationMs,
      results,
      reportFile: reportFilePath,
      regressionYaml,
    });

  } catch (e: any) {
    send('error', { message: e.message || String(e) });
  } finally {
    if (session) await closeBrowser(session);
    res.end();
  }
});
