import { getLocalAgentUrl } from '@/utils/agentUrl';
import { generateFileMD5 } from '@/utils/md5';
import { browser } from 'wxt/browser';

// ================= 本地模式（只使用本地 agent-server） =================
// 说明：
// - 所有能力统一走本地 agent-server（默认 http://localhost:8000）
// - 网页提取链路需要把“页面图片 + 拼接长截图”上传换取 cdnUrl

// 智能体服务器地址（强制本地模式：仅允许 localhost/127.0.0.1）
const LOCAL_AGENT_URL = getLocalAgentUrl();

// ================= 依赖 webserver 上传接口：uploadurl / uploadurl/file =================
const UPLOAD_CFG_STORAGE_KEY = 'SOLVELY_UPLOAD_CONFIG';

type UploadConfig = {
    base?: string;
    token?: string;
    pluginUuid?: string;
};

const getUploadConfig = async (): Promise<Required<UploadConfig>> => {
    const envBase = (import.meta as any).env?.VITE_SOLVELY_UPLOAD_BASE as string | undefined;
    const envToken = (import.meta as any).env?.VITE_SOLVELY_AUTH_TOKEN as string | undefined;
    const envUuid = (import.meta as any).env?.VITE_SOLVELY_PLUGIN_UUID as string | undefined;

    // 优先环境变量（构建期注入）
    if (envToken) {
        return {
            base: (envBase || 'https://dev-webserver.solvely.ai').trim(),
            token: envToken.trim(),
            pluginUuid: (envUuid || '').trim(),
        };
    }

    // fallback：从 chrome.storage.local 读取（运行时可配置）
    const stored = await browser.storage.local.get(UPLOAD_CFG_STORAGE_KEY);
    const cfg = (stored?.[UPLOAD_CFG_STORAGE_KEY] || {}) as UploadConfig;

    const base = (cfg.base || envBase || 'https://dev-webserver.solvely.ai').trim();
    const token = (cfg.token || '').trim();
    const pluginUuid = (cfg.pluginUuid || envUuid || '').trim();

    if (!token) {
        throw new Error('Error: Upload auth token is not configured. Please set it in extension settings.');
    }
    return { base, token, pluginUuid };
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
        const localRes = await fetch(`${LOCAL_AGENT_URL}/api/prd`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        await fetch(`${LOCAL_AGENT_URL}/api/session/${sessionId}`, {
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
}

interface TestCaseAgentResponse {
    status: 'success' | 'error';
    sessionId: string;
    type: 'query' | 'delete' | 'add' | 'modify';
    response: string;
    newTestcase?: string;
}

export const testCaseAgent = async (options: TestCaseAgentOptions): Promise<TestCaseAgentResponse> => {
    const { sessionId, text, instruction, additionalPrds } = options;
    console.log(`🧪 Test Case Agent 请求 | Session: ${sessionId}`);
    console.log(`   - 指令: ${instruction || '(首次调用)'}`);

    // 1. 尝试本地 Agent
    try {
        const localRes = await fetch(`${LOCAL_AGENT_URL}/api/testcase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                code: 'plugin_test_testcase',
                type: 'testcase',
                params: { text },
                additionalPrds: additionalPrds && additionalPrds.length > 0 ? additionalPrds : undefined,
                instruction
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
        await fetch(`${LOCAL_AGENT_URL}/api/session/${sessionId}`, { method: 'DELETE' });
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
    additionalPrds?: Array<{ title: string; content: string }>; // 辅助参考文档列表（可多选）
}

interface UiAgentResponse {
    status: 'success' | 'error';
    sessionId: string;
    type: 'query' | 'plan_generated' | 'report_generated';
    response: string;
    plan?: string;
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

interface ChatAgentOptions {
    sessionId: string;
    role: 'pm' | 'dev';
    message: string;
    additionalPrds?: Array<{ title: string; content: string }>; // 辅助参考文档列表（可多选）
}

interface ChatAgentResponse {
    status: 'success' | 'error';
    sessionId: string;
    reply: string;
}

/**
 * PM/DEV Chat-only（走本地 Agent + LangGraph）
 */
export const chatAgent = async (options: ChatAgentOptions): Promise<ChatAgentResponse> => {
    const { sessionId, role, message, additionalPrds } = options;
    try {
        const res = await fetch(`${LOCAL_AGENT_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, role, message, additionalPrds: additionalPrds && additionalPrds.length > 0 ? additionalPrds : undefined })
        });
        if (!res.ok) {
            if (res.status === 404) {
                // 错误信息必须为英文
                throw new Error(`Local agent endpoint not found: ${LOCAL_AGENT_URL}/api/chat. Please update and restart agent-server.`);
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
    const { sessionId, instruction, url, plan, report, headless = false, additionalPrds } = options;
    console.log(`🤖 UI Agent 请求 | Session: ${sessionId}`);
    console.log(`   - 指令: ${instruction}`);
    console.log(`   - URL: ${url}`);
    console.log(`   - 模式: ${headless ? '无头' : '有头'}`);

    try {
        const localRes = await fetch(`${LOCAL_AGENT_URL}/api/ui_agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                code: 'plugin_test_uinocode',
                type: 'uinocode',
                params: { 
                    url: url || '',
                    plan: plan || '',
                    report: report || '',
                    headless: headless
                },
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
        const res = await fetch(`${LOCAL_AGENT_URL}/api/ui_agent/screenshots`);
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
        await fetch(`${LOCAL_AGENT_URL}/api/ui_agent/screenshots`, { method: 'DELETE' });
        console.log('🗑️ 截图已清空');
    } catch (e) {
        console.log('⚠️ 清空截图失败');
    }
};

export const clearUiSession = async (sessionId: string): Promise<void> => {
    try {
        await fetch(`${LOCAL_AGENT_URL}/api/session/${sessionId}`, { method: 'DELETE' });
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
        const res = await fetch(`${LOCAL_AGENT_URL}/api/run_test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
    onMessage?: (text: string) => void;
    additionalPrds?: Array<{ title: string; content: string }>;  // 辅助PRD列表
  }
) => {
  const sessionId = options.sessionId || `mvp-${Date.now()}`;
  const body: any = {
    sessionId,
    code: options.code || "plugin_test_testprd",
    type: options.type || "testprd",
    params: options.params
  };

  // 添加辅助PRD参数（如果有）
  if (options.additionalPrds && options.additionalPrds.length > 0) {
    body.additionalPrds = options.additionalPrds;
  }

  const response = await fetch(`${LOCAL_AGENT_URL}/api/ask`, {
     method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

  return { answer: data.answer || '', sessionId: data.sessionId || sessionId };
};
