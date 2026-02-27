<template>
  <div class="chat-input-container">
    <!-- 已引用文档 -->
    <div v-if="selectedRefDocs.length > 0" class="ref-chip-row">
      <div
        v-for="d in selectedRefDocs"
        :key="d.docId"
        class="ref-chip"
        v-tooltip="d.title"
      >
        <span class="ref-chip-title">@{{ d.title }}</span>
        <button class="ref-chip-remove" @click="removeRefDoc(d.docId)" v-tooltip="'移除引用'">
          <X :size="12" />
        </button>
      </div>
      <button class="ref-chip-clear" @click="clearAllRefDocs" v-tooltip="'清空所有引用'">
        <Trash2 :size="12" />
        <span>清空</span>
      </button>
    </div>

    <!-- 统一输入框容器（附件 + 输入 + 按钮组） -->
    <div class="input-box" :class="{ 'input-box--focused': isTextareaFocused }">
      <!-- 附件区域（内嵌在输入框内） -->
      <div v-if="attachments.length > 0" class="attachments-inner">
        <div
          v-for="att in attachments"
          :key="att.id"
          class="attachment-chip"
          :class="{ 'error': att.status === 'error', 'uploading': att.status === 'uploading', 'completed': att.status === 'completed' }"
        >
          <component :is="getAttachmentIconComponent(att.type)" :size="16" class="attachment-icon" />
          <span class="attachment-name" v-tooltip="att.name">{{ truncateName(att.name) }}</span>
          <span v-if="att.status === 'uploading'" class="attachment-progress">{{ att.progress }}%</span>
          <Check v-if="att.status === 'completed'" :size="14" class="attachment-success" v-tooltip="'上传成功'" />
          <AlertCircle v-if="att.status === 'error'" :size="14" class="attachment-error-icon" v-tooltip="att.error" />
          <button class="attachment-remove" @click="removeAttachment(att.id)" v-tooltip="'移除附件'">
            <X :size="12" />
          </button>
        </div>
        <!-- 错误提示行 -->
        <div v-if="hasErrorAttachments" class="attachment-error-row">
          <AlertCircle :size="16" class="error-icon" />
          <span class="error-text">{{ firstErrorMessage }}</span>
        </div>
        <button v-if="attachments.length > 1" class="attachments-clear" @click="clearAllAttachments">清空</button>
      </div>

      <!-- 输入区 -->
      <textarea
        ref="textareaRef"
        v-model="inputText"
        class="unified-textarea"
        :placeholder="placeholder"
        :disabled="disabled || isUploading"
        @keydown="handleKeydown"
        @paste="handlePaste"
        @input="handleInput"
        @focus="isTextareaFocused = true"
        @blur="isTextareaFocused = false"
      ></textarea>

      <!-- 按钮组 -->
      <div class="input-buttons">
        <button
          class="send-btn"
          :class="{ 'can-send': canSend && !disabled && !isUploading }"
          :disabled="disabled || isUploading || !canSend"
          @click="handleSend"
          v-tooltip="isUploading ? '上传中...' : '发送消息'"
        >
          <ArrowUp :size="18" :stroke-width="3" />
        </button>
        <button
          v-if="activeRole === 'qa'"
          class="quick-gen-btn"
          :disabled="disabled"
          @click="handleQuickGenerate"
          v-tooltip="'直接生成测试用例'"
        >
          <Zap :size="18" />
        </button>
      </div>
    </div>

    <!-- @ 引用弹窗 -->
    <div v-if="showAtPicker" class="ref-picker" @mousedown.prevent>
      <div class="ref-picker-header">
        <span>引用文档（输入 @ 后可按标题搜索）</span>
        <button class="ref-picker-close" @click="showAtPicker = false" v-tooltip="'关闭'">
          <X :size="14" />
        </button>
      </div>
      <div v-if="filteredDocs.length === 0" class="ref-picker-empty">
        暂无可引用文档
      </div>
      <div v-else class="ref-picker-list">
        <button
          v-for="doc in filteredDocs"
          :key="doc.docId"
          class="ref-picker-item"
          :disabled="selectedRefDocs.some(d => d.docId === doc.docId)"
          @mousedown.prevent="addRefDoc(doc)"
        >
          <span class="ref-picker-title">{{ doc.title }}</span>
          <span class="ref-picker-meta">{{ doc.kind }}</span>
        </button>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="action-row">
      <button class="action-btn action-attach" @click="triggerFileInput" v-tooltip="'上传文件'">
        <Paperclip :size="14" />
        <span>附件</span>
      </button>
      <button class="action-btn action-page" @click="$emit('extract-page')" :disabled="disabled" v-tooltip="'一键滑动提取当前页面'">
        <Camera :size="14" />
        <span>当前页</span>
      </button>
      <button class="action-btn action-extract" @click="$emit('show-extract-modal')" v-tooltip="'提取文档（链接/参考/Figma）'">
        <BookOpen :size="14" />
        <span>提取</span>
      </button>
      <button class="action-btn action-hint" @click="showHints = !showHints" v-tooltip="'快捷提示词'">
        <Lightbulb :size="14" />
        <span>提示</span>
      </button>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.doc,.docx,.xls,.xlsx"
      style="display: none"
      @change="handleFileSelect"
    />

    <!-- 提示词弹窗 -->
    <div v-if="showHints" class="hints-popup">
      <div class="hints-popup-header">
        <Lightbulb :size="16" />
        <span>快捷提示词</span>
        <button class="hints-close" @click="showHints = false" v-tooltip="'关闭'">
          <X :size="14" />
        </button>
      </div>
      <div class="hints-list">
        <span
          v-for="hint in currentHints"
          :key="hint.label"
          class="hint-item"
          @click="setHint(hint)"
        >
          {{ hint.label }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { DocRef } from '../utils/refRegistry';
import type { Attachment, AttachmentType, ChatSendPayload, UserRole } from '../types/chat';

// Lucide Icons
import {
  Paperclip,
  Camera,
  BookOpen,
  Lightbulb,
  X,
  Check,
  AlertCircle,
  ArrowUp,
  Zap,
  FileText,
  Image as ImageIcon,
  File,
  Link,
  Trash2,
} from 'lucide-vue-next';

// Hint 类型
interface HintItem {
  label: string;
  text: string;
}

// DocRef 类型（兼容 App.vue 传入的格式）
interface AvailableDoc {
  docId?: string;
  logicalId?: string;
  title?: string;
  kind?: string;
}

// Props
const props = withDefaults(defineProps<{
  modelValue?: string;
  activeRole?: UserRole;
  disabled?: boolean;
  placeholder?: string;
  availableDocs?: AvailableDoc[];
  attachments?: Attachment[];
  hints?: HintItem[];
}>(), {
  modelValue: '',
  activeRole: 'qa',
  disabled: false,
  placeholder: '输入消息，按 Enter 发送，Shift+Enter 换行',
  availableDocs: () => [],
  attachments: () => [],
  hints: () => [],
});

// Emits
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'send', payload: ChatSendPayload): void;
  (e: 'extract-page'): void;
  (e: 'show-extract-modal'): void;
  (e: 'add-attachment', files: File[]): void;
  (e: 'remove-attachment', id: string): void;
  (e: 'quick-generate', text: string): void;
}>();

