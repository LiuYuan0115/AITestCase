<template>
  <div class="batch-uploader-overlay" v-if="isOpen" @click.self="close">
    <div class="batch-uploader" @click.stop>
      <div class="uploader-header">
        <h3>批量上传文件</h3>
        <button class="uploader-close" @click="close">×</button>
      </div>

      <div class="uploader-content">
        <!-- 拖拽上传区域 -->
        <div
          class="drop-zone"
          :class="{ 'drag-over': isDragOver, 'has-files': files.length > 0 }"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop"
          @click="triggerFileInput"
        >
          <input
            ref="fileInput"
            type="file"
            multiple
            :accept="acceptTypes"
            @change="handleFileSelect"
            style="display: none"
          />
          <div class="drop-zone-content">
            <div class="drop-zone-icon">📁</div>
            <div class="drop-zone-text">拖放文件到此处</div>
            <div class="drop-zone-hint">或点击选择文件</div>
            <div class="drop-zone-types">
              支持: {{ supportedTypes }}
            </div>
            <div class="drop-zone-limits">
              单文件: {{ maxSizeMB }}MB | 批量: 最多 {{ maxFiles }} 个
            </div>
          </div>
        </div>

        <!-- 文件队列 -->
        <div class="file-queue" v-if="files.length > 0">
          <div class="file-queue-header">
            <span>已选择文件 ({{ files.length }})</span>
            <button class="btn-clear" @click="clearAll">清空</button>
          </div>
          <div class="file-list">
            <div
              v-for="file in files"
              :key="file.id"
              class="file-item"
              :class="{
                'completed': file.status === 'completed',
                'error': file.status === 'error',
                'uploading': file.status === 'uploading' || file.status === 'processing'
              }"
            >
              <div class="file-icon">{{ getFileIcon(file.type) }}</div>
              <div class="file-info">
                <div class="file-name">{{ file.name }}</div>
                <div class="file-meta">
                  <span class="file-size">{{ formatSize(file.size) }}</span>
                  <span v-if="file.status === 'error'" class="file-error">{{ file.error }}</span>
                  <span v-else-if="file.status === 'completed'" class="file-success">已完成</span>
                  <span v-else-if="file.status === 'uploading'" class="file-progress-text">上传中...</span>
                  <span v-else-if="file.status === 'processing'" class="file-progress-text">处理中...</span>
                </div>
                <div v-if="file.status === 'uploading' || file.status === 'processing'" class="file-progress-bar">
                  <div class="file-progress-fill" :style="{ width: file.progress + '%' }"></div>
                </div>
              </div>
              <div class="file-actions">
                <button
                  v-if="file.status === 'pending'"
                  class="btn-remove"
                  @click="removeFile(file.id)"
                >×</button>
                <span v-else-if="file.status === 'completed'" class="status-icon">✓</span>
                <span v-else-if="file.status === 'error'" class="status-icon error">✗</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 上传选项 -->
        <div class="upload-options" v-if="files.length > 0">
          <div class="option-row">
            <label>目标位置:</label>
            <select v-model="targetKind">
              <option value="aux">辅助文档</option>
              <option value="main">主文档</option>
              <option value="knowledge">知识库</option>
            </select>
          </div>
          <div class="option-row">
            <label>并行处理:</label>
            <select v-model="parallelCount">
              <option :value="1">1 个</option>
              <option :value="2">2 个</option>
              <option :value="4">4 个</option>
            </select>
          </div>
        </div>
      </div>

      <div class="uploader-footer">
        <button class="btn-secondary" @click="close">取消</button>
        <button
          class="btn-primary"
          @click="startUpload"
          :disabled="files.length === 0 || isUploading"
        >
          {{ isUploading ? '上传中...' : '开始上传' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useDocuments } from '@/composables/useDocuments';
import { uploadFile } from '@/utils/docStoreApi';
import { useSession } from '@/composables/useSession';

interface FileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

const props = defineProps<{
  maxSizeMB?: number;
  maxFiles?: number;
  acceptTypes?: string;
}>();

const emit = defineEmits<{
  close: [];
  uploaded: [docIds: string[]];
}>();

// 默认值
const maxSizeMB = computed(() => props.maxSizeMB || 20);
const maxFiles = computed(() => props.maxFiles || 10);
const acceptTypes = computed(() => props.acceptTypes || '.pdf,.png,.jpg,.jpeg,.webp,.txt,.md');
const supportedTypes = computed(() => 'PDF, PNG, JPG, TXT, MD');

// 状态
const isOpen = ref(false);
const isDragOver = ref(false);
const files = ref<FileItem[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const targetKind = ref<'aux' | 'main' | 'knowledge'>('aux');
const parallelCount = ref(4);
const isUploading = ref(false);

const { uploadDocument } = useDocuments();
const { getSessionId } = useSession();

// 方法
const open = () => {
  isOpen.value = true;
  files.value = [];
};

const close = () => {
  if (!isUploading.value) {
    isOpen.value = false;
    files.value = [];
    emit('close');
  }
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleDragOver = () => {
  isDragOver.value = true;
};

const handleDragLeave = () => {
  isDragOver.value = false;
};

const handleDrop = (e: DragEvent) => {
  isDragOver.value = false;
  const droppedFiles = e.dataTransfer?.files;
  if (droppedFiles) {
    addFiles(Array.from(droppedFiles));
  }
};

const handleFileSelect = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (input.files) {
    addFiles(Array.from(input.files));
  }
  input.value = '';
};

const addFiles = (newFiles: File[]) => {
  const remaining = maxFiles.value - files.value.length;
  const filesToAdd = newFiles.slice(0, remaining);

  for (const file of filesToAdd) {
    // 检查大小
    if (file.size > maxSizeMB.value * 1024 * 1024) {
      files.value.push({
        id: generateId(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'error',
        progress: 0,
        error: '超出大小限制'
      });
      continue;
    }

    files.value.push({
      id: generateId(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending',
      progress: 0
    });
  }
};

const removeFile = (id: string) => {
  const index = files.value.findIndex(f => f.id === id);
  if (index !== -1) {
    files.value.splice(index, 1);
  }
};

const clearAll = () => {
  files.value = files.value.filter(f =>
    f.status === 'uploading' || f.status === 'processing'
  );
};

const startUpload = async () => {
  const pendingFiles = files.value.filter(f => f.status === 'pending');
  if (pendingFiles.length === 0) return;

  isUploading.value = true;
  const uploadedDocIds: string[] = [];
  const sessionId = getSessionId();

  // 分批并行上传
  for (let i = 0; i < pendingFiles.length; i += parallelCount.value) {
    const batch = pendingFiles.slice(i, i + parallelCount.value);

    await Promise.all(batch.map(async (fileItem) => {
      try {
        fileItem.status = 'uploading';
        fileItem.progress = 0;

        const kind = targetKind.value === 'knowledge' ? 'aux' : targetKind.value;

        // P1 优化：使用 uploadFile 并传入进度回调
        const docRef = await uploadFile(sessionId, fileItem.file, {
          kind,
          onProgress: (percent) => {
            // 上传进度占 0-90%，处理阶段占 90-100%
            fileItem.progress = Math.round(percent * 0.9);
          }
        });

        // 上传完成后进入处理阶段
        fileItem.status = 'processing';
        fileItem.progress = 95;

        // 完成
        fileItem.status = 'completed';
        fileItem.progress = 100;
        uploadedDocIds.push(docRef.docId);
      } catch (e: any) {
        fileItem.status = 'error';
        fileItem.error = e.message || '上传失败';
      }
    }));
  }

  isUploading.value = false;

  if (uploadedDocIds.length > 0) {
    emit('uploaded', uploadedDocIds);
  }
};

const generateId = () => `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const getFileIcon = (type: string): string => {
  if (type.includes('pdf')) return '📄';
  if (type.includes('image')) return '🖼️';
  if (type.includes('text')) return '📝';
  return '📎';
};

// 挂载时自动打开（因为外部通过 v-if 控制）
onMounted(() => {
  open();
});

defineExpose({ open, close });
</script>

<style scoped>
.batch-uploader-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.batch-uploader {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 560px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.uploader-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.uploader-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.uploader-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  transition: background 0.2s;
}

.uploader-close:hover {
  background: #f0f0f0;
}

.uploader-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.drop-zone {
  border: 2px dashed #d0d5dd;
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: #fafbfc;
}

.drop-zone:hover,
.drop-zone.drag-over {
  border-color: #5D6AB4;
  background: rgba(93, 106, 180, 0.05);
}

.drop-zone.has-files {
  padding: 24px 20px;
}

.drop-zone-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.drop-zone-text {
  font-size: 16px;
  font-weight: 600;
  color: #344054;
  margin-bottom: 4px;
}

.drop-zone-hint {
  font-size: 14px;
  color: #667085;
  margin-bottom: 12px;
}

.drop-zone-types,
.drop-zone-limits {
  font-size: 12px;
  color: #98a2b3;
}

.file-queue {
  margin-top: 20px;
}

.file-queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 500;
}

.btn-clear {
  background: none;
  border: none;
  color: #5D6AB4;
  cursor: pointer;
  font-size: 13px;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 240px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  gap: 12px;
  transition: background 0.2s;
}

.file-item.uploading {
  background: #f0f4ff;
}

.file-item.completed {
  background: #ecfdf5;
}

.file-item.error {
  background: #fef2f2;
}

.file-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: #344054;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #667085;
  margin-top: 2px;
}

.file-error {
  color: #dc2626;
}

.file-success {
  color: #16a34a;
}

.file-progress-text {
  color: #5D6AB4;
}

.file-progress-bar {
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}

.file-progress-fill {
  height: 100%;
  background: #5D6AB4;
  border-radius: 2px;
  transition: width 0.3s;
}

.file-actions {
  flex-shrink: 0;
}

.btn-remove {
  background: none;
  border: none;
  font-size: 18px;
  color: #98a2b3;
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  transition: all 0.2s;
}

.btn-remove:hover {
  background: #fee2e2;
  color: #dc2626;
}

.status-icon {
  font-size: 16px;
  color: #16a34a;
}

.status-icon.error {
  color: #dc2626;
}

.upload-options {
  margin-top: 20px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.option-row:last-child {
  margin-bottom: 0;
}

.option-row label {
  font-size: 13px;
  color: #344054;
  min-width: 80px;
}

.option-row select {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  font-size: 13px;
  background: white;
}

.uploader-footer {
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-secondary {
  padding: 10px 20px;
  border: 1px solid #d0d5dd;
  background: white;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #f9fafb;
}

.btn-primary {
  padding: 10px 24px;
  background: #5D6AB4;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #4a5591;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
