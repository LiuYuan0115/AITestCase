<template>
  <div class="knowledge-base-panel">
    <div class="panel-header">
      <div class="panel-title">
        <Library :size="18" class="title-icon" />
        <span>知识库</span>
      </div>
      <div class="panel-actions">
        <!-- 全选按钮 -->
        <button
          v-if="!isLoading && allDocs.length > 0"
          class="btn-icon"
          @click="toggleSelectAll"
          v-tooltip="isAllSelected ? '取消全选' : '全选'"
        >
          <CheckSquare v-if="isAllSelected" :size="16" />
          <Square v-else :size="16" />
        </button>
        <!-- 批量删除按钮 -->
        <button
          v-if="selectedDocIds.length > 0"
          class="btn-icon btn-delete-batch"
          @click="confirmBatchDelete"
          :disabled="isBatchDeleting"
          v-tooltip="'批量删除选中项'"
        >
          <Loader2 v-if="isBatchDeleting" :size="16" class="spinning" />
          <Trash2 v-else :size="16" />
          <span class="badge">{{ selectedDocIds.length }}</span>
        </button>
        <!-- 分类管理按钮 -->
        <button
          class="btn-icon"
          @click="showCategoryManager = true"
          v-tooltip="'管理分类'"
        >
          <Settings :size="16" />
        </button>
        <button
          class="btn-icon"
          @click="refresh"
          :disabled="isLoading"
          v-tooltip="'刷新列表'"
        >
          <Loader2 v-if="isLoading" :size="16" class="spinning" />
          <RefreshCw v-else :size="16" />
        </button>
        <button
          class="btn-icon btn-icon-primary"
          @click="$emit('upload')"
          v-tooltip="'上传文档'"
        >
          <Plus :size="16" />
        </button>
      </div>
    </div>

    <div class="search-box">
      <div class="search-input-wrapper">
        <Search :size="16" class="search-icon" />
        <input
          type="text"
          v-model="searchQuery"
          placeholder="搜索知识库..."
          @input="handleSearch"
        />
        <button
          v-if="searchQuery"
          class="search-clear"
          @click="searchQuery = ''"
          v-tooltip="'清空搜索'"
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <div class="panel-content">
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>

      <div v-else-if="filteredGroups.length === 0" class="empty-state">
        <FolderOpen :size="48" class="empty-icon" />
        <div class="empty-title">知识库为空</div>
        <div class="empty-text">上传 PRD 或其他参考文档<br/>开始智能测试用例生成</div>
        <button
          class="btn-upload"
          @click="$emit('upload')"
          v-tooltip="'上传 PDF、图片或文本文档'"
        >
          <Upload :size="16" />
          <span>上传文档</span>
        </button>
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
            v-tooltip="group.expanded ? '收起' : '展开'"
          >
            <component
              :is="group.expanded ? ChevronDown : ChevronUp"
              :size="16"
              class="group-chevron"
            />
            <component
              :is="group.expanded ? FolderOpen : Folder"
              :size="16"
              class="group-icon"
            />
            <span class="group-name">{{ group.name }}</span>
            <span class="group-count">{{ group.docs.length }}</span>
          </div>

          <div v-if="group.expanded" class="group-docs">
            <div
              v-for="doc in group.docs"
              :key="doc.docId"
              class="doc-item"
              :class="{ 'selected': selectedDocIds.includes(doc.docId) }"
              @click="handleDocClick(doc)"
              v-tooltip="'点击添加到对话'"
            >
              <!-- 复选框 -->
              <div class="doc-checkbox" @click.stop="toggleSelectDoc(doc.docId)">
                <CheckSquare v-if="selectedDocIds.includes(doc.docId)" :size="18" />
                <Square v-else :size="18" />
              </div>
              <component :is="getDocIconComponent(doc.contentType)" :size="20" class="doc-icon" />
              <div class="doc-info">
                <div class="doc-title">{{ doc.title || '(无标题)' }}</div>
                <div class="doc-meta">
                  <span class="doc-size">{{ formatSize(doc.length || 0) }}</span>
                  <span v-if="doc.createdAt" class="doc-date">{{ formatDate(doc.createdAt) }}</span>
                </div>
              </div>
              <div class="doc-actions">
                <button
                  class="btn-tiny"
                  @click.stop="previewDoc(doc)"
                  v-tooltip="'预览文档'"
                >
                  <Eye :size="16" />
                </button>
                <button
                  class="btn-tiny btn-delete"
                  @click.stop="confirmDeleteDoc(doc)"
                  v-tooltip="'删除文档'"
                >
                  <Trash2 :size="16" />
                </button>
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

    <!-- 分类管理弹窗 -->
    <div v-if="showCategoryManager" class="category-manager-overlay" @click.self="showCategoryManager = false">
      <div class="category-manager-modal">
        <div class="category-header">
          <h4>分类管理</h4>
          <button class="close-btn" @click="showCategoryManager = false">
            <X :size="20" />
          </button>
        </div>
        <div class="category-content">
          <!-- 添加新分类 -->
          <div class="add-category-row">
            <input
              v-model="newCategoryName"
              type="text"
              placeholder="输入新分类名称..."
              @keyup.enter="handleAddCategory"
            />
            <button class="btn-add" @click="handleAddCategory" :disabled="!newCategoryName.trim()">
              <Plus :size="16" />
              添加
            </button>
          </div>

          <!-- 分类列表 -->
          <div class="category-list">
            <div
              v-for="cat in allCategories"
              :key="cat"
              class="category-item"
              :class="{ 'is-default': isDefaultCategory(cat) }"
            >
              <!-- 编辑模式 -->
              <template v-if="editingCategory === cat">
                <input
                  v-model="editCategoryNewName"
                  type="text"
                  class="edit-input"
                  @keyup.enter="handleUpdateCategory"
                  @keyup.escape="editingCategory = null"
                />
                <div class="category-actions">
                  <button class="btn-tiny btn-save" @click="handleUpdateCategory">
                    <CheckSquare :size="16" />
                  </button>
                  <button class="btn-tiny" @click="editingCategory = null">
                    <X :size="16" />
                  </button>
                </div>
              </template>
              <!-- 显示模式 -->
              <template v-else>
                <span class="category-name-display">
                  {{ cat }}
                  <span v-if="isDefaultCategory(cat)" class="default-badge">默认</span>
                </span>
                <div class="category-actions" v-if="!isDefaultCategory(cat)">
                  <button class="btn-tiny" @click="startEditCategory(cat)" v-tooltip="'编辑'">
                    <Edit2 :size="14" />
                  </button>
                  <button class="btn-tiny btn-delete" @click="handleDeleteCategory(cat)" v-tooltip="'删除'">
                    <Trash2 :size="14" />
                  </button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 预览弹窗 -->
    <div v-if="previewingDoc" class="preview-overlay" @click.self="previewingDoc = null">
      <div class="preview-modal" :class="{ 'preview-modal-wide': previewImages.length > 0 }">
        <div class="preview-header">
          <h4>{{ previewingDoc?.title }}</h4>
          <div class="preview-tabs" v-if="previewImages.length > 0 && previewContent">
            <button
              :class="{ 'active': previewMode === 'image' }"
              @click="previewMode = 'image'"
              v-tooltip="'查看图片预览'"
            >
              <Image :size="14" />
              <span>图片预览</span>
            </button>
            <button
              :class="{ 'active': previewMode === 'text' }"
              @click="previewMode = 'text'"
              v-tooltip="'查看文本内容'"
            >
              <FileText :size="14" />
              <span>文本内容</span>
            </button>
          </div>
          <button class="close-btn" @click="previewingDoc = null" v-tooltip="'关闭'">
            <X :size="20" />
          </button>
        </div>
        <div class="preview-content">
          <div v-if="previewLoading" class="loading-state">加载中...</div>
          <!-- 图片预览模式 -->
          <div v-else-if="previewImages.length > 0 && previewMode === 'image'" class="image-preview">
            <div v-for="(img, idx) in previewImages" :key="idx" class="image-page">
              <div class="page-label">第 {{ img.page_num || idx + 1 }} 页</div>
              <img
                :src="`data:${img.media_type || 'image/png'};base64,${img.base64}`"
                :alt="`页面 ${img.page_num || idx + 1}`"
              />
            </div>
          </div>
          <!-- 文本预览模式 -->
          <pre v-else>{{ previewContent || '(无文本内容)' }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getAgentUrl, buildHeaders } from '@/utils/agentUrl';
