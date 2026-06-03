import { buildCommonApiUrl } from './api'

const AUTH_STORAGE_KEY = 'ltc-admin-auth'

function getLoginUrl() {
  return import.meta.env.VITE_AUTH_LOGIN_URL || buildCommonApiUrl('passport/auth/login')
}

function parseAuthStorage(rawValue) {
  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue)
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

export function readStoredAuth() {
  if (typeof localStorage === 'undefined') {
    return null
  }

  return parseAuthStorage(localStorage.getItem(AUTH_STORAGE_KEY))
}

export function persistAuthSession(session) {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export function clearAuthSession() {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.removeItem(AUTH_STORAGE_KEY)
}

export function hasStoredAuthSession() {
  const session = readStoredAuth()
  return Boolean(session?.authData)
}

// ===== 会话失效广播 =====
// 当 api.js 收到 401/403 时调用 signalAuthExpired() —— 由 main.js 注入的回调
// 负责 logout + 跳登录页。这里只做事件分发，避免 services 圈引到 router/store。
let authExpiredHandler = null
let lastSignalAt = 0

export function setAuthExpiredHandler(handler) {
  authExpiredHandler = typeof handler === 'function' ? handler : null
}

export function signalAuthExpired(reason = 'unauthorized') {
  // 同一会话失效会被多个并行请求重复触发，做 1s 防抖避免连续 push 登录
  const now = Date.now()
  if (now - lastSignalAt < 1000) return
  lastSignalAt = now
  if (authExpiredHandler) {
    try {
      authExpiredHandler(reason)
    } catch (e) {
      // 不让错误冒泡破坏调用方的 throw 流程
      // eslint-disable-next-line no-console
      console.error('[auth] expired handler threw:', e)
    }
  }
}

export async function loginWithPassword(payload) {
  const response = await fetch(getLoginUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
    }),
  })

  let result = null

  try {
    result = await response.json()
  } catch {
    throw new Error('登录接口返回了无法解析的数据')
  }

  if (!response.ok || result?.status !== 'success' || !result?.data?.auth_data) {
    throw new Error(result?.message || '登录失败，请检查邮箱或密码')
  }

  return {
    token: result.data.token || '',
    authData: result.data.auth_data,
    isAdmin: Boolean(result.data.is_admin),
  }
}
