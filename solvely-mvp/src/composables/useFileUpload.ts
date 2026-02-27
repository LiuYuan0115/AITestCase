/**
 * useFileUpload - 文件上传管理 Composable
 * Phase 1: 支持多类型文件上传，进度跟踪，批量处理
 */
import { ref, computed, reactive } from 'vue';
import { useSession } from './useSession';
import { uploadFile, batchUploadFiles } from '../utils/docStoreApi';
import type { DocRef } from '../utils/refRegistry';
import {
  type Attachment,
  type AttachmentStatus,
  createAttachment,
  generateAttachmentId,
  isFileTypeSupported,
  getSupportedFileTypesDescription,
} from '../types/chat';

/** 上传队列项 */
interface UploadQueueItem {
  attachment: Attachment;
  file: File;
  abortController?: AbortController;
}

/** 上传状态 */
interface UploadState {
  queue: UploadQueueItem[];
  isUploading: boolean;
  concurrency: number;
  activeUploads: number;
}

// 单例状态
const _state = reactive<UploadState>({
  queue: [],
  isUploading: false,
  concurrency: 3, // 最大并发上传数
  activeUploads: 0,
});

/**
 * 文件上传管理 Composable
 *
 * 提供统一的文件上传、进度跟踪、批量处理功能。
 *
 * @example
 * ```ts
 * const { attachments, addFiles, removeAttachment, uploadAll } = useFileUpload();
 *
 * // 添加文件
 * addFiles(fileList);
 *
 * // 上传所有待上传文件
 * await uploadAll();
 *
 * // 获取已完成的附件
 * const completed = completedAttachments.value;
 * ```
 */
