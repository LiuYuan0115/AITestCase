import { getAgentUrl, buildHeaders, isRemoteMode } from '@/utils/agentUrl';
import { generateFileMD5 } from '@/utils/md5';
import { browser } from 'wxt/browser';

// ================= Agent 服务配置（支持远程/本地切换） =================
// 说明：
// - 通过 .env 中的 VITE_USE_REMOTE 控制使用远程或本地
// - 远程模式自动携带 X-Api-Key
// - 本地模式走 localhost:8000

// 智能体服务器地址
const AGENT_URL = getAgentUrl();

// 打印当前模式（便于调试）
const currentMode = isRemoteMode();
console.log(`%c🔌 API 配置`, 'font-weight: bold; color: #5D6AB4;');
console.log(`   模式: ${currentMode ? '🌐 远程（正式包）' : '🏠 本地（开发包）'}`);
console.log(`   地址: ${AGENT_URL}`);

// ================= 依赖 webserver 上传接口：uploadurl / uploadurl/file =================
const UPLOAD_CFG_STORAGE_KEY = 'SOLVELY_UPLOAD_CONFIG';
const DEFAULT_UID = '46zOZIQ0VAQor8eAV7siSf4Ltyg2';
const DEFAULT_UPLOAD_BASE = 'https://dev-webserver.solvely.ai';
const DEFAULT_PLUGIN_UUID = '6ba22fd6-8a60-4cf4-b313-08f06fb984d5';

type UploadConfig = {
    base?: string;
    uid?: string;
    token?: string;
    tokenLastUpdate?: number;
    pluginUuid?: string;
};

/**
 * 通过 UID 获取最新的 Token
 * Token 有效期约 1 个月，通过此接口可随时刷新
 */
const fetchTokenByUid = async (base: string, uid: string): Promise<string> => {
    const url = `${base.replace(/\/$/, '')}/token?uid=${encodeURIComponent(uid)}`;
    console.log(`[Token] 正在刷新 Token...`);
    
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'accept': 'application/json, text/plain, */*',
            'content-type': 'application/json',
        }
    });
    
    if (!res.ok) {
        throw new Error(`获取 Token 失败: ${res.status} ${res.statusText}`);
    }
    
    const token = await res.text();
    if (!token || token.length < 50) {
        throw new Error('获取到的 Token 无效');
    }
    
    console.log(`[Token] 刷新成功`);
    return token.trim();
};

/**
 * 保存新的 Token 到 storage
 */
const saveToken = async (token: string) => {
    try {
        const stored = await browser.storage.local.get(UPLOAD_CFG_STORAGE_KEY);
        const cfg = (stored?.[UPLOAD_CFG_STORAGE_KEY] || {}) as UploadConfig;
        await browser.storage.local.set({
            [UPLOAD_CFG_STORAGE_KEY]: {
                ...cfg,
                token,
                tokenLastUpdate: Date.now(),
            },
        });
    } catch (e) {
        console.warn('[Token] 保存失败:', e);
    }
};

/**
 * 获取上传配置（自动刷新过期 Token）
 */
const getUploadConfig = async (): Promise<Required<{ base: string; token: string; pluginUuid: string; uid: string }>> => {
    const envBase = (import.meta as any).env?.VITE_SOLVELY_UPLOAD_BASE as string | undefined;
    const envUid = (import.meta as any).env?.VITE_SOLVELY_UID as string | undefined;
    const envUuid = (import.meta as any).env?.VITE_SOLVELY_PLUGIN_UUID as string | undefined;

    // 从 storage 读取配置
    const stored = await browser.storage.local.get(UPLOAD_CFG_STORAGE_KEY);
    const cfg = (stored?.[UPLOAD_CFG_STORAGE_KEY] || {}) as UploadConfig;

    const base = (cfg.base || envBase || DEFAULT_UPLOAD_BASE).trim();
    const uid = (cfg.uid || envUid || DEFAULT_UID).trim();
    const pluginUuid = (cfg.pluginUuid || envUuid || DEFAULT_PLUGIN_UUID).trim();
    let token = (cfg.token || '').trim();
    const tokenLastUpdate = cfg.tokenLastUpdate || 0;

    // Token 有效期检查：超过 7 天则刷新
    const TOKEN_REFRESH_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 天
    const now = Date.now();

    if (!token || (now - tokenLastUpdate) > TOKEN_REFRESH_INTERVAL) {
        console.log('[Token] Token 为空或已过期，自动刷新...');
        try {
            token = await fetchTokenByUid(base, uid);
            await saveToken(token);
        } catch (e: any) {
            console.error('[Token] 刷新失败:', e.message);
            if (!token) {
                throw new Error('Error: 无法获取有效 Token，请检查网络连接');
            }
            // 如果有旧 token，尝试继续使用
            console.warn('[Token] 使用旧 Token 继续尝试...');
        }
    }

    if (!token) {
        throw new Error('Error: Upload auth token is not available.');
    }
    
    return { base, token, pluginUuid, uid };
};

const randomSuffix = () => Math.random().toString(36).slice(2, 10);

const convertImageFileToWebp = async (input: File, outputName: string): Promise<File> => {
    const bitmap = await createImageBitmap(input);
    // 优先使用 OffscreenCanvas（更稳定），不支持则 fallback DOM canvas
    if (typeof (globalThis as any).OffscreenCanvas !== 'undefined') {
        const canvas = new (globalThis as any).OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Error: Failed to create canvas context.');
        ctx.drawImage(bitmap, 0, 0);
        const blob: Blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 });
        return new File([blob], outputName, { type: 'image/webp' });
    }

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Error: Failed to create canvas context.');
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Error: Failed to convert image to webp.'))), 'image/webp', 0.85);
    });
    return new File([blob], outputName, { type: 'image/webp' });
};

