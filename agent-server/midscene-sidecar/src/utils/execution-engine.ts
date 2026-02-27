/**
 * 共享执行引擎 — 统一的步骤执行和断言策略
 *
 * 从 run-instant.ts / run-testcase.ts / run-testcase-stream.ts 中
 * 提取的公共逻辑，消除三层降级和断言执行的代码重复。
 *
 * 所有路由通过引用此模块实现统一行为，修 Bug 只需改一处。
 */

import type { PuppeteerAgent } from '@midscene/web/puppeteer';
import type { InstantStep, InstantActionType } from './step-inference.js';
import fs from 'fs';
import path from 'path';

// ===================== 类型定义 =====================

/** 单步执行结果 */
export interface StepExecutionResult {
  stepIndex: number;
  type: InstantActionType;
  target?: string;
  value?: string;
  original: string;
  success: boolean;
  /** 实际使用了哪层执行方法 */
  method: 'instant' | 'aiAct-single' | 'aiAct-deepThink';
  error?: string;
  /** AI 分析的失败建议（仅失败时） */
  suggestion?: string;
  durationMs: number;
}

/** 断言结果 */
export interface AssertionResult {
  expected: string;
  success: boolean;
  reason?: string;
}

// ===================== 即时操作执行 =====================

/**
 * 执行即时操作（调用 Midscene 原生即时 API）
 *
 * 将 InstantStep 映射为 Midscene 的 aiTap/aiInput/aiHover 等原生方法。
 * 不可推断的类型或 assert 类型将抛出异常，由调用方处理降级。
 */
export async function executeInstantAction(agent: PuppeteerAgent, step: InstantStep): Promise<void> {
  const agentAny = agent as any;

  switch (step.type) {
    case 'tap':
      await agentAny.aiTap(step.target || step.original);
      break;
    case 'doubleTap':
      if (typeof agentAny.aiDoubleTap === 'function') {
        await agentAny.aiDoubleTap(step.target || step.original);
      } else {
        await agentAny.aiAct(`双击 ${step.target || step.original}`);
      }
      break;
    case 'rightClick':
      if (typeof agentAny.aiRightClick === 'function') {
        await agentAny.aiRightClick(step.target || step.original);
      } else {
        await agentAny.aiAct(`右键点击 ${step.target || step.original}`);
      }
      break;
    case 'hover':
      await agentAny.aiHover(step.target || step.original);
      break;
    case 'input':
      // 无目标时用"当前可见的输入框"让 VLM 自动定位活跃输入区域
      await agentAny.aiInput(step.target || '当前可见的输入框', { value: step.value || '' });
      break;
    case 'keypress':
      await agentAny.aiKeyboardPress(step.value || 'Enter');
      break;
    case 'scroll':
      await agentAny.aiScroll(step.target || '页面', {
        direction: step.direction || 'down',
        scrollType: 'once',
      });
      break;
    case 'wait':
      // 等待指定时间（毫秒）
      const waitMs = parseInt(step.value || '2000', 10) || 2000;
      await new Promise(resolve => setTimeout(resolve, waitMs));
      break;
    case 'navigate':
      // 页面导航
      if (step.value) {
        const page = (agent as any).page;
        if (page) await page.goto(step.value, { waitUntil: 'networkidle0', timeout: 30000 });
      }
      break;
    case 'assert':
      throw new Error('assert 步骤不应通过 executeInstantAction 执行');
    case 'aiAct':
    default:
      await agent.aiAct(step.original);
      break;
  }
}

// ===================== 三层降级执行引擎 =====================

/**
 * 执行单个步骤（三层降级策略）
 *
 * 依次尝试：
 *   第 1 层：即时操作（高置信度步骤直接执行）
 *   第 2 层：aiAct 单步
 *   第 3 层：aiAct + deepThink
 *
 * @param agent - Midscene PuppeteerAgent 实例
 * @param step  - 要执行的步骤
 * @param options - 额外选项
 */
