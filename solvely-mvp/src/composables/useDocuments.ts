/**
 * useDocuments - 文档管理 Composable
 * Week 8: 前端优化 - 文档状态管理
 */
import { ref, computed, reactive, watch } from 'vue';
import { useSession } from './useSession';
import {
  upsertDocs,
  listSessionDocs,
  getDocContent,
  uploadRawPrd,
  uploadAuxDoc,
  saveCurrentDoc,
  type DocListItem,
  type DocUpsertItem
} from '../utils/docStoreApi';
import type { DocRef } from '../utils/refRegistry';

// 文档状态
export type DocStatus = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

// 文档类型
export type DocKind = 'main' | 'aux' | 'output';

// 本地文档对象
export interface LocalDocument {
  id: string;
  logicalId?: string;
  kind: DocKind;
  title: string;
  content: string;
  status: DocStatus;
  docRef?: DocRef;
  version: number;
  lastModified: number;
  isSelected: boolean;
  error?: string;
}

// 上传进度
export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

// 文档管理状态
interface DocumentsState {
  documents: Map<string, LocalDocument>;
  uploadQueue: UploadProgress[];
  isLoading: boolean;
  activeDocId: string | null;
}

// 单例状态
const _state = reactive<DocumentsState>({
  documents: new Map(),
  uploadQueue: [],
  isLoading: false,
  activeDocId: null
});

/**
 * 文档管理 Composable
 *
 * 提供统一的文档 CRUD、版本管理、Pointer 操作功能。
 * 所有使用此 composable 的组件共享同一个文档状态。
 *
 * @example
 * ```ts
 * const { documents, uploadDocument, selectDocument, getSelectedDocRefs } = useDocuments();
 *
 * // 上传文档
 * await uploadDocument(file, 'aux');
 *
 * // 选择文档
 * selectDocument('doc-id');
 *
 * // 获取已选文档引用（用于发送给 AI）
 * const refs = getSelectedDocRefs();
 * ```
 */