const requestUploadUrl = async (fileName: string, contentMD5Hex: string, isFileEndpoint: boolean) => {
    const cfg = await getUploadConfig();
    const endpoint = isFileEndpoint ? '/uploadurl/file' : '/uploadurl';
    const url = `${cfg.base.replace(/\/$/, '')}${endpoint}`;

    const headers: Record<string, string> = {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'authorization': `Bearer ${cfg.token}`,
    };
    if (cfg.pluginUuid) headers['x-plugin-uuid'] = cfg.pluginUuid;

    const body: any = {
        files: [{ fileName, contentMD5: contentMD5Hex }]
    };
    if (!isFileEndpoint) body.deviceId = '';

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Error: uploadurl request failed: ${res.status} ${res.statusText}`);
    const payload = await res.json();
    const list = payload?.data || payload?.Data || payload?.result;
    const info = Array.isArray(list) ? list[0] : null;
    if (!info?.url || !info?.cdnUrl) throw new Error('Error: uploadurl response missing url/cdnUrl.');
    return { signedUrl: info.url as string, cdnUrl: info.cdnUrl as string };
};

const putToSignedUrl = async (signedUrl: string, file: File, contentMD5Base64: string) => {
    const headers: Record<string, string> = {
        'Content-Type': file.type || 'application/octet-stream',
        'Content-MD5': contentMD5Base64,
    };
    const res = await fetch(signedUrl, { method: 'PUT', headers, body: file });
    if (!res.ok) throw new Error(`Error: upload PUT failed: ${res.status} ${res.statusText}`);
};

const uploadDataUrlToCdnUrl = async (dataUrl: string, baseName: string, forceAsFile: boolean) => {
    if (!dataUrl) throw new Error('Error: dataUrl is empty.');
    if (!dataUrl.startsWith('data:')) throw new Error('Error: upload expects a data URL (data:*).');
    // 检查 data URL 是否有实际内容（排除空的 data:, 或 data:image/png;base64, 无内容）
    if (dataUrl === 'data:,' || !dataUrl.includes(',') || dataUrl.split(',')[1]?.length < 100) {
        throw new Error('Error: dataUrl has no valid content.');
    }

    const blobRes = await fetch(dataUrl);
    const blob = await blobRes.blob();
    const inputFile = new File([blob], baseName, { type: blob.type || 'application/octet-stream' });

    // 图片：转 webp 并走 /uploadurl；文件：走 /uploadurl/file
    const isImage = !forceAsFile && (inputFile.type.startsWith('image/') || baseName.toLowerCase().match(/\.(png|jpg|jpeg|gif|webp)$/));
    const fileToUpload = isImage
        ? await convertImageFileToWebp(inputFile, `solvely-plugin-image-${Date.now()}-${randomSuffix()}.webp`)
        : inputFile;

    const md5 = await generateFileMD5(fileToUpload);
    const { signedUrl, cdnUrl } = await requestUploadUrl(fileToUpload.name, md5.hex, !isImage);
    await putToSignedUrl(signedUrl, fileToUpload, md5.base64);
    return cdnUrl;
};

// 检查 data URL 是否有效（有实际内容）
const isValidDataUrl = (url: string): boolean => {
    if (!url || !url.startsWith('data:')) return false;
    if (url === 'data:,' || !url.includes(',')) return false;
    const content = url.split(',')[1] || '';
    return content.length >= 100; // 至少 100 字符的 base64 内容
};

// 1. Upload Screenshot Context（用于拼接长截图上传，返回 cdnUrls）
export const postRetrieve = async (params: { pictures?: string[], dom?: string }) => {
    try {
        // 过滤掉无效的图片 URL
        const validPictures = (params.pictures || []).filter(isValidDataUrl);
        console.log(`[postRetrieve] 有效图片: ${validPictures.length}/${params.pictures?.length || 0}`);
        
        if (validPictures.length === 0) {
            console.warn('[postRetrieve] 没有有效的图片可上传');
            return { success: true, cdnUrl: '', cdnUrls: [] as string[] };
        }
        
        // 逐张上传（每10屏拼接后的多张截图），返回 URL 数组
        const cdnUrls: string[] = [];
        for (let i = 0; i < validPictures.length; i++) {
            const dataUrl = validPictures[i];
            try {
                const cdnUrl = await uploadDataUrlToCdnUrl(
                    dataUrl,
                    `solvely-plugin-screenshot-${Date.now()}-${i + 1}.png`,
                    false
                );
                cdnUrls.push(cdnUrl);
            } catch (e: any) {
                // 错误信息必须为英文
                console.warn(`Error: postRetrieve upload failed (index=${i}): ${e?.message || e}`);
            }
        }
        
        return { success: true, cdnUrl: cdnUrls[0] || '', cdnUrls };
    } catch (e: any) {
        throw new Error(`Error: postRetrieve failed: ${e?.message || e}`);
    }
};

// 3. Generic Image Upload（用于 DOM 提取图片上传，返回 cdnUrl）
export const uploadImage = async (base64Data: string): Promise<string> => {
    try {
        // DOM 提取图片：上传到 webserver 后返回 cdnUrl（webp）
        return await uploadDataUrlToCdnUrl(base64Data, `solvely-plugin-image-${Date.now()}.png`, false);
    } catch (e: any) {
        // 错误信息必须为英文
        throw new Error(`Error: uploadImage failed: ${e?.message || e}`);
    }
};

// ================= PRD 智能体接口 =================

/**
 * PRD 智能体请求参数 - 符合方案规范
 */
interface PrdAgentOptions {
    sessionId: string;
    text: string;                    // PRD 文本内容
    instruction?: string;            // 用户指令（后续调用）
    pictureKeyList?: string[];       // 图片 URL 列表
    isImageSolve?: boolean;          // 是否带图处理
    isImageByte64?: boolean;         // 图片是否为 Base64
    additionalPrds?: Array<{ title: string; content: string }>; // 辅助参考文档列表（可多选）
}

/**
 * PRD 智能体响应格式
 */
interface PrdAgentResponse {
    status: 'success' | 'error';
    sessionId: string;
    type: 'query' | 'delete' | 'add' | 'modify';
    response: string;
    newPrd?: string;
}

/**
 * PRD 智能体 - 优先使用本地 Agent，失败回退远程 API
 * 
 * 接口规范：
 * - 首次调用：传入 text + pictureKeyList
 * - 后续调用：传入 text + instruction
 */
export const prdAgent = async (options: PrdAgentOptions): Promise<PrdAgentResponse> => {
    const { sessionId, text, instruction, pictureKeyList, isImageSolve, isImageByte64, additionalPrds } = options;
    
    console.log(`📝 PRD Agent 请求 | Session: ${sessionId}`);
    console.log(`   - 指令: ${instruction || '(首次调用)'}`);
    
    // 只使用本地 Agent（按需求移除远程回退）
    try {
        const localRes = await fetch(`${AGENT_URL}/api/prd`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({
                sessionId,
                code: 'plugin_test_testprd',
                type: 'testprd',
                params: {
                    text,
                    pictureKeyList: pictureKeyList || [],
                    isImageSolve: isImageSolve ?? true,
                    isImageByte64: isImageByte64 ?? true
                },
                additionalPrds: additionalPrds && additionalPrds.length > 0 ? additionalPrds : undefined,
                instruction
            })
        });
        
        if (localRes.ok) {
            const result = await localRes.json();
                return result as PrdAgentResponse;
            }
        throw new Error(`Server Error: ${localRes.status} ${localRes.statusText}`);
    } catch (e: any) {
            return {
            status: 'error',
            sessionId,
        type: 'query',
            response: `Error: ${e.message || e}`
    };
    }
};

/**
 * 清除 PRD Agent 会话上下文
 */
export const clearPrdSession = async (sessionId: string): Promise<void> => {
    try {
        await fetch(`${AGENT_URL}/api/session/${sessionId}`, {
            method: 'DELETE'
        });
        console.log(`🗑️ 会话已清除: ${sessionId}`);
    } catch (e) {
        console.log('⚠️ 清除会话失败（本地 Agent 可能未启动）');
    }
};

// ================= Test Case 智能体接口 =================

interface TestCaseAgentOptions {
    sessionId: string;
    text: string;
    instruction?: string;
    additionalPrds?: Array<{ title: string; content: string }>; // 辅助参考文档列表（可多选）
    outputFormat?: 'xmind' | 'table' | 'yaml'; // 输出格式
}

interface TestCaseAgentResponse {
    status: 'success' | 'error';
    sessionId: string;
    type: 'query' | 'delete' | 'add' | 'modify';
    response: string;
    newTestcase?: string;
}

export const testCaseAgent = async (options: TestCaseAgentOptions): Promise<TestCaseAgentResponse> => {
    const { sessionId, text, instruction, additionalPrds, outputFormat } = options;
    console.log(`🧪 Test Case Agent 请求 | Session: ${sessionId}`);
    console.log(`   - 指令: ${instruction || '(首次调用)'}`);
    console.log(`   - 输出格式: ${outputFormat || 'xmind'}`);

    // 1. 尝试本地 Agent
    try {
        const localRes = await fetch(`${AGENT_URL}/api/testcase`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({
                sessionId,
                code: 'plugin_test_testcase',
                type: 'testcase',
                params: { text },
                additionalPrds: additionalPrds && additionalPrds.length > 0 ? additionalPrds : undefined,
                instruction,
                outputFormat
            })
        });

        if (localRes.ok) {
            const result = await localRes.json();
            if (result.status !== 'error') {
                console.log('✅ 使用本地 Agent (Test Case)');
                return result as TestCaseAgentResponse;
            }
        }
    } catch (e) {
        console.log('⚠️ 本地 Agent 不可用');
    }

    // 2. 回退到远程 API (暂未实现专门的 testcase prompt，使用 prdagent 作为 fallback 或报错)
    console.log('🌐 使用远程 API (Fallback)');
    
    const systemPrompt = `你是一个测试用例智能助手。
当前测试用例：
---
${text.slice(0, 6000)}
---
用户请求：${instruction || '分析当前用例'}`;

    const aiRes = await ask({
        code: 'plugin_test_prdagent', // 使用通用的 text code
        type: 'prdagent',
        sessionId: sessionId,
        params: {
            text: systemPrompt,
            isImageSolve: true // 修复回退时默认值
        }
    });

    return {
        status: 'success',
        sessionId: aiRes.sessionId,
        type: 'query', // 远程 API 默认作为 query 处理
        response: aiRes.answer
    };
};

export const clearTestCaseSession = async (sessionId: string): Promise<void> => {
    try {
        await fetch(`${AGENT_URL}/api/session/${sessionId}`, { method: 'DELETE' });
    } catch (e) {}
};

// ================= UI 智能体接口 =================

interface UiAgentOptions {
    sessionId: string;
    instruction: string;
    url?: string;
    plan?: string;
    report?: string;
    headless?: boolean; // 有头/无头模式
    maxTurns?: number; // 最多执行轮数（默认 15，用于多轮自愈场景）
    autoContinue?: boolean; // 是否允许多轮自愈（默认 false，单轮执行后释放浏览器）
    workflow?: 'direct' | 'closed_loop'; // 工作流模式：direct=直接工具操控，closed_loop=闭环模板（自然语言->Plan JSON->Runner->Report）
    autoHeal?: boolean; // 是否启用自愈（默认 true，仅在 closed_loop 模式下有效）
    maxHealRounds?: number; // 最大自愈轮数（默认 1，仅在 closed_loop 模式下有效）
    additionalPrds?: Array<{ title: string; content: string }>; // 辅助参考文档列表（可多选）
}

interface UiAgentResponse {
    status: 'success' | 'error';
    sessionId: string;
    type: 'query' | 'plan_generated' | 'report_generated' | 'closed_loop_done';
    response: string;
    plan?: string;
    planJson?: string; // 可执行 Plan JSON（闭环模式返回，可直接回放）
    report?: string;
    screenshotCount?: number;
}

interface ScreenshotItem {
    filename: string;
    step: string;
    base64: string;
    timestamp: number;
}

interface ScreenshotsResponse {
    status: 'success' | 'error';
    screenshots: ScreenshotItem[];
    total: number;
}

// ================= PM/DEV Chat-only 接口 =================

// DocRef 类型定义（与后端对齐）
type DocRefItem = {
    docId: string;
    logicalId?: string;
    title?: string;
    kind?: 'main' | 'aux' | 'output';
};

interface ChatAgentOptions {
    sessionId: string;
    role: 'pm' | 'dev';
    message: string;
    additionalPrds?: Array<{ title: string; content: string }>; // 辅助参考文档列表（可多选）
    docRefs?: DocRefItem[]; // ✅ 新增：文档引用列表（走 DocStore 检索）
}

interface ChatAgentResponse {
    status: 'success' | 'error';
    sessionId: string;
    reply: string;
    usedDocRefs?: DocRefItem[]; // ✅ 新增：返回实际使用的文档引用
    targetLogicalId?: string;   // ✅ 新增：模型决定的目标文档
}

/**
 * PM/DEV Chat-only（走本地 Agent + LangGraph）
 * 支持 docRefs 检索上下文（为知识库/RAG 做准备）
 */
export const chatAgent = async (options: ChatAgentOptions): Promise<ChatAgentResponse> => {
    const { sessionId, role, message, additionalPrds, docRefs } = options;
    try {
        const body: any = { sessionId, role, message };
        
        // 兼容旧协议：additionalPrds
        if (additionalPrds && additionalPrds.length > 0) {
            body.additionalPrds = additionalPrds;
        }
        
        // ✅ 新协议：docRefs（优先使用）
        if (docRefs && docRefs.length > 0) {
            body.docRefs = docRefs;
        }
        
        const res = await fetch(`${AGENT_URL}/api/chat`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            if (res.status === 404) {
                // 错误信息必须为英文
                throw new Error(`Local agent endpoint not found: ${AGENT_URL}/api/chat. Please update and restart agent-server.`);
            }
            throw new Error(`Server Error: ${res.status} ${res.statusText}`);
        }
        return await res.json() as ChatAgentResponse;
    } catch (e: any) {
        return { status: 'error', sessionId, reply: `Error: ${e.message || e}` };
    }
};

/**
 * UI 自动化智能体
 * 
 * 功能：
 * 1. 生成测试计划 - 分析页面并生成结构化测试计划
 * 2. 执行测试并生成报告 - 根据计划执行测试，截图保存在后端
 * 3. 分析/问答 - 回答用户关于测试的问题
 */
export const uiAgent = async (options: UiAgentOptions): Promise<UiAgentResponse> => {
    const { sessionId, instruction, url, plan, report, headless = false, maxTurns, autoContinue, workflow, autoHeal, maxHealRounds, additionalPrds } = options;
    console.log(`🤖 UI Agent 请求 | Session: ${sessionId}`);
    console.log(`   - 指令: ${instruction}`);
    console.log(`   - URL: ${url}`);
    console.log(`   - 模式: ${headless ? '无头' : '有头'}`);
    if (maxTurns !== undefined) {
        console.log(`   - 最大轮数: ${maxTurns}`);
    }
    if (autoContinue !== undefined) {
        console.log(`   - 多轮自愈: ${autoContinue ? '开启' : '关闭'}`);
    }
    if (workflow) {
        console.log(`   - 工作流: ${workflow}`);
    }
    if (workflow === 'closed_loop') {
        if (autoHeal !== undefined) {
            console.log(`   - 自愈: ${autoHeal ? '开启' : '关闭'}`);
        }
        if (maxHealRounds !== undefined) {
            console.log(`   - 最大自愈轮数: ${maxHealRounds}`);
        }
    }

    try {
        const params: Record<string, any> = { 
            url: url || '',
            plan: plan || '',
            report: report || '',
            headless: headless
        };
        
        // 只在显式传入时才添加这些参数（后端有默认值）
        if (maxTurns !== undefined) {
            params.maxTurns = maxTurns;
        }
        if (autoContinue !== undefined) {
            params.autoContinue = autoContinue;
        }
        if (workflow) {
            params.workflow = workflow;
        }
        if (workflow === 'closed_loop') {
            if (autoHeal !== undefined) {
                params.autoHeal = autoHeal;
            }
            if (maxHealRounds !== undefined) {
                params.maxHealRounds = maxHealRounds;
            }
        }

        const localRes = await fetch(`${AGENT_URL}/api/ui_agent`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({
                sessionId,
                code: 'plugin_test_uinocode',
                type: 'uinocode',
                params,
                additionalPrds: additionalPrds && additionalPrds.length > 0 ? additionalPrds : undefined,
                instruction
            })
        });

        if (!localRes.ok) {
            throw new Error(`Server Error: ${localRes.status} ${localRes.statusText}`);
        }

        const result = await localRes.json() as UiAgentResponse;
        return result;
        
    } catch (e: any) {
        console.error('UI Agent Error:', e);
        return {
            status: 'error',
            sessionId,
            type: 'query',
            response: `❌ 执行失败: ${e.message}\n\n请确保：\n1. 本地 Agent 服务已启动 (Port 8000)\n2. Chrome 以调试模式运行 (Port 9222)`
        };
    }
};

/**
 * 获取截图列表
 */
export const getUiScreenshots = async (): Promise<ScreenshotsResponse> => {
    try {
        const res = await fetch(`${AGENT_URL}/api/ui_agent/screenshots`);
        if (res.ok) {
            return await res.json();
        }
        throw new Error('获取截图失败');
    } catch (e: any) {
        console.error('获取截图失败:', e);
        return { status: 'error', screenshots: [], total: 0 };
    }
};

/**
 * 清空所有截图
 */
export const clearUiScreenshots = async (): Promise<void> => {
    try {
        await fetch(`${AGENT_URL}/api/ui_agent/screenshots`, { method: 'DELETE' });
        console.log('🗑️ 截图已清空');
    } catch (e) {
        console.log('⚠️ 清空截图失败');
    }
};

export const clearUiSession = async (sessionId: string): Promise<void> => {
    try {
        await fetch(`${AGENT_URL}/api/session/${sessionId}`, { method: 'DELETE' });
        console.log(`🗑️ UI 会话已清除: ${sessionId}`);
    } catch (e) {
        console.log('⚠️ 清除 UI 会话失败');
    }
};

/**
 * 简单自动化测试 - 执行单条自然语言指令
 * 用于不需要生成计划/报告的简单操作
 */
interface SimpleTestResponse {
    status: 'success' | 'error';
    logs: string;
}

export const runSimpleTest = async (prompt: string, url: string): Promise<SimpleTestResponse> => {
    console.log(`🔧 简单自动化测试 | 指令: ${prompt}`);
    
    try {
        const res = await fetch(`${AGENT_URL}/api/run_test`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({ prompt, url })
        });
        
        if (res.ok) {
            return await res.json();
        }
        throw new Error(`Server Error: ${res.statusText}`);
    } catch (e: any) {
        console.error('简单测试失败:', e);
        return {
            status: 'error',
            logs: `执行失败: ${e.message}\n\n请确保本地 Agent 服务已启动。`
        };
    }
};

// ================= Midscene VLM UI 自动化接口 =================

export interface MidsceneTestCase {
    id: string;
    name: string;
    scenario: string;
    expectedResults: string[];
    preconditions?: string;
    testData?: Record<string, any>;
    priority?: string;
    extractSchema?: string;
    /** ★ 新增：独立步骤列表（用于混合模式和自由模式降级） */
    steps?: string[];
}

interface MidsceneAgentOptions {
    sessionId: string;
    instruction?: string;
    testCases?: MidsceneTestCase[];
    url?: string;
    headless?: boolean;
    useCDP?: boolean;
    cdpEndpoint?: string;
    additionalPrds?: Array<{ title: string; content: string }>;
    deepThink?: boolean;
    cacheStrategy?: string;
    aiContext?: string;
    /** 用于取消正在进行的请求（批量执行停止时使用） */
    signal?: AbortSignal;
}

interface MidsceneAssertionResult {
    expected: string;
    success: boolean;
    reason?: string;
}

interface MidsceneAgentResponse {
    status: 'success' | 'error';
    sessionId: string;
    type: 'plan_generated' | 'report_generated' | 'error';
    response: string;
    report?: { type?: string; dir?: string; filePath?: string; logContent?: any };
    reportLogContent?: any;
    midsceneResult?: {
        status: string;
        testcaseName?: string;
        durationMs?: number;
        results?: {
            steps: Array<{ phase: string; success: boolean; error?: string }>;
            assertions: MidsceneAssertionResult[];
            extractions: any[];
        };
        report?: { type?: string; dir?: string; filePath?: string; logContent?: any };
    };
    testcase?: {
        name?: string;
        scenario?: string;
        expectedResults?: string[];
        preconditions?: string;
    };
}

interface MidsceneBatchResultItem {
    testcaseId: string;
    testcaseName: string;
    status: string;
    durationMs?: number;
    assertions?: MidsceneAssertionResult[];
    error?: string;
}

interface MidsceneBatchResponse {
    status: 'success' | 'error';
    sessionId: string;
    results: MidsceneBatchResultItem[];
    summary: {
        total: number;
        passed: number;
        failed: number;
        errors: number;
    };
}

/**
 * Midscene UI 自动化智能体 — 单条执行
 *
 * 支持两种模式:
 * 1. 自由输入: 传 instruction, LLM 解析为结构化用例
 * 2. 用例执行: 传 testCases[], 跳过 LLM 直接执行
 */
export const midsceneAgent = async (options: MidsceneAgentOptions): Promise<MidsceneAgentResponse> => {
    const {
        sessionId, instruction, testCases, url, headless = true,
        useCDP = false, cdpEndpoint,
        additionalPrds, deepThink = false,
        cacheStrategy = 'read-write', aiContext = '',
        signal,
    } = options;

    console.log(`[Midscene] Agent request | Session: ${sessionId} | Mode: ${useCDP ? 'CDP' : headless ? 'headless' : 'headed'}`);
    if (instruction) console.log(`   - instruction: ${instruction}`);
    if (testCases?.length) console.log(`   - testCases: ${testCases.length} cases`);
    console.log(`   - URL: ${url}`);

    try {
        const res = await fetch(`${AGENT_URL}/api/midscene_agent`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({
                sessionId,
                instruction: instruction || '',
                url: url || '',
                headless,
                useCDP,
                ...(cdpEndpoint ? { cdpEndpoint } : {}),
                testCases: testCases && testCases.length > 0 ? testCases : undefined,
                additionalPrds: additionalPrds && additionalPrds.length > 0 ? additionalPrds : undefined,
                deepThink,
                cacheStrategy,
                aiContext,
            }),
            // 传入 AbortSignal，支持从外部取消请求（批量执行停止时使用）
            signal,
        });

        if (!res.ok) {
            throw new Error(`Server Error: ${res.status} ${res.statusText}`);
        }

        return await res.json() as MidsceneAgentResponse;

    } catch (e: any) {
        console.error('Midscene Agent Error:', e);
        return {
            status: 'error',
            sessionId,
            type: 'error',
            response: `Midscene 执行失败: ${e.message}\n\n请确保:\n1. Agent 服务已启动 (Port 8000)\n2. Midscene Sidecar 已启动 (Port 3100)\n   cd agent-server/midscene-sidecar && npm start`
        };
    }
};

/**
 * Midscene 批量执行 — 多条测试用例
 */
export const midsceneAgentBatch = async (options: {
    sessionId: string;
    url: string;
    testCases: MidsceneTestCase[];
    headless?: boolean;
    deepThink?: boolean;
    aiContext?: string;
}): Promise<MidsceneBatchResponse> => {
    const { sessionId, url, testCases, headless = true, deepThink = false, aiContext = '' } = options;

    console.log(`[Midscene] Batch request | ${testCases.length} cases | Session: ${sessionId}`);

    try {
        const res = await fetch(`${AGENT_URL}/api/midscene_agent/batch`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({
                sessionId,
                url,
                testCases,
                headless,
                deepThink,
                aiContext,
            })
        });

        if (!res.ok) {
            throw new Error(`Server Error: ${res.status} ${res.statusText}`);
        }

        return await res.json() as MidsceneBatchResponse;

    } catch (e: any) {
        console.error('Midscene Batch Error:', e);
        return {
            status: 'error',
            sessionId,
            results: [],
            summary: { total: 0, passed: 0, failed: 0, errors: testCases.length },
        };
    }
};

/**
 * Midscene Smart Router — 智能意图路由
 * 用户输入自然语言 → LLM 判断意图 → 自动执行并返回结果
 */
export interface MidsceneSmartResponse {
    status: 'success' | 'error';
    sessionId: string;
    intent: string;     // generate_cases / execute_cases / analyze / free_action / passthrough
    type: string;       // cases_generated / execute / analysis / free_action / passthrough / error
    response: string;
    cases?: any[];
    formattedCases?: string;
    midsceneResult?: any;
    step?: string;      // 前端应跳转的步骤
}

export const midsceneAgentSmart = async (options: {
    sessionId: string;
    instruction: string;
    url?: string;
    screenshot?: string;
    outputFormat?: string;
}): Promise<MidsceneSmartResponse> => {
    const { sessionId, instruction, url, screenshot, outputFormat = 'yaml' } = options;
    console.log(`[Midscene Smart] ${instruction}`);

    try {
        const res = await fetch(`${AGENT_URL}/api/midscene_agent/smart`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify({
                sessionId,
                instruction,
                url: url || '',
                screenshot,
                outputFormat,
            })
        });

        if (!res.ok) throw new Error(`Server Error: ${res.status}`);
        return await res.json() as MidsceneSmartResponse;
    } catch (e: any) {
        return {
            status: 'error', sessionId, intent: 'error', type: 'error',
            response: `Smart router error: ${e.message}`
        };
    }
};

/**
 * 检查 Midscene Sidecar 健康状态
 */
export const checkMidsceneHealth = async (): Promise<boolean> => {
    try {
        const res = await fetch('http://localhost:3100/health', {
            signal: AbortSignal.timeout(3000)
        });
        return res.ok;
    } catch {
        return false;
    }
};

/**
 * 获取 Midscene HTML 报告列表
 */
export const listMidsceneReports = async (): Promise<Array<{
    name: string; path: string; size: number;
    createdAt: string; modifiedAt: string;
}>> => {
    try {
        const res = await fetch('http://localhost:3100/reports', {
            signal: AbortSignal.timeout(3000)
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.reports || [];
    } catch {
        return [];
    }
};


/**
 * Midscene SSE 流式执行 — 实时接收每步执行状态
 *
 * 通过 POST 发送请求到 Sidecar，Sidecar 返回 SSE 流。
 * 由于 EventSource 只支持 GET，这里用 fetch + ReadableStream 模拟 SSE。
 */
export interface MidsceneStreamEvent {
    event: string;  // step_start | screenshot | step_done | assert_done | done | error | status
    data: any;
}

export const midsceneRunTestcaseStream = async (
    options: {
        url: string;
        testcase: MidsceneTestCase;
        useCDP?: boolean;
        cdpEndpoint?: string;
        headless?: boolean;
        aiContext?: string;
    },
    onEvent: (event: MidsceneStreamEvent) => void,
): Promise<void> => {
    const sidecarUrl = 'http://localhost:3100';

    const res = await fetch(`${sidecarUrl}/run-testcase/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: options.url,
            testcase: options.testcase,
            options: {
                useCDP: options.useCDP ?? false,
                cdpEndpoint: options.cdpEndpoint,
                headless: options.headless ?? true,
                aiContext: options.aiContext || '',
            },
        }),
    });

    if (!res.ok || !res.body) {
        onEvent({ event: 'error', data: { message: `Stream failed: ${res.status}` } });
        return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
            if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.slice(6));
                    onEvent({ event: currentEvent || 'message', data });
                } catch {}
                currentEvent = '';
            }
        }
    }
};