import { deleteDoc, getCategories, addCategory, updateCategory, deleteCategory, batchDeleteDocs } from '@/utils/docStoreApi';

// Lucide Icons
import {
  Library,
  RefreshCw,
  Plus,
  Search,
  X,
  FolderOpen,
  Folder,
  Eye,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  File,
  Image,
  Upload,
  Loader2,
  Settings,
  Edit2,
  CheckSquare,
  Square,
} from 'lucide-vue-next';

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
  'add-to-chat': [doc: KnowledgeDoc];
}>();

const AGENT_URL = getAgentUrl();

// 将旧的 kind 值映射到新的分类名称
function mapCategory(category?: string, kind?: string): string {
  // 无效的分类值（这些是 kind 值，不是分类）
  const invalidCategories = ['main', 'aux', 'output', 'knowledge'];

  // 优先使用有效的 category
  if (category && !invalidCategories.includes(category)) {
    return category;
  }

  // 兼容旧的 kind 值映射
  const kindMapping: Record<string, string> = {
    main: 'prd',
    aux: 'prd',
    output: '测试用例',
    knowledge: '其他',  // knowledge kind 默认归入"其他"分类
  };

  if (kind && kindMapping[kind]) {
    return kindMapping[kind];
  }

  return '其他';
}

const isLoading = ref(false);
const searchQuery = ref('');
const allDocs = ref<KnowledgeDoc[]>([]);
const groups = ref<DocGroup[]>([]);
const selectedDocIds = ref<string[]>([]);
const totalChunks = ref(0);
const lastUpdated = ref<number | null>(null);

