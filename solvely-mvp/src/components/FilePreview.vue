<template>
  <div class="file-preview-container">
    <!-- 文件列表模式 -->
    <div v-if="mode === 'list'" class="file-list">
      <div
        v-for="file in files"
        :key="file.id"
        class="file-item"
        :class="{ 'error': file.status === 'error', 'uploading': file.status === 'uploading' }"
      >
        <!-- 缩略图/图标 -->
        <div class="file-thumb" :class="{ 'thumb-pdf': isPdfDirect(file) }">
          <img
            v-if="file.type === 'image' && file.previewUrl"
            :src="file.previewUrl"
            :alt="file.name"
            class="thumb-img"
          />
          <div v-else-if="isPdfDirect(file) && file.previewUrl" class="thumb-pdf-badge">
            <span class="pdf-icon">PDF</span>
          </div>
          <span v-else class="thumb-icon">{{ getFileIcon(file.type) }}</span>
        </div>

        <!-- 文件信息 -->
        <div class="file-info">
          <div class="file-name" v-tooltip="file.name">{{ file.name }}</div>
          <div class="file-meta">
            <span class="file-size">{{ formatSize(file.size) }}</span>
            <span v-if="file.status === 'uploading'" class="file-status uploading">
              上传中 {{ file.progress }}%
            </span>
            <span v-else-if="file.status === 'processing'" class="file-status processing">
              处理中...
            </span>
            <span v-else-if="file.status === 'completed'" class="file-status completed">
              已上传
            </span>
            <span v-else-if="file.status === 'error'" class="file-status error">
              {{ file.error || '上传失败' }}
            </span>
          </div>
          <!-- 进度条 -->
          <div v-if="file.status === 'uploading'" class="file-progress">
            <div class="progress-bar" :style="{ width: file.progress + '%' }"></div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="file-actions">
          <button
            v-if="file.status === 'error'"
            class="action-retry"
            @click="$emit('retry', file.id)"
            v-tooltip="'重试'"
          >
            🔄
          </button>
          <button
            class="action-remove"
            @click="$emit('remove', file.id)"
            v-tooltip="'移除'"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <!-- 网格模式（适合图片） -->
    <div v-else-if="mode === 'grid'" class="file-grid">
      <div
        v-for="file in files"
        :key="file.id"
        class="grid-item"
        :class="{ 'error': file.status === 'error' }"
      >
        <div class="grid-thumb" :class="{ 'grid-thumb-pdf': isPdfDirect(file) }">
          <img
            v-if="file.type === 'image' && file.previewUrl"
            :src="file.previewUrl"
            :alt="file.name"
            class="grid-img"
          />
          <div v-else-if="isPdfDirect(file) && file.previewUrl" class="grid-pdf-badge">
            <span class="pdf-label">PDF</span>
            <span class="pdf-direct-tag">Direct</span>
          </div>
          <span v-else class="grid-icon">{{ getFileIcon(file.type) }}</span>

          <!-- 上传进度遮罩 -->
          <div v-if="file.status === 'uploading'" class="grid-overlay">
            <div class="grid-progress">{{ file.progress }}%</div>
          </div>

          <!-- 错误遮罩 -->
          <div v-if="file.status === 'error'" class="grid-overlay error">
            <span class="grid-error-icon">!</span>
          </div>
        </div>

        <div class="grid-name" v-tooltip="file.name">{{ truncateName(file.name) }}</div>

        <button class="grid-remove" @click="$emit('remove', file.id)">×</button>
      </div>
    </div>

    <!-- 紧凑模式（chips） -->
    <div v-else class="file-chips">
      <div
        v-for="file in files"
        :key="file.id"
        class="file-chip"
        :class="{
          'error': file.status === 'error',
          'uploading': file.status === 'uploading',
          'completed': file.status === 'completed',
        }"
      >
        <span v-if="isPdfDirect(file)" class="chip-icon chip-pdf-direct">PDF</span>
        <span v-else class="chip-icon">{{ getFileIcon(file.type) }}</span>
        <span class="chip-name" v-tooltip="file.name">{{ truncateName(file.name, 12) }}</span>
        <span v-if="file.status === 'uploading'" class="chip-progress">{{ file.progress }}%</span>
        <span v-if="file.status === 'error'" class="chip-error" v-tooltip="file.error">!</span>
        <button class="chip-remove" @click="$emit('remove', file.id)">×</button>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="files.length === 0 && showEmpty" class="file-empty">
      <span class="empty-icon">📁</span>
      <span class="empty-text">{{ emptyText }}</span>
    </div>

    <!-- 底部操作栏 -->
    <div v-if="files.length > 0 && showActions" class="file-actions-bar">
      <span class="files-count">{{ files.length }} 个文件</span>
      <button class="btn-clear" @click="$emit('clear-all')">清空全部</button>
      <button
        v-if="hasPending"
        class="btn-upload"
        :disabled="isUploading"
        @click="$emit('upload-all')"
      >
        {{ isUploading ? '上传中...' : '上传全部' }}
      </button>
      <button
        v-if="hasError"
        class="btn-retry"
        @click="$emit('retry-all')"
      >
        重试失败
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Attachment, AttachmentType } from '../types/chat';

