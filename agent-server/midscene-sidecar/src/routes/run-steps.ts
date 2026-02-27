import { Router, type Request, type Response } from 'express';
import { PuppeteerAgent } from '@midscene/web/puppeteer';
import { launchBrowser, closeBrowser, type BrowserSession } from '../browser/manager.js';

export const runStepsRouter = Router();

interface Step {
  type: 'action' | 'assert' | 'wait' | 'screenshot' | 'extract' | 'query';
  instruction: string;
  schema?: string;
}

interface RunStepsOptions {
  headless?: boolean;
  cache?: { strategy: string; id: string };
  aiContext?: string;
  timeout?: number;
}

runStepsRouter.post('/run-steps', async (req: Request, res: Response) => {
  const { url, steps, options = {} } = req.body as {
    url: string;
    steps: Step[];
    options: RunStepsOptions;
  };

  if (!url || !steps || steps.length === 0) {
    res.status(400).json({ status: 'error', message: 'url and steps are required' });
    return;
  }

  let session: BrowserSession | null = null;

  try {
    session = await launchBrowser({
      url,
      headless: options.headless ?? true,
    });

    const agent = new PuppeteerAgent(session.page, {
      modelConfig: {
        MIDSCENE_MODEL_NAME: process.env.MIDSCENE_MODEL_NAME,
        MIDSCENE_MODEL_BASE_URL: process.env.MIDSCENE_MODEL_BASE_URL,
        MIDSCENE_MODEL_API_KEY: process.env.MIDSCENE_MODEL_API_KEY,
        MIDSCENE_MODEL_FAMILY: process.env.MIDSCENE_MODEL_FAMILY,
      },
      generateReport: true,
      autoPrintReportMsg: false,
      ...(options.cache ? { cache: options.cache } : {}),
    });

    if (options.aiContext) {
      (agent as any).aiActContext = options.aiContext;
    }

    const results: Array<{
      stepId: string;
      type: string;
      instruction: string;
      success: boolean;
      message?: string;
      data?: any;
      durationMs: number;
    }> = [];

    const startTime = Date.now();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepId = String(i + 1);
      const stepStart = Date.now();

      console.log(`[run-steps] Step ${stepId}: ${step.type} — ${step.instruction}`);

      try {
        let data: any;

        switch (step.type) {
          case 'action':
            await agent.aiAct(step.instruction);
            break;
          case 'assert':
            await agent.aiAssert(step.instruction);
            break;
          case 'wait':
            await agent.aiWaitFor(step.instruction);
            break;
          case 'extract':
          case 'query':
            data = await agent.aiQuery(step.schema || step.instruction);
            break;
          case 'screenshot':
            // Midscene captures screenshots automatically per step
            break;
          default:
            throw new Error(`Unknown step type: ${step.type}`);
        }

        results.push({
          stepId,
          type: step.type,
          instruction: step.instruction,
          success: true,
          message: `${step.type} completed`,
          data,
          durationMs: Date.now() - stepStart,
        });
        console.log(`[run-steps] Step ${stepId}: PASSED (${Date.now() - stepStart}ms)`);

      } catch (e: any) {
        results.push({
          stepId,
          type: step.type,
          instruction: step.instruction,
          success: false,
          message: e.message || String(e),
          durationMs: Date.now() - stepStart,
        });
        console.log(`[run-steps] Step ${stepId}: FAILED — ${e.message}`);
      }
    }

    const totalDuration = Date.now() - startTime;
    const passed = results.filter((r) => r.success).length;
    const failed = results.length - passed;

    let reportData: any = null;
    try {
      reportData = (agent as any)._unstableLogContent?.();
    } catch {
      // ignore
    }

    res.json({
      status: failed === 0 ? 'passed' : 'failed',
      totalSteps: results.length,
      passedSteps: passed,
      failedSteps: failed,
      durationMs: totalDuration,
      steps: results,
      report: {
        type: 'midscene_html',
        dir: process.env.MIDSCENE_REPORT_DIR || './midscene_run/report',
        logContent: reportData,
      },
    });

  } catch (e: any) {
    console.error(`[run-steps] Fatal error:`, e);
    res.status(500).json({ status: 'error', message: e.message || String(e) });
  } finally {
    if (session) {
      await closeBrowser(session);
    }
  }
});