const previewingDoc = ref<KnowledgeDoc | null>(null);
const previewContent = ref('');
const previewImages = ref<Array<{ base64: string; media_type?: string; page_num?: number }>>([]);
const previewMode = ref<'image' | 'text'>('image');
const previewLoading = ref(false);
const deletingDocId = ref<string | null>(null);

// 分类管理相关
const showCategoryManager = ref(false);
const allCategories = ref<string[]>([]);
const defaultCategories = ref<string[]>([]);
const newCategoryName = ref('');
const editingCategory = ref<string | null>(null);
const editCategoryNewName = ref('');

// 批量删除相关
const isBatchDeleting = ref(false);

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
        category: mapCategory(doc.category, doc.kind),
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

// 分类排序优先级
const CATEGORY_ORDER = ['prd', '测试用例', '测试点', '其他'];

// 按分类分组文档
function groupDocs() {
  const categoryMap = new Map<string, KnowledgeDoc[]>();

  for (const doc of allDocs.value) {
    const category = doc.category || '其他';
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(doc);
  }

  // 按优先级排序分组
  const sortedGroups = Array.from(categoryMap.entries())
    .sort((a, b) => {
      const orderA = CATEGORY_ORDER.indexOf(a[0]);
      const orderB = CATEGORY_ORDER.indexOf(b[0]);
      // 未在列表中的分类排在最后
      const indexA = orderA === -1 ? CATEGORY_ORDER.length : orderA;
      const indexB = orderB === -1 ? CATEGORY_ORDER.length : orderB;
      return indexA - indexB;
    })
    .map(([name, docs]) => ({
      name,
      docs,
      expanded: true
    }));

  groups.value = sortedGroups;
}

