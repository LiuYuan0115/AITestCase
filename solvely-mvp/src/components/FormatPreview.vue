<template>
  <div class="format-preview">
    <!-- 格式切换工具栏 -->
    <div class="format-toolbar">
      <div class="format-buttons">
        <button
          v-for="fmt in formats"
          :key="fmt.value"
          :class="['format-btn', { active: currentFormat === fmt.value }]"
          @click="switchFormat(fmt.value)"
          v-tooltip="fmt.label"
        >
          <span class="format-icon">{{ fmt.icon }}</span>
          <span class="format-label">{{ fmt.label }}</span>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <button class="action-btn" @click="copyContent" v-tooltip="'复制'">
          {{ isCopied ? '✅ 已复制' : '📋 复制' }}
        </button>
        <div class="export-wrapper">
          <button class="action-btn" @click="exportContent" v-tooltip="'导出'">
            💾 导出
          </button>
          <!-- 表格格式的导出选项菜单 -->
          <div v-if="showExportMenu && currentFormat === 'table'" class="export-menu">
            <button class="export-menu-item" @click="exportAsMarkdown">
              📝 Markdown 表格 (.md)
            </button>
            <button class="export-menu-item" @click="exportAsCSV">
              📊 CSV 文件 (.csv)
            </button>
          </div>
        </div>
        <button
          v-if="enableEdit"
          class="action-btn"
          @click="toggleEdit"
          :class="{ active: isEditing }"
          v-tooltip="'编辑'"
        >
          {{ isEditing ? '✅ 完成' : '✏️ 编辑' }}
        </button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="preview-content">
      <!-- 思维导图 -->
      <MindMapPreview
        v-if="currentFormat === 'mindmap'"
        :content="content"
        :type="contentType === 'testpoint' ? 'test_point' : 'test_case'"
      />

      <!-- 表格视图 -->
      <div v-else-if="currentFormat === 'table'" class="table-view">
        <div v-if="isEditing" class="table-editor">
          <textarea
            v-model="editableContent"
            class="edit-textarea"
            placeholder="编辑表格内容..."
          ></textarea>
        </div>
        <div v-else class="table-readonly" v-html="renderedTable"></div>
      </div>

      <!-- YAML 视图 -->
      <div v-else-if="currentFormat === 'yaml'" class="yaml-view">
        <textarea
          v-if="isEditing"
          v-model="editableContent"
          class="edit-textarea yaml-editor"
          placeholder="编辑 YAML..."
        ></textarea>
        <pre v-else class="yaml-display"><code>{{ formattedYaml }}</code></pre>
      </div>

      <!-- JSON 视图 -->
      <div v-else-if="currentFormat === 'json'" class="json-view">
        <textarea
          v-if="isEditing"
          v-model="editableContent"
          class="edit-textarea json-editor"
          placeholder="编辑 JSON..."
        ></textarea>
        <pre v-else class="json-display"><code>{{ formattedJson }}</code></pre>
      </div>

      <!-- Markdown 视图 -->
      <div v-else class="markdown-view">
        <textarea
          v-if="isEditing"
          v-model="editableContent"
          class="edit-textarea markdown-editor"
          placeholder="编辑 Markdown..."
        ></textarea>
        <div v-else class="markdown-display" v-html="renderedMarkdown"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { marked } from 'marked';
import MindMapPreview from './MindMapPreview.vue';
import {
  formatContent,
  convertToTable,
  convertToYaml,
  convertToJson,
  convertToCSV,
  getFileExtension,
  getMimeType,
} from '@/utils/formatConverter';
import { preferences, type OutputFormatType, type ContentType } from '@/utils/preferences';

const props = defineProps<{
  content: string;
  contentType: ContentType;
  enableEdit?: boolean;
  initialFormat?: OutputFormatType;
}>();

const emit = defineEmits<{
  (e: 'update:content', value: string): void;
  (e: 'format-change', format: OutputFormatType): void;
}>();

// 格式选项
const formats = [
  { value: 'mindmap' as const, label: '思维导图', icon: '🗺️' },
  { value: 'table' as const, label: '表格', icon: '📊' },
  { value: 'yaml' as const, label: 'YAML', icon: '📄' },
  { value: 'json' as const, label: 'JSON', icon: '{ }' },
  { value: 'markdown' as const, label: 'Markdown', icon: '📝' },
];

// 状态
const currentFormat = ref<OutputFormatType>(props.initialFormat || 'mindmap');
const isEditing = ref(false);
const isCopied = ref(false);
const editableContent = ref('');
const showExportMenu = ref(false);

// 格式化内容
const renderedMarkdown = computed(() => {
  try {
    return marked(props.content);
  } catch {
    return props.content;
  }
});

const renderedTable = computed(() => {
  const tableMarkdown = convertToTable(props.content, props.contentType);
  try {
    return marked(tableMarkdown);
  } catch {
    return `<pre>${tableMarkdown}</pre>`;
  }
});

