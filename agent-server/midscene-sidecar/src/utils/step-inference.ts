/**
 * 步骤意图推断引擎 — 将自然语言步骤文本推断为即时操作类型
 *
 * 纯正则规则匹配，零 AI 开销。
 * 用于混合模式：能推断的步骤 → 即时操作（aiTap/aiInput/...），无法推断 → 回退 aiAct。
 */

// ===================== 类型定义 =====================

/** 即时操作步骤类型 */
export type InstantActionType =
  | 'tap'        // 点击
  | 'doubleTap'  // 双击
  | 'rightClick' // 右键点击
  | 'hover'      // 悬停
  | 'input'      // 输入文本
  | 'keypress'   // 按键
  | 'scroll'     // 滚动
  | 'wait'       // 等待/延时
  | 'navigate'   // 页面跳转
  | 'assert'     // 内联断言（在步骤之间验证页面状态）
  | 'aiAct';     // 兜底：交给 AI 自由规划

/** 推断后的即时操作步骤 */
export interface InstantStep {
  /** 操作类型 */
  type: InstantActionType;
  /** 操作目标的自然语言描述（给 Midscene 视觉定位用） */
  target?: string;
  /** 输入值（input 类型）或按键名（keypress 类型） */
  value?: string;
  /** 滚动方向（scroll 类型） */
  direction?: 'up' | 'down' | 'left' | 'right';
  /** 原始步骤文本（用于 aiAct 回退、日志、YAML 注释） */
  original: string;
  /** 推断置信度 0-1（1=明确匹配, 0.5=模糊推断, 0=无法推断→aiAct） */
  confidence: number;
}

// ===================== 推断规则 =====================

/**
 * 推断单个步骤的即时操作类型
 *
 * 规则优先级（从高到低）：
 *   1. 输入类（最明确：有目标+值）
 *   2. 双击（关键词唯一）
 *   3. 右键（关键词唯一）
 *   4. 悬停（关键词唯一）
 *   5. 滚动（关键词唯一）
 *   6. 按键（关键词唯一）
 *   7. 点击（最宽泛，放最后）
 *   8. 兜底 → aiAct
 */
