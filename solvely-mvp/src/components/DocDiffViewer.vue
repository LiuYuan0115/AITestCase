<template>
  <div class="doc-diff-viewer">
    <div class="diff-header">
      <div class="diff-title">
        <span class="title-icon">🔄</span>
        <span>版本对比</span>
      </div>
      <button class="btn-close" @click="$emit('close')">×</button>
    </div>

    <div class="diff-toolbar">
      <div class="version-label left">
        <span class="version-tag old">旧版本</span>
        <span class="version-id">{{ leftDocId?.slice(0, 8) }}...</span>
      </div>
      <div class="diff-stats" v-if="diffStats">
        <span class="stat added">+{{ diffStats.added }}</span>
        <span class="stat removed">-{{ diffStats.removed }}</span>
        <span class="stat unchanged">={{ diffStats.unchanged }}</span>
      </div>
      <div class="version-label right">
        <span class="version-tag new">新版本</span>
        <span class="version-id">{{ rightDocId?.slice(0, 8) }}...</span>
      </div>
    </div>

    <div class="diff-content">
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载文档内容...</span>
      </div>

      <div v-else-if="error" class="error-state">
        <div class="error-icon">⚠️</div>
        <div class="error-text">{{ error }}</div>
      </div>

      <div v-else class="diff-container">
        <!-- 左侧：旧版本 -->
        <div class="diff-pane left">
          <div class="pane-header">旧版本</div>
          <div class="pane-content">
            <div
              v-for="(line, idx) in diffLines"
              :key="'left-' + idx"
              class="diff-line"
              :class="line.type"
            >
              <span class="line-number">{{ line.leftNum || '' }}</span>
              <span class="line-content">{{ line.type === 'added' ? '' : line.left }}</span>
            </div>
          </div>
        </div>

        <!-- 右侧：新版本 -->
        <div class="diff-pane right">
          <div class="pane-header">新版本</div>
          <div class="pane-content">
            <div
              v-for="(line, idx) in diffLines"
              :key="'right-' + idx"
              class="diff-line"
              :class="line.type"
            >
              <span class="line-number">{{ line.rightNum || '' }}</span>
              <span class="line-content">{{ line.type === 'removed' ? '' : line.right }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="diff-footer">
      <button class="btn-swap" @click="swapVersions" v-tooltip="'交换左右版本'">
        ⇄ 交换
      </button>
      <button class="btn-close-footer" @click="$emit('close')">
        关闭
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { getAgentUrl, buildHeaders } from '@/utils/agentUrl';

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  left: string;
  right: string;
  leftNum?: number;
  rightNum?: number;
}

interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

const props = defineProps<{
  leftDocId: string;
  rightDocId: string;
}>();

const emit = defineEmits<{
  close: [];
  swap: [];
}>();

const AGENT_URL = getAgentUrl();

const isLoading = ref(false);
const error = ref<string | null>(null);
const leftContent = ref('');
const rightContent = ref('');
const diffLines = ref<DiffLine[]>([]);

// 计算差异统计
const diffStats = computed<DiffStats | null>(() => {
  if (diffLines.value.length === 0) return null;

  let added = 0, removed = 0, unchanged = 0;
  for (const line of diffLines.value) {
    if (line.type === 'added') added++;
    else if (line.type === 'removed') removed++;
    else unchanged++;
  }
  return { added, removed, unchanged };
});

// 加载文档内容
async function loadContent(docId: string): Promise<string> {
  const res = await fetch(`${AGENT_URL}/api/docs/${docId}`, {
    headers: buildHeaders()
  });

  if (!res.ok) {
    throw new Error(`加载文档失败: ${res.statusText}`);
  }

  const data = await res.json();
  return data.content || '';
}