const formattedYaml = computed(() => {
  return convertToYaml(props.content, props.contentType);
});

const formattedJson = computed(() => {
  return convertToJson(props.content, props.contentType);
});

// 格式切换
function switchFormat(format: OutputFormatType) {
  currentFormat.value = format;
  isEditing.value = false;
  emit('format-change', format);

  // 持久化到 localStorage
  preferences.setFormat(props.contentType, format);
}

// 编辑切换
function toggleEdit() {
  if (isEditing.value) {
    // 完成编辑
    emit('update:content', editableContent.value);
  } else {
    // 开始编辑
    editableContent.value = getFormattedContent();
  }
  isEditing.value = !isEditing.value;
}

// 复制内容
async function copyContent() {
  const content = getFormattedContent();
  try {
    await navigator.clipboard.writeText(content);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

// 导出内容
function exportContent() {
  // 表格格式支持多种导出选项
  if (currentFormat.value === 'table') {
    showExportMenu.value = !showExportMenu.value;
  } else {
    doExport(currentFormat.value);
  }
}

// 执行导出
function doExport(format: string, asCSV = false) {
  showExportMenu.value = false;

  let content: string;
  let ext: string;
  let mimeType: string;

  if (asCSV) {
    // 导出为 CSV（Excel 兼容）
    content = convertToCSV(props.content, props.contentType);
    ext = 'csv';
    mimeType = 'text/csv;charset=utf-8';
  } else {
    content = formatContent(props.content, format as any, props.contentType);
    ext = getFileExtension(format);
    mimeType = getMimeType(format);
  }

  const filename = `${props.contentType}_${Date.now()}.${ext}`;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 导出为 Markdown 表格
function exportAsMarkdown() {
  doExport('table', false);
}

// 导出为 CSV
function exportAsCSV() {
  doExport('table', true);
}

// 获取格式化后的内容
function getFormattedContent(): string {
  return formatContent(props.content, currentFormat.value, props.contentType);
}

// 初始化时加载保存的格式偏好
onMounted(() => {
  const savedFormat = preferences.getFormat(props.contentType);
  if (savedFormat) {
    currentFormat.value = savedFormat;
  }
});

// 监听 contentType 变化，加载对应的格式偏好
watch(
  () => props.contentType,
  (newType) => {
    const savedFormat = preferences.getFormat(newType);
    if (savedFormat) {
      currentFormat.value = savedFormat;
    }
  }
);
</script>

<style scoped>
.format-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.format-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  gap: 8px;
  flex-wrap: wrap;
}

.format-buttons {
  display: flex;
  gap: 4px;
}

.format-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid #dcdfe6;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.format-btn:hover {
  border-color: #409eff;
  color: #409eff;
}

.format-btn.active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}

.format-icon {
  font-size: 14px;
}

.format-label {
  font-size: 12px;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: #dcdfe6;
  margin: 0 8px;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

.action-btn {
  padding: 6px 12px;
  border: 1px solid #dcdfe6;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.action-btn:hover {
  border-color: #409eff;
  color: #409eff;
}

.action-btn.active {
  background: #67c23a;
  border-color: #67c23a;
  color: #fff;
}

.preview-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.table-view,
.yaml-view,
.json-view,
.markdown-view {
  height: 100%;
}

.table-readonly {
  overflow: auto;
}

.table-readonly :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table-readonly :deep(th),
.table-readonly :deep(td) {
  border: 1px solid #e4e7ed;
  padding: 8px 12px;
  text-align: left;
}

.table-readonly :deep(th) {
  background: #f5f7fa;
  font-weight: 600;
}

.table-readonly :deep(tr:hover) {
  background: #f5f7fa;
}

.yaml-display,
.json-display {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 4px;
  overflow: auto;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}

.markdown-display {
  line-height: 1.6;
}

.markdown-display :deep(h1),
.markdown-display :deep(h2),
.markdown-display :deep(h3),
.markdown-display :deep(h4),
.markdown-display :deep(h5),
.markdown-display :deep(h6) {
  margin-top: 16px;
  margin-bottom: 8px;
}

.markdown-display :deep(ul),
.markdown-display :deep(ol) {
  padding-left: 24px;
}

.edit-textarea {
  width: 100%;
  height: 100%;
  min-height: 300px;
  padding: 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
}

.yaml-editor,
.json-editor {
  background: #1e1e1e;
  color: #d4d4d4;
}

/* 导出菜单样式 */
.export-wrapper {
  position: relative;
}

.export-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  min-width: 160px;
}

.export-menu-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  text-align: left;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.export-menu-item:hover {
  background: #f5f7fa;
}

.export-menu-item:first-child {
  border-radius: 4px 4px 0 0;
}

.export-menu-item:last-child {
  border-radius: 0 0 4px 4px;
}
</style>
