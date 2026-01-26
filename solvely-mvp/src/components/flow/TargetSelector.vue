<template>
  <div class="target-selector">
    <div 
      class="target-option" 
      :class="{ active: modelValue === 'page' }"
      @click="$emit('update:modelValue', 'page')"
    >
      <span class="target-icon">🌐</span>
      <div class="target-info">
        <div class="target-name">网页内容</div>
        <div class="target-desc">操作主页面元素</div>
      </div>
    </div>
    
    <div 
      class="target-option" 
      :class="{ active: modelValue === 'plugin' }"
      @click="$emit('update:modelValue', 'plugin')"
    >
      <span class="target-icon">🔌</span>
      <div class="target-info">
        <div class="target-name">插件侧栏</div>
        <div class="target-desc">操作插件面板元素</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TargetType } from '@/types/flow';

// Props
defineProps<{
  modelValue: TargetType;
}>();

// Emits
defineEmits<{
  (e: 'update:modelValue', value: TargetType): void;
}>();
</script>

<style scoped>
.target-selector {
  display: flex;
  gap: 12px;
}

.target-option {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border: 2px solid #e8e8e8;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.target-option:hover {
  border-color: #91d5ff;
  background: #f6ffff;
}

.target-option.active {
  border-color: #1890ff;
  background: #e6f7ff;
}

.target-icon {
  font-size: 24px;
  margin-right: 12px;
}

.target-info {
  flex: 1;
}

.target-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.target-desc {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}
</style>
