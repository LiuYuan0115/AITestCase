<template>
  <div class="knowledge-base-panel">
    <div class="panel-header">
      <div class="panel-title">
        <span class="title-icon">📚</span>
        <span>知识库</span>
      </div>
      <div class="panel-actions">
        <button class="btn-icon" @click="refresh" :disabled="isLoading" title="刷新">
          <span :class="{ 'spinning': isLoading }">🔄</span>
        </button>
        <button class="btn-icon" @click="$emit('upload')" title="上传文档">+</button>
      </div>
    </div>

    <div class="search-box">
      <input
        type="text"
        v-model="searchQuery"
        placeholder="🔍 搜索知识库..."
        @input="handleSearch"
      />
    </div>

    <div class="panel-content">
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>

      <div v-else-if="filteredGroups.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">暂无知识库文档</div>
        <button class="btn-upload" @click="$emit('upload')">上传文档</button>
      </div>

      <div v-else class="doc-groups">
        <div
          v-for="group in filteredGroups"
          :key="group.name"
          class="doc-group"
        >
          <div
            class="group-header"
            @click="toggleGroup(group.name)"
          >
            <span class="group-icon">{{ group.expanded ? '📂' : '📁' }}</span>
            <span class="group-name">{{ group.name }}</span>
            <span class="group-count">{{ group.docs.length }}</span>
          </div>

          <div v-if="group.expanded" class="group-docs">
            <div
              v-for="doc in group.docs"
              :key="doc.docId"
              class="doc-item"
              :class="{ 'selected': selectedDocIds.includes(doc.docId) }"
              @click="toggleSelect(doc)"
            >
              <span class="doc-icon">{{ getDocIcon(doc.contentType) }}</span>
              <div class="doc-info">
                <div class="doc-title">{{ doc.title || '(无标题)' }}</div>
                <div class="doc-meta">
                  <span class="doc-size">{{ formatSize(doc.length || 0) }}</span>
                  <span v-if="doc.createdAt" class="doc-date">{{ formatDate(doc.createdAt) }}</span>
                </div>
              </div>
              <div class="doc-actions">
                <button class="btn-tiny" @click.stop="previewDoc(doc)" title="预览">👁</button>
                <button class="btn-tiny btn-delete" @click.stop="confirmDeleteDoc(doc)" title="删除">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel-footer">
      <div class="stats">
        已索引: {{ totalChunks }} 个文档片段
      </div>
      <div v-if="lastUpdated" class="last-updated">
        更新: {{ formatDate(lastUpdated) }}
      </div>
    </div>

    <!-- 预览弹窗 -->
    <div v-if="previewingDoc" class="preview-overlay" @click.self="previewingDoc = null">
      <div class="preview-modal">
        <div class="preview-header">
          <h4>{{ previewingDoc?.title }}</h4>
          <button @click="previewingDoc = null">×</button>
        </div>
        <div class="preview-content">
          <div v-if="previewLoading" class="loading-state">加载中...</div>
          <pre v-else>{{ previewContent }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getAgentUrl, buildHeaders } from '@/utils/agentUrl';
import { deleteDoc } from '@/utils/docStoreApi';

interface KnowledgeDoc {
  docId: string;
  title?: string;
  category?: string;
  contentType?: string;
  length?: number;
  createdAt?: number;
}

interface DocGroup {
  name: string;
  docs: KnowledgeDoc[];
  expanded: boolean;
}

const props = defineProps<{
  sessionId: string;
}>();

const emit = defineEmits<{
  upload: [];
  select: [docs: KnowledgeDoc[]];
}>();

const AGENT_URL = getAgentUrl();

const isLoading = ref(false);
const searchQuery = ref('');
const allDocs = ref<KnowledgeDoc[]>([]);
const groups = ref<DocGroup[]>([]);
const selectedDocIds = ref<string[]>([]);
const totalChunks = ref(0);
const lastUpdated = ref<number | null>(null);

const previewingDoc = ref<KnowledgeDoc | null>(null);
const previewContent = ref('');
const previewLoading = ref(false);
const deletingDocId = ref<string | null>(null);

// 根据搜索过滤分组
const filteredGroups = computed(() => {
  if (!searchQuery.value.trim()) {
    return groups.value;
  }

  const query = searchQuery.value.toLowerCase();
  return groups.value
    .map(group => ({
      ...group,
      docs: group.docs.filter(doc =>
        doc.title?.toLowerCase().includes(query) ||
        doc.category?.toLowerCase().includes(query)
      )
    }))
    .filter(group => group.docs.length > 0);
});

// 加载知识库文档（带 API 降级处理）
async function loadKnowledgeDocs() {
  isLoading.value = true;
  try {
    // 优先使用知识库专用接口
    let res = await fetch(`${AGENT_URL}/api/knowledge/list`, {
      headers: buildHeaders()
    });

    // 如果 404，降级到会话文档接口
    if (!res.ok && (res.status === 404 || res.status === 501)) {
      console.warn('[KnowledgeBasePanel] /api/knowledge/list not found, fallback to session docs');
      if (props.sessionId) {
        res = await fetch(`${AGENT_URL}/api/sessions/${props.sessionId}/docs`, {
          headers: buildHeaders()
        });
      }
    }

    if (res.ok) {
      const data = await res.json();
      // 兼容两种响应格式
      const docs = data.docs || data.documents || [];
      allDocs.value = docs.map((doc: any) => ({
        docId: doc.docId || doc.id,
        title: doc.title || doc.name || '未命名文档',
        category: doc.category || doc.kind || '会话文档',
        contentType: doc.contentType || 'text/markdown',
        length: doc.length || 0,
        createdAt: doc.createdAt || Date.now() / 1000
      }));
      totalChunks.value = data.totalChunks || allDocs.value.length;
      lastUpdated.value = data.lastUpdated || Date.now() / 1000;

      // 按分类分组
      groupDocs();
    } else {
      console.error('[KnowledgeBasePanel] Load failed:', res.status, res.statusText);
    }
  } catch (e) {
    console.error('[KnowledgeBasePanel] Load error:', e);
  } finally {
    isLoading.value = false;
  }
}

