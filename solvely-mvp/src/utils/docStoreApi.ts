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

