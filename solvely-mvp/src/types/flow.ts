/**
 * 无代码 UI 自动化 - 类型定义
 * 
 * 核心数据结构：
 * - FlowConfig: 流程配置
 * - TestStep: 测试步骤
 * - VariableDefinition: 变量定义
 * - FlowResult: 执行结果
 */

// ==================== 流程配置 ====================

/** 流程分类 */
export type FlowCategory = 'login' | 'solve' | 'payment' | 'custom';

/** 操作区域：page=网页, plugin=插件侧栏 */
export type TargetType = 'page' | 'plugin';

/** 操作类型 */
export type ActionType = 
  | 'navigate'   // 页面跳转
  | 'click'      // 点击元素
  | 'input'      // 输入文本
  | 'select'     // 下拉选择
  | 'wait'       // 等待
  | 'assert'     // 断言验证
  | 'screenshot' // 截图
  | 'scroll';    // 滚动

/** 选择器类型 */
export type SelectorType = 'css' | 'xpath' | 'text' | 'ai';

/** 错误处理方式 */
export type OnErrorAction = 'fail' | 'skip' | 'retry';

/** 变量类型 */
export type VariableType = 'string' | 'secret' | 'url' | 'number' | 'select';

/** 等待条件 */
export type WaitForCondition = 'visible' | 'hidden' | 'enabled' | 'disabled';

/** 滚动方向 */
export type ScrollDirection = 'up' | 'down';

// ==================== 变量定义 ====================

/** 变量定义 */
export interface VariableDefinition {
  /** 变量名（如: username） */
  name: string;
  /** 显示名称（如: 用户名） */
  label: string;
  /** 变量类型 */
  type: VariableType;
  /** 是否必填 */
  required: boolean;
  /** 默认值 */
  defaultValue?: string;
  /** type=select 时的选项 */
  options?: string[];
  /** 输入提示 */
  placeholder?: string;
}

// ==================== 选择器 ====================

/** 元素选择器 */
export interface ElementSelector {
  /** 选择器类型 */
  type: SelectorType;
  /** 选择器值（如: "登录按钮" 或 "#login-btn"） */
  value: string;
}

// ==================== 操作参数 ====================

/** 操作参数 */
export interface ActionParams {
  /** input 的输入值，支持变量 {{username}} */
  value?: string;
  /** 等待超时（毫秒） */
  timeout?: number;
  /** 等待条件 */
  waitFor?: WaitForCondition;
  /** scroll 方向 */
  direction?: ScrollDirection;
  /** scroll 距离（像素） */
  distance?: number;
}

// ==================== 测试步骤 ====================

/** 测试步骤 */
export interface TestStep {
  /** 步骤 ID */
  id: string;
  /** 步骤名称（如: 点击登录按钮） */
  name: string;
  /** 操作区域 */
  target: TargetType;
  /** 操作类型 */
  action: ActionType;
  /** 元素选择器 */
  selector?: ElementSelector;
  /** 操作参数 */
  params?: ActionParams;
  /** 错误处理方式 */
  onError: OnErrorAction;
  /** 是否启用 */
  enabled: boolean;
}

// ==================== 执行选项 ====================

/** 执行选项 */
export interface FlowOptions {
  /** 无头模式 */
  headless: boolean;
  /** 自动截图 */
  autoScreenshot: boolean;
  /** 失败自愈 */
  autoHeal: boolean;
  /** 最大重试次数 */
  maxRetries: number;
  /** 单步超时（毫秒） */
  stepTimeout: number;
  /** 流程超时（毫秒） */
  flowTimeout: number;
}

// ==================== 流程配置 ====================

/** 流程配置（完整） */
export interface FlowConfig {
  /** 流程唯一 ID */
  id: string;
  /** 流程名称 */
  name: string;
  /** 流程描述 */
  description?: string;
  /** 流程分类 */
  category: FlowCategory;
  /** 变量定义 */
  variables: VariableDefinition[];
  /** 测试步骤 */
  steps: TestStep[];
  /** 执行选项 */
  options: FlowOptions;
  /** 是否为预置模板 */
  isPreset?: boolean;
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
}

