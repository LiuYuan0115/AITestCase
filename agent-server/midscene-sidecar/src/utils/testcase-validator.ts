/**
 * 用例执行前校验器
 *
 * 在执行前检查用例结构是否完整、步骤格式是否符合推断规则，
 * 返回警告和建议的最优执行模式。
 */

import { inferInstantStep, type InstantStep } from './step-inference.js';

export interface ValidationResult {
  /** 用例是否可执行 */
  isValid: boolean;
  /** 校验警告列表（不阻止执行，仅提示） */
  warnings: string[];
  /** 建议的最优执行模式 */
  suggestedMode: 'free' | 'mixed' | 'regression';
  /** 步骤推断质量评分 0-1 */
  stepQualityScore: number;
}

interface TestCaseInput {
  scenario?: string;
  steps?: string[];
  expectedResults?: string[];
  preconditions?: string;
  testData?: Record<string, string>;
  hasBaseline?: boolean;
}

/**
 * 校验用例结构和步骤质量
 */
export function validateTestCase(
  tc: TestCaseInput,
  mode: 'free' | 'mixed' | 'regression',
): ValidationResult {
  const warnings: string[] = [];
  let isValid = true;

  // 1. 基础结构检查
  if (!tc.scenario && (!tc.steps || tc.steps.length === 0)) {
    warnings.push('用例缺少 scenario 和 steps，无法执行');
    isValid = false;
  }

  // 2. 模式适配检查
  if (mode === 'mixed' && (!tc.steps || tc.steps.length === 0)) {
    warnings.push('混合模式需要 steps 字段，当前用例缺少步骤定义');
  }

  if (mode === 'regression' && !tc.hasBaseline) {
    warnings.push('回归模式需要预存基线，当前用例无基线（将降级为混合/自由模式）');
  }

  // 3. 步骤格式质量检查
  let stepQualityScore = 1.0;
  if (tc.steps && tc.steps.length > 0) {
    const inferred = tc.steps.map(s => inferInstantStep(s));
    const avgConfidence = inferred.reduce((sum, s) => sum + s.confidence, 0) / inferred.length;
    stepQualityScore = avgConfidence;

    // 检测低置信度步骤
    const lowConfSteps = inferred.filter(s => s.confidence < 0.5);
    if (lowConfSteps.length > 0) {
      warnings.push(
        `${lowConfSteps.length} 个步骤无法推断操作类型（将回退 aiAct）: ` +
        lowConfSteps.slice(0, 3).map(s => `"${s.original}"`).join(', ') +
        (lowConfSteps.length > 3 ? ` 等${lowConfSteps.length}个` : ''),
      );
    }

    // 检测步骤格式问题
    for (let i = 0; i < tc.steps.length; i++) {
      const step = tc.steps[i];
      // 步骤过长可能是场景描述而非单步操作
      if (step.length > 100) {
        warnings.push(`步骤 ${i + 1} 过长 (${step.length} 字符)，可能需要拆分`);
      }
      // 步骤包含多个动作
      if (/[，,].*?(?:然后|接着|再|并且)/.test(step)) {
        warnings.push(`步骤 ${i + 1} 包含多个动作，建议拆分为独立步骤`);
      }
    }
  }

  // 4. 断言检查
  if (!tc.expectedResults || tc.expectedResults.length === 0) {
    warnings.push('用例缺少预期结果（expectedResults），即使执行成功也无法验证正确性');
  }

  // 5. 推荐模式
  let suggestedMode: 'free' | 'mixed' | 'regression' = 'free';
  if (tc.hasBaseline) {
    suggestedMode = 'regression';
  } else if (tc.steps && tc.steps.length > 0 && stepQualityScore >= 0.5) {
    suggestedMode = 'mixed';
  }

  return { isValid, warnings, suggestedMode, stepQualityScore };
}

/**
 * 步骤格式标准化建议
 *
 * 用于 AI 生成用例时的 prompt 规范参考：
 *   - 点击操作: "点击[目标元素]"
 *   - 输入操作: "在[目标输入框]中输入[具体值]"
 *   - 滚动操作: "向[方向]滚动[目标区域]"
 *   - 按键操作: "按下[按键名]"
 *   - 断言操作: "验证:[预期状态]"
 *   - 等待操作: "等待[N]秒"
 *   - 导航操作: "跳转到[URL]"
 */
export const STEP_FORMAT_GUIDE = `
步骤格式规范（确保 step-inference 能正确推断）：
- 点击操作: "点击[目标元素]" 或 "click [target]"
- 输入操作: "在[目标输入框]中输入[具体值]" 或 "type [value] in [target]"
- 滚动操作: "向[方向]滚动[目标区域]" 或 "scroll [direction]"
- 按键操作: "按下[按键名]" 或 "press [key]"
- 悬停操作: "悬停在[目标元素]" 或 "hover on [target]"
- 断言操作: "验证:[预期状态]" 或 "assert: [expected]"
- 等待操作: "等待[N]秒" 或 "wait [N]s"
- 导航操作: "跳转到 [URL]" 或 "navigate to [URL]"

注意事项：
- 每步只包含一个操作，不要用逗号或"然后"连接多个操作
- 步骤描述要简洁，50字以内
- 输入值使用引号包裹以区分目标和值
`.trim();
