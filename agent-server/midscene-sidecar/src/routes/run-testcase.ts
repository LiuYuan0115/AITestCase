import { Router, type Request, type Response } from 'express';
import { PuppeteerAgent } from '@midscene/web/puppeteer';
import { launchBrowser, connectBrowser, closeBrowser, type BrowserSession } from '../browser/manager.js';
import { getFileUploadActions } from '../actions/file-upload-action.js';
import { inferSteps, type InstantStep } from '../utils/step-inference.js';
import { generateMidsceneYaml } from '../utils/yaml-generator.js';
import {
  executeStepWithFallback,
  executeInstantAction,
  shouldDisableCache,
  resolveSmartCacheStrategy,
} from '../utils/execution-engine.js';
import fs from 'fs';
import path from 'path';

export const runTestcaseRouter = Router();

// shouldDisableCache 已统一到 utils/execution-engine.ts

// ===================== 文件上传工具函数 =====================

/**
 * 从 scenario 文本和 testData 中提取文件路径
 * 支持：
 *  - scenario 中括号内的绝对路径：（/Users/mac/test.png）或 (/Users/mac/test.png)
 *  - testData.uploadFiles：逗号分隔的文件路径
 *  - testData.dragFiles：逗号分隔的拖拽文件路径
 */
function extractFilePaths(scenario: string, testData?: Record<string, string>): string[] {
  const paths: string[] = [];

  // 1. 从 testData.uploadFiles 或 testData.dragFiles 中提取
  const uploadFiles = testData?.uploadFiles || testData?.dragFiles || '';
  if (uploadFiles) {
    paths.push(...uploadFiles.split(',').map(p => p.trim()).filter(Boolean));
  }

  // 2. 从 scenario 文本中提取括号内的绝对路径
  //    匹配中文括号（）和英文括号()，支持 /开头 或 ~/开头 的路径
  const pathRegex = /[（(]((?:\/|~\/)[^）)]+)[）)]/g;
  let match;
  while ((match = pathRegex.exec(scenario)) !== null) {
    const filePath = match[1].trim();
    // 验证路径是否存在
    if (fs.existsSync(filePath)) {
      paths.push(filePath);
    } else {
      console.warn(`[file-upload] 文件不存在: ${filePath}`);
    }
  }

  return [...new Set(paths)]; // 去重
}

/**
 * 判断 scenario 是否为拖拽上传场景
 */
function isDragDropScenario(scenario: string, testData?: Record<string, string>): boolean {
  if (testData?.dragFiles) return true;
  return /拖拽|拖放|drag.?and.?drop|drag.?drop|拖动.*上传|拖入/i.test(scenario);
}

/**
 * 获取 MIME 类型
 */
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

/**
 * 通过 Puppeteer page.evaluate 模拟文件拖入
 * 在浏览器环境中构造 File + DataTransfer + DragEvent，触发拖拽上传
 */
