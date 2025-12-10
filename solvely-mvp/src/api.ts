import axios from 'axios';
import { generateFileMD5 } from '@/utils/md5';

// ================= 环境变量配置 =================
// 敏感信息从 .env 文件读取，不硬编码在代码中
// Vite/WXT 使用 import.meta.env.VITE_* 访问环境变量

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api-web.solvely.ai';
const AUTH_TOKEN = import.meta.env.VITE_AUTH_TOKEN || '';
const DEVICE_ID = import.meta.env.VITE_DEVICE_ID || 'l3SinKrDR7QSx2v9GcaspRaRpqP2';
const PLUGIN_UUID = import.meta.env.VITE_PLUGIN_UUID || 'ce61a089-26db-43f2-b850-2ec86a377b99';

// 开发环境警告检查
if (!AUTH_TOKEN && import.meta.env.DEV) {
    console.warn('⚠️ VITE_AUTH_TOKEN 未设置！请在 .env 文件中配置。');
}

// Configure Axios
const http = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'x-plugin-uuid': PLUGIN_UUID,
        'origin': 'chrome-extension://aedglnfjjccpifohekdeoogffomjcikm' 
    }
});

// Helper to get Upload URL
const getUploadUrl = (params: object) => http.post(`/uploadurl`, params);

// Helper to upload to S3 (Direct)
const uploadToS3Direct = async (url: string, file: Blob, contentType: string, contentMD5: string) => {
    // S3 PUT requires specific headers to match the signature
    const instance = axios.create();
    await instance.put(url, file, {
        headers: {
            'Content-Type': contentType,
            'Content-MD5': contentMD5, // Must use Base64 MD5 here
            'x-plugin-uuid': PLUGIN_UUID
        }
    });
};

// 1. Upload Screenshot Context
export const postRetrieve = async (params: { pictures?: string[], dom?: string }) => {
    console.log("API: Uploading Context...", params);
    
    try {
        let cdnUrl = '';

        if (params.pictures && params.pictures.length > 0) {
            const base64Data = params.pictures[0];
            const res = await fetch(base64Data);
            const blob = await res.blob();
            const fileName = `optimized-slice-${Date.now()}-5.webp`; 
            const file = new File([blob], fileName, { type: 'image/webp' });
            
            // 1. Calculate MD5 (Hex & Base64)
            const { hex, base64 } = await generateFileMD5(file);
            console.log("Calculated MD5 Hex:", hex);
            console.log("Calculated MD5 Base64:", base64);

            // 2. Get Upload URL using HEX MD5
            // IMPORTANT: Solvely API expects HEX MD5 in `contentMD5` field for generating signature
            const uploadPayload = {
                deviceId: "", 
                files: [{
                    fileName: fileName,
                    contentMD5: hex // Use Hex here for API request
                }]
            };
            
            const urlRes = await getUploadUrl(uploadPayload);
            const fileInfo = urlRes.data.data[0]; 

            // 3. Upload to S3 using Base64 MD5
            // IMPORTANT: S3 PUT header `Content-MD5` expects BASE64 encoded MD5
            await uploadToS3Direct(fileInfo.url, file, 'image/webp', base64);
            
            cdnUrl = fileInfo.cdnUrl;
            console.log("Screenshot Uploaded, CDN URL:", cdnUrl);
        }
        
        return { 
            success: true, 
            cdnUrl: cdnUrl
        };
        
    } catch (e) {
        console.error("Context Upload Failed", e);
        throw e;
    }
};

