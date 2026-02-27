/**
 * 回归模式执行路由 — 使用 Midscene 原生 runYaml() 执行 YAML
 *
 * 回归模式的核心：
 *   1. 从基线文件或请求体获取 Midscene 原生 YAML
 *   2. 解析 web.url 启动浏览器
 *   3. 解析 agent 配置（cache、aiContext 等）
 *   4. 调用 agent.runYaml(tasks) 执行 tasks 部分
 *   5. 更新回归基线的执行状态
 *
 * 注意：runYaml() 只解析 tasks 字段，web 和 agent 字段需在 JS 层处理。
 */

import { Router, type Request, type Response } from 'express';
import { PuppeteerAgent } from '@midscene/web/puppeteer';
import { launchBrowser, connectBrowser, closeBrowser, type BrowserSession } from '../browser/manager.js';
import { parseMidsceneYaml } from '../utils/yaml-generator.js';
import { resolveSmartCacheStrategy } from '../utils/execution-engine.js';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

export const runYamlRouter = Router();

// ===================== 类型定义 =====================

interface RunYamlRequest {
  /** Midscene 原生 YAML 内容（和 regressionId 二选一） */
  yamlContent?: string;
  /** 回归基线 ID（从文件读取 YAML） */
  regressionId?: string;
  options: {
    useCDP?: boolean;
    cdpEndpoint?: string;
    headless?: boolean;
    /** 覆盖 YAML 中的缓存策略 */
    cacheStrategy?: string;
  };
}

// ===================== 路由实现 =====================

