/**
 * 格式化错误信息，安全地处理各种类型的错误对象
 * @param error 任意类型的错误
 * @returns 格式化后的错误信息字符串
 */
export function formatError(error: unknown): string {
  // 处理标准 Error 对象
  if (error instanceof Error) {
    return error.message;
  }
  
  // 处理字符串类型
  if (typeof error === 'string') {
    return error;
  }
  
  // 处理对象类型
  if (error && typeof error === 'object') {
    try {
      // 尝试使用 JSON.stringify 转换对象
      const stringified = JSON.stringify(error);
      
      // 如果对象有 message 属性，优先使用
      try {
        const parsed = JSON.parse(stringified);
        if (parsed.message && typeof parsed.message === 'string') {
          return parsed.message;
        }
      } catch {
        // 解析失败，忽略
      }
      
      // 返回字符串化的对象
      return stringified;
    } catch {
      // JSON 转换失败，返回对象的 toString 结果
      return Object.prototype.toString.call(error);
    }
  }
  
  // 其他类型，使用 String 转换
  return String(error);
}