export async function executeStepWithFallback(
  agent: PuppeteerAgent,
  step: InstantStep,
  options: {
    cacheable?: boolean;
    deepThink?: boolean;
    /** 进度回调：在耗时操作前通知调用方（可用于 SSE 发送中间状态） */
    onProgress?: (phase: string, detail?: string) => void;
  } = {},
): Promise<Omit<StepExecutionResult, 'stepIndex'>> {
  const startTime = Date.now();

  const isAlreadyAiAct = step.type === 'aiAct';
  // 低置信度步骤（confidence < 0.85）跳过 instant 层，直接走 aiAct
  const skipInstant = isAlreadyAiAct || (step.confidence !== undefined && step.confidence < 0.85);

  // ============ 第 1 层：即时操作 ============
  if (!skipInstant) {
    try {
      await executeInstantAction(agent, step);
      return {
        type: step.type,
        target: step.target,
        value: step.value,
        original: step.original,
        success: true,
        method: 'instant',
        durationMs: Date.now() - startTime,
      };
    } catch (instantErr: any) {
      console.log(`[execution-engine] 第1层(即时)失败: ${step.original} → ${instantErr.message}`);
    }
  }

  // ============ 第 2 层：aiAct 单步 ============
  try {
    options.onProgress?.('aiAct', `AI 正在分析并执行: ${step.original}`);
    await agent.aiAct(step.original, { cacheable: options.cacheable ?? true });
    return {
      type: step.type,
      target: step.target,
      value: step.value,
      original: step.original,
      success: true,
      method: 'aiAct-single',
      durationMs: Date.now() - startTime,
    };
  } catch (singleErr: any) {
    console.log(`[execution-engine] 第2层(aiAct单步)失败: ${step.original} → ${singleErr.message}`);

    // 如果步骤本身已经是 aiAct 类型（场景描述），Layer 3 只是重复更慢的同样操作
    // 直接返回失败，避免浪费时间
    if (isAlreadyAiAct) {
      console.log(`[execution-engine] 步骤本身为 aiAct 类型，跳过 Layer 3 deepThink（避免重复调用）`);
      return {
        type: step.type,
        target: step.target,
        value: step.value,
        original: step.original,
        success: false,
        method: 'aiAct-single',
        error: singleErr.message || String(singleErr),
        suggestion: extractSuggestion(singleErr),
        durationMs: Date.now() - startTime,
      };
    }
  }

  // ============ 第 3 层：aiAct + deepThink（仅对非 aiAct 类型步骤） ============
  try {
    options.onProgress?.('deepThink', `步骤降级到深度思考模式: ${step.original}`);
    await agent.aiAct(step.original, { cacheable: options.cacheable ?? true, deepThink: true });
    return {
      type: step.type,
      target: step.target,
      value: step.value,
      original: step.original,
      success: true,
      method: 'aiAct-deepThink',
      durationMs: Date.now() - startTime,
    };
  } catch (deepErr: any) {
    console.log(`[execution-engine] 第3层(deepThink)失败: ${step.original} → ${deepErr.message}`);
    return {
      type: step.type,
      target: step.target,
      value: step.value,
      original: step.original,
      success: false,
      method: 'aiAct-deepThink',
      error: deepErr.message || String(deepErr),
      suggestion: extractSuggestion(deepErr),
      durationMs: Date.now() - startTime,
    };
  }
}

// ===================== 三层断言策略 =====================

/**
 * 三层断言策略: aiWaitFor → aiAssert → aiBoolean
 *
 * 所有路由共用同一断言引擎，确保行为一致。
 * 内置隐式等待（aiWaitFor 15s）和失败后重试逻辑。
 */