// 3. Generic Image Upload
export const uploadImage = async (base64Data: string): Promise<string> => {
    try {
        const res = await fetch(base64Data);
        const blob = await res.blob();
        const fileName = `image-${Date.now()}.png`;
        const file = new File([blob], fileName, { type: blob.type || 'image/png' });

        const { hex, base64 } = await generateFileMD5(file);

        const uploadPayload = {
            deviceId: "",
            files: [{
                fileName: fileName,
                contentMD5: hex
            }]
        };

        const urlRes = await getUploadUrl(uploadPayload);
        const fileInfo = urlRes.data.data[0];

        await uploadToS3Direct(fileInfo.url, file, file.type, base64);

        console.log("Image Uploaded:", fileInfo.cdnUrl);
        return fileInfo.cdnUrl;
    } catch (e) {
        console.error("Image Upload Failed", e);
        throw e;
    }
};
const NEW_API_URL = 'http://public-test.justsolvely.com/solvelyPubServer/v1/plugin/context/ask';
const LOCAL_AGENT_URL = 'http://localhost:8000';

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
    const { sessionId, text, instruction, pictureKeyList, isImageSolve, isImageByte64 } = options;
    
    console.log(`📝 PRD Agent 请求 | Session: ${sessionId}`);
    console.log(`   - 指令: ${instruction || '(首次调用)'}`);
    
    // 1. 优先尝试本地 Agent
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
                instruction
            })
        });
        
        if (localRes.ok) {
            const result = await localRes.json();
            if (result.status !== 'error') {
                console.log('✅ 使用本地 Agent');
                return result as PrdAgentResponse;
            }
        }
    } catch (e) {
        console.log('⚠️ 本地 Agent 不可用，尝试远程 API');
    }
    
    // 2. 回退到远程 API
    console.log('🌐 使用远程 API');
    
    const systemPrompt = `你是一个专业的产品需求文档(PRD)智能助手。必须使用中文回复。

当前PRD文档内容：
---
${text.slice(0, 6000)}
---

根据用户请求执行操作，返回 JSON 格式：
- 分析类：{ "type": "query", "response": "分析结果(中文Markdown)" }
- 删除类：{ "type": "delete", "response": "已删除xxx", "newPrd": "完整修改后PRD" }
- 增加/修改类：{ "type": "add" 或 "modify", "response": "已修改xxx", "newPrd": "完整修改后PRD" }

⚠️ 删除操作严格规则：
- 只删除用户明确指定的部分，保留其他所有内容
- 必须保留所有图片链接`;

    const aiRes = await ask({
        code: 'plugin_test_prdagent',
        type: 'prdagent',
        sessionId: sessionId,
        params: {
            text: `${systemPrompt}\n\n用户请求：${instruction || '分析当前PRD'}`,
            pictureKeyList: pictureKeyList || [],
            isImageSolve: isImageSolve ?? true,
            isImageByte64: isImageByte64 ?? true
        }
    });
    
    // 解析 AI 返回的 JSON
    try {
        const jsonMatch = aiRes.answer.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                status: 'success',
                sessionId: aiRes.sessionId,
                type: parsed.type || 'query',
                response: parsed.response || aiRes.answer,
                newPrd: parsed.newPrd
            };
        }
    } catch (e) {
        console.error('JSON 解析失败，返回原始内容');
    }
    
    return {
        status: 'success',
        sessionId: aiRes.sessionId,
        type: 'query',
        response: aiRes.answer
    };
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
}

interface TestCaseAgentResponse {
    status: 'success' | 'error';
    sessionId: string;
    type: 'query' | 'delete' | 'add' | 'modify';
    response: string;
    newTestcase?: string;
}

export const testCaseAgent = async (options: TestCaseAgentOptions): Promise<TestCaseAgentResponse> => {
    const { sessionId, text, instruction } = options;
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

/**
 * UI 自动化智能体
 * 
 * 功能：
 * 1. 生成测试计划 - 分析页面并生成结构化测试计划
 * 2. 执行测试并生成报告 - 根据计划执行测试，截图保存在后端
 * 3. 分析/问答 - 回答用户关于测试的问题
 */
export const uiAgent = async (options: UiAgentOptions): Promise<UiAgentResponse> => {
    const { sessionId, instruction, url, plan, report } = options;
    console.log(`🤖 UI Agent 请求 | Session: ${sessionId}`);
    console.log(`   - 指令: ${instruction}`);
    console.log(`   - URL: ${url}`);

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
                    report: report || ''
                },
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
  }
) => {
  const sessionId = options.sessionId || `mvp-${Date.now()}`;
  const body = {
    deviceId: DEVICE_ID,
    platform: "plugin",
    sessionId: sessionId,
    code: options.code || "plugin_test_testprd",
    type: options.type || "testprd",
    params: options.params
  };

  console.log("API: Asking...", body);

  const response = await fetch(NEW_API_URL, {
     method: 'POST',
     headers: {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${AUTH_TOKEN}`,
         'x-plugin-uuid': PLUGIN_UUID
     },
     body: JSON.stringify(body)
  });

  if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  if (reader) {
      try {
          while (true) {
              const { done, value } = await reader.read();
              if (done) {
                  if (buffer.trim()) {
                      try {
                          const data = JSON.parse(buffer.trim());
                          if (data.data?.content) {
                              fullContent += data.data.content;
                              if (options.onMessage) options.onMessage(data.data.content);
                          }
                      } catch (e) {}
                  }
                  break;
              }
              
              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;
              
              const parts = buffer.split('solvelyPublicServer:');
              buffer = parts.pop() || '';
              
              for (const part of parts) {
                  if (!part.trim()) continue;
                  try {
                      const data = JSON.parse(part.trim());
                      if (data.data?.content) {
                          fullContent += data.data.content;
                          if (options.onMessage) options.onMessage(data.data.content);
                      }
                  } catch (e) {
                      console.error("Parse error", e);
                  }
              }

              // Optimistic parse for buffer
              const trimmed = buffer.trim();
              if (trimmed.endsWith('}')) {
                  try {
                      const data = JSON.parse(trimmed);
                      if (data.data?.content) {
                          fullContent += data.data.content;
                          if (options.onMessage) options.onMessage(data.data.content);
                      }
                      buffer = '';
                  } catch (e) {}
              }
          }
      } catch (err) {
          console.error("Stream reading error", err);
      }
  }
  
  return { answer: fullContent, sessionId: sessionId };
};
