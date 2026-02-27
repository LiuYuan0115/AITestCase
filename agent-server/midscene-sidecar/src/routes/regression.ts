/**
 * 回归基线管理路由 — CRUD 操作
 *
 * 基线以 Midscene 原生 YAML 格式保存到 ./midscene_run/regression/ 目录。
 * 所有基线都在 index.json 中有元数据索引，方便前端快速列表和检索。
 *
 * 路由列表：
 *   GET    /regression/list       — 列出所有回归基线
 *   GET    /regression/:id        — 获取指定基线 YAML 内容
 *   POST   /regression/save       — 保存新基线（从执行结果自动保存或手动保存）
 *   PUT    /regression/:id        — 更新基线（用户编辑步骤后保存）
 *   DELETE /regression/:id        — 删除基线
 *   POST   /regression/:id/refresh — 刷新基线（用混合模式重新录制后覆盖）
 */

import { Router, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { generateMidsceneYaml, parseMidsceneYaml } from '../utils/yaml-generator.js';
import { buildReadableFileId, inferSteps } from '../utils/step-inference.js';
import type { InstantStep } from '../utils/step-inference.js';

// ===================== 文件锁（防止并发读写冲突） =====================

let indexFileLock: Promise<void> = Promise.resolve();

/**
 * 使用 Promise 链作为简易互斥锁
 * 所有对 index.json 的读写操作都通过此函数串行化
 */
async function withIndexLock<T>(fn: () => T | Promise<T>): Promise<T> {
  let resolve!: () => void;
  const next = new Promise<void>(r => { resolve = r; });
  const prev = indexFileLock;
  indexFileLock = next;
  try {
    await prev;
    return await fn();
  } finally {
    resolve();
  }
}

export const regressionRouter = Router();

// ===================== 基线存储目录 =====================

const REGRESSION_DIR = path.resolve(
  process.env.MIDSCENE_REGRESSION_DIR || './midscene_run/regression'
);
const INDEX_FILE = path.join(REGRESSION_DIR, 'index.json');

/** 基线索引条目 */
interface BaselineEntry {
  id: string;
  caseId: string;
  caseName: string;
  url: string;
  stepsCount: number;
  assertionsCount: number;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  lastRunStatus?: 'passed' | 'failed';
  lastRunDurationMs?: number;
}

// ===================== 工具函数 =====================

/** 确保目录和索引文件存在 */
function ensureDir(): void {
  if (!fs.existsSync(REGRESSION_DIR)) {
    fs.mkdirSync(REGRESSION_DIR, { recursive: true });
  }
  if (!fs.existsSync(INDEX_FILE)) {
    fs.writeFileSync(INDEX_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

/** 读取索引 */
function readIndex(): BaselineEntry[] {
  ensureDir();
  try {
    const content = fs.readFileSync(INDEX_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/** 写入索引 */
function writeIndex(entries: BaselineEntry[]): void {
  ensureDir();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

/**
 * 原子读写索引操作
 * 在 Promise 互斥锁保护下执行回调，确保并发安全
 */
async function atomicUpdateIndex(
  updater: (entries: BaselineEntry[]) => BaselineEntry[],
): Promise<BaselineEntry[]> {
  return withIndexLock(() => {
    const entries = readIndex();
    const updated = updater(entries);
    writeIndex(updated);
    return updated;
  });
}

/** 生成唯一 ID */
function generateId(): string {
  return `reg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// ===================== 路由实现 =====================

/**
 * GET /regression/list — 列出所有回归基线
 */
regressionRouter.get('/regression/list', (_req: Request, res: Response) => {
  try {
    const entries = readIndex();
    res.json({
      status: 'ok',
      total: entries.length,
      baselines: entries,
    });
  } catch (e: any) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

/**
 * GET /regression/:id — 获取指定基线的 YAML 内容 + 解析后的步骤
 */
regressionRouter.get('/regression/:id', (req: Request, res: Response) => {
  try {
    const entries = readIndex();
    const entry = entries.find(e => e.id === req.params.id);
    if (!entry) {
      res.status(404).json({ status: 'error', message: 'Baseline not found' });
      return;
    }

    const yamlPath = path.join(REGRESSION_DIR, entry.fileName);
    if (!fs.existsSync(yamlPath)) {
      res.status(404).json({ status: 'error', message: 'Baseline YAML file not found' });
      return;
    }

    const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
    const parsed = parseMidsceneYaml(yamlContent);

    res.json({
      status: 'ok',
      baseline: entry,
      yamlContent,
      parsed: {
        url: parsed.url,
        caseName: parsed.caseName,
        steps: parsed.steps,
        assertions: parsed.assertions,
      },
    });
  } catch (e: any) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

/**
 * POST /regression/save — 保存新基线
 *
 * 请求体可以是：
 *   1. 直接传 YAML 内容：{ yamlContent: string, caseId, caseName, url }
 *   2. 传步骤数组让后端生成：{ steps, assertions, caseId, caseName, url }
 */
regressionRouter.post('/regression/save', async (req: Request, res: Response) => {
  try {
    const {
      yamlContent,
      steps,
      assertions = [],
      caseId,
      caseName,
      url,
      cacheStrategy,
    } = req.body as {
      yamlContent?: string;
      steps?: InstantStep[];
      assertions?: string[];
      caseId?: string;
      caseName?: string;
      url?: string;
      cacheStrategy?: string;
    };

    // 也支持传原始步骤文本（自由模式成功后保存基线）
    const rawSteps = (req.body as any).rawSteps as string[] | undefined;

    if (!caseId || !caseName || !url) {
      res.status(400).json({
        status: 'error',
        message: 'caseId, caseName, and url are required',
      });
      return;
    }

    ensureDir();

    // 生成 YAML
    let finalYaml: string;
    let stepsCount = 0;
    let assertionsCount = 0;

    if (yamlContent) {
      finalYaml = yamlContent;
      const parsed = parseMidsceneYaml(yamlContent);
      stepsCount = parsed.steps.length;
      assertionsCount = parsed.assertions.length;
    } else if (steps && steps.length > 0) {
      finalYaml = generateMidsceneYaml({
        url,
        caseId,
        caseName,
        steps,
        assertions,
        cacheStrategy: cacheStrategy || 'read-only',
      });
      stepsCount = steps.length;
      assertionsCount = assertions.length;
    } else if (rawSteps && rawSteps.length > 0) {
      // 从原始步骤文本推断即时操作类型后生成 YAML
      const inferredSteps = inferSteps(rawSteps);
      // 质量检查：全是低置信度 aiAct 说明步骤是粗粒度场景描述，不适合做回归基线
      const allLowQuality = inferredSteps.every(s => s.type === 'aiAct' && (s.confidence ?? 0) < 0.3);
      if (allLowQuality) {
        res.status(400).json({
          status: 'error',
          message: 'Steps are too coarse-grained for regression baseline. Please provide detailed steps (e.g. "click X", "input Y").',
        });
        return;
      }
      finalYaml = generateMidsceneYaml({
        url,
        caseId,
        caseName,
        steps: inferredSteps,
        assertions,
        cacheStrategy: cacheStrategy || 'read-only',
      });
      stepsCount = inferredSteps.length;
      assertionsCount = assertions.length;
    } else {
      res.status(400).json({
        status: 'error',
        message: 'yamlContent or steps[] is required',
      });
      return;
    }

    // 生成文件名
    const readableId = buildReadableFileId(url, caseId, caseName);
    const fileName = `${readableId}.yaml`;
    const filePath = path.join(REGRESSION_DIR, fileName);

    // 写入 YAML 文件
    fs.writeFileSync(filePath, finalYaml, 'utf-8');

    // 原子化索引更新（带文件锁防止并发冲突）
    let newEntry!: BaselineEntry;
    let isUpdate = false;
    await atomicUpdateIndex((entries) => {
      const existingIdx = entries.findIndex(e => e.caseId === caseId);
      const id = existingIdx >= 0 ? entries[existingIdx].id : generateId();
      const now = new Date().toISOString();

      newEntry = {
        id,
        caseId,
        caseName,
        url,
        stepsCount,
        assertionsCount,
        fileName,
        createdAt: existingIdx >= 0 ? entries[existingIdx].createdAt : now,
        updatedAt: now,
      };

      if (existingIdx >= 0) {
        if (entries[existingIdx].fileName !== fileName) {
          const oldPath = path.join(REGRESSION_DIR, entries[existingIdx].fileName);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        entries[existingIdx] = newEntry;
        isUpdate = true;
      } else {
        entries.push(newEntry);
      }
      return entries;
    });

    console.log(`[regression] 基线已保存: ${fileName} (${stepsCount}步, ${assertionsCount}断言)`);

    res.json({
      status: 'ok',
      message: isUpdate ? '基线已更新' : '基线已保存',
      baseline: newEntry,
    });
  } catch (e: any) {
    console.error(`[regression] 保存基线失败:`, e);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

/**
 * PUT /regression/:id — 更新基线（用户编辑步骤后保存）
 */
regressionRouter.put('/regression/:id', (req: Request, res: Response) => {
  try {
    const entries = readIndex();
    const idx = entries.findIndex(e => e.id === req.params.id);
    if (idx < 0) {
      res.status(404).json({ status: 'error', message: 'Baseline not found' });
      return;
    }

    const { yamlContent, steps, assertions } = req.body as {
      yamlContent?: string;
      steps?: InstantStep[];
      assertions?: string[];
    };

    const entry = entries[idx];
    const filePath = path.join(REGRESSION_DIR, entry.fileName);

    let finalYaml: string;
    if (yamlContent) {
      finalYaml = yamlContent;
    } else if (steps) {
      finalYaml = generateMidsceneYaml({
        url: entry.url,
        caseId: entry.caseId,
        caseName: entry.caseName,
        steps,
        assertions: assertions || [],
        cacheStrategy: 'read-only',
      });
    } else {
      res.status(400).json({ status: 'error', message: 'yamlContent or steps[] is required' });
      return;
    }

    fs.writeFileSync(filePath, finalYaml, 'utf-8');

    // 更新索引
    const parsed = parseMidsceneYaml(finalYaml);
    entry.stepsCount = parsed.steps.length;
    entry.assertionsCount = parsed.assertions.length;
    entry.updatedAt = new Date().toISOString();
    writeIndex(entries);

    console.log(`[regression] 基线已更新: ${entry.fileName}`);
    res.json({ status: 'ok', message: '基线已更新', baseline: entry });
  } catch (e: any) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

/**
 * DELETE /regression/:id — 删除基线
 */
regressionRouter.delete('/regression/:id', (req: Request, res: Response) => {
  try {
    const entries = readIndex();
    const idx = entries.findIndex(e => e.id === req.params.id);
    if (idx < 0) {
      res.status(404).json({ status: 'error', message: 'Baseline not found' });
      return;
    }

    const entry = entries[idx];
    const filePath = path.join(REGRESSION_DIR, entry.fileName);

    // 删除 YAML 文件
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 从索引移除
    entries.splice(idx, 1);
    writeIndex(entries);

    console.log(`[regression] 基线已删除: ${entry.fileName}`);
    res.json({ status: 'ok', message: '基线已删除' });
  } catch (e: any) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

/**
 * POST /regression/:id/refresh — 刷新基线（原子操作）
 *
 * 后端自动完成完整流程：
 *   1. 读取现有基线的步骤
 *   2. 用共享执行引擎执行步骤和断言
 *   3. 成功则用新 YAML 覆盖基线，失败则保留旧基线
 *
 * 传 mode='parse-only' 只返回解析数据（兼容旧行为）。
 */
regressionRouter.post('/regression/:id/refresh', async (req: Request, res: Response) => {
  try {
    const { mode } = req.body || {};
    const entries = readIndex();
    const entry = entries.find(e => e.id === req.params.id);
    if (!entry) {
      res.status(404).json({ status: 'error', message: 'Baseline not found' });
      return;
    }

    const yamlPath = path.join(REGRESSION_DIR, entry.fileName);
    if (!fs.existsSync(yamlPath)) {
      res.status(404).json({ status: 'error', message: 'Baseline YAML file not found' });
      return;
    }

    const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
    const parsed = parseMidsceneYaml(yamlContent);

    // 兼容模式：只返回解析数据
    if (mode === 'parse-only') {
      res.json({
        status: 'ok',
        baseline: entry,
        parsed: { url: parsed.url, steps: parsed.steps, assertions: parsed.assertions },
      });
      return;
    }

    // 原子刷新：后端执行步骤 → 成功则覆盖基线
    const { launchBrowser, connectBrowser, closeBrowser } = await import('../browser/manager.js');
    const { PuppeteerAgent } = await import('@midscene/web/puppeteer');
    const { executeStepWithFallback, executeAssertionWithTripleStrategy } = await import('../utils/execution-engine.js');

    const opts = req.body?.options || {};
    let session: any;
    try {
      if (opts.useCDP) {
        session = await connectBrowser({ url: parsed.url, cdpEndpoint: opts.cdpEndpoint });
      } else {
        session = await launchBrowser({ url: parsed.url, headless: opts.headless ?? true });
      }

      const agent = new PuppeteerAgent(session.page, {
        generateReport: true,
        autoPrintReportMsg: false,
        cache: { strategy: 'read-write', id: entry.caseId },
      });

      const startTime = Date.now();
      let allStepsPassed = true;

      for (const step of parsed.steps) {
        const result = await executeStepWithFallback(agent, step, { cacheable: true });
        if (!result.success) { allStepsPassed = false; break; }
      }

      let assertionsPassed = true;
      if (allStepsPassed && parsed.assertions.length > 0) {
        for (const assertion of parsed.assertions) {
          const assertResult = await executeAssertionWithTripleStrategy(agent, assertion);
          if (!assertResult.success) { assertionsPassed = false; break; }
        }
      }

      const durationMs = Date.now() - startTime;
      const refreshStatus = allStepsPassed && assertionsPassed ? 'passed' : 'failed';

      // 成功 → 用新 YAML 覆盖基线
      if (refreshStatus === 'passed') {
        const newYaml = generateMidsceneYaml({
          url: parsed.url,
          caseId: entry.caseId,
          caseName: entry.caseName,
          steps: parsed.steps,
          assertions: parsed.assertions,
        });
        fs.writeFileSync(yamlPath, newYaml, 'utf-8');
      }

      // 更新索引状态
      await atomicUpdateIndex((entries) => {
        const e = entries.find(e => e.id === req.params.id);
        if (e) {
          e.lastRunAt = new Date().toISOString();
          e.lastRunStatus = refreshStatus;
          e.lastRunDurationMs = durationMs;
          if (refreshStatus === 'passed') e.updatedAt = new Date().toISOString();
        }
        return entries;
      });

      try { (agent as any).writeOutActionDumps?.(); } catch {}

      res.json({
        status: 'ok',
        refreshStatus,
        durationMs,
        message: refreshStatus === 'passed' ? '基线已刷新' : '执行失败，保留旧基线',
      });
    } finally {
      if (session) await closeBrowser(session);
    }
  } catch (e: any) {
    console.error(`[regression] 刷新基线失败:`, e);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

/**
 * POST /regression/:id/update-run-status — 更新基线的执行状态
 * （内部接口，由 run-yaml 执行后调用）
 */
regressionRouter.post('/regression/:id/update-run-status', async (req: Request, res: Response) => {
  try {
    const { status, durationMs } = req.body as { status: 'passed' | 'failed'; durationMs?: number };
    const targetId = req.params.id;

    await atomicUpdateIndex((entries) => {
      const entry = entries.find(e => e.id === targetId);
      if (entry) {
        entry.lastRunAt = new Date().toISOString();
        entry.lastRunStatus = status;
        entry.lastRunDurationMs = durationMs;
      }
      return entries;
    });

    res.json({ status: 'ok' });
  } catch (e: any) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});
