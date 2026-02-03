/**
 * DocStore API
 * 封装文档管理相关接口
 */

import { getAgentUrl, buildHeaders } from './agentUrl';
import type { DocRef } from './refRegistry';

const AGENT_URL = getAgentUrl();

export type DocUpsertItem = {
    logicalId?: string;
    kind: 'main' | 'aux' | 'output';
    title: string;
    content: string;
    tags?: string[];
    clientDocId?: string;
    contentType?: string;
};

export type DocUpsertRequest = {
    sessionId: string;
    docs: DocUpsertItem[];
};

export type DocUpsertResponse = {
    status: string;
    sessionId: string;
    stored: Array<{
        clientDocId?: string;
        docRef?: DocRef;
        isNew?: boolean;
        createdAt?: number;
        error?: string;
    }>;
};

export type DocListItem = {
    docId: string;
    logicalId?: string;
    kind?: string;
    title?: string;
    hash?: string;
    length?: number;
    contentType?: string;
    createdAt?: number;
};

export type DocListResponse = {
    status: string;
    docs: DocListItem[];
};

export type DocContentResponse = {
    status: string;
    docId: string;
    docRef?: DocRef;
    content?: string;
    code?: string;
    message?: string;
};

/**
 * 上传/更新文档
 */
export async function upsertDocs(request: DocUpsertRequest): Promise<DocUpsertResponse> {
    const res = await fetch(`${AGENT_URL}/api/docs/upsert`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(request),
    });
    if (!res.ok) {
        throw new Error(`上传文档失败: ${res.statusText}`);
    }
    return await res.json();
}

/**
 * 获取会话下的所有文档列表
 */
export async function listSessionDocs(sessionId: string): Promise<DocListResponse> {
    const res = await fetch(`${AGENT_URL}/api/sessions/${sessionId}/docs`, {
        method: 'GET',
        headers: buildHeaders(),
    });
    if (!res.ok) {
        throw new Error(`获取文档列表失败: ${res.statusText}`);
    }
    return await res.json();
}

/**
 * 根据 docId 获取文档内容
 */
export async function getDocContent(docId: string): Promise<DocContentResponse> {
    const res = await fetch(`${AGENT_URL}/api/docs/${docId}`, {
        method: 'GET',
        headers: buildHeaders(),
    });
    if (!res.ok) {
        throw new Error(`获取文档内容失败: ${res.statusText}`);
    }
    return await res.json();
}

/**
 * 上传主 PRD（raw_prd）
 */
export async function uploadRawPrd(
    sessionId: string,
    content: string,
    title: string = 'Raw PRD',
    clientDocId?: string
): Promise<DocRef> {
    const response = await upsertDocs({
        sessionId,
        docs: [{
            logicalId: 'raw_prd',
            kind: 'main',
            title,
            content,
            clientDocId,
            contentType: 'text/markdown',
        }],
    });
    const stored = response.stored[0];
    if (stored.error || !stored.docRef) {
        throw new Error(stored.error || '上传失败');
    }
    return stored.docRef;
}

/**
 * 上传辅助文档
 */
export async function uploadAuxDoc(
    sessionId: string,
    content: string,
    title: string,
    logicalId?: string,
    tags?: string[],
    clientDocId?: string
): Promise<DocRef> {
    const response = await upsertDocs({
        sessionId,
        docs: [{
            logicalId,
            kind: 'aux',
            title,
            content,
            tags,
            clientDocId,
            contentType: 'text/markdown',
        }],
    });
    const stored = response.stored[0];
    if (stored.error || !stored.docRef) {
        throw new Error(stored.error || '上传失败');
    }
    return stored.docRef;
}

/**
 * 保存当前编辑的文档（optimized_prd_current/testpoints_current/testcases_current）
 */
export async function saveCurrentDoc(
    sessionId: string,
    logicalId: string,
    content: string,
    title: string,
    kind: 'main' | 'output' = 'output'
): Promise<DocRef> {
    const response = await upsertDocs({
        sessionId,
        docs: [{
            logicalId,
            kind,
            title,
            content,
            contentType: 'text/markdown',
        }],
    });
    const stored = response.stored[0];
    if (stored.error || !stored.docRef) {
        throw new Error(stored.error || '保存失败');
    }
    return stored.docRef;
}

// -----------------------------
// Batch Upload API (Week 8)
// -----------------------------

export type BatchUploadResult = {
    filename: string;
    docRef?: DocRef;
    error?: string;
};

export type BatchUploadResponse = {
    status: 'completed' | 'partial' | 'failed' | 'error';
    total: number;
    success: number;
    failed: number;
    results: BatchUploadResult[];
    message?: string;
};

export type BatchUploadOptions = {
    kind?: 'main' | 'aux';
    useOcr?: boolean;
    onProgress?: (completed: number, total: number) => void;
};

/**
 * 批量上传文件（直接调用 /api/docs/batch-upload）
 *
 * 使用单次 HTTP 请求上传多个文件，比多次调用 upsertDocs 更高效。
 *
 * @param sessionId 会话 ID
 * @param files 文件列表
 * @param options 可选配置
 * @returns 批量上传结果
 */
