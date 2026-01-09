/**
 * RefRegistry / PointerRegistry
 * 管理文档版本指针（logicalId -> docId）
 */

import { getAgentUrl, buildHeaders } from './agentUrl';

const AGENT_URL = getAgentUrl();

export type DocRef = {
    docId: string;
    logicalId?: string;
    title?: string;
    hash?: string;
    kind?: 'main' | 'aux' | 'output';
    length?: number;
    contentType?: string;
};

export type Pointers = Record<string, string>; // logicalId -> docId

/**
 * 从后端获取版本指针表
 */
export async function fetchPointers(sessionId: string): Promise<Pointers> {
    try {
        const res = await fetch(`${AGENT_URL}/api/sessions/${sessionId}/doc_pointers`, {
            method: 'GET',
            headers: buildHeaders(),
        });
        if (!res.ok) {
            throw new Error(`获取指针表失败: ${res.statusText}`);
        }
        const data = await res.json();
        return data.pointers || {};
    } catch (error) {
        console.error('[RefRegistry] 获取指针表失败:', error);
        return {};
    }
}

/**
 * 更新版本指针
 */
export async function updatePointers(sessionId: string, updates: Pointers): Promise<Pointers> {
    try {
        const res = await fetch(`${AGENT_URL}/api/sessions/${sessionId}/doc_pointers`, {
            method: 'PATCH',
            headers: buildHeaders(),
            body: JSON.stringify({ set: updates }),
        });
        if (!res.ok) {
            throw new Error(`更新指针失败: ${res.statusText}`);
        }
        const data = await res.json();
        return data.pointers || {};
    } catch (error) {
        console.error('[RefRegistry] 更新指针失败:', error);
        throw error;
    }
}

/**
 * PointerRegistry 类：管理本地指针状态
 */
export class PointerRegistry {
    private pointers: Pointers = {};
    private sessionId: string;

    constructor(sessionId: string) {
        this.sessionId = sessionId;
    }

    /**
     * 初始化：从后端加载指针表
     * 如果后端返回 404 或空表，初始化为空对象（新会话）
     */
    async init(): Promise<void> {
        try {
            this.pointers = await fetchPointers(this.sessionId);
            console.log('[RefRegistry] 指针表已加载:', this.pointers);
        } catch (error: any) {
            // 404 或空表：新会话，初始化为空
            if (error.message?.includes('404') || error.message?.includes('不存在')) {
                this.pointers = {};
                console.log('[RefRegistry] 新会话，指针表为空');
            } else {
                console.error('[RefRegistry] 加载指针表失败:', error);
                this.pointers = {}; // 失败时也初始化为空，避免阻塞
            }
        }
    }

    /**
     * 获取指针值
     */
    get(logicalId: string): string | undefined {
        return this.pointers[logicalId];
    }

    /**
     * 设置指针值（本地）
     */
    set(logicalId: string, docId: string): void {
        this.pointers[logicalId] = docId;
    }

    /**
     * 批量设置指针值（本地）
     */
    setBatch(updates: Pointers): void {
        Object.assign(this.pointers, updates);
    }

    /**
     * 同步到后端
     */
    async sync(updates?: Pointers): Promise<void> {
        if (updates) {
            this.setBatch(updates);
        }
        await updatePointers(this.sessionId, this.pointers);
    }

    /**
     * 获取所有指针
     */
    getAll(): Pointers {
        return { ...this.pointers };
    }

    /**
     * 根据阶段类型获取默认的 main docId（硬编码规则，避免串阶段）
     */
    getMainDocId(type: 'testprd' | 'testpoint' | 'testcase'): string | undefined {
        // 硬编码规则：确保不串阶段
        const logicalIdMap: Record<string, string> = {
            testprd: 'raw_prd', // testprd 阶段必须使用 raw_prd
            testpoint: 'optimized_prd_current', // testpoint 阶段必须使用优化后的 PRD
            testcase: 'optimized_prd_current', // testcase 阶段必须使用优化后的 PRD（不是 testpoints）
        };
        const logicalId = logicalIdMap[type];
        if (!logicalId) {
            console.warn(`[RefRegistry] 未知的阶段类型: ${type}`);
            return undefined;
        }
        const docId = this.get(logicalId);
        if (!docId) {
            console.warn(`[RefRegistry] 阶段 ${type} 需要 logicalId=${logicalId}，但指针表中不存在`);
        }
        return docId;
    }

    /**
     * 根据阶段类型获取默认的 aux docIds（硬编码规则）
     */
    getAuxDocIds(type: 'testprd' | 'testpoint' | 'testcase'): string[] {
        const auxDocIds: string[] = [];
        
        // testcase 阶段默认包含 testpoints_current（如果存在）
        if (type === 'testcase') {
            const testpointsDocId = this.get('testpoints_current');
            if (testpointsDocId) {
                auxDocIds.push(testpointsDocId);
            }
        }
        
        // 其他阶段可以根据需要添加 aux 文档
        // 例如：testprd 可以包含 aux_figma_notes 等
        
        return auxDocIds;
    }

    /**
     * 根据阶段类型获取默认的 output logicalId
     */
    getOutputLogicalId(type: 'testprd' | 'testpoint' | 'testcase'): string {
        const logicalIdMap: Record<string, string> = {
            testprd: 'optimized_prd_current',
            testpoint: 'testpoints_current',
            testcase: 'testcases_current',
        };
        return logicalIdMap[type] || '';
    }
}