const props = withDefaults(defineProps<{
  files: Attachment[];
  mode?: 'list' | 'grid' | 'chips';
  showEmpty?: boolean;
  showActions?: boolean;
  emptyText?: string;
  isUploading?: boolean;
}>(), {
  mode: 'chips',
  showEmpty: false,
  showActions: false,
  emptyText: '暂无文件',
  isUploading: false,
});

defineEmits<{
  (e: 'remove', id: string): void;
  (e: 'retry', id: string): void;
  (e: 'clear-all'): void;
  (e: 'upload-all'): void;
  (e: 'retry-all'): void;
}>();

const hasPending = computed(() =>
  props.files.some(f => f.status === 'pending')
);

const hasError = computed(() =>
  props.files.some(f => f.status === 'error')
);

/** 判断文件是否为 Gemini PDF 直传模式 */
function isPdfDirect(file: Attachment): boolean {
  return file.type === 'pdf' && file.multimodalMode === 'gemini_pdf_direct';
}

function getFileIcon(type: AttachmentType): string {
  switch (type) {
    case 'pdf': return '📄';
    case 'image': return '🖼️';
    case 'text': return '📝';
    case 'office': return '📊';
    case 'url': return '🔗';
    case 'extracted': return '📸';
    default: return '📎';
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function truncateName(name: string, maxLen = 20): string {
  if (name.length <= maxLen) return name;
  const ext = name.split('.').pop() || '';
  const baseName = name.slice(0, maxLen - ext.length - 4);
  return `${baseName}...${ext}`;
}
</script>

<style scoped>
.file-preview-container {
  width: 100%;
}

/* 列表模式 */
.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #e8e8e8);
  border-radius: 8px;
  transition: all 0.2s;
}

.file-item:hover {
  border-color: var(--primary-color, #1890ff);
}

.file-item.uploading {
  border-color: var(--primary-color, #1890ff);
}

.file-item.error {
  border-color: var(--error-color, #ff4d4f);
  background: #fff1f0;
}

.file-thumb {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 6px;
  overflow: hidden;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-icon {
  font-size: 24px;
}

.thumb-pdf {
  background: #fff0f0;
  border: 1px solid #ffccc7;
}

.thumb-pdf-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.pdf-icon {
  font-size: 12px;
  font-weight: 700;
  color: #cf1322;
  background: #fff1f0;
  padding: 2px 6px;
  border-radius: 3px;
  letter-spacing: 0.5px;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #333);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 2px;
}

.file-size {
  font-size: 11px;
  color: var(--text-secondary, #999);
}

.file-status {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
}

.file-status.uploading {
  background: #e6f7ff;
  color: #1890ff;
}

.file-status.processing {
  background: #fff7e6;
  color: #fa8c16;
}

.file-status.completed {
  background: #f6ffed;
  color: #52c41a;
}

.file-status.error {
  background: #fff1f0;
  color: #ff4d4f;
}

.file-progress {
  height: 3px;
  background: #f0f0f0;
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--primary-color, #1890ff);
  transition: width 0.2s;
}

.file-actions {
  display: flex;
  gap: 4px;
}

.action-retry,
.action-remove {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.action-retry:hover {
  background: #e6f7ff;
}

.action-remove:hover {
  background: #fff1f0;
  color: #ff4d4f;
}

/* 网格模式 */
.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 12px;
}

.grid-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.grid-thumb {
  position: relative;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary, #f5f5f5);
  border: 1px solid var(--border-color, #e8e8e8);
  border-radius: 8px;
  overflow: hidden;
}

.grid-item.error .grid-thumb {
  border-color: var(--error-color, #ff4d4f);
}

.grid-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.grid-icon {
  font-size: 32px;
}

.grid-thumb-pdf {
  background: #fff0f0;
  border-color: #ffccc7;
}

.grid-pdf-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.pdf-label {
  font-size: 16px;
  font-weight: 700;
  color: #cf1322;
}

.pdf-direct-tag {
  font-size: 9px;
  color: #fff;
  background: #cf1322;
  padding: 1px 4px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.grid-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.grid-overlay.error {
  background: rgba(255, 77, 79, 0.8);
}

.grid-progress {
  color: white;
  font-size: 14px;
  font-weight: 600;
}

.grid-error-icon {
  color: white;
  font-size: 24px;
  font-weight: bold;
}

.grid-name {
  font-size: 11px;
  color: var(--text-secondary, #666);
  text-align: center;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grid-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--error-color, #ff4d4f);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
}

.grid-item:hover .grid-remove {
  opacity: 1;
}

/* Chips 模式 */
.file-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.file-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #ddd);
  border-radius: 12px;
  font-size: 12px;
}

.file-chip.uploading {
  border-color: var(--primary-color, #1890ff);
  background: #e6f7ff;
}

.file-chip.completed {
  border-color: var(--success-color, #52c41a);
  background: #f6ffed;
}

.file-chip.error {
  border-color: var(--error-color, #ff4d4f);
  background: #fff1f0;
}

.chip-icon {
  font-size: 14px;
}

.chip-pdf-direct {
  font-size: 10px;
  font-weight: 700;
  color: #cf1322;
  background: #fff1f0;
  padding: 1px 4px;
  border-radius: 3px;
  letter-spacing: 0.5px;
}

.chip-name {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-progress {
  color: var(--primary-color, #1890ff);
  font-size: 11px;
}

.chip-error {
  color: var(--error-color, #ff4d4f);
  font-weight: bold;
}

.chip-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary, #999);
  font-size: 14px;
  padding: 0;
  line-height: 1;
}

.chip-remove:hover {
  color: var(--error-color, #ff4d4f);
}

/* 空状态 */
.file-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--text-secondary, #999);
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-text {
  font-size: 13px;
}

/* 底部操作栏 */
.file-actions-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color, #e8e8e8);
}

.files-count {
  font-size: 12px;
  color: var(--text-secondary, #666);
}

.btn-clear,
.btn-upload,
.btn-retry {
  padding: 6px 12px;
  border: 1px solid var(--border-color, #d9d9d9);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clear {
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #333);
}

.btn-clear:hover {
  border-color: var(--error-color, #ff4d4f);
  color: var(--error-color, #ff4d4f);
}

.btn-upload {
  background: var(--primary-color, #1890ff);
  border-color: var(--primary-color, #1890ff);
  color: white;
}

.btn-upload:hover:not(:disabled) {
  background: var(--primary-hover, #40a9ff);
}

.btn-upload:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-retry {
  background: var(--bg-primary, #fff);
  color: var(--warning-color, #fa8c16);
  border-color: var(--warning-color, #fa8c16);
}

.btn-retry:hover {
  background: #fff7e6;
}
</style>
