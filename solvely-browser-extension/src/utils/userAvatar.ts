import userAvatar from '@/assets/images/popup/user-info-avatar.webp'

/**
 * 获取用户头像URL
 * @param user 用户信息
 * @param firebaseUser Firebase用户信息（可选）
 * @returns 头像URL
 */
export const getUserAvatarUrl = (
  user: { email?: string; userPicture?: string } | null,
  firebaseUser?: { photoURL?: string } | null
): string => {
  // 1. 优先使用服务器返回的用户头像
  if (user?.userPicture) {
    return user.userPicture
  }
  
  // 2. 备用：使用Firebase用户头像
  if (firebaseUser?.photoURL) {
    return firebaseUser.photoURL
  }
  
  // 3. 检查是否是Google邮箱，使用Google默认头像
  if (user?.email?.endsWith('@gmail.com')) {
    // 使用Google的默认头像API，基于邮箱地址生成
    const email = user.email.toLowerCase().trim()
    return `https://www.gravatar.com/avatar/${email}?d=mp&s=96`
  }
  
  // 4. 使用默认头像
  return userAvatar
}

/**
 * 从本地存储获取Firebase用户信息
 * @returns Firebase用户信息
 */
export const getFirebaseUserFromStorage = async (): Promise<any> => {
  try {
    const result = await browser.storage.local.get('/firebase_user')
    return result['/firebase_user']
  } catch (error) {
    console.error('获取Firebase用户信息失败:', error)
    return null
  }
}

/**
 * 检查是否是Google邮箱
 * @param email 邮箱地址
 * @returns 是否是Google邮箱
 */
export const isGoogleEmail = (email?: string): boolean => {
  return email?.endsWith('@gmail.com') || email?.endsWith('@googlemail.com') || false
} 