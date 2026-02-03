<template>
  <div class="document-panel">
    <div class="panel-header">
      <div class="panel-title">
        <span class="title-icon">📄</span>
        <span>文档</span>
      </div>
      <div class="panel-actions">
        <button class="btn-icon" @click="refresh" :disabled="isLoading" title="刷新">
          <span :class="{ 'spinning': isLoading }">🔄</span>
        </button>
        <button class="btn-icon" @click="$emit('upload')" title="上传">+</button>
      </div>
    </div>

    <div class="panel-content">
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
      </div>

      <div v-else-if="documents.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">暂无文档</div>
        <button class="btn-small" @click="$emit('upload')">上传文档</button>
      </div>

      <div v-else class="doc-sections">
        <!-- 主文档 -->
        <div v-if="mainDocs.length > 0" class="doc-section">
          <div class="section-header">主文档</div>
          <div class="doc-list">
            <DocumentCard
              v-for="doc in mainDocs"
              :key="doc.id"
              :doc="doc"
              :active="activeDocId === doc.id"
              :selected="selectedDocIds.includes(doc.id)"
              @click="handleDocClick(doc)"
              @select="handleDocSelect(doc)"
              @edit="handleDocEdit(doc)"
            />
          </div>
        </div>

        <!-- 输出文档 -->
        <div v-if="outputDocs.length > 0" class="doc-section">
          <div class="section-header">生成结果</div>
          <div class="doc-list">
            <DocumentCard
              v-for="doc in outputDocs"
              :key="doc.id"
              :doc="doc"
              :active="activeDocId === doc.id"
              :selected="selectedDocIds.includes(doc.id)"
              @click="handleDocClick(doc)"
              @select="handleDocSelect(doc)"
              @edit="handleDocEdit(doc)"
            />
          </div>
        </div>

        <!-- 辅助文档 -->
        <div v-if="auxDocs.length > 0" class="doc-section">
          <div class="section-header">辅助文档</div>
          <div class="doc-list">
            <DocumentCard
              v-for="doc in auxDocs"
              :key="doc.id"
              :doc="doc"
              :active="activeDocId === doc.id"
              :selected="selectedDocIds.includes(doc.id)"
              @click="handleDocClick(doc)"
              @select="handleDocSelect(doc)"
              @edit="handleDocEdit(doc)"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedDocIds.length > 0" class="panel-footer">
      <span>已选择 {{ selectedDocIds.length }} 个文档</span>
      <button class="btn-link" @click="clearSelection">取消全选</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useDocuments, type LocalDocument } from '@/composables';
import DocumentCard from './DocumentCard.vue';

const props = defineProps<{
  sessionId: string;
}>();

const emit = defineEmits<{
  upload: [];
  docClick: [doc: LocalDocument];
  docEdit: [doc: LocalDocument];
  selectionChange: [docIds: string[]];
}>();

const {
  documents,
  mainDocuments,
  auxDocuments,
  outputDocuments,
  isLoading,
  loadSessionDocuments,
  toggleDocumentSelection,
  clearSelection: clearDocSelection,
  setActiveDocument
} = useDocuments();

const activeDocId = ref<string | null>(null);
const selectedDocIds = ref<string[]>([]);

// 分类文档
const mainDocs = computed(() => mainDocuments.value);
const auxDocs = computed(() => auxDocuments.value);
const outputDocs = computed(() => outputDocuments.value);

// 处理文档点击
function handleDocClick(doc: LocalDocument) {
  activeDocId.value = doc.id;
  setActiveDocument(doc.id);
  emit('docClick', doc);
}

// 处理文档选择
function handleDocSelect(doc: LocalDocument) {
  toggleDocumentSelection(doc.id);

  const idx = selectedDocIds.value.indexOf(doc.id);
  if (idx === -1) {
    selectedDocIds.value.push(doc.id);
  } else {
    selectedDocIds.value.splice(idx, 1);
  }

  emit('selectionChange', selectedDocIds.value);
}

// 处理文档编辑
function handleDocEdit(doc: LocalDocument) {
  emit('docEdit', doc);
}

// 清除选择
function clearSelection() {
  selectedDocIds.value = [];
  clearDocSelection();
  emit('selectionChange', []);
}

// 刷新
function refresh() {
  loadSessionDocuments();
}

// 监听 sessionId 变化
watch(() => props.sessionId, () => {
  if (props.sessionId) {
    loadSessionDocuments();
  }
}, { immediate: true });

defineExpose({ refresh });
</script>

<style scoped>
.document-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
}

.title-icon {
  font-size: 18px;
}

.panel-actions {
  display: flex;
  gap: 4px;
}

.btn-icon {
  background: none;
  border: 1px solid #e5e7eb;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-icon:hover:not(:disabled) {
  background: #f3f4f6;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top-color: #5D6AB4;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #6b7280;
  gap: 12px;
}

.empty-icon {
  font-size: 40px;
}

.empty-text {
  font-size: 14px;
}

.btn-small {
  padding: 6px 14px;
  background: #5D6AB4;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.doc-sections {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.doc-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-header {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.doc-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.panel-footer {
  padding: 10px 16px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #6b7280;
}

.btn-link {
  background: none;
  border: none;
  color: #5D6AB4;
  cursor: pointer;
  font-size: 12px;
}

.btn-link:hover {
  text-decoration: underline;
}
</style>
