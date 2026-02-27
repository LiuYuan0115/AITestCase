<template>
  <div class="input-toolbar">
    <!-- 附件按钮 -->
    <button
      class="toolbar-btn"
      :class="{ 'has-count': attachmentCount > 0 }"
      @click="$emit('attach')"
      v-tooltip="'上传文件 (PDF/图片/文本)'"
    >
      <span class="toolbar-icon">📎</span>
      <span class="toolbar-label">附件</span>
      <span v-if="attachmentCount > 0" class="toolbar-count">{{ attachmentCount }}</span>
    </button>

    <!-- 当前页按钮 -->
    <button
      class="toolbar-btn"
      :disabled="disabled"
      @click="$emit('extract-page')"
      v-tooltip="'一键滑动提取当前页面'"
    >
      <span class="toolbar-icon">📸</span>
      <span class="toolbar-label">当前页</span>
    </button>

    <!-- 提取按钮 -->
    <button
      class="toolbar-btn"
      @click="$emit('show-extract')"
      v-tooltip="'提取文档（链接/参考/Figma）'"
    >
      <span class="toolbar-icon">📚</span>
      <span class="toolbar-label">提取</span>
    </button>

    <!-- 引用按钮 -->
    <button
      class="toolbar-btn"
      :class="{ 'has-count': refCount > 0 }"
      @click="$emit('show-refs')"
      v-tooltip="'引用文档'"
    >
      <span class="toolbar-icon">@</span>
      <span class="toolbar-label">引用</span>
      <span v-if="refCount > 0" class="toolbar-count">{{ refCount }}</span>
    </button>

    <!-- 提示按钮 -->
    <button
      class="toolbar-btn hints-btn"
      :class="{ 'active': showHints }"
      @click="$emit('toggle-hints')"
      v-tooltip="'快捷提示词'"
    >
      <span class="toolbar-icon">💡</span>
      <span class="toolbar-label">提示</span>
    </button>

    <!-- 工具配置按钮 (可选) -->
    <button
      v-if="showToolConfig"
      class="toolbar-btn config-btn"
      :class="{ 'active': showConfig }"
      @click="$emit('toggle-config')"
      v-tooltip="'工具配置'"
    >
      <span class="toolbar-icon">⚙️</span>
    </button>

    <!-- 分隔符 -->
    <div class="toolbar-spacer"></div>

    <!-- 角色指示器 -->
    <div class="role-indicator" :class="role">
      <span class="role-icon">{{ roleIcon }}</span>
      <span class="role-label">{{ roleLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { UserRole } from '../types/chat';

const props = withDefaults(defineProps<{
  role: UserRole;
  disabled?: boolean;
  attachmentCount?: number;
  refCount?: number;
  showHints?: boolean;
  showConfig?: boolean;
  showToolConfig?: boolean;
}>(), {
  disabled: false,
  attachmentCount: 0,
  refCount: 0,
  showHints: false,
  showConfig: false,
  showToolConfig: false,
});

defineEmits<{
  (e: 'attach'): void;
  (e: 'extract-page'): void;
  (e: 'show-extract'): void;
  (e: 'show-refs'): void;
  (e: 'toggle-hints'): void;
  (e: 'toggle-config'): void;
}>();

const roleIcon = computed(() => {
  switch (props.role) {
    case 'pm': return '📊';
    case 'dev': return '💻';
    case 'qa': return '🔍';
    default: return '👤';
  }
});

const roleLabel = computed(() => {
  switch (props.role) {
    case 'pm': return 'PM';
    case 'dev': return 'DEV';
    case 'qa': return 'QA';
    default: return '';
  }
});
</script>

<style scoped>
.input-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background: var(--bg-secondary, #fafafa);
  border-radius: 6px;
  flex-wrap: wrap;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #e8e8e8);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-primary, #333);
}

.toolbar-btn:hover:not(:disabled) {
  border-color: var(--primary-color, #1890ff);
  color: var(--primary-color, #1890ff);
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-btn.active {
  background: var(--primary-light, #e6f7ff);
  border-color: var(--primary-color, #1890ff);
  color: var(--primary-color, #1890ff);
}

.toolbar-btn.has-count {
  background: var(--primary-light, #e6f7ff);
}

.toolbar-icon {
  font-size: 14px;
}

.toolbar-label {
  font-weight: 500;
}

.toolbar-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--primary-color, #1890ff);
  color: white;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
}

.config-btn {
  padding: 6px 8px;
}

.toolbar-spacer {
  flex: 1;
}

.role-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.role-indicator.pm {
  background: #fff7e6;
  color: #fa8c16;
}

.role-indicator.dev {
  background: #f6ffed;
  color: #52c41a;
}

.role-indicator.qa {
  background: #e6f7ff;
  color: #1890ff;
}

.role-icon {
  font-size: 14px;
}

.role-label {
  text-transform: uppercase;
}

/* 响应式 */
@media (max-width: 480px) {
  .toolbar-label {
    display: none;
  }

  .toolbar-btn {
    padding: 6px 8px;
  }
}
</style>
