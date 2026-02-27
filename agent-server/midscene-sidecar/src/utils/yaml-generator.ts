/**
 * YAML 生成器 — 将结构化步骤转为 Midscene 原生 YAML
 *
 * 用途：
 *   1. 混合模式执行成功后，自动生成回归基线 YAML
 *   2. 从已保存的回归基线 YAML 解析出步骤（供步骤编辑器使用）
 *   3. 在回归模式下，通过 agent.runYaml() 直接执行
 *
 * 生成的 YAML 格式严格遵循 Midscene 官方 YAML 规范：
 *   https://midscenejs.com/zh/automate-with-scripts-in-yaml
 */

import yaml from 'js-yaml';
import type { InstantStep, InstantActionType } from './step-inference.js';
import { buildReadableFileId } from './step-inference.js';

// ===================== 类型定义 =====================

/** 生成 YAML 的输入参数 */
export interface YamlGeneratorParams {
  /** 目标网页 URL */
  url: string;
  /** 用例 ID（如 TC-001） */
  caseId: string;
  /** 用例名称（如 "用户登录"） */
  caseName: string;
  /** 推断后的即时操作步骤列表 */
  steps: InstantStep[];
  /** 断言列表 */
  assertions: string[];
  /** 缓存策略，默认 read-only（回归推荐） */
  cacheStrategy?: string;
  /** AI 上下文信息（处理弹窗等） */
  aiContext?: string;
}

/** 解析 YAML 的输出结构 */
export interface ParsedMidsceneYaml {
  url: string;
  caseName: string;
  steps: InstantStep[];
  assertions: string[];
  cacheId?: string;
  cacheStrategy?: string;
  aiContext?: string;
}

// ===================== YAML 操作类型映射 =====================

/** 步骤注释模板 */
const ACTION_LABELS: Record<InstantActionType, string> = {
  tap: '点击',
  doubleTap: '双击',
  rightClick: '右键点击',
  hover: '悬停',
  input: '输入',
  keypress: '按键',
  scroll: '滚动',
  wait: '等待',
  navigate: '导航',
  assert: '内联断言',
  aiAct: '自由操作',
};

// ===================== 生成 YAML =====================

/**
 * 从 InstantStep[] 生成 Midscene 原生 YAML 字符串
 *
 * 生成的 YAML 格式完全符合 Midscene 的 tasks flow 规范，
 * 可直接通过 agent.runYaml() 执行。
 *
 * @example
 *   const yamlStr = generateMidsceneYaml({
 *     url: 'https://app.example.com/login',
 *     caseId: 'TC-001',
 *     caseName: '用户登录',
 *     steps: [
 *       { type: 'tap', target: '登录按钮', original: '点击登录按钮', confidence: 0.9 },
 *       { type: 'input', target: '用户名输入框', value: 'admin', original: '输入admin', confidence: 0.95 },
 *     ],
 *     assertions: ['页面显示欢迎信息'],
 *   });
 */
