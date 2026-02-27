<template>
  <div
    class="document-card"
    :class="{
      'active': active,
      'selected': selected,
      'uploading': doc.status === 'uploading',
      'error': doc.status === 'error'
    }"
    @click="$emit('click')"
  >
    <div class="card-checkbox" @click.stop="$emit('select')">
      <input type="checkbox" :checked="selected" @change.stop="$emit('select')" />
    </div>

    <div class="card-icon">{{ docIcon }}</div>

    <div class="card-content">
      <div class="card-title">{{ doc.title || '(无标题)' }}</div>
      <div class="card-meta">
        <span v-if="doc.logicalId" class="meta-tag">{{ doc.logicalId }}</span>
        <span class="meta-version">v{{ doc.version }}</span>
        <span v-if="doc.status === 'uploading'" class="meta-status uploading">上传中...</span>
        <span v-else-if="doc.status === 'error'" class="meta-status error">{{ doc.error || '错误' }}</span>
      </div>
    </div>

    <div class="card-actions">
      <button
        class="btn-action"
        @click.stop="$emit('versions')"
        v-tooltip="'版本历史'"
        :disabled="doc.status !== 'ready'"
      >
        📋
      </button>
      <button
        class="btn-action"
        @click.stop="$emit('edit')"
        v-tooltip="'编辑'"
        :disabled="doc.status !== 'ready'"
      >
        ✏️
      </button>
    </div>

    <div class="card-kind" :class="doc.kind">
      {{ kindLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { LocalDocument } from '@/composables';

const props = defineProps<{
  doc: LocalDocument;
  active?: boolean;
  selected?: boolean;
}>();

defineEmits<{
  click: [];
  select: [];
  edit: [];
  versions: [];
}>();

const docIcon = computed(() => {
  const contentType = props.doc.docRef?.contentType || '';
  if (contentType.includes('pdf')) return '📕';
  if (contentType.includes('image')) return '🖼️';
  if (contentType.includes('markdown') || props.doc.title?.endsWith('.md')) return '📝';
  return '📄';
});

const kindLabel = computed(() => {
  switch (props.doc.kind) {
    case 'main': return '主';
    case 'aux': return '辅';
    case 'output': return '出';
    default: return '';
  }
});
</script>

<style scoped>
.document-card {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.document-card:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.document-card.active {
  background: #eff6ff;
  border-color: #5D6AB4;
}

.document-card.selected {
  background: #f0f4ff;
}

.document-card.uploading {
  opacity: 0.7;
}

.document-card.error {
  border-color: #fca5a5;
  background: #fef2f2;
}

.card-checkbox {
  flex-shrink: 0;
}

.card-checkbox input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.card-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.card-content {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  font-size: 11px;
  color: #9ca3af;
}

.meta-tag {
  background: #e5e7eb;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 10px;
}

.meta-version {
  color: #6b7280;
}

.meta-status {
  font-weight: 500;
}

.meta-status.uploading {
  color: #5D6AB4;
}

.meta-status.error {
  color: #dc2626;
}

.card-actions {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.document-card:hover .card-actions {
  opacity: 1;
}

.btn-action {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.btn-action:hover:not(:disabled) {
  opacity: 1;
}

.btn-action:disabled {
  cursor: not-allowed;
  opacity: 0.3;
}

.card-kind {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 9px;
  font-weight: 600;
  padding: 2px 4px;
  border-radius: 3px;
  text-transform: uppercase;
}

.card-kind.main {
  background: #dbeafe;
  color: #1e40af;
}

.card-kind.aux {
  background: #e5e7eb;
  color: #4b5563;
}

.card-kind.output {
  background: #d1fae5;
  color: #065f46;
}
</style>