export function useFileUpload() {
  const { getSessionId } = useSession();

  // 计算属性
  const attachments = computed(() => _state.queue.map(item => item.attachment));

  const pendingAttachments = computed(() =>
    _state.queue.filter(item => item.attachment.status === 'pending')
  );

  const uploadingAttachments = computed(() =>
    _state.queue.filter(item =>
      item.attachment.status === 'uploading' || item.attachment.status === 'processing'
    )
  );

  const completedAttachments = computed(() =>
    _state.queue.filter(item => item.attachment.status === 'completed')
  );

  const errorAttachments = computed(() =>
    _state.queue.filter(item => item.attachment.status === 'error')
  );

  const isUploading = computed(() => _state.isUploading);

  const totalProgress = computed(() => {
    if (_state.queue.length === 0) return 0;
    const total = _state.queue.reduce((sum, item) => sum + item.attachment.progress, 0);
    return Math.round(total / _state.queue.length);
  });

  const hasFiles = computed(() => _state.queue.length > 0);

  /**
   * 添加文件到上传队列
   */
  function addFiles(files: FileList | File[]): Attachment[] {
    const newAttachments: Attachment[] = [];

    for (const file of files) {
      // 检查文件类型是否支持
      if (!isFileTypeSupported(file.name)) {
        console.warn(`[useFileUpload] 不支持的文件类型: ${file.name}`);
        const attachment = createAttachment(file);
        attachment.status = 'error';
        attachment.error = `不支持的文件类型。支持: ${getSupportedFileTypesDescription()}`;
        _state.queue.push({ attachment, file });
        newAttachments.push(attachment);
        continue;
      }

      // 检查文件大小限制 (20MB)
      if (file.size > 20 * 1024 * 1024) {
        console.warn(`[useFileUpload] 文件过大: ${file.name} (${file.size} bytes)`);
        const attachment = createAttachment(file);
        attachment.status = 'error';
        attachment.error = '文件大小超过 20MB 限制';
        _state.queue.push({ attachment, file });
        newAttachments.push(attachment);
        continue;
      }

      const attachment = createAttachment(file);
      _state.queue.push({ attachment, file });
      newAttachments.push(attachment);
    }

    return newAttachments;
  }

  /**
   * 从队列中移除附件
   */
  function removeAttachment(id: string): void {
    const index = _state.queue.findIndex(item => item.attachment.id === id);
    if (index !== -1) {
      const item = _state.queue[index];

      // 如果正在上传，取消上传
      if (item.abortController) {
        item.abortController.abort();
      }

      // 释放 blob URL
      if (item.attachment.previewUrl) {
        URL.revokeObjectURL(item.attachment.previewUrl);
      }

      _state.queue.splice(index, 1);
    }
  }

  /**
   * 清空所有附件
   */
  function clearAll(): void {
    // 取消所有上传
    for (const item of _state.queue) {
      if (item.abortController) {
        item.abortController.abort();
      }
      if (item.attachment.previewUrl) {
        URL.revokeObjectURL(item.attachment.previewUrl);
      }
    }
    _state.queue = [];
    _state.isUploading = false;
    _state.activeUploads = 0;
  }

  /**
   * 更新附件状态
   */
  function updateAttachment(id: string, updates: Partial<Attachment>): void {
    const item = _state.queue.find(item => item.attachment.id === id);
    if (item) {
      Object.assign(item.attachment, updates);
    }
  }

  /**
   * 上传单个文件
   */
  async function uploadSingle(item: UploadQueueItem): Promise<DocRef | null> {
    const { attachment, file } = item;

    try {
      updateAttachment(attachment.id, { status: 'uploading', progress: 0 });

      const sessionId = getSessionId();
      const uploadResult = await uploadFile(sessionId, file, {
        title: file.name,
        kind: 'aux',
        useOcr: true,
        onProgress: (percent) => {
          updateAttachment(attachment.id, { progress: percent });
        },
      });

      updateAttachment(attachment.id, {
        status: 'completed',
        progress: 100,
        docRef: uploadResult.docRef,
        multimodalMode: uploadResult.multimodalMode,
      });

      return uploadResult.docRef;
    } catch (error: any) {
      console.error(`[useFileUpload] 上传失败: ${file.name}`, error);
      updateAttachment(attachment.id, {
        status: 'error',
        error: error.message || '上传失败',
      });
      return null;
    }
  }

  /**
   * 上传所有待上传文件
   */
  async function uploadAll(): Promise<DocRef[]> {
    const pending = pendingAttachments.value;
    if (pending.length === 0) {
      return completedAttachments.value
        .map(item => item.attachment.docRef)
        .filter((ref): ref is DocRef => ref !== undefined);
    }

    _state.isUploading = true;
    const results: DocRef[] = [];

    // 使用并发控制上传
    const pendingItems = _state.queue.filter(
      item => item.attachment.status === 'pending'
    );

    // 简单的并发控制
    const uploadWithConcurrency = async () => {
      const executing: Promise<void>[] = [];

      for (const item of pendingItems) {
        const promise = uploadSingle(item).then(docRef => {
          if (docRef) results.push(docRef);
        });

        executing.push(promise);

        if (executing.length >= _state.concurrency) {
          await Promise.race(executing);
          // 移除已完成的 promise
          const completed = executing.findIndex(p =>
            Promise.race([p, Promise.resolve('pending')]).then(v => v !== 'pending')
          );
          if (completed !== -1) {
            executing.splice(completed, 1);
          }
        }
      }

      await Promise.all(executing);
    };

    try {
      await uploadWithConcurrency();
    } finally {
      _state.isUploading = false;
    }

    return results;
  }

  /**
   * 批量上传（使用后端批量接口）
   */
  async function batchUpload(): Promise<DocRef[]> {
    const pending = pendingAttachments.value;
    if (pending.length === 0) {
      return completedAttachments.value
        .map(item => item.attachment.docRef)
        .filter((ref): ref is DocRef => ref !== undefined);
    }

    _state.isUploading = true;

    // 更新所有待上传项状态
    for (const item of pending) {
      updateAttachment(item.attachment.id, { status: 'uploading', progress: 0 });
    }

    try {
      const sessionId = getSessionId();
      const files = _state.queue
        .filter(item => item.attachment.status === 'uploading')
        .map(item => item.file);

      const response = await batchUploadFiles(sessionId, files, {
        kind: 'aux',
        useOcr: true,
        onProgress: (completed, total) => {
          const progress = Math.round((completed / total) * 100);
          // 更新整体进度
          for (const item of _state.queue) {
            if (item.attachment.status === 'uploading') {
              updateAttachment(item.attachment.id, { progress });
            }
          }
        },
      });

      // 更新各文件状态
      const results: DocRef[] = [];
      for (const result of response.results) {
        const item = _state.queue.find(
          i => i.file.name === result.filename
        );
        if (item) {
          if (result.docRef) {
            updateAttachment(item.attachment.id, {
              status: 'completed',
              progress: 100,
              docRef: result.docRef,
            });
            results.push(result.docRef);
          } else {
            updateAttachment(item.attachment.id, {
              status: 'error',
              error: result.error || '上传失败',
            });
          }
        }
      }

      return results;
    } catch (error: any) {
      console.error('[useFileUpload] 批量上传失败:', error);

      // 标记所有上传中的项为错误
      for (const item of _state.queue) {
        if (item.attachment.status === 'uploading') {
          updateAttachment(item.attachment.id, {
            status: 'error',
            error: error.message || '批量上传失败',
          });
        }
      }

      return [];
    } finally {
      _state.isUploading = false;
    }
  }

  /**
   * 重试失败的上传
   */
  async function retryFailed(): Promise<DocRef[]> {
    const failed = errorAttachments.value;
    if (failed.length === 0) return [];

    // 重置失败项状态
    for (const item of failed) {
      updateAttachment(item.attachment.id, {
        status: 'pending',
        progress: 0,
        error: undefined,
      });
    }

    return uploadAll();
  }

  /**
   * 获取所有已完成的 DocRef
   */
  function getCompletedDocRefs(): DocRef[] {
    return completedAttachments.value
      .map(item => item.attachment.docRef)
      .filter((ref): ref is DocRef => ref !== undefined);
  }

  /**
   * 获取所有附件（用于发送消息时）
   */
  function getAllAttachments(): Attachment[] {
    return _state.queue.map(item => ({ ...item.attachment }));
  }

  /**
   * 设置并发数
   */
  function setConcurrency(n: number): void {
    _state.concurrency = Math.max(1, Math.min(10, n));
  }

  return {
    // 状态
    attachments,
    pendingAttachments,
    uploadingAttachments,
    completedAttachments,
    errorAttachments,
    isUploading,
    totalProgress,
    hasFiles,

    // 操作
    addFiles,
    removeAttachment,
    clearAll,
    updateAttachment,
    uploadAll,
    batchUpload,
    retryFailed,

    // 获取数据
    getCompletedDocRefs,
    getAllAttachments,

    // 配置
    setConcurrency,
  };
}

export default useFileUpload;
