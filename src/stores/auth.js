import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  clearAuthSession,
  hasStoredAuthSession,
  loginWithPassword,
  persistAuthSession,
  readStoredAuth,
  revokeCurrentSession,
} from '../services/auth'

export const useAuthStore = defineStore('auth', () => {
  const session = ref(readStoredAuth())
  const loginLoading = ref(false)
  const loginError = ref('')

  const isAuthenticated = computed(() => Boolean(session.value?.authData))

  function initializeAuth() {
    session.value = readStoredAuth()
  }

  async function login(credentials) {
    loginLoading.value = true
    loginError.value = ''

    try {
      const nextSession = await loginWithPassword(credentials)
      // 登录接口对普通用户同样发 token；非管理员会话不落地
      if (!nextSession.isAdmin) {
        throw new Error('该账户没有管理员权限')
      }
      session.value = nextSession
      persistAuthSession(nextSession)
      return nextSession
    } catch (error) {
      loginError.value = error instanceof Error ? error.message : '登录失败，请稍后重试'
      throw error
    } finally {
      loginLoading.value = false
    }
  }

  function logout() {
    // 吊销必须在 clearAuthSession 之前发起（token 读自 storage）；
    // fire-and-forget 保持同步签名，网络失败兜底本地登出
    revokeCurrentSession()
    session.value = null
    loginError.value = ''
    clearAuthSession()
  }

  return {
    hasStoredAuthSession,
    initializeAuth,
    isAuthenticated,
    login,
    loginError,
    loginLoading,
    logout,
    session,
  }
})
