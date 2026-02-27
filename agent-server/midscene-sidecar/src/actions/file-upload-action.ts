/**
 * 文件上传自定义动作
 *
 * 通过 Midscene 的 defineAction 注册两个自定义动作：
 * 1. FileUpload - 点击上传：AI 规划器遇到上传场景时自动触发 fileChooserAccept
 * 2. FileDrop - 拖拽上传：AI 规划器遇到拖拽场景时自动模拟文件拖入
 *
 * 注入方式：在 PuppeteerAgent 构造时传入 customActions
 */
import fs from 'fs';
import path from 'path';

/**
 * 获取 MIME 类型
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
    '.pdf': 'application/pdf', '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain', '.csv': 'text/csv', '.json': 'application/json',
    '.zip': 'application/zip', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

/**
 * 自定义动作：FileUpload
 * 当 AI 规划器判断需要「点击上传文件」时自动调用
 * 通过 page 的 fileChooser 事件拦截来完成文件选择
 */
export const FileUploadAction = {
  name: 'FileUpload',
  description: '点击上传文件 - 当页面有文件选择按钮或 input[type=file] 时，点击并选择指定文件。适用于"上传文件"、"选择文件"、"添加附件"等场景。',
  params: {
    filePaths: {
      type: 'string' as const,
      description: '要上传的文件路径，多个文件用逗号分隔。例如: /Users/mac/test.png,/Users/mac/doc.pdf',
      required: true,
    },
  },
  /**
   * 动作执行函数
   * @param params - AI 规划器传入的参数
   * @param context - Midscene 提供的执行上下文（包含 page、agent 等）
   */
  async executor(params: { filePaths: string }, context: any) {
    const paths = params.filePaths.split(',').map(p => p.trim()).filter(Boolean);
    const validPaths = paths.filter(p => {
      if (!fs.existsSync(p)) {
        console.warn(`[FileUpload] 文件不存在: ${p}`);
        return false;
      }
      return true;
    });

    if (validPaths.length === 0) {
      throw new Error('No valid file paths provided for upload');
    }

    console.log(`[FileUpload] 开始点击上传: ${validPaths.join(', ')}`);

    const page = context.page;
    // 监听 file chooser 事件并自动选择文件
    const [fileChooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 10000 }),
      // 尝试点击文件上传按钮
      page.evaluate(() => {
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) {
          fileInput.click();
        } else {
          // 尝试找上传按钮
          const uploadBtn = document.querySelector('[class*="upload"]') ||
            document.querySelector('[data-testid*="upload"]') ||
            document.querySelector('button:has([class*="upload"])');
          if (uploadBtn) (uploadBtn as HTMLElement).click();
        }
      }),
    ]);

    await fileChooser.accept(validPaths);
    // 等待上传处理
    await new Promise(r => setTimeout(r, 2000));
    console.log(`[FileUpload] 点击上传完成`);

    return { success: true, uploadedFiles: validPaths.map(p => path.basename(p)) };
  },
};

/**
 * 自定义动作：FileDrop
 * 当 AI 规划器判断需要「拖拽上传文件」时自动调用
 * 通过 page.evaluate 在浏览器中构造 DataTransfer + DragEvent 模拟拖入
 */
export const FileDropAction = {
  name: 'FileDrop',
  description: '拖拽上传文件 - 将文件拖入页面的拖拽上传区域。适用于"拖拽文件"、"拖放上传"、"拖入文件"等场景。',
  params: {
    filePaths: {
      type: 'string' as const,
      description: '要拖拽的文件路径，多个文件用逗号分隔。例如: /Users/mac/test.png',
      required: true,
    },
    dropTarget: {
      type: 'string' as const,
      description: '拖拽目标的 CSS 选择器（可选），例如: .upload-area, .dropzone',
      required: false,
    },
  },
  async executor(params: { filePaths: string; dropTarget?: string }, context: any) {
    const paths = params.filePaths.split(',').map(p => p.trim()).filter(Boolean);
    const validPaths = paths.filter(p => {
      if (!fs.existsSync(p)) {
        console.warn(`[FileDrop] 文件不存在: ${p}`);
        return false;
      }
      return true;
    });

    if (validPaths.length === 0) {
      throw new Error('No valid file paths provided for drag-drop');
    }

    console.log(`[FileDrop] 开始拖拽上传: ${validPaths.join(', ')}`);

    const page = context.page;
    const fileDataList = validPaths.map(fp => ({
      name: path.basename(fp),
      mimeType: getMimeType(fp),
      base64: fs.readFileSync(fp).toString('base64'),
    }));

    await page.evaluate(async (
      files: Array<{ name: string; mimeType: string; base64: string }>,
      selector?: string,
    ) => {
      function base64ToUint8Array(base64: string): Uint8Array {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      }

      const dataTransfer = new DataTransfer();
      for (const f of files) {
        const bytes = base64ToUint8Array(f.base64);
        const file = new File([bytes as unknown as BlobPart], f.name, { type: f.mimeType });
        dataTransfer.items.add(file);
      }

      let dropTarget: Element | null = null;
      if (selector) dropTarget = document.querySelector(selector);
      if (!dropTarget) {
        const candidates = [
          '[class*="drop"]', '[class*="upload"]', '[class*="dropzone"]',
          '[class*="drag"]', '[data-testid*="upload"]', '[data-testid*="drop"]',
          'input[type="file"]', '.upload-area', '.drop-area', '.file-drop',
        ];
        for (const sel of candidates) {
          dropTarget = document.querySelector(sel);
          if (dropTarget) break;
        }
      }
      if (!dropTarget) dropTarget = document.body;

      const eventInit = { dataTransfer, bubbles: true, cancelable: true };
      dropTarget.dispatchEvent(new DragEvent('dragenter', eventInit));
      dropTarget.dispatchEvent(new DragEvent('dragover', eventInit));
      dropTarget.dispatchEvent(new DragEvent('drop', eventInit));
      dropTarget.dispatchEvent(new DragEvent('dragleave', eventInit));
    }, fileDataList, params.dropTarget);

    await new Promise(r => setTimeout(r, 2000));
    console.log(`[FileDrop] 拖拽上传完成`);

    return { success: true, droppedFiles: validPaths.map(p => path.basename(p)) };
  },
};

/**
 * 获取所有文件上传相关的自定义动作
 * 在 PuppeteerAgent 构造时传入 customActions 配置项
 */
export function getFileUploadActions() {
  return [FileUploadAction, FileDropAction];
}