// 切换分组展开
function toggleGroup(name: string) {
  const group = groups.value.find(g => g.name === name);
  if (group) {
    group.expanded = !group.expanded;
  }
}

// 点击文档项 -> 添加到对话输入框
function handleDocClick(doc: KnowledgeDoc) {
  emit('add-to-chat', doc);
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
  previewImages.value = [];
  previewMode.value = 'image'; // 默认显示图片模式

  try {
    const res = await fetch(`${AGENT_URL}/api/docs/${doc.docId}`, {
      headers: buildHeaders()
    });

    if (res.ok) {
      const data = await res.json();
      previewContent.value = data.content || '';

      // 检查是否有图片数据（PDF/图片类型的多模态文档）
      if (data.images && data.images.length > 0) {
        previewImages.value = data.images;
        previewMode.value = 'image';
      } else if (previewContent.value) {
        // 没有图片，切换到文本模式
        previewMode.value = 'text';
      }
    }
  } catch (e) {
    previewContent.value = '加载失败';
    previewMode.value = 'text';
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

// 返回文档类型对应的 Lucide 图标组件
function getDocIconComponent(contentType?: string) {
  if (!contentType) return FileText;
  if (contentType.includes('pdf')) return File;
  if (contentType.includes('image')) return Image;
  if (contentType.includes('markdown')) return FileText;
  return FileText;
}

// ========================================
// 分类管理功能
// ========================================

async function loadCategories() {
  try {
    const data = await getCategories();
    allCategories.value = data.categories;
    defaultCategories.value = data.defaultCategories;
  } catch (e) {
    console.error('[KnowledgeBasePanel] Load categories failed:', e);
  }
}

function isDefaultCategory(name: string): boolean {
  return defaultCategories.value.includes(name);
}

async function handleAddCategory() {
  const name = newCategoryName.value.trim();
  if (!name) return;

  try {
    const result = await addCategory(name);
    if (result.status === 'success') {
      newCategoryName.value = '';
      await loadCategories();
    } else {
      alert(result.message);
    }
  } catch (e) {
    alert('添加分类失败');
  }
}

function startEditCategory(name: string) {
  editingCategory.value = name;
  editCategoryNewName.value = name;
}

async function handleUpdateCategory() {
  if (!editingCategory.value || !editCategoryNewName.value.trim()) return;

  try {
    const result = await updateCategory(editingCategory.value, editCategoryNewName.value);
    if (result.status === 'success') {
      editingCategory.value = null;
      await loadCategories();
      await loadKnowledgeDocs();
    } else {
      alert(result.message);
    }
  } catch (e) {
    alert('更新分类失败');
  }
}

async function handleDeleteCategory(name: string) {
  if (!confirm(`确定要删除分类「${name}」吗？该分类下的文档将移动到"其他"。`)) {
    return;
  }

  try {
    const result = await deleteCategory(name);
    if (result.status === 'success') {
      await loadCategories();
      await loadKnowledgeDocs();
    } else {
      alert(result.message);
    }
  } catch (e) {
    alert('删除分类失败');
  }
}

// ========================================
// 批量删除功能
// ========================================

const isAllSelected = computed(() => {
  if (allDocs.value.length === 0) return false;
  return allDocs.value.every(doc => selectedDocIds.value.includes(doc.docId));
});

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedDocIds.value = [];
  } else {
    selectedDocIds.value = allDocs.value.map(doc => doc.docId);
  }
}

function toggleSelectDoc(docId: string) {
  const idx = selectedDocIds.value.indexOf(docId);
  if (idx === -1) {
    selectedDocIds.value.push(docId);
  } else {
    selectedDocIds.value.splice(idx, 1);
  }
}

async function confirmBatchDelete() {
  const count = selectedDocIds.value.length;
  if (count === 0) return;

  const confirmed = confirm(
    `确定要删除选中的 ${count} 个文档吗？此操作不可撤销。`
  );

  if (!confirmed) return;

  await handleBatchDelete();
}

