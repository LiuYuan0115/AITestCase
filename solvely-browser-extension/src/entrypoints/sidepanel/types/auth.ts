// src/entrypoints/sidepanel/types/auth.ts
import { Ref, ComputedRef } from 'vue'

export interface AuthState {
  isShowModal: Ref<boolean>
  isShowVerificationCode: Ref<boolean>
  userEmail: Ref<string>
  isAuthenticated: ComputedRef<boolean>
  showLoginModal: (onSuccess?: () => void, onCancel?: () => void) => void
  closeLoginModal: () => void
  showVerificationCode: (email: string) => void
  closeVerificationCode: () => void
  getAuthStatus: () => Promise<boolean>
  handleLoginSuccess: () => void
  userFrom: ComputedRef<string>
}