// 按分类分组文档
function groupDocs() {
  const categoryMap = new Map<string, KnowledgeDoc[]>();

  for (const doc of allDocs.value) {
    const category = doc.category || '未分类';
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(doc);
  }

  groups.value = Array.from(categoryMap.entries()).map(([name, docs]) => ({
    name,
    docs,
    expanded: true
  }));
}

// 切换分组展开
function toggleGroup(name: string) {
  const group = groups.value.find(g => g.name === name);
  if (group) {
    group.expanded = !group.expanded;
  }
}

// 切换选择文档
function toggleSelect(doc: KnowledgeDoc) {
  const idx = selectedDocIds.value.indexOf(doc.docId);
  if (idx === -1) {
    selectedDocIds.value.push(doc.docId);
  } else {
    selectedDocIds.value.splice(idx, 1);
  }

  // 通知父组件
  const selectedDocs = allDocs.value.filter(d =>
    selectedDocIds.value.includes(d.docId)
  );
  emit('select', selectedDocs);
}

// 预览文档
async function previewDoc(doc: KnowledgeDoc) {
  previewingDoc.value = doc;
  previewLoading.value = true;
  previewContent.value = '';

  try {
    const res = await fetch(`${AGENT_URL}/api/docs/${doc.docId}`, {
      headers: buildHeaders()
    });

    if (res.ok) {
      const data = await res.json();
      previewContent.value = data.content || '(无内容)';
    }
  } catch (e) {
    previewContent.value = '加载失败';
  } finally {
    previewLoading.value = false;
  }
}

// 确认删除文档
function confirmDeleteDoc(doc: KnowledgeDoc) {
  if (confirm(`确定要删除文档「${doc.title || doc.docId}」吗？此操作不可撤销。`)) {
    handleDeleteDoc(doc);
  }
}

// 删除文档
async function handleDeleteDoc(doc: KnowledgeDoc) {
  deletingDocId.value = doc.docId;
  try {
    await deleteDoc(doc.docId, props.sessionId);
    // 从本地列表中移除
    allDocs.value = allDocs.value.filter(d => d.docId !== doc.docId);
    selectedDocIds.value = selectedDocIds.value.filter(id => id !== doc.docId);
    // 重新分组
    groupDocs();
    // 更新统计
    totalChunks.value = Math.max(0, totalChunks.value - 1);
  } catch (e) {
    console.error('[KnowledgeBasePanel] Delete error:', e);
    alert('删除失败: ' + (e instanceof Error ? e.message : '未知错误'));
  } finally {
    deletingDocId.value = null;
  }
}

// 刷新
function refresh() {
  loadKnowledgeDocs();
}

// 搜索防抖
let searchTimer: ReturnType<typeof setTimeout> | null = null;
function handleSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    // 搜索逻辑已在 computed 中处理
  }, 300);
}

// 格式化工具
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('zh-CN');
}

function getDocIcon(contentType?: string): string {
  if (!contentType) return '📄';
  if (contentType.includes('pdf')) return '📕';
  if (contentType.includes('image')) return '🖼️';
  if (contentType.includes('markdown')) return '📝';
  if (contentType.includes('excel') || contentType.includes('spreadsheet')) return '📊';
  return '📄';
}

onMounted(() => {
  loadKnowledgeDocs();
});

defineExpose({ refresh });
</script>

<style scoped>
.knowledge-base-panel {
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

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.search-box {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.search-box input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.search-box input:focus {
  border-color: #5D6AB4;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #6b7280;
  gap: 12px;
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
  font-size: 48px;
}

.empty-text {
  font-size: 14px;
}

.btn-upload {
  padding: 8px 16px;
  background: #5D6AB4;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.doc-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.doc-group {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: #f9fafb;
  cursor: pointer;
  gap: 8px;
  transition: background 0.2s;
}

.group-header:hover {
  background: #f3f4f6;
}

.group-icon {
  font-size: 16px;
}

.group-name {
  flex: 1;
  font-weight: 500;
  font-size: 13px;
}

.group-count {
  background: #e5e7eb;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  color: #6b7280;
}

.group-docs {
  border-top: 1px solid #e5e7eb;
}

.doc-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  gap: 10px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #f3f4f6;
}

.doc-item:last-child {
  border-bottom: none;
}

.doc-item:hover {
  background: #f9fafb;
}

.doc-item.selected {
  background: #eff6ff;
}

.doc-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.doc-info {
  flex: 1;
  min-width: 0;
}

.doc-title {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}

.doc-actions {
  flex-shrink: 0;
}

.btn-tiny {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.btn-tiny:hover {
  opacity: 1;
}

.btn-tiny.btn-delete:hover {
  color: #dc2626;
}

.panel-footer {
  padding: 10px 16px;
  border-top: 1px solid #e5e7eb;
  font-size: 11px;
  color: #9ca3af;
  display: flex;
  justify-content: space-between;
}

.preview-overlay {
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

.preview-modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.preview-header h4 {
  margin: 0;
  font-size: 16px;
}

.preview-header button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
}

.preview-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.preview-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.5;
}
</style>