export function generateMidsceneYaml(params: YamlGeneratorParams): string {
  const {
    url,
    caseId,
    caseName,
    steps,
    assertions,
    cacheStrategy = 'read-only',
    aiContext,
  } = params;

  const readableId = buildReadableFileId(url, caseId, caseName);
  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').substring(0, 16);

  // 构建 flow 数组（Midscene tasks.flow 格式）
  const flowItems: any[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const label = ACTION_LABELS[step.type] || step.type;
    const comment = `步骤${i + 1}: ${label}${step.target ? ` - ${step.target}` : ''}`;

    switch (step.type) {
      case 'tap':
        flowItems.push({ _comment: comment, aiTap: step.target || step.original });
        break;
      case 'doubleTap':
        // Midscene YAML 没有 aiDoubleTap，用 aiAct 模拟
        flowItems.push({ _comment: comment, aiAct: `双击 ${step.target || step.original}` });
        break;
      case 'rightClick':
        // Midscene YAML 没有 aiRightClick，用 aiAct 模拟
        flowItems.push({ _comment: comment, aiAct: `右键点击 ${step.target || step.original}` });
        break;
      case 'hover':
        flowItems.push({ _comment: comment, aiHover: step.target || step.original });
        break;
      case 'input':
        flowItems.push({
          _comment: comment,
          aiInput: step.target || '输入框',
          value: step.value || '',
        });
        break;
      case 'keypress':
        flowItems.push({
          _comment: comment,
          aiKeyboardPress: step.target || '当前元素',
          keyName: step.value || 'Enter',
        });
        break;
      case 'scroll':
        flowItems.push({
          _comment: comment,
          aiScroll: step.target || '页面',
          direction: step.direction || 'down',
        });
        break;
      case 'wait':
        flowItems.push({ _comment: comment, sleep: parseInt(step.value || '2000', 10) });
        break;
      case 'navigate':
        flowItems.push({ _comment: comment, aiAct: `跳转到 ${step.value || step.original}` });
        break;
      case 'assert':
        flowItems.push({ _comment: comment, aiAssert: step.target || step.original });
        break;
      case 'aiAct':
      default:
        flowItems.push({ _comment: comment, aiAct: step.original });
        break;
    }
  }

  // 添加尾部断言（不在步骤内的独立断言）
  for (const assertion of assertions) {
    flowItems.push({ aiAssert: assertion });
  }

  // 将 _comment 字段转为实际的 YAML 注释
  // js-yaml 不支持注释，所以用后处理方式插入
  const flowForYaml = flowItems.map(item => {
    const { _comment, ...rest } = item;
    return rest;
  });

  // 构建完整的 YAML 结构
  const yamlObj: any = {
    web: { url },
    agent: {
      testId: readableId,
      cache: {
        strategy: cacheStrategy,
        id: readableId,
      },
    },
    tasks: [
      {
        name: `${caseId}: ${caseName}`,
        flow: flowForYaml,
      },
    ],
  };

  if (aiContext) {
    yamlObj.agent.aiActContext = aiContext;
  }

  // 生成 YAML 字符串
  let yamlStr = yaml.dump(yamlObj, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });

  // 基于 flow 数组索引插入注释，避免正则匹配 YAML 输出的脆弱性
  const yamlLines = yamlStr.split('\n');
  const resultLines: string[] = [];
  let insideFlow = false;
  let flowItemIdx = 0;

  for (const line of yamlLines) {
    if (/^\s+flow:\s*$/.test(line)) {
      insideFlow = true;
      resultLines.push(line);
      continue;
    }

    // 在 flow 块内，每遇到一个列表项（以 "- " 开头的行），插入对应注释
    if (insideFlow && /^\s+- \S/.test(line)) {
      if (flowItemIdx < flowItems.length) {
        const comment = flowItems[flowItemIdx]._comment;
        if (comment) {
          const indentMatch = line.match(/^(\s+)/);
          const indent = indentMatch ? indentMatch[1] : '      ';
          resultLines.push(`${indent}# ${comment}`);
        }
        flowItemIdx++;
      }
    }

    // 离开 flow 块：遇到与 flow 同级或更高级的键
    if (insideFlow && flowItemIdx > 0 && /^\s{0,4}\w/.test(line)) {
      insideFlow = false;
    }

    resultLines.push(line);
  }
  yamlStr = resultLines.join('\n');

  // 添加文件头部注释
  const header = [
    `# ==========================================`,
    `# 回归基线: ${caseId} ${caseName}`,
    `# 目标网站: ${url}`,
    `# 创建时间: ${dateStr}`,
    `# 文件ID: ${readableId}`,
    `# ==========================================`,
    ``,
  ].join('\n');

  return header + yamlStr;
}

// ===================== 解析 YAML =====================

/**
 * 从 Midscene 原生 YAML 解析出步骤（供步骤编辑器使用）
 *
 * 将 YAML 中的 flow 项反向解析为 InstantStep[]，
 * 让用户在步骤编辑器中查看和修改。
 */