export async function batchUploadFiles(
    sessionId: string,
    files: File[],
    options?: BatchUploadOptions
): Promise<BatchUploadResponse> {
    const formData = new FormData();
    formData.append('sessionId', sessionId);

    if (options?.kind) {
        formData.append('kind', options.kind);
    }

    formData.append('useOcr', String(options?.useOcr ?? true));

    for (const file of files) {
        formData.append('files', file);
    }

    // 获取 headers，但移除 Content-Type（FormData 会自动设置）
    const headers = buildHeaders();
    delete (headers as Record<string, string>)['Content-Type'];

    const res = await fetch(`${AGENT_URL}/api/docs/batch-upload`, {
        method: 'POST',
        headers,
        body: formData
    });

    if (!res.ok) {
        throw new Error(`批量上传失败: ${res.statusText}`);
    }

    return res.json();
}

/**
 * 上传单个文件（使用 /api/docs/upload）
 *
 * P1 优化：支持上传进度回调，使用 XMLHttpRequest 实现
 *
 * @param sessionId 会话 ID
 * @param file 文件
 * @param options 可选配置
 * @returns 文档引用
 */
export async function uploadFile(
    sessionId: string,
    file: File,
    options?: {
        title?: string;
        kind?: string;
        logicalId?: string;
        useOcr?: boolean;
        onProgress?: (percent: number) => void;
    }
): Promise<DocRef> {
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    formData.append('file', file);

    if (options?.title) {
        formData.append('title', options.title);
    }
    if (options?.kind) {
        formData.append('kind', options.kind);
    }
    if (options?.logicalId) {
        formData.append('logicalId', options.logicalId);
    }
    formData.append('useOcr', String(options?.useOcr ?? true));

    // 如果有进度回调，使用 XMLHttpRequest
    if (options?.onProgress) {
        return uploadFileWithProgress(formData, options.onProgress);
    }

    // 否则使用原有的 fetch 方式
    const headers = buildHeaders();
    delete (headers as Record<string, string>)['Content-Type'];

    const res = await fetch(`${AGENT_URL}/api/docs/upload`, {
        method: 'POST',
        headers,
        body: formData
    });

    if (!res.ok) {
        throw new Error(`文件上传失败: ${res.statusText}`);
    }

    const result = await res.json();

    if (result.status !== 'success' || !result.docRef) {
        throw new Error(result.message || '上传失败');
    }

    return result.docRef;
}

/**
 * 使用 XMLHttpRequest 上传文件，支持进度回调
 */
function uploadFileWithProgress(
    formData: FormData,
    onProgress: (percent: number) => void
): Promise<DocRef> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // 上传进度事件
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                onProgress(percent);
            }
        };

        // 请求完成
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    if (result.status === 'success' && result.docRef) {
                        resolve(result.docRef);
                    } else {
                        reject(new Error(result.message || '上传失败'));
                    }
                } catch (e) {
                    reject(new Error('解析响应失败'));
                }
            } else {
                reject(new Error(`文件上传失败: ${xhr.statusText}`));
            }
        };

        // 请求错误
        xhr.onerror = () => {
            reject(new Error('网络错误'));
        };

        // 请求中断
        xhr.onabort = () => {
            reject(new Error('上传已取消'));
        };

        // 配置请求
        xhr.open('POST', `${AGENT_URL}/api/docs/upload`);

        // 添加自定义 headers（除了 Content-Type，由 FormData 自动设置）
        const headers = buildHeaders();
        delete (headers as Record<string, string>)['Content-Type'];
        for (const [key, value] of Object.entries(headers)) {
            if (value) xhr.setRequestHeader(key, value);
        }

        // 发送请求
        xhr.send(formData);
    });
}

// -----------------------------
// Delete Document API
// -----------------------------

export type DeleteDocResponse = {
    status: string;
    message?: string;
    deleted_from?: string[];
};

/**
 * 删除文档
 *
 * @param docId 文档 ID
 * @param sessionId 可选会话 ID（用于清理会话内引用）
 * @returns 删除结果
 */
export async function deleteDoc(
    docId: string,
    sessionId?: string
): Promise<DeleteDocResponse> {
    const params = new URLSearchParams();
    if (sessionId) params.append('session_id', sessionId);

    const queryString = params.toString();
    const url = queryString
        ? `${AGENT_URL}/api/docs/${docId}?${queryString}`
        : `${AGENT_URL}/api/docs/${docId}`;

    const res = await fetch(url, {
        method: 'DELETE',
        headers: buildHeaders(),
    });

    if (!res.ok) {
        throw new Error(`删除文档失败: ${res.statusText}`);
    }

    return res.json();
}

// -----------------------------
// Knowledge Base API (Week 8)
// -----------------------------

export type KnowledgeListResponse = {
    status: string;
    docs: DocListItem[];
    grouped: Record<string, DocListItem[]>;
    totalChunks: number;
    lastUpdated: number;
    message?: string;
};

/**
 * 获取知识库文档列表
 *
 * @param sessionId 可选会话 ID，若提供则只返回该会话的文档
 * @param category 可选分类筛选
 * @param limit 返回数量限制
 * @returns 知识库文档列表
 */
export async function listKnowledgeDocs(
    sessionId?: string,
    category?: string,
    limit: number = 100
): Promise<KnowledgeListResponse> {
    const params = new URLSearchParams();
    if (sessionId) params.append('session_id', sessionId);
    if (category) params.append('category', category);
    params.append('limit', String(limit));

    const res = await fetch(`${AGENT_URL}/api/knowledge/list?${params}`, {
        method: 'GET',
        headers: buildHeaders(),
    });

    if (!res.ok) {
        throw new Error(`获取知识库失败: ${res.statusText}`);
    }

    return res.json();
}