export function inferInstantStep(stepText: string): InstantStep {
  const text = stepText.trim();
  if (!text) {
    return { type: 'aiAct', original: stepText, confidence: 0 };
  }

  // ---------- 0. 内联断言 ----------
  // 匹配: "断言:xxx", "验证:xxx", "确认:xxx", "assert:xxx", "检查:xxx"
  // 也匹配: "断言 xxx", "验证xxx已显示", "确保xxx"
  const assertPattern = /^(?:断言|验证|确认|检查|确保|assert|verify|check)\s*[:：]?\s*(.+)/i;
  const assertMatch = text.match(assertPattern);
  if (assertMatch) {
    return {
      type: 'assert',
      target: assertMatch[1].trim(),
      original: stepText,
      confidence: 1.0,
    };
  }

  // ---------- 0.5 等待/延时 ----------
  // 匹配: "等待3秒", "延时2s", "wait 3s", "sleep 1000ms", "等待页面加载"
  const waitPattern = /^(?:等待|延时|延迟|wait|sleep|pause)\s*(\d+)?\s*(?:秒|s|ms|毫秒)?\s*$/i;
  const waitMatch = text.match(waitPattern);
  if (waitMatch) {
    const rawNum = waitMatch[1];
    let waitMs = 2000;
    if (rawNum) {
      if (/ms|毫秒/i.test(text)) {
        waitMs = parseInt(rawNum, 10);
      } else {
        waitMs = parseInt(rawNum, 10) * 1000;
      }
    }
    return {
      type: 'wait',
      value: String(waitMs),
      original: stepText,
      confidence: 1.0,
    };
  }

  // ---------- 0.6 页面导航 ----------
  // 匹配: "跳转到 https://...", "访问 http://...", "打开URL https://...", "navigate to ..."
  const navPattern = /^(?:跳转到|访问|打开(?:URL|页面|网址)?|导航到|navigate\s+to|go\s+to|open)\s+(https?:\/\/\S+)/i;
  const navMatch = text.match(navPattern);
  if (navMatch) {
    return {
      type: 'navigate',
      value: navMatch[1].trim(),
      original: stepText,
      confidence: 1.0,
    };
  }

  // ---------- 1. 输入类 ----------
  // 模式A1: "在X中/里/内输入Y" — 带方位词，精确分割（"在用户名输入框中输入tomsmith"）
  const inputPatternA1 = /(?:在|到)(.+?)(?:中|里|内)(?:输入|填写|填入|键入|录入|写入)\s*["""]?(.+?)["""]?\s*$/;
  const matchA1 = text.match(inputPatternA1);
  if (matchA1) {
    return {
      type: 'input',
      target: matchA1[1].trim(),
      value: matchA1[2].trim().replace(/^["'"'""]|["'"'""]$/g, ''),
      original: stepText,
      confidence: 0.95,
    };
  }
  // 模式A2: "在X框/栏/区/字段输入Y" — target 以容器名词结尾，贪婪匹配（"在搜索输入框输入hello"）
  const inputPatternA2 = /(?:在|到)(.+(?:框|栏|区|字段))(?:输入|填写|填入|键入|录入|写入)\s*["""]?(.+?)["""]?\s*$/;
  const matchA2 = text.match(inputPatternA2);
  if (matchA2) {
    return {
      type: 'input',
      target: matchA2[1].trim(),
      value: matchA2[2].trim().replace(/^["'"'""]|["'"'""]$/g, ''),
      original: stepText,
      confidence: 0.9,
    };
  }
  // 模式A3: "在X输入Y" — 无方位词、无容器名词，非贪婪兜底（"在表单输入abc"）
  const inputPatternA3 = /(?:在|到)(.+?)(?:输入|填写|填入|键入|录入|写入)\s*["""]?(.+?)["""]?\s*$/;
  const matchA3 = text.match(inputPatternA3);
  if (matchA3) {
    return {
      type: 'input',
      target: matchA3[1].trim(),
      value: matchA3[2].trim().replace(/^["'"'""]|["'"'""]$/g, ''),
      original: stepText,
      confidence: 0.85,
    };
  }

  // 模式B: "输入Y到X"、"填写Y到X"
  const inputPatternB = /(?:输入|填写|填入|键入)\s*["""]?(.+?)["""]?\s*(?:到|在|至)\s*(.+)/;
  const matchB = text.match(inputPatternB);
  if (matchB) {
    return {
      type: 'input',
      target: matchB[2].trim(),
      value: matchB[1].trim().replace(/^["'"'""]|["'"'""]$/g, ''),
      original: stepText,
      confidence: 0.9,
    };
  }

  // 模式C (English): "type/enter/input 'value' in/into X"
  const inputPatternC = /(?:type|enter|input|fill)\s+[""']?(.+?)[""']?\s+(?:in|into|to)\s+(.+)/i;
  const matchC = text.match(inputPatternC);
  if (matchC) {
    return {
      type: 'input',
      target: matchC[2].trim(),
      value: matchC[1].trim().replace(/^["'"'""]|["'"'""]$/g, ''),
      original: stepText,
      confidence: 0.9,
    };
  }

  // 模式D: "X输入框输入/填写Y" — 目标在前
  const inputPatternD = /(.+?)(?:输入框|文本框|搜索框|编辑框|字段)(?:中|里|内)?(?:输入|填写|填入|键入)\s*["""]?(.+?)["""]?\s*$/;
  const matchD = text.match(inputPatternD);
  if (matchD) {
    return {
      type: 'input',
      target: matchD[1].trim() + '输入框',
      value: matchD[2].trim().replace(/^["'"'""]|["'"'""]$/g, ''),
      original: stepText,
      confidence: 0.9,
    };
  }

  // 模式E: "输入X" — 无目标元素，仅有输入动词和值（用户省略了目标）
  // 匹配: "输入1+1=?", "输入Hello World", "填写admin", "键入测试内容"
  // Midscene 会自动定位当前页面的活跃/可见输入框
  const inputPatternE = /^(?:输入|填写|填入|键入|录入|写入)\s*["""]?(.+?)["""]?\s*$/;
  const matchE = text.match(inputPatternE);
  if (matchE && matchE[1].trim()) {
    const val = matchE[1].trim().replace(/^["'"'""]|["'"'""]$/g, '');
    // 排除 "输入框" 这类名词（不是输入动作）
    if (!/^(?:框|栏|区|字段|区域)$/.test(val)) {
      return {
        type: 'input',
        target: undefined,
        value: val,
        original: stepText,
        confidence: 0.7,
      };
    }
  }

  // 模式F (English): "type X", "enter X", "input X" — 无目标，仅有值
  const inputPatternF = /^(?:type|enter|input)\s+[""']?(.+?)[""']?\s*$/i;
  const matchF = text.match(inputPatternF);
  if (matchF && matchF[1].trim() && !/\b(?:in|into|to)\b/i.test(matchF[1])) {
    return {
      type: 'input',
      target: undefined,
      value: matchF[1].trim().replace(/^["'"'""]|["'"'""]$/g, ''),
      original: stepText,
      confidence: 0.7,
    };
  }

  // ---------- 2. 双击 ----------
  if (/双击|double[\s-]?click/i.test(text)) {
    const target = text
      .replace(/双击|double[\s-]?click/gi, '')
      .replace(/^[\s,，、]+|[\s,，、]+$/g, '')
      .trim();
    return { type: 'doubleTap', target: target || undefined, original: stepText, confidence: 0.95 };
  }

  // ---------- 3. 右键 ----------
  if (/右键点击|右键单击|右键|右击|right[\s-]?click/i.test(text)) {
    const target = text
      .replace(/右键点击|右键单击|右键|右击|right[\s-]?click/gi, '')
      .replace(/^[\s,，、]+|[\s,，、]+$/g, '')
      .trim();
    return { type: 'rightClick', target: target || undefined, original: stepText, confidence: 0.95 };
  }

  // ---------- 4. 悬停 ----------
  if (/悬停在?|hover\s*(on|over)?|鼠标移到|鼠标移动到|移动?到.+上|move\s+(?:mouse\s+)?(?:to|over)/i.test(text)) {
    const target = text
      .replace(/悬停在?|hover\s*(on|over)?|鼠标移到|鼠标移动到|移动?到|上$|move\s+(?:mouse\s+)?(?:to|over)/gi, '')
      .replace(/^[\s,，、]+|[\s,，、]+$/g, '')
      .trim();
    return { type: 'hover', target: target || undefined, original: stepText, confidence: 0.9 };
  }

  // ---------- 5. 滚动 ----------
  if (/滚动|scroll|向[上下左右]|翻页|下拉|上拉|滑动/i.test(text)) {
    let direction: 'up' | 'down' | 'left' | 'right' = 'down';
    if (/向上|上拉|scroll\s*up|向顶部/i.test(text)) direction = 'up';
    else if (/向左|scroll\s*left/i.test(text)) direction = 'left';
    else if (/向右|scroll\s*right/i.test(text)) direction = 'right';

    // 提取滚动目标（可能是页面、列表、某个区域）
    const target = text
      .replace(/向?[上下左右]?滚动|scroll\s*(up|down|left|right)?|翻页|下拉|上拉|滑动|到?底部|到?顶部/gi, '')
      .replace(/^[\s,，、]+|[\s,，、]+$/g, '')
      .trim();

    return {
      type: 'scroll',
      target: target || undefined,
      direction,
      original: stepText,
      confidence: 0.85,
    };
  }

  // ---------- 6. 按键 ----------
  if (/按下|按键|press|回车|enter|tab|escape|esc|delete|backspace|空格/i.test(text)) {
    // 尝试提取按键名
    let keyName = 'Enter'; // 默认回车
    const keyMap: Array<[RegExp, string]> = [
      [/回车|enter/i, 'Enter'],
      [/tab/i, 'Tab'],
      [/escape|esc/i, 'Escape'],
      [/delete|删除键/i, 'Delete'],
      [/backspace|退格/i, 'Backspace'],
      [/空格|space/i, 'Space'],
      [/上箭头|arrow\s*up/i, 'ArrowUp'],
      [/下箭头|arrow\s*down/i, 'ArrowDown'],
      [/左箭头|arrow\s*left/i, 'ArrowLeft'],
      [/右箭头|arrow\s*right/i, 'ArrowRight'],
    ];
    for (const [pattern, name] of keyMap) {
      if (pattern.test(text)) {
        keyName = name;
        break;
      }
    }

    // 尝试提取按键目标元素
    const target = text
      .replace(/按下|按键|press|回车|enter|tab|escape|esc|delete|backspace|空格|键/gi, '')
      .replace(/^[\s,，、在]+|[\s,，、上]+$/g, '')
      .trim();

    return {
      type: 'keypress',
      target: target || undefined,
      value: keyName,
      original: stepText,
      confidence: 0.85,
    };
  }

  // ---------- 7. 点击类（最宽泛，放在倒数第二） ----------
  if (/点击|单击|选择|勾选|打开|关闭|切换|选中|取消选中|展开|收起|click|tap|select|check|uncheck|toggle|open|close/i.test(text)) {
    const target = text
      .replace(/点击|单击|选择|勾选|打开|关闭|切换到?|选中|取消选中|展开|收起|click|tap|select|check|uncheck|toggle|open|close/gi, '')
      .replace(/^[\s,，、]+|[\s,，、]+$/g, '')
      .trim();
    return { type: 'tap', target: target || undefined, original: stepText, confidence: 0.85 };
  }

  // ---------- 8. 兜底：无法推断 → aiAct ----------
  return { type: 'aiAct', target: text, original: stepText, confidence: 0 };
}

/**
 * 批量推断步骤
 */
export function inferSteps(stepTexts: string[]): InstantStep[] {
  return stepTexts.map(text => inferInstantStep(text));
}

// ===================== 命名规范工具 =====================

/**
 * 生成可读的文件名 ID
 *
 * 所有模式下的缓存/基线/报告文件都使用此函数生成统一的文件名前缀，
 * 确保缓存 ↔ 基线 ↔ 报告可以通过 readableId 关联。
 *
 * @example
 *   buildReadableFileId('https://app.example.com/login', 'TC-001', '用户登录验证')
 *   → 'example.com_TC-001_用户登录验证'
 */
export function buildReadableFileId(url: string, caseId: string, caseName: string): string {
  // 1. 提取域名（去掉 www.）
  let domain = '';
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // URL 无效时跳过域名
  }

  // 2. 用例名安全处理：去掉文件名非法字符，截断到 20 字符
  const safeName = caseName
    .replace(/[/\\:*?"<>|\n\r\t]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 20)
    .replace(/_+$/, '')
    .trim();

  // 3. caseId 安全处理
  const safeId = caseId
    .replace(/[/\\:*?"<>|\n\r\t]/g, '_')
    .trim();

  // 4. 拼接：domain_caseId_caseName
  const parts = [domain, safeId, safeName].filter(Boolean);
  return parts.join('_') || 'unnamed';
}

/**
 * 生成带时间戳的文件名（用于报告等不可覆盖的文件）
 *
 * @example
 *   buildTimestampedFileName('example.com_TC-001_用户登录', '.html')
 *   → 'example.com_TC-001_用户登录_2026-02-11_16-20.html'
 */
export function buildTimestampedFileName(readableId: string, extension: string): string {
  const now = new Date();
  const ts = [
    now.getFullYear(),
    '-',
    String(now.getMonth() + 1).padStart(2, '0'),
    '-',
    String(now.getDate()).padStart(2, '0'),
    '_',
    String(now.getHours()).padStart(2, '0'),
    '-',
    String(now.getMinutes()).padStart(2, '0'),
  ].join('');
  return `${readableId}_${ts}${extension}`;
}