// 计算属性：检查是否有上传中的附件
const isUploading = computed(() => {
  return props.attachments.some(a => a.status === 'uploading');
});

// 状态
const inputText = ref(props.modelValue);
const selectedRefDocs = ref<AvailableDoc[]>([]);
const showAtPicker = ref(false);
const atSearchQuery = ref('');
const showHints = ref(false);
const isTextareaFocused = ref(false);

// 同步 v-model
watch(() => props.modelValue, (val) => {
  inputText.value = val || '';
});

watch(inputText, (val) => {
  emit('update:modelValue', val);
});

// Refs
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

// 计算属性
const canSend = computed(() => {
  return inputText.value.trim() || props.attachments.length > 0;
});

// 是否有已完成上传的附件
const hasCompletedAttachments = computed(() => {
  return props.attachments.some(a => a.status === 'completed');
});

// 是否有错误的附件
const hasErrorAttachments = computed(() => {
  return props.attachments.some(a => a.status === 'error');
});

// 获取第一个错误信息
const firstErrorMessage = computed(() => {
  const errorAtt = props.attachments.find(a => a.status === 'error');
  return errorAtt?.error || '文件上传失败';
});

const filteredDocs = computed(() => {
  const query = atSearchQuery.value.toLowerCase();
  return props.availableDocs.filter(doc =>
    doc.title?.toLowerCase().includes(query)
  );
});