async function handleBatchDelete() {
  const docIdsToDelete = [...selectedDocIds.value];
  isBatchDeleting.value = true;

  try {
    const result = await batchDeleteDocs(docIdsToDelete, props.sessionId);

    if (result.status === 'success' || result.status === 'partial') {
      // 从本地列表中移除已删除的文档
      const deletedIds = new Set(
        docIdsToDelete.filter((id) =>
          !result.results?.errors.some(e => e.docId === id)
        )
      );

      allDocs.value = allDocs.value.filter(doc => !deletedIds.has(doc.docId));
      selectedDocIds.value = selectedDocIds.value.filter(id => !deletedIds.has(id));

      // 重新分组
      groupDocs();

      // 更新统计
      totalChunks.value = Math.max(0, totalChunks.value - deletedIds.size);

      if (result.status === 'partial') {
        alert(`删除完成：成功 ${result.results?.deleted} 个，失败 ${result.results?.failed} 个`);
      }
    } else {
      alert(result.message || '批量删除失败');
    }
  } catch (e) {
    console.error('[KnowledgeBasePanel] Batch delete error:', e);
    alert('批量删除失败: ' + (e instanceof Error ? e.message : '未知错误'));
  } finally {
    isBatchDeleting.value = false;
  }
}

onMounted(() => {
  loadKnowledgeDocs();
  loadCategories();
});

defineExpose({ refresh });
</script>

