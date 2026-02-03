<template>
  <div class="task-progress-bar" :class="statusClass">
    <div class="progress-header">
      <div class="progress-info">
        <span class="progress-icon">{{ statusIcon }}</span>
        <span class="progress-label">{{ label || defaultLabel }}</span>
      </div>
      <div class="progress-actions">
        <span v-if="showPercent" class="progress-percent">{{ progress }}%</span>
        <button
          v-if="cancelable && isRunning"
          class="btn-cancel"
          @click="handleCancel"
          title="取消任务"
        >
          ×
        </button>
      </div>
    </div>

    <div class="progress-track">
      <div
        class="progress-fill"
        :style="{ width: progress + '%' }"
        :class="{ 'animated': isRunning }"
      ></div>
    </div>

    <div v-if="statusMessage" class="progress-message">
      {{ statusMessage }}
    </div>

    <div v-if="error" class="progress-error">
      {{ error }}
    </div>

    <div v-if="result && showResult" class="progress-result">
      <slot name="result" :result="result">
        <pre>{{ JSON.stringify(result, null, 2) }}</pre>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TaskStatus } from '@/composables/useTaskProgress';

const props = defineProps<{
  /** 任务状态 */
  status: TaskStatus;
  /** 进度 (0-100) */
  progress: number;
  /** 自定义标签 */
  label?: string;
  /** 状态消息 */
  statusMessage?: string;
  /** 错误信息 */
  error?: string;
  /** 任务结果 */
  result?: any;
  /** 是否可取消 */
  cancelable?: boolean;
  /** 是否显示百分比 */
  showPercent?: boolean;
  /** 是否显示结果 */
  showResult?: boolean;
}>();

const emit = defineEmits<{
  cancel: [];
}>();

const isRunning = computed(() =>
  props.status === 'pending' || props.status === 'running'
);

const isCompleted = computed(() => props.status === 'completed');
const isFailed = computed(() => props.status === 'failed');

const statusClass = computed(() => ({
  'is-pending': props.status === 'pending',
  'is-running': props.status === 'running',
  'is-completed': props.status === 'completed',
  'is-failed': props.status === 'failed',
  'is-cancelled': props.status === 'cancelled'
}));

const statusIcon = computed(() => {
  switch (props.status) {
    case 'pending': return '⏳';
    case 'running': return '⚡';
    case 'completed': return '✅';
    case 'failed': return '❌';
    case 'cancelled': return '🚫';
    default: return '📋';
  }
});

const defaultLabel = computed(() => {
  switch (props.status) {
    case 'pending': return '等待中...';
    case 'running': return '处理中...';
    case 'completed': return '已完成';
    case 'failed': return '失败';
    case 'cancelled': return '已取消';
    default: return '未知状态';
  }
});

const handleCancel = () => {
  emit('cancel');
};
</script>

<style scoped>
.task-progress-bar {
  background: white;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  transition: border-color 0.3s, background 0.3s;
}

.task-progress-bar.is-running {
  border-color: #5D6AB4;
  background: linear-gradient(135deg, #fafbff 0%, #f0f4ff 100%);
}

.task-progress-bar.is-completed {
  border-color: #16a34a;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
}

.task-progress-bar.is-failed {
  border-color: #dc2626;
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
}

.task-progress-bar.is-cancelled {
  border-color: #9ca3af;
  background: #f9fafb;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-icon {
  font-size: 16px;
}

.progress-label {
  font-size: 14px;
  font-weight: 500;
  color: #344054;
}

.progress-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-percent {
  font-size: 14px;
  font-weight: 600;
  color: #5D6AB4;
}

.is-completed .progress-percent {
  color: #16a34a;
}

.is-failed .progress-percent {
  color: #dc2626;
}

.btn-cancel {
  background: none;
  border: 1px solid #d0d5dd;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  color: #667085;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: #fee2e2;
  border-color: #dc2626;
  color: #dc2626;
}

.progress-track {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #5D6AB4 0%, #7c8adb 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-fill.animated {
  background: linear-gradient(90deg, #5D6AB4 0%, #7c8adb 50%, #5D6AB4 100%);
  background-size: 200% 100%;
  animation: shimmer 2s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.is-completed .progress-fill {
  background: linear-gradient(90deg, #16a34a 0%, #22c55e 100%);
}

.is-failed .progress-fill {
  background: linear-gradient(90deg, #dc2626 0%, #ef4444 100%);
}

.progress-message {
  margin-top: 8px;
  font-size: 12px;
  color: #667085;
}

.progress-error {
  margin-top: 8px;
  font-size: 12px;
  color: #dc2626;
  padding: 8px;
  background: rgba(220, 38, 38, 0.1);
  border-radius: 4px;
}

.progress-result {
  margin-top: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 12px;
  max-height: 200px;
  overflow: auto;
}

.progress-result pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
