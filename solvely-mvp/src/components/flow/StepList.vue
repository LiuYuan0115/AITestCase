<template>
  <div class="step-list">
    <div v-if="steps.length === 0" class="empty-hint">
      暂无步骤，点击"添加步骤"开始配置
    </div>

    <div class="steps-container">
      <div
        v-for="(step, index) in steps"
        :key="step.id"
        class="step-item"
        :class="{ disabled: !step.enabled }"
        draggable="true"
        @dragstart="handleDragStart($event, index)"
        @dragover="handleDragOver($event, index)"
        @drop="handleDrop($event, index)"
        @dragend="handleDragEnd"
      >
        <div class="step-drag-handle" title="拖动排序">⋮⋮</div>
        
        <div class="step-index">{{ index + 1 }}</div>
        
        <div class="step-target" :class="step.target">
          {{ step.target === 'page' ? '🌐' : '🔌' }}
        </div>
        
        <div class="step-content">
          <div class="step-action">
            <span class="action-badge">{{ getActionLabel(step.action) }}</span>
            <span class="step-name">{{ step.name }}</span>
          </div>
          <div class="step-selector" v-if="step.selector">
            {{ getSelectorPreview(step.selector) }}
          </div>
        </div>
        
        <div class="step-actions">
          <button 
            class="btn-step" 
            @click.stop="toggleEnabled(index)"
            :title="step.enabled ? '禁用步骤' : '启用步骤'"
          >
            {{ step.enabled ? '✓' : '○' }}
          </button>
          <button class="btn-step" @click.stop="$emit('edit', step)" title="编辑">
            ✏️
          </button>
          <button class="btn-step btn-delete" @click.stop="$emit('delete', step.id)" title="删除">
            🗑️
          </button>
        </div>
      </div>
    </div>

    <!-- 拖动指示线 -->
    <div 
      v-if="dragOverIndex !== null" 
      class="drag-indicator"
      :style="{ top: `${dragOverIndex * 56}px` }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { TestStep, ElementSelector } from '@/types/flow';

// Props
const props = defineProps<{
  steps: TestStep[];
}>();

// Emits
const emit = defineEmits<{
  (e: 'update:steps', steps: TestStep[]): void;
  (e: 'edit', step: TestStep): void;
  (e: 'delete', stepId: string): void;
}>();

// 拖拽状态
const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

// 操作标签
const getActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    navigate: '跳转',
    click: '点击',
    input: '输入',
    select: '选择',
    wait: '等待',
    assert: '断言',
    screenshot: '截图',
    scroll: '滚动',
  };
  return labels[action] || action;
};

// 选择器预览
const getSelectorPreview = (selector: ElementSelector) => {
  const typeLabel: Record<string, string> = {
    css: 'CSS',
    xpath: 'XPath',
    text: '文本',
    ai: 'AI',
  };
  const type = typeLabel[selector.type] || selector.type;
  const value = selector.value.length > 30 
    ? selector.value.slice(0, 30) + '...' 
    : selector.value;
  return `[${type}] ${value}`;
};

// 切换启用状态
const toggleEnabled = (index: number) => {
  const newSteps = [...props.steps];
  newSteps[index] = {
    ...newSteps[index],
    enabled: !newSteps[index].enabled,
  };
  emit('update:steps', newSteps);
};

// 拖拽开始
const handleDragStart = (event: DragEvent, index: number) => {
  dragIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  }
};

// 拖拽经过
const handleDragOver = (event: DragEvent, index: number) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  dragOverIndex.value = index;
};

// 放置
const handleDrop = (event: DragEvent, targetIndex: number) => {
  event.preventDefault();
  
  if (dragIndex.value === null || dragIndex.value === targetIndex) {
    return;
  }
  
  const newSteps = [...props.steps];
  const [removed] = newSteps.splice(dragIndex.value, 1);
  newSteps.splice(targetIndex, 0, removed);
  
  emit('update:steps', newSteps);
  
  dragIndex.value = null;
  dragOverIndex.value = null;
};

// 拖拽结束
const handleDragEnd = () => {
  dragIndex.value = null;
  dragOverIndex.value = null;
};
</script>

<style scoped>
.step-list {
  position: relative;
  min-height: 100px;
}

.empty-hint {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 40px 20px;
}

.steps-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
  cursor: grab;
  transition: all 0.2s;
}

.step-item:hover {
  background: #f0f0f0;
}

.step-item.disabled {
  opacity: 0.5;
}

.step-item:active {
  cursor: grabbing;
}

.step-drag-handle {
  color: #ccc;
  font-size: 14px;
  margin-right: 8px;
  cursor: grab;
}

.step-index {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e6f7ff;
  color: #1890ff;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  margin-right: 10px;
}

.step-target {
  font-size: 16px;
  margin-right: 10px;
}

.step-target.plugin {
  background: #f6ffed;
  padding: 2px 4px;
  border-radius: 4px;
}

.step-content {
  flex: 1;
  min-width: 0;
}

.step-action {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-badge {
  font-size: 11px;
  padding: 2px 6px;
  background: #1890ff;
  color: #fff;
  border-radius: 3px;
}

.step-name {
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.step-selector {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.step-item:hover .step-actions {
  opacity: 1;
}

.btn-step {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
}

.btn-step:hover {
  background: #e6e6e6;
}

.btn-step.btn-delete:hover {
  background: #ffebee;
}

.drag-indicator {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: #1890ff;
  pointer-events: none;
}
</style>