runYamlRouter.post('/run-yaml', async (req: Request, res: Response) => {
  const { yamlContent, regressionId, options = {} as RunYamlRequest['options'] } = req.body as RunYamlRequest;

  // 1. 获取 YAML 内容
  let finalYaml = '';

  if (yamlContent) {
    finalYaml = yamlContent;
  } else if (regressionId) {
    // 从回归基线文件读取
    const regressionDir = path.resolve(
      process.env.MIDSCENE_REGRESSION_DIR || './midscene_run/regression'
    );
    const indexPath = path.join(regressionDir, 'index.json');

    if (!fs.existsSync(indexPath)) {
      res.status(404).json({ status: 'error', message: 'Regression index not found' });
      return;
    }

    const entries = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const entry = entries.find((e: any) => e.id === regressionId);
    if (!entry) {
      res.status(404).json({ status: 'error', message: `Baseline ${regressionId} not found` });
      return;
    }

    const yamlPath = path.join(regressionDir, entry.fileName);
    if (!fs.existsSync(yamlPath)) {
      res.status(404).json({ status: 'error', message: 'Baseline YAML file not found' });
      return;
    }
    finalYaml = fs.readFileSync(yamlPath, 'utf-8');
  } else {
    res.status(400).json({ status: 'error', message: 'yamlContent or regressionId is required' });
    return;
  }

  // 2. 解析 YAML 中的 web.url 和 agent 配置
  let yamlDoc: any;
  try {
    // js-yaml 原生支持 YAML 注释，无需手动过滤
    yamlDoc = yaml.load(finalYaml);
  } catch (parseErr: any) {
    res.status(400).json({ status: 'error', message: `YAML parse error: ${parseErr.message}` });
    return;
  }

  const url = yamlDoc?.web?.url;
  if (!url) {
    res.status(400).json({ status: 'error', message: 'YAML must contain web.url field' });
    return;
  }

  let session: BrowserSession | null = null;

  try {
    // 3. 连接或启动浏览器
    console.log(`[run-yaml] 开始回归模式执行: ${url}`);
    if (options.useCDP) {
      session = await connectBrowser({ url, cdpEndpoint: options.cdpEndpoint });
    } else {
      session = await launchBrowser({ url, headless: options.headless ?? true });
    }

    // 4. 创建 Agent，应用 YAML 中的 agent 配置
    const agentYamlConfig = yamlDoc?.agent || {};
    const agentConfig: Record<string, any> = {
      generateReport: true,
      autoPrintReportMsg: false,
    };

    // 缓存配置：优先使用请求参数覆盖，否则用 YAML 中的配置
    const rawCacheStrategy = options.cacheStrategy || agentYamlConfig?.cache?.strategy || 'read-only';
    const cacheId = agentYamlConfig?.cache?.id || agentYamlConfig?.testId || 'regression';
    const cacheStrategy = resolveSmartCacheStrategy(rawCacheStrategy, { cacheId });

    if (cacheStrategy !== 'false') {
      agentConfig.cache = {
        strategy: cacheStrategy,
        id: cacheId,
      };
    }
    console.log(`[run-yaml] 缓存策略: ${rawCacheStrategy} → ${cacheStrategy}, ID: ${cacheId}`);

    if (agentYamlConfig?.aiActContext) {
      agentConfig.aiActContext = agentYamlConfig.aiActContext;
    }

    const agent = new PuppeteerAgent(session.page, agentConfig);
    const startTime = Date.now();

    // 5. 提取 tasks 部分（runYaml 只解析 tasks）
    //    构造只包含 tasks 的 YAML 给 runYaml
    const tasksOnlyYaml = yaml.dump({ tasks: yamlDoc.tasks }, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });

    console.log(`[run-yaml] 执行 tasks (${yamlDoc.tasks?.length || 0} 个任务)...`);

    // 6. 调用 runYaml
    let runResult: any;
    try {
      runResult = await (agent as any).runYaml(tasksOnlyYaml);
      console.log(`[run-yaml] runYaml 执行完成`);
    } catch (runErr: any) {
      console.error(`[run-yaml] runYaml 执行失败:`, runErr.message);
      throw runErr;
    }

    // 7. 生成报告
    try {
      (agent as any).writeOutActionDumps?.();
    } catch {}

    const durationMs = Date.now() - startTime;

    // 8. 从 runResult 中判断真实执行状态
    const hasErrors = runResult?.errors?.length > 0
      || runResult?.error
      || (Array.isArray(runResult?.tasks) && runResult.tasks.some((t: any) =>
          t.status === 'failed' || t.error || (Array.isArray(t.flow) && t.flow.some((f: any) => f.error))
        ));
    const actualStatus: 'passed' | 'failed' = hasErrors ? 'failed' : 'passed';
    console.log(`[run-yaml] 执行结果: ${actualStatus}, 耗时: ${durationMs}ms`);

    // 9. 更新回归基线的执行状态
    if (regressionId) {
      try {
        const regressionDir = path.resolve(
          process.env.MIDSCENE_REGRESSION_DIR || './midscene_run/regression'
        );
        const indexPath = path.join(regressionDir, 'index.json');
        const entries = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        const entry = entries.find((e: any) => e.id === regressionId);
        if (entry) {
          entry.lastRunAt = new Date().toISOString();
          entry.lastRunStatus = actualStatus;
          entry.lastRunDurationMs = durationMs;
          fs.writeFileSync(indexPath, JSON.stringify(entries, null, 2), 'utf-8');
          console.log(`[run-yaml] 已更新基线执行状态: ${actualStatus}`);
        }
      } catch (idxErr: any) {
        console.warn(`[run-yaml] 更新基线状态失败: ${idxErr.message}`);
      }
    }

    const parsed = parseMidsceneYaml(finalYaml);
    res.json({
      status: actualStatus,
      durationMs,
      regressionId: regressionId || undefined,
      stepsCount: parsed.steps.length,
      assertionsCount: parsed.assertions.length,
      result: runResult || {},
    });

  } catch (e: any) {
    console.error(`[run-yaml] 致命错误:`, e);

    // 更新失败状态
    if (regressionId) {
      try {
        const regressionDir = path.resolve(
          process.env.MIDSCENE_REGRESSION_DIR || './midscene_run/regression'
        );
        const indexPath = path.join(regressionDir, 'index.json');
        const entries = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        const entry = entries.find((e: any) => e.id === regressionId);
        if (entry) {
          entry.lastRunAt = new Date().toISOString();
          entry.lastRunStatus = 'failed';
          fs.writeFileSync(indexPath, JSON.stringify(entries, null, 2), 'utf-8');
        }
      } catch {}
    }

    res.status(500).json({
      status: 'failed',
      message: e.message || String(e),
      regressionId: regressionId || undefined,
    });
  } finally {
    if (session) {
      await closeBrowser(session);
    }
  }
});