export async function executeAssertionWithTripleStrategy(
  agent: PuppeteerAgent,
  expected: string,
  options: { retryOnce?: boolean } = {},
): Promise<AssertionResult> {
  const result = await doAssert(agent, expected);

  // 断言失败时自动重试一次（处理页面加载慢导致的假失败）
  if (!result.success && options.retryOnce !== false) {
    console.log(`[execution-engine] 断言首次失败，等待 2s 后重试: ${expected}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    return doAssert(agent, expected);
  }

  return result;
}

async function doAssert(agent: PuppeteerAgent, expected: string): Promise<AssertionResult> {
  const assertStart = Date.now();
  const agentAny = agent as any;

  // 第 1 层: aiWaitFor — 自动轮询等待条件成立
  if (typeof agentAny.aiWaitFor === 'function') {
    try {
      await agentAny.aiWaitFor(expected, { timeoutMs: 15000 });
      console.log(`[execution-engine] 断言通过(aiWaitFor): ${expected}, ${Date.now() - assertStart}ms`);
      return { expected, success: true };
    } catch (waitErr: any) {
      console.log(`[execution-engine] aiWaitFor 超时: ${waitErr.message}`);
    }
  }

  // 第 2 层: aiAssert — 直接断言
  try {
    await agent.aiAssert(expected);
    console.log(`[execution-engine] 断言通过(aiAssert): ${expected}, ${Date.now() - assertStart}ms`);
    return { expected, success: true };
  } catch (assertErr: any) {
    const rawMsg = assertErr.message || String(assertErr);
    console.log(`[execution-engine] aiAssert 失败: ${rawMsg}`);
    if (!rawMsg.includes('undefined')) {
      return { expected, success: false, reason: rawMsg };
    }
  }

  // 第 3 层: aiBoolean — 布尔判断兜底
  if (typeof agentAny.aiBoolean === 'function') {
    try {
      const result = await agentAny.aiBoolean(expected);
      console.log(`[execution-engine] aiBoolean 返回: ${result}`);
      return {
        expected,
        success: !!result,
        reason: result ? undefined : `断言不成立: ${expected}`,
      };
    } catch (boolErr: any) {
      console.log(`[execution-engine] aiBoolean 异常: ${boolErr.message}`);
    }
  }

  return { expected, success: false, reason: `断言不成立: ${expected}` };
}

/**
 * 执行内联断言（在步骤之间验证页面状态）
 */
export async function executeInlineAssert(
  agent: PuppeteerAgent,
  assertText: string,
): Promise<{ success: boolean; reason?: string; durationMs: number }> {
  const start = Date.now();
  console.log(`[execution-engine] 内联断言: ${assertText}`);
  const result = await executeAssertionWithTripleStrategy(agent, assertText);
  return { ...result, durationMs: Date.now() - start };
}

// ===================== 工具函数 =====================

/**
 * 从错误信息中提取修改建议
 */
export function extractSuggestion(err: any): string {
  const msg = err?.message || String(err);
  if (/not found|找不到|cannot find|no element|未找到/i.test(msg)) {
    return '目标元素未找到，请检查目标描述是否准确，或页面是否已完成加载';
  }
  if (/timeout|超时/i.test(msg)) {
    return '操作超时，页面可能加载缓慢或元素尚未出现';
  }
  if (/multiple|多个|ambiguous/i.test(msg)) {
    return '匹配到多个元素，请使用更精确的目标描述';
  }
  return '操作失败，建议修改目标描述或切换为 aiAct 模式';
}

/**
 * 判断 scenario 是否应该禁用缓存（涉及动态内容）
 */
export function shouldDisableCache(scenario: string): boolean {
  const dynamicPatterns = [
    /验证码/i, /captcha/i,
    /随机/i, /random/i,
    /当前时间/i, /current.?time/i,
    /动态/i, /dynamic/i,
    /刷新/i, /refresh/i,
    /实时/i, /real.?time/i,
  ];
  return dynamicPatterns.some(p => p.test(scenario));
}

/**
 * 解析 smart 缓存策略
 *
 * smart 策略行为：
 *  - 有缓存文件 → read-only（跳过 AI 规划，直接复用）
 *  - 无缓存文件 → read-write（首次执行创建缓存）
 *  - 场景涉及动态内容 → false（禁用缓存）
 */
export function resolveSmartCacheStrategy(
  strategy: string,
  opts: { cacheId?: string; cacheDir?: string; scenario?: string },
): string {
  if (strategy !== 'smart') return strategy;

  // 动态内容直接禁用缓存
  if (opts.scenario && shouldDisableCache(opts.scenario)) {
    console.log(`[cache-smart] 检测到动态内容，禁用缓存`);
    return 'false';
  }

  // 检查缓存文件是否存在
  if (opts.cacheId) {
    const cacheDir = opts.cacheDir || process.env.MIDSCENE_CACHE_DIR || './midscene_run/cache';
    const cacheFile = path.resolve(cacheDir, `${opts.cacheId}.cache.yaml`);
    if (fs.existsSync(cacheFile)) {
      console.log(`[cache-smart] 发现缓存文件，使用 read-only: ${cacheFile}`);
      return 'read-only';
    }
  }

  console.log(`[cache-smart] 无缓存文件，使用 read-write`);
  return 'read-write';
}