// ==================== 执行结果 ====================

/** 步骤执行状态 */
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/** 步骤执行结果 */
export interface StepResult {
  /** 步骤 ID */
  stepId: string;
  /** 步骤名称 */
  stepName: string;
  /** 执行状态 */
  status: StepStatus;
  /** 执行耗时（毫秒） */
  duration: number;
  /** 截图 URL */
  screenshotUrl?: string;
  /** 错误信息 */
  error?: string;
  /** 重试次数 */
  retryCount?: number;
}

/** 截图信息 */
export interface Screenshot {
  /** 文件名 */
  filename: string;
  /** 关联步骤 */
  stepId: string;
  /** 截图 URL */
  url: string;
  /** 时间戳 */
  timestamp: number;
}

/** 错误信息 */
export interface ErrorInfo {
  /** 错误步骤 ID */
  stepId: string;
  /** 错误类型 */
  type: string;
  /** 错误消息 */
  message: string;
  /** 堆栈信息 */
  stack?: string;
}

/** 流程执行状态 */
export type FlowStatus = 'pending' | 'running' | 'success' | 'failed' | 'partial';

/** 流程执行结果 */
export interface FlowResult {
  /** 流程 ID */
  flowId: string;
  /** 任务 ID */
  taskId: string;
  /** 执行状态 */
  status: FlowStatus;
  /** 开始时间 */
  startTime: string;
  /** 结束时间 */
  endTime?: string;
  /** 总耗时（毫秒） */
  duration?: number;
  /** 步骤结果列表 */
  steps: StepResult[];
  /** 执行摘要 */
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  /** 截图列表 */
  screenshots: Screenshot[];
  /** 错误列表 */
  errors: ErrorInfo[];
}

// ==================== API 请求/响应 ====================

/** 执行流程请求 */
export interface ExecuteFlowRequest {
  /** 流程配置 */
  flow: FlowConfig;
  /** 变量值 */
  variables: Record<string, string>;
  /** 执行选项覆盖 */
  options?: Partial<FlowOptions>;
}

/** 执行流程响应 */
export interface ExecuteFlowResponse {
  /** 状态 */
  status: 'success' | 'error';
  /** 任务 ID */
  taskId: string;
  /** 错误消息 */
  message?: string;
}

/** 模板列表响应 */
export interface TemplateListResponse {
  /** 状态 */
  status: 'success' | 'error';
  /** 模板列表 */
  templates: FlowConfig[];
}

/** 保存模板请求 */
export interface SaveTemplateRequest {
  /** 模板配置 */
  template: FlowConfig;
  /** 会话 ID */
  sessionId?: string;
}

/** 保存模板响应 */
export interface SaveTemplateResponse {
  /** 状态 */
  status: 'success' | 'error';
  /** 模板 ID */
  templateId: string;
  /** 错误消息 */
  message?: string;
}

// ==================== 默认值工厂 ====================

/** 创建默认执行选项 */
export function createDefaultOptions(): FlowOptions {
  return {
    headless: false,
    autoScreenshot: true,
    autoHeal: true,
    maxRetries: 2,
    stepTimeout: 10000,
    flowTimeout: 120000,
  };
}

/** 创建默认步骤 */
export function createDefaultStep(id: string): TestStep {
  return {
    id,
    name: '新步骤',
    target: 'page',
    action: 'click',
    selector: { type: 'ai', value: '' },
    params: {},
    onError: 'fail',
    enabled: true,
  };
}

/** 创建空流程配置 */
export function createEmptyFlow(): FlowConfig {
  return {
    id: `flow_${Date.now()}`,
    name: '新建流程',
    description: '',
    category: 'custom',
    variables: [],
    steps: [],
    options: createDefaultOptions(),
  };
}

/** 生成唯一步骤 ID */
export function generateStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