const currentHints = computed(() => {
  // 使用传入的 hints 或默认值
  if (props.hints && props.hints.length > 0) {
    return props.hints;
  }
  return [
    { label: '分析文档', text: '分析这个文档' },
    { label: '提取信息', text: '提取关键信息' },
    { label: '生成用例', text: '生成测试用例' },
    { label: '识别风险', text: '识别风险点' },
  ];
});

// 方法
function getAttachmentIcon(type: AttachmentType): string {
  switch (type) {
    case 'pdf': return '📄';
    case 'image': return '🖼️';
    case 'text': return '📝';
    case 'office': return '📊';
    case 'url': return '🔗';
    default: return '📎';
  }
}

// 返回附件类型对应的 Lucide 图标组件
function getAttachmentIconComponent(type: AttachmentType) {
  switch (type) {
    case 'pdf': return File;
    case 'image': return ImageIcon;
    case 'text': return FileText;
    case 'office': return FileText;
    case 'url': return Link;
    default: return Paperclip;
  }
}

function truncateName(name: string, maxLen = 15): string {
  if (name.length <= maxLen) return name;
  const ext = name.split('.').pop() || '';
  const baseName = name.slice(0, maxLen - ext.length - 4);
  return `${baseName}...${ext}`;
}

function removeAttachment(id: string): void {
  emit('remove-attachment', id);
}

function clearAllAttachments(): void {
  props.attachments.forEach(a => emit('remove-attachment', a.id));
}

function removeRefDoc(docId: string | undefined): void {
  if (!docId) return;
  selectedRefDocs.value = selectedRefDocs.value.filter(d => d.docId !== docId);
}

function clearAllRefDocs(): void {
  selectedRefDocs.value = [];
}

function addRefDoc(doc: AvailableDoc): void {
  const id = doc.docId || doc.logicalId;
  if (id && !selectedRefDocs.value.some(d => (d.docId || d.logicalId) === id)) {
    selectedRefDocs.value.push(doc);
  }
  showAtPicker.value = false;
  atSearchQuery.value = '';
  // 清除输入框中的 @ 查询
  inputText.value = inputText.value.replace(/@[\w\u4e00-\u9fa5]*$/, '');
}

function triggerFileInput(): void {
  fileInputRef.value?.click();
}

function handleFileSelect(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    emit('add-attachment', Array.from(input.files));
    input.value = ''; // 清空以允许重复选择同一文件
  }
}

function handlePaste(event: ClipboardEvent): void {
  const items = event.clipboardData?.items;
  if (!items) return;

  const files: File[] = [];
  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }

  if (files.length > 0) {
    emit('add-attachment', files);
    // 不阻止默认行为，允许粘贴文本
  }
}

function handleInput(): void {
  // 检测 @ 触发
  const text = inputText.value;
  const atMatch = text.match(/@([\w\u4e00-\u9fa5]*)$/);
  if (atMatch) {
    showAtPicker.value = true;
    atSearchQuery.value = atMatch[1];
  } else {
    showAtPicker.value = false;
    atSearchQuery.value = '';
  }
}

function handleKeydown(event: KeyboardEvent): void {
  // Enter 发送，Shift+Enter 换行
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
}

async function handleSend(): Promise<void> {
  if (!canSend.value || props.disabled || isUploading.value) return;

  // 构建 payload
  const payload: ChatSendPayload = {
    text: inputText.value.trim(),
    attachments: props.attachments.map(a => ({ ...a })),
    refDocs: selectedRefDocs.value.map(d => ({
      docId: d.docId || '',
      title: d.title || '',
      logicalId: d.logicalId,
    })),
    toolConfig: {},
  };

  // 发送
  emit('send', payload);

  // 清空输入和附件
  inputText.value = '';
  selectedRefDocs.value = [];
  clearAllAttachments();
}

function setHint(hint: HintItem): void {
  inputText.value = hint.text;
  showHints.value = false;
  textareaRef.value?.focus();
}

// 快捷生成测试用例（携带输入文本）
function handleQuickGenerate(): void {
  emit('quick-generate', inputText.value.trim());
  inputText.value = ''; // 发送后清空输入
}

// 生命周期
onMounted(() => {
  // 自动聚焦
  textareaRef.value?.focus();
});
</script>

<style scoped>
/* Neo-brutalist 设计变量 */
.chat-input-container {
  --neo-black: #232323;
  --neo-white: #FFFEF9;
  --neo-cream: #FFF9E6;
  --neo-purple: #A2A3D1;
  --neo-primary: #5D6AB4;
  --neo-yellow: #FFE066;
  --neo-green: #90EE90;
  --neo-pink-light: #FFE4EC;
  --neo-red: #E86F68;
  --neo-blue-light: #E3F2FD;

  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--neo-cream);
  border-top: 3px solid var(--neo-black);
  position: relative;
}

