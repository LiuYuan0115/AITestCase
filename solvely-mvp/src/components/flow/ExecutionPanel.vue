<template>
  <div class="execution-panel" :class="{ expanded: isExpanded }">
    <div class="panel-header" @click="toggleExpand">
      <div class="header-left">
        <span class="status-icon">{{ getStatusIcon() }}</span>
        <span class="status-text">{{ getStatusText() }}</span>
        <span v-if="result" class="status-summary">
          {{ result.summary.passed }}/{{ result.summary.total }} 通过
        </span>
      </div>
      <div class="header-right">
        <div v-if="isExecuting" class="progress-bar">
          <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
        </div>
        <button class="btn-toggle">{{ isExpanded ? '▼' : '▲' }}</button>
        <button class="btn-close" @click.stop="$emit('close')">×</button>
      </div>
    </div>

    <div v-if="isExpanded" class="panel-body">
      <!-- 执行中状态 -->
      <div v-if="isExecuting" class="executing-state">
        <div class="spinner"></div>
        <span>正在执行测试流程...</span>
      </div>

      <!-- 执行结果 -->
      <div v-else-if="result" class="result-content">
        <!-- 摘要 -->
        <div class="result-summary">
          <div class="summary-item passed">
            <span class="num">{{ result.summary.passed }}</span>
            <span class="label">通过</span>
          </div>
          <div class="summary-item failed">
            <span class="num">{{ result.summary.failed }}</span>
            <span class="label">失败</span>
          </div>
          <div class="summary-item skipped">
            <span class="num">{{ result.summary.skipped }}</span>
            <span class="label">跳过</span>
          </div>
          <div class="summary-item duration">
            <span class="num">{{ formatDuration(result.duration || 0) }}</span>
            <span class="label">耗时</span>
          </div>
        </div>

        <!-- 步骤详情 -->
        <div class="step-results">
          <div 
            v-for="step in result.steps" 
            :key="step.stepId"
            class="step-result-item"
            :class="step.status"
          >
            <span class="step-icon">{{ getStepIcon(step.status) }}</span>
            <span class="step-name">{{ step.stepName }}</span>
            <span class="step-duration">{{ step.duration }}ms</span>
            <span v-if="step.error" class="step-error" :title="step.error">
              {{ truncateError(step.error) }}
            </span>
            <a 
              v-if="step.screenshotUrl" 
              :href="step.screenshotUrl" 
              target="_blank"
              class="step-screenshot"
            >
              📸
            </a>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="result-actions">
          <button class="btn-secondary" @click="exportReport">📄 导出报告</button>
          <button class="btn-primary" @click="$emit('retry')">🔄 重新执行</button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <p>暂无执行结果</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { FlowResult, StepStatus } from '@/types/flow';

// Props
const props = defineProps<{
  result: FlowResult | null;
  isExecuting: boolean;
  progress: number;
}>();

// Emits
defineEmits<{
  (e: 'close'): void;
  (e: 'retry'): void;
}>();

// 展开状态
const isExpanded = ref(true);

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
};

// 状态图标
const getStatusIcon = () => {
  if (props.isExecuting) return '⏳';
  if (!props.result) return '📋';
  
  switch (props.result.status) {
    case 'success': return '✅';
    case 'failed': return '❌';
    case 'partial': return '⚠️';
    default: return '📋';
  }
};

// 状态文本
const getStatusText = () => {
  if (props.isExecuting) return '执行中';
  if (!props.result) return '等待执行';
  
  switch (props.result.status) {
    case 'success': return '执行成功';
    case 'failed': return '执行失败';
    case 'partial': return '部分成功';
    default: return '未知状态';
  }
};

// 步骤图标
const getStepIcon = (status: StepStatus) => {
  const icons: Record<StepStatus, string> = {
    pending: '⏳',
    running: '🔄',
    passed: '✅',
    failed: '❌',
    skipped: '⏭️',
  };
  return icons[status] || '?';
};

// 格式化耗时
const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

// 截断错误信息
const truncateError = (error: string) => {
  return error.length > 40 ? error.slice(0, 40) + '...' : error;
};

// 导出报告
const exportReport = () => {
  if (!props.result) return;
  
  const report = `# 可视化测试报告

## 概要
- 状态: ${props.result.status}
- 开始时间: ${props.result.startTime}
- 结束时间: ${props.result.endTime || 'N/A'}
- 总耗时: ${props.result.duration || 0}ms
- 通过/失败/跳过: ${props.result.summary.passed}/${props.result.summary.failed}/${props.result.summary.skipped}

## 步骤详情

| 步骤 | 状态 | 耗时 | 错误 |
|------|------|------|------|
${props.result.steps.map(s => `| ${s.stepName} | ${s.status} | ${s.duration}ms | ${s.error || '-'} |`).join('\n')}
`;

  const blob = new Blob([report], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `test-report-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
};
</script>

<style scoped>
.execution-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 12px 12px 0 0;
  z-index: 100;
  transition: all 0.3s;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #e8e8e8;
  cursor: pointer;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-icon {
  font-size: 18px;
}

.status-text {
  font-weight: 600;
  color: #333;
}

.status-summary {
  font-size: 13px;
  color: #52c41a;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  width: 120px;
  height: 6px;
  background: #e8e8e8;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #1890ff;
  transition: width 0.3s;
}

.btn-toggle {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: #999;
}

.btn-close {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  color: #999;
}

.btn-close:hover {
  background: #f5f5f5;
  color: #333;
}

.panel-body {
  max-height: 300px;
  overflow-y: auto;
  padding: 16px 20px;
}

.executing-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: #666;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e8e8e8;
  border-top-color: #1890ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.result-summary {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.summary-item .num {
  font-size: 24px;
  font-weight: 600;
}

.summary-item .label {
  font-size: 12px;
  color: #999;
}

.summary-item.passed .num { color: #52c41a; }
.summary-item.failed .num { color: #ff4d4f; }
.summary-item.skipped .num { color: #faad14; }
.summary-item.duration .num { color: #1890ff; }

.step-results {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
}

.step-result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
}

.step-result-item:last-child {
  border-bottom: none;
}

.step-result-item.failed {
  background: #fff2f0;
}

.step-icon {
  font-size: 14px;
}

.step-name {
  flex: 1;
  color: #333;
}

.step-duration {
  color: #999;
  font-size: 12px;
}

.step-error {
  color: #ff4d4f;
  font-size: 12px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-screenshot {
  text-decoration: none;
  font-size: 14px;
}

.result-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.btn-secondary:hover {
  background: #f5f5f5;
}

.btn-primary {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: #1890ff;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}

.btn-primary:hover {
  background: #40a9ff;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>
