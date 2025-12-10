/* src/utils/platforms.ts */

// 用户操作系统
export const UserPlatform = {
  // 是否为 macOS
  isMacOs: (() => {
    return detectOS() === 'macOS';
  })(),
  // 是否为 Windows
  isWindows: (() => {
    return detectOS() === 'Windows';
  })(),
}

// 检测操作系统
function detectOS() {
  try {
    // 检查 navigator 对象是否存在
    if (typeof navigator === 'undefined') {
      return 'Windows'; // 默认当作 Windows
    }
    
    const platform = navigator.platform || '';
    const userAgent = navigator.userAgent || '';

    // 简化判断，只检测是否为 macOS
    if (platform.startsWith('Mac') || userAgent.includes('Mac OS')) {
      return 'macOS';
    }
    
    // 其他所有系统都视为 Windows
    return 'Windows';
  } catch (error) {
    // API 调用失败时默认为 Windows
    return 'Windows';
  }
}