async function simulateFileDrop(
  page: any,
  filePaths: string[],
  dropTargetSelector?: string,
  dropCoords?: { x: number; y: number },
): Promise<void> {
  // 读取所有文件内容，转为 base64
  const fileDataList = filePaths.map(fp => ({
    name: path.basename(fp),
    mimeType: getMimeType(fp),
    base64: fs.readFileSync(fp).toString('base64'),
  }));

  console.log(`[file-upload] 模拟拖拽上传 ${fileDataList.length} 个文件到页面`);
  if (dropCoords) {
    console.log(`[file-upload] 使用 AI 定位坐标: (${dropCoords.x}, ${dropCoords.y})`);
  }

  // 在浏览器环境中执行拖拽模拟
  await page.evaluate(async (
    files: Array<{ name: string; mimeType: string; base64: string }>,
    selector: string | undefined,
    coords: { x: number; y: number } | undefined,
  ) => {
    // 辅助：base64 转 Uint8Array
    function base64ToUint8Array(base64: string): Uint8Array {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }

    // 构造 DataTransfer 和 File 对象
    const dataTransfer = new DataTransfer();
    for (const f of files) {
      const bytes = base64ToUint8Array(f.base64);
      const file = new File([bytes as unknown as BlobPart], f.name, { type: f.mimeType });
      dataTransfer.items.add(file);
    }

    // ★ 定位拖放目标：优先使用 AI 定位坐标，其次 selector，最后候选列表
    let dropTarget: Element | null = null;

    // 方式一：使用 aiLocate 返回的精确坐标定位元素
    if (coords) {
      dropTarget = document.elementFromPoint(coords.x, coords.y);
      if (dropTarget) {
        console.log(`[file-upload] 通过 AI 坐标定位到: ${dropTarget.tagName}.${dropTarget.className}`);
      }
    }

    // 方式二：使用指定的 CSS 选择器
    if (!dropTarget && selector) {
      dropTarget = document.querySelector(selector);
    }

    // 方式三：尝试常见的拖拽上传区域 class/id
    if (!dropTarget) {
      const candidates = [
        '[class*="drop"]', '[class*="upload"]', '[class*="dropzone"]',
        '[class*="drag"]', '[data-testid*="upload"]', '[data-testid*="drop"]',
        'input[type="file"]',
        '.upload-area', '.drop-area', '.file-drop',
      ];
      for (const sel of candidates) {
        dropTarget = document.querySelector(sel);
        if (dropTarget) break;
      }
    }
    // 兜底：直接用 document.body
    if (!dropTarget) {
      dropTarget = document.body;
    }

    // 模拟完整的拖拽事件序列
    const eventInit: any = { dataTransfer, bubbles: true, cancelable: true };
    // 如果有坐标，将坐标信息附加到事件中，提高兼容性
    if (coords) {
      eventInit.clientX = coords.x;
      eventInit.clientY = coords.y;
    }
    dropTarget.dispatchEvent(new DragEvent('dragenter', eventInit));
    dropTarget.dispatchEvent(new DragEvent('dragover', eventInit));
    dropTarget.dispatchEvent(new DragEvent('drop', eventInit));
    dropTarget.dispatchEvent(new DragEvent('dragleave', eventInit));
  }, fileDataList, dropTargetSelector, dropCoords);

  // 拖入后等待页面处理
  await new Promise(r => setTimeout(r, 2000));
  console.log(`[file-upload] 拖拽上传模拟完成`);
}

/**
 * 从 scenario 文本中移除文件路径部分，只保留操作描述
 * 避免 AI 误将路径当做输入内容
 */
function cleanScenarioForAI(scenario: string): string {
  // 移除括号内的文件路径，保留操作描述
  return scenario.replace(/[（(](?:\/|~\/)[^）)]+[）)]/g, '').trim();
}

interface TestCase {
  name: string;
  scenario: string;
  expectedResults?: string[];
  preconditions?: string;
  testData?: Record<string, string>;
  extractSchema?: string;
  /** 新增：独立步骤列表（用于自由模式失败后自动降级到混合模式） */
  steps?: string[];
  /** 新增：用例 ID（用于命名/缓存/基线） */
  caseId?: string;
  /** 新增：执行模式，默认 free */
  executionMode?: 'free' | 'mixed' | 'regression';
  /** 新增：回归基线 ID（回归模式用） */
  regressionId?: string;
}

interface RunOptions {
  headless?: boolean;
  useCDP?: boolean;
  cdpEndpoint?: string;
  cache?: { strategy: string; id: string };
  deepThink?: boolean;
  aiContext?: string;
  timeout?: number;
}

interface StepResult {
  phase: string;
  success: boolean;
  error?: string;
}

interface AssertionResult {
  expected: string;
  success: boolean;
  reason?: string;
}

// ===================== 即时操作辅助函数（自由模式降级用） =====================

// executeInstantAction 已统一到 utils/execution-engine.ts