/* 附件内嵌区域（在输入框内部） */
.attachments-inner {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 8px 12px 4px;
  border-bottom: 1px dashed #ddd;
}

.attachment-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--neo-cream);
  border: 2px solid var(--neo-black);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 2px 2px 0 var(--neo-black);
  transition: all 0.15s;
}

.attachment-chip:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black);
}

.attachment-chip.uploading {
  background: var(--neo-blue-light);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.attachment-chip.error {
  background: var(--neo-red);
  color: var(--neo-white);
}

.attachment-chip.completed {
  background: var(--neo-green);
}

.attachment-icon {
  flex-shrink: 0;
}

.attachment-name {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-progress {
  color: var(--neo-primary);
  font-size: 11px;
  font-weight: 700;
}

.attachment-error-icon {
  font-weight: bold;
}

/* 错误提示行 */
.attachment-error-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: var(--neo-red);
  border: 2px solid var(--neo-black);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--neo-white);
  box-shadow: 2px 2px 0 var(--neo-black);
}

.attachment-error-row .error-icon {
  font-size: 16px;
}

.attachment-error-row .error-text {
  flex: 1;
}

.attachment-success {
  font-weight: bold;
}

.attachment-remove,
.attachments-clear {
  background: var(--neo-white);
  border: 2px solid var(--neo-black);
  border-radius: 4px;
  cursor: pointer;
  color: var(--neo-black);
  font-size: 12px;
  font-weight: 700;
  padding: 4px 6px;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.attachment-remove:hover,
.attachments-clear:hover {
  background: var(--neo-red);
  color: var(--neo-white);
}

/* 快捷生成按钮（与发送按钮并列，同尺寸） */
.quick-gen-btn {
  width: 36px;
  height: 36px;
  border: 2px solid var(--neo-black);
  border-radius: 8px;
  background: var(--neo-yellow);
  color: var(--neo-black);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 2px 2px 0 var(--neo-black);
  transition: all 0.15s;
}

.quick-gen-btn:hover:not(:disabled) {
  background: #f0d050;
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black);
}

.quick-gen-btn:active:not(:disabled) {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 var(--neo-black);
}

.quick-gen-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  box-shadow: 2px 2px 0 var(--neo-black);
}

/* 引用文档行 */
.ref-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px;
  background: var(--neo-pink-light);
  border: 2px solid var(--neo-black);
  border-radius: 8px;
  box-shadow: 3px 3px 0 var(--neo-black);
}

.ref-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--neo-blue-light);
  border: 2px solid var(--neo-primary);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--neo-primary);
}

.ref-chip-title {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ref-chip-remove,
.ref-chip-clear {
  background: var(--neo-white);
  border: 2px solid var(--neo-black);
  border-radius: 4px;
  cursor: pointer;
  color: var(--neo-black);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 6px;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.ref-chip-remove:hover,
.ref-chip-clear:hover {
  background: var(--neo-red);
  color: var(--neo-white);
}

/* 统一输入框容器 */
.input-box {
  position: relative;
  border: 3px solid var(--neo-black);
  border-radius: 12px;
  background: var(--neo-white);
  box-shadow: 4px 4px 0 var(--neo-black);
  transition: all 0.15s;
}

.input-box--focused {
  border-color: var(--neo-primary);
  box-shadow: 4px 4px 0 var(--neo-primary);
}

.unified-textarea {
  width: 100%;
  min-height: 56px;
  max-height: 120px;
  padding: 10px 90px 10px 16px;
  border: none;
  border-radius: 0 0 12px 12px;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  font-family: inherit;
  background: transparent;
  box-sizing: border-box;
}

.unified-textarea:focus {
  outline: none;
}

.unified-textarea:disabled {
  background: #f0f0f0;
  cursor: not-allowed;
}

.unified-textarea::placeholder {
  color: #888;
  font-weight: 500;
}

/* 按钮组 - 输入框右下角 */
.input-buttons {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: flex;
  gap: 6px;
  align-items: center;
}

/* 发送按钮 */
.send-btn {
  width: 36px;
  height: 36px;
  border: 2px solid var(--neo-black);
  border-radius: 8px;
  background: #d1d5db;
  color: var(--neo-white);
  font-size: 18px;
  font-weight: 800;
  cursor: not-allowed;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  box-shadow: 2px 2px 0 var(--neo-black);
}

.send-btn.can-send {
  background: var(--neo-primary);
  cursor: pointer;
}

.send-btn.can-send:hover {
  background: #4A5496;
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black);
}

.send-btn.can-send:active {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 var(--neo-black);
}

/* @ 引用弹窗 */
.ref-picker {
  position: absolute;
  bottom: 100%;
  left: 14px;
  right: 14px;
  max-height: 220px;
  background: var(--neo-white);
  border: 3px solid var(--neo-black);
  border-radius: 8px;
  box-shadow: 5px 5px 0 var(--neo-black);
  overflow: hidden;
  z-index: 100;
  margin-bottom: 8px;
}

.ref-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: var(--neo-purple);
  border-bottom: 2px solid var(--neo-black);
  font-size: 12px;
  font-weight: 700;
  color: var(--neo-black);
}

