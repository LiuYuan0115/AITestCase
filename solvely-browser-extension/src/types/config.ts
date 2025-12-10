// Storage key 常量
export const STORAGE_KEYS = {
  ONBOARDING_COMPLETED: 'onboardingCompleted',
} as const

// Storage 结构类型
export type StorageSchema = {
  [STORAGE_KEYS.ONBOARDING_COMPLETED]?: boolean
}