<style scoped>
.knowledge-base-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--neo-white, #FFFEF9);
  border: 2px solid var(--neo-black, #232323);
  border-radius: 8px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 2px solid var(--neo-black, #232323);
  background: var(--neo-cream, #FFF9E6);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 15px;
  color: var(--neo-black, #232323);
}

.title-icon {
  color: var(--neo-primary, #5D6AB4);
}

.panel-actions {
  display: flex;
  gap: 6px;
}

.btn-icon {
  background: var(--neo-white, #FFFEF9);
  border: 2px solid var(--neo-black, #232323);
  width: 30px;
  height: 30px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  box-shadow: 2px 2px 0 var(--neo-black, #232323);
  color: var(--neo-black, #232323);
}

.btn-icon:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black, #232323);
  background: var(--neo-cream, #FFF9E6);
}

.btn-icon:active:not(:disabled) {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 var(--neo-black, #232323);
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon-primary {
  background: var(--neo-primary, #5D6AB4);
  color: white;
}

.btn-icon-primary:hover:not(:disabled) {
  background: #4a5699;
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
  border-bottom: 2px solid var(--neo-black, #232323);
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  color: var(--neo-gray, #888);
  pointer-events: none;
}

.search-box input {
  width: 100%;
  padding: 10px 36px;
  border: 2px solid var(--neo-black, #232323);
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
  background: var(--neo-white, #FFFEF9);
  box-shadow: 2px 2px 0 var(--neo-black, #232323);
}

.search-box input:focus {
  border-color: var(--neo-primary, #5D6AB4);
  box-shadow: 3px 3px 0 var(--neo-primary, #5D6AB4);
}

.search-clear {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--neo-gray, #888);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.15s;
}

.search-clear:hover {
  color: var(--neo-black, #232323);
  background: var(--neo-cream, #FFF9E6);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  background: var(--neo-white, #FFFEF9);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--neo-gray, #888);
  gap: 12px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--neo-cream, #FFF9E6);
  border-top-color: var(--neo-primary, #5D6AB4);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--neo-gray, #888);
  gap: 12px;
  text-align: center;
}

.empty-icon {
  color: var(--neo-primary, #5D6AB4);
  opacity: 0.6;
}

.empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--neo-black, #232323);
}

.empty-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--neo-gray, #888);
}

.btn-upload {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--neo-primary, #5D6AB4);
  color: white;
  border: 2px solid var(--neo-black, #232323);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 3px 3px 0 var(--neo-black, #232323);
  transition: all 0.15s ease;
  margin-top: 8px;
}

.btn-upload:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--neo-black, #232323);
}

.btn-upload:active {
  transform: translate(1px, 1px);
  box-shadow: 2px 2px 0 var(--neo-black, #232323);
}

.doc-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.doc-group {
  border: 2px solid var(--neo-black, #232323);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 3px 3px 0 var(--neo-black, #232323);
}

.group-header {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: var(--neo-cream, #FFF9E6);
  cursor: pointer;
  gap: 6px;
  transition: all 0.15s ease;
  border-bottom: 2px solid var(--neo-black, #232323);
}

.group-header:hover {
  background: var(--neo-yellow, #FFE066);
}

.group-chevron {
  color: var(--neo-gray, #888);
  transition: transform 0.2s;
}

.group-icon {
  color: var(--neo-primary, #5D6AB4);
}

.group-name {
  flex: 1;
  font-weight: 600;
  font-size: 13px;
  color: var(--neo-black, #232323);
}

.group-count {
  background: var(--neo-black, #232323);
  color: var(--neo-white, #FFFEF9);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.group-docs {
  background: var(--neo-white, #FFFEF9);
}

.doc-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  gap: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  border-bottom: 1px solid var(--neo-cream, #FFF9E6);
}

.doc-item:last-child {
  border-bottom: none;
}

.doc-item:hover {
  background: var(--neo-cream, #FFF9E6);
}

.doc-item.selected {
  background: var(--neo-purple, #A2A3D1);
}

.doc-item.selected .doc-title {
  color: var(--neo-black, #232323);
}

.doc-icon {
  flex-shrink: 0;
  color: var(--neo-primary, #5D6AB4);
}

.doc-info {
  flex: 1;
  min-width: 0;
}

.doc-title {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--neo-black, #232323);
}

.doc-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--neo-gray, #888);
  margin-top: 2px;
}

.doc-actions {
  flex-shrink: 0;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.doc-item:hover .doc-actions {
  opacity: 1;
}

.btn-tiny {
  background: var(--neo-white, #FFFEF9);
  border: 2px solid var(--neo-black, #232323);
  border-radius: 4px;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  box-shadow: 1px 1px 0 var(--neo-black, #232323);
  color: var(--neo-black, #232323);
}

.btn-tiny:hover {
  transform: translate(-1px, -1px);
  box-shadow: 2px 2px 0 var(--neo-black, #232323);
  background: var(--neo-cream, #FFF9E6);
}

.btn-tiny.btn-delete:hover {
  background: var(--neo-red, #E86F68);
  color: white;
}

.panel-footer {
  padding: 10px 16px;
  border-top: 2px solid var(--neo-black, #232323);
  font-size: 11px;
  color: var(--neo-gray, #888);
  display: flex;
  justify-content: space-between;
  background: var(--neo-cream, #FFF9E6);
}

.preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-modal {
  background: var(--neo-white, #FFFEF9);
  border: 3px solid var(--neo-black, #232323);
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 6px 6px 0 var(--neo-black, #232323);
}

.preview-header {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 2px solid var(--neo-black, #232323);
  background: var(--neo-cream, #FFF9E6);
  gap: 12px;
}

.preview-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--neo-black, #232323);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-btn {
  background: var(--neo-white, #FFFEF9);
  border: 2px solid var(--neo-black, #232323);
  border-radius: 6px;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 2px 2px 0 var(--neo-black, #232323);
  transition: all 0.15s ease;
  color: var(--neo-black, #232323);
}

.close-btn:hover {
  background: var(--neo-red, #E86F68);
  color: white;
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black, #232323);
}

.preview-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
  background: var(--neo-white, #FFFEF9);
}

.preview-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.6;
  color: var(--neo-black, #232323);
  background: var(--neo-cream, #FFF9E6);
  padding: 12px;
  border: 2px solid var(--neo-black, #232323);
  border-radius: 6px;
}

/* 图片预览样式 */
.preview-modal-wide {
  max-width: 900px;
}

.preview-tabs {
  display: flex;
  gap: 4px;
}

.preview-tabs button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 2px solid var(--neo-black, #232323);
  background: var(--neo-white, #FFFEF9);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 2px 2px 0 var(--neo-black, #232323);
}

.preview-tabs button.active {
  background: var(--neo-primary, #5D6AB4);
  color: white;
}

.preview-tabs button:hover:not(.active) {
  background: var(--neo-cream, #FFF9E6);
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black, #232323);
}

.image-preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.image-page {
  border: 2px solid var(--neo-black, #232323);
  border-radius: 8px;
  overflow: hidden;
  background: var(--neo-white, #FFFEF9);
  box-shadow: 3px 3px 0 var(--neo-black, #232323);
}

.page-label {
  padding: 8px 12px;
  background: var(--neo-cream, #FFF9E6);
  border-bottom: 2px solid var(--neo-black, #232323);
  font-size: 12px;
  font-weight: 600;
  color: var(--neo-gray, #888);
  text-align: center;
}

.image-page img {
  display: block;
  max-width: 100%;
  height: auto;
}

/* 批量删除按钮样式 */
.btn-delete-batch {
  position: relative;
  background: var(--neo-red, #E86F68);
  color: white;
}

.btn-delete-batch:hover:not(:disabled) {
  background: #d65a52;
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black, #232323);
}

.btn-delete-batch:active:not(:disabled) {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 var(--neo-black, #232323);
}

.btn-delete-batch .badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: var(--neo-black, #232323);
  color: var(--neo-white, #FFFEF9);
  font-size: 10px;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border: 2px solid var(--neo-white, #FFFEF9);
}

/* 文档复选框样式 */
.doc-checkbox {
  flex-shrink: 0;
  cursor: pointer;
  color: var(--neo-gray, #888);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
}

.doc-checkbox:hover {
  color: var(--neo-primary, #5D6AB4);
}

.doc-item.selected .doc-checkbox {
  color: var(--neo-primary, #5D6AB4);
}

/* 分类管理弹窗样式 */
.category-manager-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.category-manager-modal {
  background: var(--neo-white, #FFFEF9);
  border: 3px solid var(--neo-black, #232323);
  border-radius: 8px;
  width: 90%;
  max-width: 420px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 6px 6px 0 var(--neo-black, #232323);
}

.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 2px solid var(--neo-black, #232323);
  background: var(--neo-cream, #FFF9E6);
}

.category-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--neo-black, #232323);
}

.category-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.add-category-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.add-category-row input {
  flex: 1;
  padding: 10px 12px;
  border: 2px solid var(--neo-black, #232323);
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  background: var(--neo-white, #FFFEF9);
  box-shadow: 2px 2px 0 var(--neo-black, #232323);
}

.add-category-row input:focus {
  border-color: var(--neo-primary, #5D6AB4);
  box-shadow: 2px 2px 0 var(--neo-primary, #5D6AB4);
}

.btn-add {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 16px;
  background: var(--neo-primary, #5D6AB4);
  color: white;
  border: 2px solid var(--neo-black, #232323);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 2px 2px 0 var(--neo-black, #232323);
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-add:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--neo-black, #232323);
}

.btn-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--neo-white, #FFFEF9);
  border: 2px solid var(--neo-black, #232323);
  border-radius: 6px;
  box-shadow: 2px 2px 0 var(--neo-black, #232323);
}

.category-item.is-default {
  background: var(--neo-cream, #FFF9E6);
}

.category-name-display {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--neo-black, #232323);
}

.default-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  background: var(--neo-gray, #888);
  color: white;
  border-radius: 4px;
}

.category-actions {
  display: flex;
  gap: 4px;
}

.category-item .edit-input {
  flex: 1;
  padding: 6px 10px;
  border: 2px solid var(--neo-primary, #5D6AB4);
  border-radius: 4px;
  font-size: 13px;
  outline: none;
  background: var(--neo-white, #FFFEF9);
}

.btn-save {
  background: var(--neo-green, #6BB86A);
  color: white;
}

.btn-save:hover {
  background: #5aa559;
}
</style>
