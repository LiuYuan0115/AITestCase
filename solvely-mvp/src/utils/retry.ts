/**
 * retry.ts - 自动重试机制
 * Week 8: 网络请求自动重试，支持指数退避
 */

export interface RetryOptions {
  /**
   * 最大重试次数
   * @default 3
   */
  maxRetries?: number;
  /**
   * 初始延迟时间 (毫秒)
   * @default 1000
   */
  baseDelay?: number;
  /**
   * 最大延迟时间 (毫秒)
   * @default 30000
   */
  maxDelay?: number;
  /**
   * 退避倍数
   * @default 2
   */
  backoffMultiplier?: number;
  /**
   * 是否应该重试的判断函数
   * 默认对网络错误和 5xx 错误重试
   */
  shouldRetry?: (error: any, attempt: number) => boolean;
  /**
   * 重试前的回调
   */
  onRetry?: (error: any, attempt: number, delay: number) => void;
}

/**
 * 默认的重试判断逻辑
 * 对网络错误和 5xx 服务器错误进行重试
 */
function defaultShouldRetry(error: any, attempt: number): boolean {
  // 网络错误
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // HTTP 5xx 错误
  if (error?.status && error.status >= 500 && error.status < 600) {
    return true;
  }

  // 超时错误
  if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
    return true;
  }

  // 特定的可重试错误消息
  const retryableMessages = [
    'network',
    'timeout',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'failed to fetch',
    'load failed'
  ];

  const errorMessage = (error?.message || '').toLowerCase();
  return retryableMessages.some(msg => errorMessage.includes(msg));
}

/**
 * 计算延迟时间（指数退避 + 抖动）
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffMultiplier: number
): number {
  // 指数退避
  const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);

  // 添加随机抖动 (0-25%)
  const jitter = exponentialDelay * 0.25 * Math.random();

  // 限制最大延迟
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带自动重试的异步函数执行器
 *
 * @example
 * ```ts
 * // 基本用法
 * const result = await retryWithBackoff(async () => {
 *   const response = await fetch('/api/data');
 *   if (!response.ok) throw new Error('Request failed');
 *   return response.json();
 * });
 *
 * // 自定义选项
 * const result = await retryWithBackoff(
 *   () => uploadFile(file),
 *   {
 *     maxRetries: 5,
 *     baseDelay: 2000,
 *     onRetry: (err, attempt) => console.log(`Retry ${attempt}:`, err)
 *   }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = defaultShouldRetry,
    onRetry
  } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 已达到最大重试次数
      if (attempt > maxRetries) {
        break;
      }

      // 检查是否应该重试
      if (!shouldRetry(error, attempt)) {
        break;
      }

      // 计算延迟时间
      const retryDelay = calculateDelay(attempt, baseDelay, maxDelay, backoffMultiplier);

      // 调用重试回调
      onRetry?.(error, attempt, retryDelay);

      // 等待后重试
      await delay(retryDelay);
    }
  }

  throw lastError;
}

/**
 * 创建带重试功能的 fetch 包装器
 *
 * @example
 * ```ts
 * const fetchWithRetry = createRetryFetch({ maxRetries: 3 });
 * const response = await fetchWithRetry('/api/data');
 * ```
 */
export function createRetryFetch(options: RetryOptions = {}) {
  return async function retryFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    return retryWithBackoff(async () => {
      const response = await fetch(input, init);

      // 5xx 错误需要重试
      if (response.status >= 500 && response.status < 600) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        throw error;
      }

      return response;
    }, options);
  };
}

/**
 * 创建带超时和重试功能的 fetch 包装器
 *
 * @example
 * ```ts
 * const robustFetch = createRobustFetch({
 *   timeout: 10000,
 *   maxRetries: 3
 * });
 * const response = await robustFetch('/api/slow-endpoint');
 * ```
 */
export function createRobustFetch(options: RetryOptions & { timeout?: number } = {}) {
  const { timeout = 30000, ...retryOptions } = options;

  return async function robustFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    return retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal
        });

        // 5xx 错误需要重试
        if (response.status >= 500 && response.status < 600) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
          (error as any).status = response.status;
          throw error;
        }

        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    }, retryOptions);
  };
}

/**
 * 用于表单提交的重试包装器
 *
 * @example
 * ```ts
 * const result = await retryFormSubmit(
 *   '/api/upload',
 *   formData,
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function retryFormSubmit<T = any>(
  url: string,
  formData: FormData,
  options: RetryOptions & { timeout?: number } = {}
): Promise<T> {
  const { timeout = 60000, ...retryOptions } = options;

  return retryWithBackoff(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        throw error;
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }, retryOptions);
}

export default retryWithBackoff;