export function useDocuments() {
  const { getSessionId, getPointers } = useSession();

  // 计算属性
  const documents = computed(() => Array.from(_state.documents.values()));

  const mainDocuments = computed(() =>
    documents.value.filter(d => d.kind === 'main')
  );

  const auxDocuments = computed(() =>
    documents.value.filter(d => d.kind === 'aux')
  );

  const outputDocuments = computed(() =>
    documents.value.filter(d => d.kind === 'output')
  );

  const selectedDocuments = computed(() =>
    documents.value.filter(d => d.isSelected)
  );

  const isLoading = computed(() => _state.isLoading);

  const activeDocument = computed(() =>
    _state.activeDocId ? _state.documents.get(_state.activeDocId) : null
  );

  const uploadQueue = computed(() => _state.uploadQueue);

  const isUploading = computed(() =>
    _state.uploadQueue.some(q => q.status === 'uploading' || q.status === 'processing')
  );

  /**
   * 生成本地文档 ID
   */
  function generateLocalId(): string {
    return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 从后端加载会话文档
   */
  async function loadSessionDocuments(): Promise<void> {
    const sessionId = getSessionId();
    _state.isLoading = true;

    try {
      const result = await listSessionDocs(sessionId);

      if (result.status === 'success') {
        // 清空现有文档
        _state.documents.clear();

        // 添加后端文档
        for (const doc of result.docs) {
          const localDoc: LocalDocument = {
            id: doc.docId,
            logicalId: doc.logicalId,
            kind: (doc.kind as DocKind) || 'aux',
            title: doc.title || 'Untitled',
            content: '', // 内容稍后懒加载
            status: 'ready',
            docRef: {
              docId: doc.docId,
              logicalId: doc.logicalId,
              title: doc.title,
              hash: doc.hash,
              kind: doc.kind,
              length: doc.length,
              contentType: doc.contentType
            },
            version: 1,
            lastModified: doc.createdAt || Date.now(),
            isSelected: false
          };
          _state.documents.set(doc.docId, localDoc);
        }
      }
    } catch (e) {
      console.error('[useDocuments] Load error:', e);
    } finally {
      _state.isLoading = false;
    }
  }

  /**
   * 获取文档内容
   */
  async function fetchDocumentContent(docId: string): Promise<string> {
    const doc = _state.documents.get(docId);
    if (!doc) {
      throw new Error(`Document not found: ${docId}`);
    }

    // 如果已有内容，直接返回
    if (doc.content) {
      return doc.content;
    }

    try {
      doc.status = 'processing';
      const result = await getDocContent(docId);

      if (result.status === 'success' && result.content) {
        doc.content = result.content;
        doc.status = 'ready';
        return result.content;
      }

      throw new Error(result.message || 'Failed to fetch content');
    } catch (e: any) {
      doc.status = 'error';
      doc.error = e.message;
      throw e;
    }
  }

  /**
   * 上传文档（从文件）
   */
  async function uploadDocument(
    file: File,
    kind: DocKind = 'aux',
    logicalId?: string
  ): Promise<LocalDocument> {
    const sessionId = getSessionId();
    const localId = generateLocalId();

    // 创建本地文档
    const localDoc: LocalDocument = {
      id: localId,
      logicalId,
      kind,
      title: file.name,
      content: '',
      status: 'uploading',
      version: 1,
      lastModified: Date.now(),
      isSelected: false
    };
    _state.documents.set(localId, localDoc);

    // 添加到上传队列
    const queueItem: UploadProgress = {
      fileName: file.name,
      progress: 0,
      status: 'uploading'
    };
    _state.uploadQueue.push(queueItem);

    try {
      // 读取文件内容
      const content = await readFileContent(file);
      localDoc.content = content;
      queueItem.progress = 50;

      // 上传到后端
      queueItem.status = 'processing';
      const docRef = await uploadAuxDoc(
        sessionId,
        content,
        file.name,
        logicalId
      );

      // 更新本地文档
      localDoc.id = docRef.docId;
      localDoc.docRef = docRef;
      localDoc.status = 'ready';
      localDoc.logicalId = docRef.logicalId;

      // 更新 Map（使用新 ID）
      _state.documents.delete(localId);
      _state.documents.set(docRef.docId, localDoc);

      // 更新队列状态
      queueItem.progress = 100;
      queueItem.status = 'completed';

      return localDoc;

    } catch (e: any) {
      localDoc.status = 'error';
      localDoc.error = e.message;
      queueItem.status = 'error';
      queueItem.error = e.message;
      throw e;
    }
  }

  /**
   * 上传文本内容
   */
  async function uploadTextContent(
    content: string,
    title: string,
    kind: DocKind = 'aux',
    logicalId?: string
  ): Promise<LocalDocument> {
    const sessionId = getSessionId();
    const localId = generateLocalId();

    const localDoc: LocalDocument = {
      id: localId,
      logicalId,
      kind,
      title,
      content,
      status: 'uploading',
      version: 1,
      lastModified: Date.now(),
      isSelected: false
    };
    _state.documents.set(localId, localDoc);

    try {
      let docRef: DocRef;

      if (kind === 'main' && logicalId === 'raw_prd') {
        docRef = await uploadRawPrd(sessionId, content, title);
      } else {
        docRef = await uploadAuxDoc(sessionId, content, title, logicalId);
      }

      localDoc.id = docRef.docId;
      localDoc.docRef = docRef;
      localDoc.status = 'ready';
      localDoc.logicalId = docRef.logicalId;

      _state.documents.delete(localId);
      _state.documents.set(docRef.docId, localDoc);

      return localDoc;

    } catch (e: any) {
      localDoc.status = 'error';
      localDoc.error = e.message;
      throw e;
    }
  }

  /**
   * 保存文档（用于编辑后保存）
   */
  async function saveDocument(docId: string, content: string): Promise<DocRef> {
    const sessionId = getSessionId();
    const doc = _state.documents.get(docId);

    if (!doc) {
      throw new Error(`Document not found: ${docId}`);
    }

    doc.status = 'uploading';

    try {
      const docRef = await saveCurrentDoc(
        sessionId,
        doc.logicalId || docId,
        content,
        doc.title,
        doc.kind === 'main' ? 'main' : 'output'
      );

      doc.content = content;
      doc.docRef = docRef;
      doc.status = 'ready';
      doc.version += 1;
      doc.lastModified = Date.now();

      return docRef;

    } catch (e: any) {
      doc.status = 'error';
      doc.error = e.message;
      throw e;
    }
  }

  /**
   * 选择/取消选择文档
   */
  function toggleDocumentSelection(docId: string): void {
    const doc = _state.documents.get(docId);
    if (doc) {
      doc.isSelected = !doc.isSelected;
    }
  }

  /**
   * 选择文档
   */
  function selectDocument(docId: string): void {
    const doc = _state.documents.get(docId);
    if (doc) {
      doc.isSelected = true;
    }
  }

  /**
   * 取消选择文档
   */
  function deselectDocument(docId: string): void {
    const doc = _state.documents.get(docId);
    if (doc) {
      doc.isSelected = false;
    }
  }

  /**
   * 取消选择所有文档
   */
  function clearSelection(): void {
    _state.documents.forEach(doc => {
      doc.isSelected = false;
    });
  }

  /**
   * 设置活动文档（当前正在编辑的文档）
   */
  function setActiveDocument(docId: string | null): void {
    _state.activeDocId = docId;
  }

  /**
   * 获取已选文档的引用列表
   */
  function getSelectedDocRefs(): DocRef[] {
    return selectedDocuments.value
      .filter(d => d.docRef)
      .map(d => d.docRef!);
  }

  /**
   * 删除本地文档
   */
  function removeDocument(docId: string): void {
    _state.documents.delete(docId);
    if (_state.activeDocId === docId) {
      _state.activeDocId = null;
    }
  }

  /**
   * 清空所有文档
   */
  function clearAllDocuments(): void {
    _state.documents.clear();
    _state.uploadQueue = [];
    _state.activeDocId = null;
  }

  /**
   * 清除上传队列中已完成的项目
   */
  function clearCompletedUploads(): void {
    _state.uploadQueue = _state.uploadQueue.filter(
      q => q.status === 'uploading' || q.status === 'processing' || q.status === 'pending'
    );
  }

  /**
   * 更新文档内容（本地）
   */
  function updateDocumentContent(docId: string, content: string): void {
    const doc = _state.documents.get(docId);
    if (doc) {
      doc.content = content;
      doc.lastModified = Date.now();
    }
  }

  /**
   * 更新文档标题（本地）
   */
  function updateDocumentTitle(docId: string, title: string): void {
    const doc = _state.documents.get(docId);
    if (doc) {
      doc.title = title;
      doc.lastModified = Date.now();
    }
  }

  return {
    // 状态
    documents,
    mainDocuments,
    auxDocuments,
    outputDocuments,
    selectedDocuments,
    isLoading,
    isUploading,
    activeDocument,
    uploadQueue,

    // 加载
    loadSessionDocuments,
    fetchDocumentContent,

    // 上传保存
    uploadDocument,
    uploadTextContent,
    saveDocument,

    // 选择
    toggleDocumentSelection,
    selectDocument,
    deselectDocument,
    clearSelection,
    setActiveDocument,
    getSelectedDocRefs,

    // 编辑
    updateDocumentContent,
    updateDocumentTitle,

    // 删除
    removeDocument,
    clearAllDocuments,
    clearCompletedUploads
  };
}

/**
 * 读取文件内容
 */
async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export default useDocuments;
