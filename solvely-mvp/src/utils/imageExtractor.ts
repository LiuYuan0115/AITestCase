/**
 * 图片提取器
 * Phase 2: 异步下载图片，转为 base64，上传到 CDN
 * 用于"提取当前页"功能，将图片嵌入 PDF
 */

import { uploadImage } from '../api';
import type { ExtractedImage } from './page';

/** 图片下载结果 */
export interface ImageDownloadResult {
  placeholder: string;
  src: string;
  base64?: string;
  cdnUrl?: string;
  error?: string;
  status: 'pending' | 'downloading' | 'uploading' | 'completed' | 'error';
}

/** 图片提取选项 */
export interface ImageExtractorOptions {
  /** 最大并发下载数 */
  concurrency?: number;
  /** 下载超时时间（ms） */
  timeout?: number;
  /** 是否上传到 CDN */
  uploadToCdn?: boolean;
  /** 进度回调 */
  onProgress?: (completed: number, total: number) => void;
}

const DEFAULT_OPTIONS: Required<ImageExtractorOptions> = {
  concurrency: 3,
  timeout: 30000,
  uploadToCdn: true,
  onProgress: () => {},
};

/**
 * 下载单张图片并转为 base64
 */
async function downloadImageAsBase64(
  src: string,
  timeout: number
): Promise<string> {
  // 处理相对 URL
  const absoluteUrl = src.startsWith('http') ? src : new URL(src, window.location.href).href;

  // 使用 fetch 下载图片
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(absoluteUrl, {
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    clearTimeout(timeoutId);

    // 转为 base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  } catch (error: any) {
    clearTimeout(timeoutId);

    // CORS 错误时，尝试使用 background script 代理
    if (error.name === 'TypeError' || error.message?.includes('CORS')) {
      console.warn(`[ImageExtractor] CORS error for ${src}, trying background proxy`);
      return downloadViaBackground(absoluteUrl, timeout);
    }

    throw error;
  }
}

/**
 * 通过 background script 代理下载图片（绕过 CORS）
 */
async function downloadViaBackground(src: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Background download timeout'));
    }, timeout);

    // 发送消息给 background script
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage(
        { type: 'DOWNLOAD_IMAGE', url: src },
        (response) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response?.error) {
            reject(new Error(response.error));
            return;
          }
          if (response?.base64) {
            resolve(response.base64);
          } else {
            reject(new Error('No base64 data in response'));
          }
        }
      );
    } else if (typeof browser !== 'undefined' && browser.runtime) {
      browser.runtime.sendMessage({ type: 'DOWNLOAD_IMAGE', url: src })
        .then((response: any) => {
          clearTimeout(timeoutId);
          if (response?.error) {
            reject(new Error(response.error));
            return;
          }
          if (response?.base64) {
            resolve(response.base64);
          } else {
            reject(new Error('No base64 data in response'));
          }
        })
        .catch((err: any) => {
          clearTimeout(timeoutId);
          reject(err);
        });
    } else {
      clearTimeout(timeoutId);
      reject(new Error('No browser runtime available'));
    }
  });
}

/**
 * 批量下载并上传图片
 */
export async function extractAndUploadImages(
  images: ExtractedImage[],
  options?: ImageExtractorOptions
): Promise<ImageDownloadResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const results: ImageDownloadResult[] = images.map((img) => ({
    placeholder: img.placeholder,
    src: img.src,
    status: 'pending' as const,
  }));

  if (images.length === 0) {
    return results;
  }

  let completed = 0;
  const total = images.length;

  // 并发控制
  const semaphore = new Array(opts.concurrency).fill(null);
  let currentIndex = 0;

  const processNext = async (): Promise<void> => {
    while (currentIndex < images.length) {
      const index = currentIndex++;
      const img = images[index];
      const result = results[index];

      try {
        // 1. 下载图片
        result.status = 'downloading';
        console.log(`[ImageExtractor] Downloading ${img.placeholder}: ${img.src.slice(0, 50)}...`);

        const base64 = await downloadImageAsBase64(img.src, opts.timeout);
        result.base64 = base64;

        // 2. 上传到 CDN（如果启用）
        if (opts.uploadToCdn) {
          result.status = 'uploading';
          console.log(`[ImageExtractor] Uploading ${img.placeholder}...`);

          const cdnUrl = await uploadImage(base64);
          result.cdnUrl = cdnUrl;
        }

        result.status = 'completed';
        console.log(`[ImageExtractor] Completed ${img.placeholder}`);
      } catch (error: any) {
        console.error(`[ImageExtractor] Failed ${img.placeholder}:`, error);
        result.status = 'error';
        result.error = error.message || 'Unknown error';
      }

      completed++;
      opts.onProgress(completed, total);
    }
  };

  // 启动并发任务
  await Promise.all(semaphore.map(() => processNext()));

  return results;
}

/**
 * 将下载结果转为 PDF 合成需要的格式
 */
export function prepareForPdfCompose(
  results: ImageDownloadResult[]
): Array<{ placeholder: string; cdnUrl: string }> {
  return results
    .filter((r) => r.status === 'completed' && r.cdnUrl)
    .map((r) => ({
      placeholder: r.placeholder,
      cdnUrl: r.cdnUrl!,
    }));
}

/**
 * 统计下载结果
 */
export function summarizeResults(results: ImageDownloadResult[]): {
  total: number;
  completed: number;
  failed: number;
  pending: number;
} {
  const total = results.length;
  const completed = results.filter((r) => r.status === 'completed').length;
  const failed = results.filter((r) => r.status === 'error').length;
  const pending = results.filter(
    (r) => r.status === 'pending' || r.status === 'downloading' || r.status === 'uploading'
  ).length;

  return { total, completed, failed, pending };
}

export default {
  extractAndUploadImages,
  prepareForPdfCompose,
  summarizeResults,
};