.ref-picker-close {
  background: var(--neo-white);
  border: 2px solid var(--neo-black);
  border-radius: 4px;
  cursor: pointer;
  padding: 4px;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--neo-black);
}

.ref-picker-close:hover {
  background: var(--neo-red);
  color: var(--neo-white);
}

.ref-picker-empty {
  padding: 24px;
  text-align: center;
  color: #666;
  font-size: 13px;
  font-weight: 600;
}

.ref-picker-list {
  max-height: 160px;
  overflow-y: auto;
}

.ref-picker-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 12px 14px;
  background: none;
  border: none;
  border-bottom: 2px solid var(--neo-cream);
  cursor: pointer;
  text-align: left;
  font-weight: 600;
  transition: all 0.15s;
}

.ref-picker-item:hover:not(:disabled) {
  background: var(--neo-yellow);
}

.ref-picker-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ref-picker-title {
  font-size: 13px;
  color: var(--neo-black);
}

.ref-picker-meta {
  font-size: 11px;
  color: var(--neo-white);
  background: var(--neo-primary);
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 700;
}

/* 操作行 */
.action-row {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
}

.action-btn {
  padding: 5px 10px;
  min-height: 30px;
  background: var(--neo-white);
  border: 2px solid var(--neo-black);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 2px 2px 0 var(--neo-black);
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

.action-btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black);
}

.action-btn:active:not(:disabled) {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 var(--neo-black);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: 1px 1px 0 var(--neo-black) ;
}

/* 各按钮独特颜色 */
.action-attach {
  background: var(--neo-purple);
  color: var(--neo-black);
}

.action-attach:hover:not(:disabled) {
  background: #8B8DC0;
}

.action-page {
  background: var(--neo-yellow);
  color: var(--neo-black);
}

.action-page:hover:not(:disabled) {
  background: #F5D54A;
}

.action-extract {
  background: var(--neo-green);
  color: var(--neo-black);
}

.action-extract:hover:not(:disabled) {
  background: #7AD97A;
}

.action-hint {
  background: var(--neo-pink-light);
  color: var(--neo-black);
}

.action-hint:hover:not(:disabled) {
  background: #FFCEDA;
}

/* 提示词弹窗 */
.hints-popup {
  position: absolute;
  bottom: 100%;
  right: 14px;
  width: 260px;
  background: var(--neo-white);
  border: 3px solid var(--neo-black);
  border-radius: 8px;
  box-shadow: 5px 5px 0 var(--neo-black);
  z-index: 100;
  margin-bottom: 8px;
}

.hints-popup-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: var(--neo-yellow);
  border-bottom: 2px solid var(--neo-black);
  font-size: 13px;
  font-weight: 700;
}

.hints-popup-header span {
  flex: 1;
}

.hints-close {
  background: var(--neo-white);
  border: 2px solid var(--neo-black);
  border-radius: 4px;
  cursor: pointer;
  padding: 4px;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--neo-black);
}

.hints-close:hover {
  background: var(--neo-red);
  color: var(--neo-white);
}

.hints-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px;
}

.hint-item {
  padding: 8px 12px;
  background: var(--neo-cream);
  border: 2px solid var(--neo-black);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--neo-black);
  cursor: pointer;
  box-shadow: 2px 2px 0 var(--neo-black);
  transition: all 0.15s;
}

.hint-item:hover {
  background: var(--neo-purple);
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black);
}
</style>