runTestcaseRouter.post('/run-testcase', async (req: Request, res: Response) => {
  const { url, testcase, options = {} } = req.body as {
    url: string;
    testcase: TestCase;
    options: RunOptions;
  };

  if (!url || !testcase?.scenario) {
    res.status(400).json({ status: 'error', message: 'url and testcase.scenario are required' });
    return;
  }

  let session: BrowserSession | null = null;

  try {
    // 1. Connect or launch browser
    console.log(`[run-testcase] Starting: ${testcase.name || 'unnamed'}`);
    console.log(`[run-testcase] URL: ${url}`);
    console.log(`[run-testcase] Mode: ${options.useCDP ? 'CDP' : (options.headless ?? true) ? 'headless' : 'headed'}`);

    if (options.useCDP) {
      session = await connectBrowser({ url, cdpEndpoint: options.cdpEndpoint });
    } else {
      session = await launchBrowser({ url, headless: options.headless ?? true });
    }

    // 2. 创建 Midscene Agent 配置
    //    Midscene SDK 直接从环境变量读取模型配置（OPENAI_API_KEY, OPENAI_BASE_URL 等），
    //    不需要通过 modelConfig 手动传入
    const agentConfig: Record<string, any> = {
      generateReport: true,
      autoPrintReportMsg: false,
      // ★ onTaskStartTip 回调：记录 AI 规划的每个子步骤（非流式仅日志输出）
      onTaskStartTip: (tip: string) => {
        console.log(`[run-testcase] 子步骤: ${tip}`);
      },
    };

    // ★ defineAction / customActions：当用例包含文件路径时，注入文件上传自定义动作
    //   让 AI 规划器在遇到上传场景时可以自动调用 FileUpload / FileDrop 动作
    const preFilePaths = extractFilePaths(testcase.scenario, testcase.testData);
    if (preFilePaths.length > 0) {
      agentConfig.customActions = getFileUploadActions();
      console.log(`[run-testcase] 已注入文件上传自定义动作 (FileUpload, FileDrop)`);
    }

    // Cache configuration — "smart" 需要先解析为 Midscene 原生策略
    if (options.cache) {
      const rawStrategy = options.cache.strategy || 'read-write';
      const resolvedStrategy = resolveSmartCacheStrategy(rawStrategy, {
        cacheId: options.cache.id,
        scenario: testcase.scenario,
      });
      if (resolvedStrategy !== 'false') {
        agentConfig.cache = {
          strategy: resolvedStrategy,
          id: options.cache.id || 'default',
        };
      }
    }

    // ★ 多模型策略：为规划/定位/数据提取分别配置不同模型
    //   环境变量有值时才传入，避免覆盖默认模型配置
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
      console.log(`[run-testcase] Planning 模型: ${planningModelName}`);
    }
    if (insightModelName) {
      agentConfig.insightModelConfig = {
        model: insightModelName,
        ...(insightModelBaseUrl ? { baseURL: insightModelBaseUrl } : {}),
        ...(insightModelApiKey ? { apiKey: insightModelApiKey } : {}),
      };
      console.log(`[run-testcase] Insight 模型: ${insightModelName}`);
    }

    // 3. 构建 AI 上下文（处理弹窗、前置条件等）
    const contextParts: string[] = [];
    if (options.aiContext) {
      contextParts.push(options.aiContext);
    }
    if (testcase.preconditions) {
      contextParts.push(`Background: ${testcase.preconditions}`);
    }
    // aiActContext 是只读属性，必须在构造时传入
    if (contextParts.length > 0) {
      agentConfig.aiActContext = contextParts.join('. ');
    }

    const agent = new PuppeteerAgent(session.page, agentConfig);

    const results: {
      steps: StepResult[];
      assertions: AssertionResult[];
      extractions: any[];
      pageState?: Record<string, any>;
    } = {
      steps: [],
      assertions: [],
      extractions: [],
    };

    const startTime = Date.now();

    // cacheable 精细控制：动态场景（验证码、实时数据等）禁用缓存（提到外层，降级块也需要）
    const cacheableFromTestData = testcase.testData?.cacheable !== 'false';
    const cacheableForAct = cacheableFromTestData && !shouldDisableCache(testcase.scenario);

    try {
      // 4. 提取文件路径 + 判断场景类型
      const filePaths = extractFilePaths(testcase.scenario, testcase.testData);
      const isDragDrop = isDragDropScenario(testcase.scenario, testcase.testData);
      if (!cacheableForAct) {
        console.log(`[run-testcase] 该场景禁用缓存 (动态内容或 testData.cacheable=false)`);
      }

      // deepThink 选项：复杂场景启用深度思考规划
      const deepThinkOpt = options.deepThink === true ? true : undefined;
      if (deepThinkOpt) {
        console.log(`[run-testcase] deepThink 已启用`);
      }

      if (filePaths.length > 0 && isDragDrop) {
        // ★ 拖拽上传模式：通过 Puppeteer 模拟文件拖入
        console.log(`[run-testcase] 拖拽上传模式: ${filePaths.join(', ')}`);
        const dropTarget = testcase.testData?.dropTarget;

        // ★ aiLocate：先用 AI 精确定位上传/拖拽区域的坐标，提高拖拽成功率
        let dropCoords: { x: number; y: number } | undefined;
        try {
          const located = await (agent as any).aiLocate?.('文件上传或拖拽区域');
          if (located?.center) {
            dropCoords = { x: located.center[0], y: located.center[1] };
            console.log(`[run-testcase] aiLocate 定位成功: (${dropCoords.x}, ${dropCoords.y})`);
          }
        } catch (locateErr: any) {
          console.warn(`[run-testcase] aiLocate 定位失败，回退到选择器/候选列表: ${locateErr.message}`);
        }

        await simulateFileDrop(session.page, filePaths, dropTarget, dropCoords);
        results.steps.push({ phase: 'drag-upload', success: true });
        console.log(`[run-testcase] 拖拽上传完成`);

        // 拖拽后如果 scenario 还有其他操作描述，继续执行
        const cleanedScenario = cleanScenarioForAI(testcase.scenario);
        if (cleanedScenario && !/^功能测试[:：]?\s*拖拽文件上传/i.test(cleanedScenario)) {
          console.log(`[run-testcase] 继续执行后续操作: ${cleanedScenario}`);
          await agent.aiAct(cleanedScenario, { cacheable: cacheableForAct, deepThink: deepThinkOpt });
          results.steps.push({ phase: 'scenario', success: true });
        }

      } else if (filePaths.length > 0) {
        // ★ 点击上传模式：将文件路径作为 fileChooserAccept 传给 aiAct
        console.log(`[run-testcase] 点击上传模式: ${filePaths.join(', ')}`);
        const cleanedScenario = cleanScenarioForAI(testcase.scenario);
        console.log(`[run-testcase] aiAct: ${cleanedScenario}`);
        await agent.aiAct(cleanedScenario || testcase.scenario, {
          cacheable: cacheableForAct,
          fileChooserAccept: filePaths,
          deepThink: deepThinkOpt,
        });
        results.steps.push({ phase: 'scenario', success: true });
        console.log(`[run-testcase] 点击上传 + aiAct 完成`);

      } else {
        // ★ 普通场景（无文件上传）
        console.log(`[run-testcase] aiAct: ${testcase.scenario}`);
        await agent.aiAct(testcase.scenario, { cacheable: cacheableForAct, deepThink: deepThinkOpt });
        results.steps.push({ phase: 'scenario', success: true });
        console.log(`[run-testcase] aiAct completed successfully`);
      }

      // ★ recordToReport：aiAct 完成后记录截图到 Midscene 报告，方便事后排查
      try {
        await (agent as any).recordToReport?.('场景执行完成', {
          content: testcase.scenario.substring(0, 100),
        });
        console.log(`[run-testcase] recordToReport: 已记录场景执行截图`);
      } catch (reportErr: any) {
        console.warn(`[run-testcase] recordToReport 警告: ${reportErr.message}`);
      }

      // ★ evaluateJavaScript：在 aiAct 之后、aiAssert 之前执行页面内 JS
      //   用于检查 localStorage、console 错误、组件状态等，结果自动记入 Midscene 报告
      if (testcase.testData?.evaluateJs) {
        try {
          console.log(`[run-testcase] evaluateJavaScript: ${testcase.testData.evaluateJs.substring(0, 80)}`);
          const jsResult = await (agent as any).evaluateJavaScript?.(testcase.testData.evaluateJs);
          results.extractions.push({ type: 'js_eval', data: jsResult });
          console.log(`[run-testcase] JS 执行结果:`, jsResult);
        } catch (jsErr: any) {
          console.warn(`[run-testcase] evaluateJavaScript 失败: ${jsErr.message}`);
          results.extractions.push({ type: 'js_eval', error: jsErr.message });
        }
      }

      // 5. Visual assertions for each expected result
      if (testcase.expectedResults && testcase.expectedResults.length > 0) {
        for (const expected of testcase.expectedResults) {
          try {
            console.log(`[run-testcase] aiAssert: ${expected}`);
            // ★ domIncluded：当 testData 指定时，让 aiAssert 同时获取 DOM 信息辅助判断
            //   使用 (agent as any) 绕过类型限制，domIncluded 在新版 SDK 中可能尚未暴露类型
            if (testcase.testData?.domIncluded === 'true') {
              await (agent as any).aiAssert(expected, { domIncluded: true });
            } else {
              await agent.aiAssert(expected);
            }
            results.assertions.push({ expected, success: true });
            console.log(`[run-testcase] Assertion PASSED: ${expected}`);
          } catch (e: any) {
            results.assertions.push({
              expected,
              success: false,
              reason: e.message || String(e),
            });
            console.log(`[run-testcase] Assertion FAILED: ${expected} — ${e.message}`);
          }
        }
      }

      // 6. Structured data extraction (optional)
      if (testcase.extractSchema) {
        try {
          console.log(`[run-testcase] aiQuery: ${testcase.extractSchema}`);
          // ★ domIncluded：当 testData 指定时，让 aiQuery 同时获取 DOM 信息（如图片 URL、隐藏属性等）
          let data: any;
          if (testcase.testData?.domIncluded === 'true') {
            data = await (agent as any).aiQuery(testcase.extractSchema, { domIncluded: true });
          } else {
            data = await agent.aiQuery(testcase.extractSchema);
          }
          results.extractions.push({ schema: testcase.extractSchema, data });
        } catch (e: any) {
          results.extractions.push({
            schema: testcase.extractSchema,
            error: e.message,
          });
        }
      }

      // 7. Freeze context for efficient batch queries
      try {
        await (agent as any).freezePageContext?.();
        const pageState: Record<string, any> = {
          url: session.page.url(),
        };
        try {
          pageState.hasError = await (agent as any).aiBoolean?.('Is there an error message on the page?');
        } catch {
          pageState.hasError = null;
        }
        await (agent as any).unfreezePageContext?.();
        results.pageState = pageState;
      } catch {
        // freezePageContext may not be available in all versions
        results.pageState = { url: session.page.url() };
      }

    } catch (e: any) {
      const freeModeFailed = true;
      console.error(`[run-testcase] Scenario execution failed:`, e.message);

      // ★ 执行失败时删除该用例的缓存文件，防止错误规划被复用
      if (options.cache?.id) {
        const cacheFile = path.resolve(
          process.env.MIDSCENE_CACHE_DIR || './midscene_run/cache',
          `${options.cache.id}.cache.yaml`
        );
        try {
          if (fs.existsSync(cacheFile)) {
            fs.unlinkSync(cacheFile);
            console.log(`[run-testcase] 已清除失败用例缓存: ${cacheFile}`);
          }
        } catch (cleanErr: any) {
          console.warn(`[run-testcase] 清除缓存文件失败: ${cleanErr.message}`);
        }
      }

      // ★ 自由模式自动降级：aiAct 失败后，如果有结构化步骤，自动降级到逐步执行
      if (freeModeFailed && testcase.steps && testcase.steps.length > 0) {
        console.log(`[run-testcase] ★ 自动降级: 自由模式失败，切换为逐步即时操作执行 (${testcase.steps.length} 步)`);
        (results as any).degraded = true;
        (results as any).degradeReason = `aiAct 整段执行失败: ${e.message}`;

        const instantSteps = inferSteps(testcase.steps);
        let degradeSuccess = true;
        const degradeStepResults: any[] = [];

        for (let i = 0; i < instantSteps.length; i++) {
          const step = instantSteps[i];
          console.log(`[run-testcase][降级] 步骤 ${i + 1}/${instantSteps.length}: [${step.type}] ${step.original}`);

          // 使用共享执行引擎（三层降级）
          const result = await executeStepWithFallback(agent, step, { cacheable: cacheableForAct });
          degradeStepResults.push({
            stepIndex: i, type: step.type, original: step.original,
            success: result.success, method: result.method, error: result.error,
            durationMs: result.durationMs,
          });

          if (!result.success) {
            degradeSuccess = false;
            console.error(`[run-testcase][降级] 步骤 ${i + 1} 彻底失败: ${result.error}`);
            break;
          }
        }

        (results as any).degradeSteps = degradeStepResults;

        if (degradeSuccess) {
          // 降级成功，标记为通过（scenario 步骤覆盖为成功）
          results.steps.push({ phase: 'scenario-degraded', success: true });
          console.log(`[run-testcase] ★ 降级成功！逐步执行全部通过`);
        } else {
          results.steps.push({
            phase: 'scenario-degraded',
            success: false,
            error: `降级执行也失败: ${degradeStepResults.find(s => !s.success)?.error}`,
          });
        }
      } else {
        // 没有步骤可降级，直接标记失败
        results.steps.push({
          phase: 'scenario',
          success: false,
          error: e.message || String(e),
        });
      }
    }

    // ★ 执行成功后，清理缓存中未使用的旧条目
    const scenarioSuccess = results.steps.every((s) => s.success);
    if (scenarioSuccess) {
      try {
        await (agent as any).flushCache?.({ cleanUnused: true });
        console.log(`[run-testcase] 缓存已清理无用条目`);
      } catch (flushErr: any) {
        console.warn(`[run-testcase] flushCache 警告: ${flushErr.message}`);
      }
    }

    const durationMs = Date.now() - startTime;

    // 8. Flush report to disk, then collect report data
    let reportData: any = null;
    let reportFilePath: string | undefined;
    try {
      // writeOutActionDumps() writes the HTML report file to midscene_run/report/
      (agent as any).writeOutActionDumps?.();
      reportFilePath = (agent as any).reportFile;
      if (reportFilePath) {
        console.log(`[run-testcase] Report written: ${reportFilePath}`);
      }
    } catch (e: any) {
      console.warn(`[run-testcase] Report write warning: ${e.message}`);
    }
    try {
      reportData = (agent as any)._unstableLogContent?.();
    } catch {
      // Report collection may fail in some versions
    }

    const reportDir = process.env.MIDSCENE_REPORT_DIR || './midscene_run/report';
    const allAssertionsPassed = results.assertions.length === 0 ||
      results.assertions.every((a) => a.success);
    const scenarioPassed = results.steps.every((s) => s.success);

    // 成功时生成 regressionYaml，用于自动保存回归基线
    let regressionYaml: string | undefined;
    const finalPassed = scenarioPassed && allAssertionsPassed;
    if (finalPassed && testcase.steps && testcase.steps.length > 0) {
      try {
        const inferredSteps = inferSteps(testcase.steps);
        // 只有推断出高质量步骤时才生成
        const hasQuality = !inferredSteps.every(s => s.type === 'aiAct' && (s.confidence ?? 0) < 0.3);
        if (hasQuality) {
          regressionYaml = generateMidsceneYaml({
            url: options.url || testcase.testData?.url || '',
            caseId: testcase.id || testcase.name || 'unknown',
            caseName: testcase.name || 'unnamed',
            steps: inferredSteps,
            assertions: testcase.expectedResults || [],
            cacheStrategy: 'read-only',
          });
        }
      } catch (yamlErr: any) {
        console.warn(`[run-testcase] 生成 regressionYaml 失败: ${yamlErr.message}`);
      }
    }

    const response = {
      status: finalPassed ? 'passed' : 'failed',
      testcaseName: testcase.name || 'unnamed',
      durationMs,
      results,
      regressionYaml,
      report: {
        type: 'midscene_html',
        dir: reportDir,
        filePath: reportFilePath,
        logContent: reportData,
      },
    };

    console.log(`[run-testcase] Done: ${response.status} in ${durationMs}ms`);
    console.log(`[run-testcase] Assertions: ${results.assertions.filter(a => a.success).length}/${results.assertions.length} passed`);

    res.json(response);

  } catch (e: any) {
    console.error(`[run-testcase] Fatal error:`, e);
    res.status(500).json({
      status: 'error',
      message: e.message || String(e),
    });
  } finally {
    if (session) {
      await closeBrowser(session);
    }
  }
});