// 简单的行级 diff 算法
function computeDiff(left: string, right: string): DiffLine[] {
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  const result: DiffLine[] = [];

  // 使用简单的 LCS (最长公共子序列) 近似算法
  let i = 0, j = 0;
  let leftNum = 1, rightNum = 1;

  // 创建行内容到行号的映射
  const leftSet = new Set(leftLines);
  const rightSet = new Set(rightLines);

  while (i < leftLines.length || j < rightLines.length) {
    if (i >= leftLines.length) {
      // 左边已结束，右边剩余都是新增
      result.push({
        type: 'added',
        left: '',
        right: rightLines[j],
        rightNum: rightNum++
      });
      j++;
    } else if (j >= rightLines.length) {
      // 右边已结束，左边剩余都是删除
      result.push({
        type: 'removed',
        left: leftLines[i],
        right: '',
        leftNum: leftNum++
      });
      i++;
    } else if (leftLines[i] === rightLines[j]) {
      // 相同行
      result.push({
        type: 'unchanged',
        left: leftLines[i],
        right: rightLines[j],
        leftNum: leftNum++,
        rightNum: rightNum++
      });
      i++;
      j++;
    } else if (!rightSet.has(leftLines[i])) {
      // 左边这行在右边不存在，标记为删除
      result.push({
        type: 'removed',
        left: leftLines[i],
        right: '',
        leftNum: leftNum++
      });
      i++;
    } else if (!leftSet.has(rightLines[j])) {
      // 右边这行在左边不存在，标记为新增
      result.push({
        type: 'added',
        left: '',
        right: rightLines[j],
        rightNum: rightNum++
      });
      j++;
    } else {
      // 都存在但位置不同，先处理左边
      result.push({
        type: 'removed',
        left: leftLines[i],
        right: '',
        leftNum: leftNum++
      });
      i++;
    }
  }

  return result;
}

// 加载并计算 diff
async function loadAndCompare() {
  isLoading.value = true;
  error.value = null;

  try {
    const [left, right] = await Promise.all([
      loadContent(props.leftDocId),
      loadContent(props.rightDocId)
    ]);

    leftContent.value = left;
    rightContent.value = right;
    diffLines.value = computeDiff(left, right);
  } catch (e: any) {
    error.value = e.message || '加载失败';
  } finally {
    isLoading.value = false;
  }
}

// 交换版本
function swapVersions() {
  emit('swap');
}

// 监听 docId 变化
watch([() => props.leftDocId, () => props.rightDocId], () => {
  loadAndCompare();
});

onMounted(() => {
  loadAndCompare();
});
</script>

<style scoped>
.doc-diff-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.diff-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.diff-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
}

.title-icon {
  font-size: 18px;
}

.btn-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #6b7280;
  padding: 4px 8px;
}

.btn-close:hover {
  color: #374151;
}

.diff-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #fefce8;
}

.version-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.version-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.version-tag.old {
  background: #fee2e2;
  color: #dc2626;
}

.version-tag.new {
  background: #dcfce7;
  color: #16a34a;
}

.version-id {
  font-size: 10px;
  color: #6b7280;
  font-family: monospace;
}

.diff-stats {
  display: flex;
  gap: 12px;
}

.stat {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
}

.stat.added {
  background: #dcfce7;
  color: #16a34a;
}

.stat.removed {
  background: #fee2e2;
  color: #dc2626;
}

.stat.unchanged {
  background: #e5e7eb;
  color: #6b7280;
}

.diff-content {
  flex: 1;
  overflow: hidden;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
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

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-icon {
  font-size: 48px;
}

.error-text {
  font-size: 14px;
  color: #dc2626;
}

.diff-container {
  display: flex;
  height: 100%;
}

.diff-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.diff-pane.left {
  border-right: 1px solid #e5e7eb;
}

.pane-header {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.pane-content {
  flex: 1;
  overflow-y: auto;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  line-height: 1.5;
}

.diff-line {
  display: flex;
  min-height: 20px;
  padding: 0 8px;
}

.diff-line.unchanged {
  background: white;
}

.diff-line.added {
  background: #dcfce7;
}

.diff-line.removed {
  background: #fee2e2;
}

.line-number {
  width: 40px;
  flex-shrink: 0;
  text-align: right;
  padding-right: 8px;
  color: #9ca3af;
  user-select: none;
  border-right: 1px solid #e5e7eb;
  margin-right: 8px;
}

.line-content {
  white-space: pre-wrap;
  word-break: break-all;
}

.diff-footer {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.btn-swap {
  padding: 8px 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-swap:hover {
  background: #f3f4f6;
}

.btn-close-footer {
  padding: 8px 16px;
  background: #5D6AB4;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-close-footer:hover {
  background: #4c5a9a;
}
</style>
