/**
 * useWorkflow - 工作流管理 Composable
 * Week 8: QA 角色工作流状态管理
 */
import { ref, computed } from 'vue';

export type WorkflowStep =
  | 'setup'           // 初始设置
  | 'analyzing'       // 分析中
  | 'content_review'  // 内容审查
  | 'optimizing'      // 优化中
  | 'prd_review'      // PRD 审查
  | 'test_point'      // 测试点生成
  | 'test_case'       // 测试用例生成
  | 'auto_test'       // 自动化测试
  | 'completed';      // 完成

export interface WorkflowState {
  currentStep: WorkflowStep;
  isProcessing: boolean;
  progress: number;
  statusText: string;
  error?: string;
}

// 步骤配置
export const WORKFLOW_STEPS: Record<WorkflowStep, {
  label: string;
  description: string;
  order: number;
}> = {
  setup: { label: '设置', description: '初始化工作环境', order: 0 },
  analyzing: { label: '分析', description: '正在分析文档内容', order: 1 },
  content_review: { label: '内容审查', description: '审查提取的内容', order: 2 },
  optimizing: { label: '优化', description: '正在优化 PRD', order: 3 },
  prd_review: { label: 'PRD 审查', description: '审查优化后的 PRD', order: 4 },
  test_point: { label: '测试点', description: '生成测试点', order: 5 },
  test_case: { label: '测试用例', description: '生成测试用例', order: 6 },
  auto_test: { label: '自动化测试', description: '执行自动化测试', order: 7 },
  completed: { label: '完成', description: '工作流已完成', order: 8 }
};

// 单例状态
let _workflowState = ref<WorkflowState>({
  currentStep: 'setup',
  isProcessing: false,
  progress: 0,
  statusText: ''
});

/**
 * 工作流管理 Composable
 *
 * @example
 * ```ts
 * const { currentStep, isProcessing, goToStep, nextStep, prevStep } = useWorkflow();
 *
 * // 前进到下一步
 * nextStep();
 *
 * // 跳转到特定步骤
 * goToStep('test_case');
 * ```
 */
export function useWorkflow() {
  const currentStep = computed(() => _workflowState.value.currentStep);
  const isProcessing = computed(() => _workflowState.value.isProcessing);
  const progress = computed(() => _workflowState.value.progress);
  const statusText = computed(() => _workflowState.value.statusText);
  const error = computed(() => _workflowState.value.error);

  const currentStepInfo = computed(() =>
    WORKFLOW_STEPS[_workflowState.value.currentStep]
  );

  const currentStepOrder = computed(() =>
    WORKFLOW_STEPS[_workflowState.value.currentStep].order
  );

  const totalSteps = computed(() =>
    Object.keys(WORKFLOW_STEPS).length - 1 // 减去 'completed'
  );

  const progressPercent = computed(() =>
    Math.round((currentStepOrder.value / totalSteps.value) * 100)
  );

  /**
   * 跳转到指定步骤
   */
  function goToStep(step: WorkflowStep): void {
    _workflowState.value.currentStep = step;
    _workflowState.value.error = undefined;
    console.log('[useWorkflow] Step changed to:', step);
  }

  /**
   * 前进到下一步
   */
  function nextStep(): WorkflowStep | null {
    const steps = Object.keys(WORKFLOW_STEPS) as WorkflowStep[];
    const currentOrder = WORKFLOW_STEPS[_workflowState.value.currentStep].order;

    // 找到下一个步骤
    const nextStepEntry = steps.find(s =>
      WORKFLOW_STEPS[s].order === currentOrder + 1
    );

    if (nextStepEntry) {
      goToStep(nextStepEntry);
      return nextStepEntry;
    }

    return null;
  }

  /**
   * 返回上一步
   */
  function prevStep(): WorkflowStep | null {
    const steps = Object.keys(WORKFLOW_STEPS) as WorkflowStep[];
    const currentOrder = WORKFLOW_STEPS[_workflowState.value.currentStep].order;

    // 找到上一个步骤
    const prevStepEntry = steps.find(s =>
      WORKFLOW_STEPS[s].order === currentOrder - 1
    );

    if (prevStepEntry) {
      goToStep(prevStepEntry);
      return prevStepEntry;
    }

    return null;
  }

  /**
   * 设置处理状态
   */
  function setProcessing(processing: boolean, statusText?: string): void {
    _workflowState.value.isProcessing = processing;
    if (statusText !== undefined) {
      _workflowState.value.statusText = statusText;
    }
    if (!processing) {
      _workflowState.value.progress = 0;
    }
  }

  /**
   * 更新进度
   */
  function setProgress(progress: number, statusText?: string): void {
    _workflowState.value.progress = Math.max(0, Math.min(100, progress));
    if (statusText !== undefined) {
      _workflowState.value.statusText = statusText;
    }
  }

  /**
   * 设置错误
   */
  function setError(error: string): void {
    _workflowState.value.error = error;
    _workflowState.value.isProcessing = false;
  }

  /**
   * 清除错误
   */
  function clearError(): void {
    _workflowState.value.error = undefined;
  }

  /**
   * 重置工作流
   */
  function resetWorkflow(): void {
    _workflowState.value = {
      currentStep: 'setup',
      isProcessing: false,
      progress: 0,
      statusText: ''
    };
  }

  /**
   * 检查是否可以前进到某个步骤
   * 用于步骤导航的权限控制
   */
  function canGoToStep(step: WorkflowStep): boolean {
    // 简单规则：只能前进到当前步骤或之前的步骤
    // 或者已完成当前步骤后可以前进到下一步
    const targetOrder = WORKFLOW_STEPS[step].order;
    const currentOrder = WORKFLOW_STEPS[_workflowState.value.currentStep].order;

    // 可以回退到任何之前的步骤
    if (targetOrder <= currentOrder) {
      return true;
    }

    // 不能跳过步骤
    if (targetOrder > currentOrder + 1) {
      return false;
    }

    // 可以前进一步
    return true;
  }

  /**
   * 获取步骤列表（用于导航）
   */
  function getStepList(): Array<{
    step: WorkflowStep;
    label: string;
    order: number;
    isActive: boolean;
    isCompleted: boolean;
    canNavigate: boolean;
  }> {
    const steps = Object.entries(WORKFLOW_STEPS)
      .filter(([step]) => step !== 'setup' && step !== 'completed')
      .sort((a, b) => a[1].order - b[1].order)
      .map(([step, info]) => ({
        step: step as WorkflowStep,
        label: info.label,
        order: info.order,
        isActive: step === _workflowState.value.currentStep,
        isCompleted: info.order < currentStepOrder.value,
        canNavigate: canGoToStep(step as WorkflowStep)
      }));

    return steps;
  }

  return {
    // 状态
    currentStep,
    isProcessing,
    progress,
    statusText,
    error,
    currentStepInfo,
    currentStepOrder,
    totalSteps,
    progressPercent,

    // 方法
    goToStep,
    nextStep,
    prevStep,
    setProcessing,
    setProgress,
    setError,
    clearError,
    resetWorkflow,
    canGoToStep,
    getStepList
  };
}

export default useWorkflow;