export function parseMidsceneYaml(yamlContent: string): ParsedMidsceneYaml {
  // js-yaml 原生支持 YAML 注释（#），无需手动过滤
  // 之前的暴力过滤会误删包含 # 的合法 YAML 值
  const doc: any = yaml.load(yamlContent);
  if (!doc) {
    return { url: '', caseName: '', steps: [], assertions: [] };
  }

  const url = doc?.web?.url || '';
  const cacheId = doc?.agent?.cache?.id;
  const cacheStrategy = doc?.agent?.cache?.strategy;
  const aiContext = doc?.agent?.aiActContext;

  const steps: InstantStep[] = [];
  const assertions: string[] = [];
  let caseName = '';

  // 解析 tasks
  const tasks = doc?.tasks || [];
  for (const task of tasks) {
    caseName = caseName || task?.name || '';

    const flow = task?.flow || [];
    // 先收集所有 flow 项，区分内联断言和尾部断言
    let lastActionIdx = -1;
    for (let fi = flow.length - 1; fi >= 0; fi--) {
      if (!flow[fi].aiAssert) {
        lastActionIdx = fi;
        break;
      }
    }
    for (let fi = 0; fi < flow.length; fi++) {
      const item = flow[fi];
      if (item.aiAssert) {
        const assertStr = typeof item.aiAssert === 'string'
          ? item.aiAssert
          : item.aiAssert?.prompt || '';
        if (!assertStr) continue;

        if (fi <= lastActionIdx) {
          // 在操作步骤之间的 aiAssert → 内联断言步骤
          steps.push({
            type: 'assert',
            target: assertStr,
            original: `验证: ${assertStr}`,
            confidence: 1,
          });
        } else {
          // 在所有操作步骤之后的 aiAssert → 尾部断言
          assertions.push(assertStr);
        }
        continue;
      }

      const step = parseFlowItem(item);
      if (step) steps.push(step);
    }
  }

  return { url, caseName, steps, assertions, cacheId, cacheStrategy, aiContext };
}

/**
 * 将单个 YAML flow 项解析为 InstantStep
 */
function parseFlowItem(item: any): InstantStep | null {
  if (item.aiTap) {
    const target = typeof item.aiTap === 'string' ? item.aiTap : item.aiTap?.prompt || '';
    return { type: 'tap', target, original: `点击 ${target}`, confidence: 1 };
  }
  if (item.aiHover) {
    const target = typeof item.aiHover === 'string' ? item.aiHover : item.aiHover?.prompt || '';
    return { type: 'hover', target, original: `悬停 ${target}`, confidence: 1 };
  }
  if (item.aiInput != null) {
    const target = typeof item.aiInput === 'string' ? item.aiInput : item.aiInput?.prompt || '';
    const value = item.value || '';
    return { type: 'input', target, value, original: `在 ${target} 输入 ${value}`, confidence: 1 };
  }
  if (item.aiKeyboardPress) {
    const target = typeof item.aiKeyboardPress === 'string'
      ? item.aiKeyboardPress
      : item.aiKeyboardPress?.prompt || '';
    const keyName = item.keyName || 'Enter';
    return { type: 'keypress', target, value: keyName, original: `按下 ${keyName}`, confidence: 1 };
  }
  if (item.aiScroll != null) {
    const target = typeof item.aiScroll === 'string' ? item.aiScroll : item.aiScroll?.prompt || '';
    const direction = item.direction || 'down';
    return { type: 'scroll', target, direction, original: `滚动 ${target}`, confidence: 1 };
  }
  if (item.sleep != null) {
    const ms = typeof item.sleep === 'number' ? item.sleep : parseInt(item.sleep, 10) || 2000;
    return { type: 'wait', value: String(ms), original: `等待 ${ms}ms`, confidence: 1 };
  }
  if (item.aiAct || item.ai) {
    const instruction = item.aiAct || item.ai || '';
    // 检测是否为导航操作
    const navMatch = instruction.match(/^跳转到\s+(https?:\/\/\S+)/i);
    if (navMatch) {
      return { type: 'navigate', value: navMatch[1], original: instruction, confidence: 1 };
    }
    return { type: 'aiAct', original: instruction, confidence: 0 };
  }

  return null;
}

// ===================== 辅助函数 =====================

/**
 * 将 InstantStep[] 转为前端可展示的摘要文本
 */
export function stepsToSummary(steps: InstantStep[]): string {
  return steps.map((s, i) => {
    const label = ACTION_LABELS[s.type] || s.type;
    const detail = s.type === 'input'
      ? `${s.target} = "${s.value}"`
      : s.target || s.original;
    return `${i + 1}. ${label}: ${detail}`;
  }).join('\n');
}
