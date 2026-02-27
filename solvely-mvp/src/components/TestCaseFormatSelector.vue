<template>
  <div class="format-selector">
    <span class="selector-label">输出格式</span>
    <div class="format-options">
      <button
        v-for="opt in options"
        :key="opt.value"
        :class="['format-btn', { active: modelValue === opt.value }]"
        @click="selectFormat(opt.value)"
        v-tooltip="opt.description"
      >
        <span class="format-icon">{{ opt.icon }}</span>
        <span class="format-name">{{ opt.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { preferences, type TestCaseOutputFormat } from '@/utils/preferences';

const props = defineProps<{
  modelValue: TestCaseOutputFormat;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: TestCaseOutputFormat): void;
}>();

const options = [
  {
    value: 'xmind' as const,
    label: 'XMind',
    icon: '🗺️',
    description: 'H1-H6层级结构，兼容XMind导入',
  },
  {
    value: 'table' as const,
    label: '表格',
    icon: '📊',
    description: 'Markdown表格格式，便于复制到Excel/飞书',
  },
  {
    value: 'yaml' as const,
    label: 'YAML',
    icon: '📄',
    description: 'YAML结构化格式，便于程序化处理',
  },
];

function selectFormat(format: TestCaseOutputFormat) {
  emit('update:modelValue', format);
  // 持久化偏好设置
  const formats = preferences.get('formats');
  formats.testcaseGeneration = format;
  preferences.set('formats', formats);
}
</script>

<style scoped>
.format-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selector-label {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

.format-options {
  display: flex;
  gap: 4px;
}

.format-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: #666;
  transition: all 0.2s ease;
}

.format-btn:hover {
  border-color: #5d6ab4;
  color: #5d6ab4;
}

.format-btn.active {
  background: #5d6ab4;
  border-color: #5d6ab4;
  color: #fff;
}

.format-icon {
  font-size: 14px;
}

.format-name {
  font-size: 12px;
}
</style>
