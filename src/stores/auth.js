import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  TWO_FACTOR_STATE,
  clearAuthSession,
  confirmTwoFactor,
  hasStoredAuthSession,
  loginWithPassword,
  persistAuthSession,
  readStoredAuth,
  revokeCurrentSession,
  setupTwoFactor,
  verifyTwoFactor,
} from '../services/auth'

export const useAuthStore = defineStore('auth', () => {
  const session = ref(readStoredAuth())
  const loginLoading = ref(false)
  const loginError = ref('')
  // 密码通过后、两步验证完成前的中间态：{ twoFactor, challenge, expiresAt }
  const pendingChallenge = ref(null)

  const isAuthenticated = computed(() => Boolean(session.value?.authData))

  function initializeAuth() {
    session.value = readStoredAuth()
  }

  function adoptSession(nextSession) {
    // 后台登录接口只对管理员发挑战，这里再兜一层
    if (!nextSession.isAdmin) {
      throw new Error('该账户没有管理员权限')
    }
    session.value = nextSession
    persistAuthSession(nextSession)
    pendingChallenge.value = null
    return nextSession
  }

  function failWith(error) {
    loginError.value = error instanceof Error ? error.message : '登录失败，请稍后重试'
    if (error?.challengeExpired) {
      pendingChallenge.value = null
    }
    throw error
  }

  /** 第一步：邮箱 + 密码 → 挑战（不落地任何会话） */
  async function login(credentials) {
    loginLoading.value = true
    loginError.value = ''
    pendingChallenge.value = null

    try {
      const result = await loginWithPassword(credentials)
      pendingChallenge.value = {
        twoFactor: result.twoFactor,
        challenge: result.challenge,
        expiresAt: Date.now() + result.expiresIn * 1000,
      }
      return pendingChallenge.value
    } catch (error) {
      failWith(error)
    } finally {
      loginLoading.value = false
    }
  }

  function requireChallenge(expectedState) {
    const pending = pendingChallenge.value
    if (!pending?.challenge || Date.now() > pending.expiresAt) {
      pendingChallenge.value = null
      const error = new Error('登录状态已过期，请重新输入密码')
      error.challengeExpired = true
      throw error
    }
    if (expectedState && pending.twoFactor !== expectedState) {
      const error = new Error('当前登录步骤不匹配，请重新登录')
      error.challengeExpired = true
      throw error
    }
    return pending.challenge
  }

  /** 首次绑定：拿密钥与二维码 */
  async function beginTwoFactorSetup() {
    loginError.value = ''
    try {
      return await setupTwoFactor(requireChallenge(TWO_FACTOR_STATE.SETUP_REQUIRED))
    } catch (error) {
      failWith(error)
    }
  }

  /** 首次绑定：验证码确认，返回恢复码；会话已落地 */
  async function confirmTwoFactorSetup(otp) {
    loginLoading.value = true
    loginError.value = ''
    try {
      const result = await confirmTwoFactor(requireChallenge(TWO_FACTOR_STATE.SETUP_REQUIRED), otp)
      adoptSession(result.session)
      return result.recoveryCodes
    } catch (error) {
      failWith(error)
    } finally {
      loginLoading.value = false
    }
  }

  /** 已绑定：验证码 / 恢复码 */
  async function completeTwoFactor(otp) {
    loginLoading.value = true
    loginError.value = ''
    try {
      const result = await verifyTwoFactor(requireChallenge(TWO_FACTOR_STATE.REQUIRED), otp)
      adoptSession(result.session)
      return result
    } catch (error) {
      failWith(error)
    } finally {
      loginLoading.value = false
    }
  }

  function cancelPendingLogin() {
    pendingChallenge.value = null
    loginError.value = ''
  }

  function logout() {
    // 吊销必须在 clearAuthSession 之前发起（token 读自 storage）；
    // fire-and-forget 保持同步签名，网络失败兜底本地登出
    revokeCurrentSession()
    session.value = null
    loginError.value = ''
    pendingChallenge.value = null
    clearAuthSession()
  }

  return {
    beginTwoFactorSetup,
    cancelPendingLogin,
    completeTwoFactor,
    confirmTwoFactorSetup,
    hasStoredAuthSession,
    initializeAuth,
    isAuthenticated,
    login,
    loginError,
    loginLoading,
    logout,
    pendingChallenge,
    session,
  }
})