// ================= 通用 Ask 接口 =================

// New Ask Interface
export const ask = async (
  options: {
    code?: string;
    type?: string;
    params: {
      text: string;
      pictureKeyList?: string[];
      isImageSolve?: boolean;
      isImageByte64?: boolean;
      [key: string]: any;
    };
    sessionId?: string;
    instruction?: string; // 用户输入的补充说明（后端会放进 [补充说明] 标签）
    onMessage?: (text: string) => void;
    additionalPrds?: Array<{ title: string; content: string }>;  // 辅助PRD列表
    docRefs?: Array<{ docId: string; kind?: string; title?: string; hash?: string; logicalId?: string; length?: number; contentType?: string }>; // docRefs-only 链路
    targetLogicalId?: string; // chat/edit 目标右侧文档 logicalId
    outputFormat?: 'xmind' | 'table' | 'yaml'; // 测试用例输出格式
  }
) => {
  const sessionId = options.sessionId || `mvp-${Date.now()}`;
  const body: any = {
    sessionId,
    code: options.code || "plugin_test_testprd",
    type: options.type || "testprd",
    params: options.params,
    instruction: (options.instruction || '').trim() || undefined,
  };

  // ✅ docRefs-only
  if (options.docRefs && options.docRefs.length > 0) {
    body.docRefs = options.docRefs;
  }

  // ✅ chat/edit target
  if (options.targetLogicalId) {
    body.targetLogicalId = options.targetLogicalId;
  }

  // ✅ 测试用例输出格式
  if (options.outputFormat) {
    body.outputFormat = options.outputFormat;
  }

  // 下面继续追加其它字段


  // 添加辅助PRD参数（如果有）
  if (options.additionalPrds && options.additionalPrds.length > 0) {
    body.additionalPrds = options.additionalPrds;
  }

  // ================= 远程连接排查日志（关键：请求体大小/字段长度） =================
  // 说明：curl 成功但插件失败时，最常见原因是“插件请求体过大”，服务端/网关会直接断开连接，
  // 浏览器侧表现为 net::ERR_CONNECTION_CLOSED / TypeError: Failed to fetch。
  const stringifySafe = (obj: any) => {
    try {
      return JSON.stringify(obj);
    } catch (e) {
      return '';
    }
  };

  const safeLen = (s: any) => (typeof s === 'string' ? s.length : 0);
  const safeArrLen = (a: any) => (Array.isArray(a) ? a.length : 0);

  const rawText = body?.params?.text;
  const rawPics = body?.params?.pictureKeyList;
  const rawAdditional = body?.additionalPrds;
  const payloadStr0 = stringifySafe(body);

  console.log(`🧭 [ask] url=${AGENT_URL}/api/ask`);
  console.log(`   - mode=${isRemoteMode() ? 'remote' : 'local'}`);
  console.log(`   - bytes=${payloadStr0 ? payloadStr0.length : -1}`);
  console.log(`   - textLen=${safeLen(rawText)}`);
  console.log(`   - pictureKeyList=${safeArrLen(rawPics)}`);
  console.log(`   - additionalPrds=${safeArrLen(rawAdditional)}`);
  if (Array.isArray(rawAdditional) && rawAdditional.length > 0) {
    const preview = rawAdditional.slice(0, 5).map((d: any) => ({
      title: d?.title,
      contentLen: safeLen(d?.content),
    }));
    console.log(`   - additionalPrdsPreview(<=5)=`, preview);
  }

  // 远程模式下做一个“超大请求”兜底：避免直接断链无响应（本地不限制，方便调试）
  // Cloud Run / 代理层通常对请求体有大小限制，过大时会直接断开连接。
  const MAX_REMOTE_BYTES = 900_000; // 约 0.9MB：足够覆盖绝大多数文本场景，避免超大文档导致断链
  const MAX_REMOTE_TEXT = 120_000;  // text 最大 12 万字符（按需可调）
  const MAX_REMOTE_ADDITIONAL = 6;  // 最多携带 6 个辅助文档
  const MAX_REMOTE_ADDITIONAL_TEXT = 60_000; // 每个辅助文档最多 6 万字符

  if (isRemoteMode()) {
    // 1) 优先截断字段，再计算一次 bytes
    if (typeof body?.params?.text === 'string' && body.params.text.length > MAX_REMOTE_TEXT) {
      console.warn(`⚠️ [ask] remote text too large: ${body.params.text.length}, truncate to ${MAX_REMOTE_TEXT}`);
      body.params.text = body.params.text.slice(0, MAX_REMOTE_TEXT);
    }
    if (Array.isArray(body?.additionalPrds) && body.additionalPrds.length > MAX_REMOTE_ADDITIONAL) {
      console.warn(`⚠️ [ask] remote additionalPrds too many: ${body.additionalPrds.length}, keep first ${MAX_REMOTE_ADDITIONAL}`);
      body.additionalPrds = body.additionalPrds.slice(0, MAX_REMOTE_ADDITIONAL);
    }
    if (Array.isArray(body?.additionalPrds)) {
      body.additionalPrds = body.additionalPrds.map((d: any) => {
        const title = d?.title || '';
        const content = typeof d?.content === 'string' ? d.content : '';
        if (content.length > MAX_REMOTE_ADDITIONAL_TEXT) {
          return { ...d, title, content: content.slice(0, MAX_REMOTE_ADDITIONAL_TEXT) };
        }
        return { ...d, title, content };
      });
    }

    const payloadStr1 = stringifySafe(body);
    if (payloadStr1 && payloadStr1.length > MAX_REMOTE_BYTES) {
      // 2) 仍然过大：直接抛出可读错误，避免浏览器只看到“Failed to fetch”
      const errMsg =
        `Error: Remote request payload too large (${payloadStr1.length} bytes). ` +
        `Please reduce PRD/reference content or use fewer documents, then retry.`;
      console.error(`❌ [ask] ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  const response = await fetch(`${AGENT_URL}/api/ask`, {
     method: 'POST',
    headers: buildHeaders(),
     body: JSON.stringify(body)
  });

  if (!response.ok) {
    // 错误信息必须为英文
    throw new Error(`Error: API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { status: 'success' | 'error'; sessionId: string; answer: string; error?: string };
  if (data.status !== 'success') {
    throw new Error(data.error || 'Error: ask failed.');
  }

  if (options.onMessage) {
    // 本地版本暂不做流式，直接一次性回调
    options.onMessage(data.answer || '');
                  }

  return {
    answer: data.answer || '',
    sessionId: data.sessionId || sessionId,
    mode: data.mode, // 'analysis' | 'edit'（chat 才有）
    updatedDocument: data.updatedDocument,
    editSummary: data.editSummary,
    generatedDocRef: data.generatedDocRef,
    usedDocRefs: data.usedDocRefs || [],
  };
};

// ================= 质量评估接口 =================

import type { EvaluationReport } from '@/types/chat';

interface EvaluateResponse {
  status: 'success' | 'error';
  score?: number;
  summary?: string;
  coverage_gap?: string[];
  logic_issues?: Array<{ id: string; issue: string; severity: 'high' | 'medium' | 'low' }>;
  duplicates?: string[];
  suggestions?: string[];
  quality_breakdown?: Record<string, number>;
  message?: string;
}

/**
 * 质量评估 - 评估测试用例质量
 *
 * @param prdText PRD 原文
 * @param testcasesText 测试用例文本（Markdown 格式）
 * @param ragContext 可选 RAG 上下文
 */
export const evaluateTestCases = async (
  prdText: string,
  testcasesText: string,
  ragContext?: string,
): Promise<EvaluationReport> => {
  const formData = new FormData();
  formData.append('prdText', prdText);
  formData.append('testcasesText', testcasesText);
  if (ragContext) {
    formData.append('ragContext', ragContext);
  }

  const res = await fetch(`${AGENT_URL}/api/evaluate`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Error: evaluate request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as EvaluateResponse;

  if (data.status !== 'success') {
    throw new Error(data.message || 'Error: evaluation failed.');
  }

  return {
    score: data.score ?? 0,
    summary: data.summary ?? '',
    coverage_gap: data.coverage_gap ?? [],
    logic_issues: (data.logic_issues ?? []).map(i => ({
      id: i.id,
      issue: i.issue,
      severity: i.severity,
    })),
    duplicates: data.duplicates ?? [],
    suggestions: data.suggestions ?? [],
    risk_points: [],
    supplementary_cases: [],
  };
};


// ================= Midscene 缓存管理 API =================

const MIDSCENE_SIDECAR_URL = 'http://localhost:3100';

/** 缓存条目信息 */
export interface MidsceneCacheItem {
  id: string;
  fileName: string;
  sizeBytes: number;
  lastModified: string;
  planCount: number;
  locateCount: number;
}

/** 缓存列表响应 */
export interface MidsceneCacheListResponse {
  caches: MidsceneCacheItem[];
  totalSize: number;
  cacheDir: string;
}

/** 获取缓存列表 */
export const getMidsceneCacheList = async (): Promise<MidsceneCacheListResponse> => {
  try {
    const res = await fetch(`${MIDSCENE_SIDECAR_URL}/cache/list`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e: any) {
    console.error('[cache] 获取缓存列表失败:', e.message);
    return { caches: [], totalSize: 0, cacheDir: '' };
  }
};

/** 删除指定缓存 */
export const deleteMidsceneCache = async (cacheId: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const res = await fetch(`${MIDSCENE_SIDECAR_URL}/cache/${encodeURIComponent(cacheId)}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(5000),
    });
    return await res.json();
  } catch (e: any) {
    console.error('[cache] 删除缓存失败:', e.message);
    return { success: false, message: e.message };
  }
};

/** 清空所有缓存 */
export const clearAllMidsceneCache = async (): Promise<{ success: boolean; deleted: number }> => {
  try {
    const res = await fetch(`${MIDSCENE_SIDECAR_URL}/cache`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(5000),
    });
    return await res.json();
  } catch (e: any) {
    console.error('[cache] 清空缓存失败:', e.message);
    return { success: false, deleted: 0 };
  }
};


// ================= 即时操作 & 三模式执行 API =================

/** 即时操作步骤类型 */
export type InstantActionType = 'tap' | 'doubleTap' | 'rightClick' | 'hover' | 'input' | 'keypress' | 'scroll' | 'aiAct';

/** 即时操作步骤 */
export interface InstantStep {
  type: InstantActionType;
  target?: string;
  value?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  original: string;
  confidence?: number;
}

/** 逐步执行结果（单步） */
export interface InstantStepResult {
  stepIndex: number;
  type: string;
  target?: string;
  value?: string;
  original: string;
  success: boolean;
  method: 'instant' | 'aiAct-single' | 'aiAct-deepThink';
  error?: string;
  suggestion?: string;
  durationMs: number;
}

/** 回归基线元数据 */
export interface RegressionBaseline {
  id: string;
  caseId: string;
  caseName: string;
  url: string;
  stepsCount: number;
  assertionsCount: number;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  lastRunStatus?: 'passed' | 'failed';
  lastRunDurationMs?: number;
}

/** 混合模式执行选项 */
export interface RunInstantOptions {
  url: string;
  steps?: InstantStep[];
  rawSteps?: string[];
  assertions?: string[];
  caseId?: string;
  caseName?: string;
  options: {
    useCDP?: boolean;
    cdpEndpoint?: string;
    headless?: boolean;
    cache?: { strategy: string; id: string };
    aiContext?: string;
    deepThink?: boolean;
    startFromStep?: number;
  };
}

/** 混合模式执行结果 */
export interface RunInstantResult {
  status: 'passed' | 'failed';
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  durationMs: number;
  steps: InstantStepResult[];
  assertions: Array<{ expected: string; success: boolean; reason?: string }>;
  regressionYaml?: string;
}

// ---------- 混合模式 API ----------

/** 混合模式执行（同步） */
export const midsceneRunInstant = async (options: RunInstantOptions): Promise<RunInstantResult> => {
  const res = await fetch(`${MIDSCENE_SIDECAR_URL}/run-instant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return await res.json();
};

/** 混合模式执行（SSE 流式） */
export const midsceneRunInstantStream = (
  options: RunInstantOptions,
  onEvent: (event: string, data: any) => void,
  signal?: AbortSignal,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    fetch(`${MIDSCENE_SIDECAR_URL}/run-instant/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
      signal,
    })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processChunk = ({ done, value }: ReadableStreamReadResult<Uint8Array>): void | Promise<void> => {
        if (done) { resolve(); return; }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        let eventName = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventName = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onEvent(eventName || 'message', data);
              if (eventName === 'done' || eventName === 'error') {
                resolve();
                return;
              }
            } catch {}
          }
        }
        return reader!.read().then(processChunk);
      };

      reader!.read().then(processChunk);
    })
    .catch(reject);
  });
};

// ---------- 回归模式 API ----------

/** 回归模式执行（runYaml） */
export const midsceneRunYaml = async (options: {
  yamlContent?: string;
  regressionId?: string;
  options: {
    useCDP?: boolean;
    cdpEndpoint?: string;
    headless?: boolean;
    cacheStrategy?: string;
  };
}): Promise<any> => {
  const res = await fetch(`${MIDSCENE_SIDECAR_URL}/run-yaml`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return await res.json();
};

// ---------- 回归基线管理 API ----------

/** 列出所有回归基线 */
export const listRegressionBaselines = async (): Promise<{
  total: number;
  baselines: RegressionBaseline[];
}> => {
  try {
    const res = await fetch(`${MIDSCENE_SIDECAR_URL}/regression/list`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { total: data.total || 0, baselines: data.baselines || [] };
  } catch (e: any) {
    console.error('[regression] 获取基线列表失败:', e.message);
    return { total: 0, baselines: [] };
  }
};

/** 获取指定回归基线详情 */
export const getRegressionBaseline = async (id: string): Promise<{
  baseline: RegressionBaseline;
  yamlContent: string;
  parsed: { url: string; steps: InstantStep[]; assertions: string[] };
} | null> => {
  try {
    const res = await fetch(`${MIDSCENE_SIDECAR_URL}/regression/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.status === 'ok' ? data : null;
  } catch (e: any) {
    console.error('[regression] 获取基线详情失败:', e.message);
    return null;
  }
};

/** 保存回归基线 */
export const saveRegressionBaseline = async (data: {
  yamlContent?: string;
  steps?: InstantStep[];
  assertions?: string[];
  caseId: string;
  caseName: string;
  url: string;
  cacheStrategy?: string;
}): Promise<{ status: string; baseline?: RegressionBaseline }> => {
  const res = await fetch(`${MIDSCENE_SIDECAR_URL}/regression/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return await res.json();
};

/** 更新回归基线 */
export const updateRegressionBaseline = async (id: string, data: {
  yamlContent?: string;
  steps?: InstantStep[];
  assertions?: string[];
}): Promise<{ status: string; baseline?: RegressionBaseline }> => {
  const res = await fetch(`${MIDSCENE_SIDECAR_URL}/regression/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return await res.json();
};

/** 删除回归基线 */
export const deleteRegressionBaseline = async (id: string): Promise<{ status: string }> => {
  const res = await fetch(`${MIDSCENE_SIDECAR_URL}/regression/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return await res.json();
};

/** 刷新回归基线（获取数据供前端重新执行） */
export const refreshRegressionBaseline = async (id: string): Promise<{
  baseline: RegressionBaseline;
  parsed: { url: string; steps: InstantStep[]; assertions: string[] };
} | null> => {
  try {
    const res = await fetch(`${MIDSCENE_SIDECAR_URL}/regression/${encodeURIComponent(id)}/refresh`, {
      method: 'POST',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e: any) {
    console.error('[regression] 刷新基线失败:', e.message);
    return null;
  }
};
