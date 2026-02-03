<template>
  <div class="workflow-progress" v-if="currentRole === 'qa'">
    <div class="workflow-header">
      <span class="workflow-title">QA 测试工作流</span>
      <span class="workflow-current-step">{{ currentStepLabel }}</span>
    </div>

    <div class="workflow-steps">
      <div
        v-for="(step, index) in steps"
        :key="step.id"
        class="workflow-step"
        :class="{
          'completed': index < currentStep,
          'active': index === currentStep,
          'pending': index > currentStep
        }"
        @click="handleStepClick(index)"
      >
        <div class="step-indicator">
          <span v-if="index < currentStep" class="step-check">✓</span>
          <span v-else-if="index === currentStep && isProcessing" class="step-loading">●</span>
          <span v-else class="step-number">{{ index + 1 }}</span>
        </div>
        <div class="step-label">{{ step.label }}</div>
        <div v-if="index < steps.length - 1" class="step-connector" :class="{ 'completed': index < currentStep }"></div>
      </div>
    </div>

    <div v-if="isProcessing && taskProgress > 0" class="workflow-task-progress">
      <div class="task-progress-label">{{ taskLabel }}</div>
      <div class="task-progress-bar">
        <div class="task-progress-fill" :style="{ width: taskProgress + '%' }"></div>
      </div>
      <div class="task-progress-percent">{{ taskProgress }}%</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRole } from '@/composables/useRole';
import { useWorkflow, WORKFLOW_STEPS } from '@/composables/useWorkflow';

const props = defineProps<{
  /** 任务进度 (0-100) */
  taskProgress?: number;
  /** 当前任务标签 */
  taskLabel?: string;
  /** 是否正在处理 */
  isProcessing?: boolean;
}>();

const emit = defineEmits<{
  stepClick: [stepIndex: number];
}>();

const { currentRole } = useRole();
const { currentStep, currentStepId, canGoToStep, goToStep } = useWorkflow();

const steps = computed(() => WORKFLOW_STEPS);

const currentStepLabel = computed(() => {
  const step = WORKFLOW_STEPS[currentStep.value];
  return step ? `步骤 ${currentStep.value + 1} - ${step.label}` : '';
});

const handleStepClick = (index: number) => {
  if (canGoToStep(index)) {
    emit('stepClick', index);
    goToStep(index);
  }
};
</script>

<style scoped>
.workflow-progress {
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
  border-radius: 8px;
  padding: 16px;
  margin: 8px 0;
  border: 1px solid #e3e8f0;
}

.workflow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.workflow-title {
  font-weight: 600;
  font-size: 14px;
  color: #4a5568;
}

.workflow-current-step {
  font-size: 12px;
  color: #5D6AB4;
  background: rgba(93, 106, 180, 0.1);
  padding: 4px 8px;
  border-radius: 12px;
}

.workflow-steps {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
}

.workflow-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  position: relative;
  cursor: pointer;
  transition: opacity 0.2s;
}

.workflow-step.pending {
  opacity: 0.5;
  cursor: not-allowed;
}

.workflow-step.pending:hover {
  opacity: 0.6;
}

.workflow-step.completed:hover,
.workflow-step.active:hover {
  opacity: 0.8;
}

.step-indicator {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  transition: all 0.3s ease;
}

.workflow-step.completed .step-indicator {
  background: #48bb78;
  color: white;
}

.workflow-step.active .step-indicator {
  background: #5D6AB4;
  color: white;
  box-shadow: 0 0 0 4px rgba(93, 106, 180, 0.2);
}

.workflow-step.pending .step-indicator {
  background: #e2e8f0;
  color: #a0aec0;
}

.step-check {
  font-size: 16px;
}

.step-loading {
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.step-number {
  font-size: 12px;
}

.step-label {
  font-size: 11px;
  color: #4a5568;
  text-align: center;
  max-width: 60px;
  line-height: 1.3;
}

.workflow-step.active .step-label {
  color: #5D6AB4;
  font-weight: 600;
}

.step-connector {
  position: absolute;
  top: 16px;
  left: calc(50% + 20px);
  width: calc(100% - 40px);
  height: 2px;
  background: #e2e8f0;
}

.step-connector.completed {
  background: #48bb78;
}

.workflow-step:last-child .step-connector {
  display: none;
}

.workflow-task-progress {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #e3e8f0;
}

.task-progress-label {
  font-size: 12px;
  color: #4a5568;
  margin-bottom: 8px;
}

.task-progress-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.task-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #5D6AB4 0%, #7c8adb 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.task-progress-percent {
  font-size: 11px;
  color: #5D6AB4;
  text-align: right;
  font-weight: 600;
}
</style>
