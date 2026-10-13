import { buildCommonApiUrl, buildDashboardApiUrl } from './api'

const AUTH_STORAGE_KEY = 'ltc-admin-auth'

// 后台登录走 secure_path 之下的专用接口（/api/v2/<secure_path>/auth/*）：
// 密码正确只换来一个 5 分钟有效的「挑战」，验证器里的 6 位码（或恢复码）通过后才发 token。
// 公共的 /api/v1/passport/auth/login 对管理员账号只发普通会话，进不了后台，所以这里不再用它。
export const TWO_FACTOR_STATE = Object.freeze({
  REQUIRED: 'required',
  SETUP_REQUIRED: 'setup_required',
})

function parseAuthStorage(rawValue) {
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue)
    // 形态校验：authData 必须是非空字符串，避免被注入怪东西后还盲发 Authorization 头
    if (!parsed || typeof parsed !== 'object' || typeof parsed.authData !== 'string' || !parsed.authData) {
      // eslint-disable-next-line no-console
      console.warn('[auth] stored session shape invalid, clearing')
      localStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }
    return parsed
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[auth] failed to parse stored session:', e?.message || e)
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

// 登出时吊销后端 token。必须用裸 fetch：走统一请求层的话，401/403 会再触发
// signalAuthExpired → logout 循环。失败静默——本地登出照常进行。
export async function revokeCurrentSession() {
  const session = readStoredAuth()
  if (!session?.authData) {
    return
  }
  try {
    await fetch(buildCommonApiUrl('user/logout'), {
      method: 'POST',
      headers: { Authorization: session.authData },
    })
  } catch {
    // 网络失败不阻塞本地登出；token 只能等后端过期
  }
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

async function postAuth(endpoint, body, fallbackMessage) {
  const response = await fetch(buildDashboardApiUrl(endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  let result = null

  try {
    result = await response.json()
  } catch {
    throw new Error('登录接口返回了无法解析的数据')
  }

  if (!response.ok || result?.status !== 'success') {
    const error = new Error(result?.message || fallbackMessage)
    error.status = response.status
    // 挑战过期 / 作废：登录页据此退回密码步骤
    error.challengeExpired = response.status === 401
    throw error
  }

  return result.data || {}
}

function toSession(auth) {
  if (!auth || typeof auth.auth_data !== 'string' || !auth.auth_data) {
    throw new Error('登录接口没有返回会话凭据')
  }
  return {
    token: auth.token || '',
    authData: auth.auth_data,
    isAdmin: Boolean(auth.is_admin),
  }
}

/**
 * 第一步：邮箱 + 密码。成功只返回两步验证挑战，没有 token。
 * @returns {{ twoFactor: 'required' | 'setup_required', challenge: string, expiresIn: number }}
 */
export async function loginWithPassword(payload) {
  const data = await postAuth(
    'auth/login',
    { email: payload.email, password: payload.password },
    '登录失败，请检查邮箱或密码',
  )
  if (!data.challenge || !data.two_factor) {
    throw new Error('登录接口返回了意外的数据，请刷新后重试')
  }
  return {
    twoFactor: data.two_factor,
    challenge: data.challenge,
    expiresIn: Number(data.expires_in || 300),
  }
}

/** 首次绑定：换取密钥与二维码 */
export async function setupTwoFactor(challenge) {
  const data = await postAuth('auth/two-factor/setup', { challenge }, '无法开始绑定验证器')
  return {
    secret: data.secret || '',
    secretGrouped: data.secret_grouped || data.secret || '',
    otpauthUrl: data.otpauth_url || '',
    qrSvg: data.qr_svg || '',
    issuer: data.issuer || '',
    account: data.account || '',
  }
}

/** 首次绑定：验证码确认 → 恢复码 + 后台会话 */
export async function confirmTwoFactor(challenge, otp) {
  const data = await postAuth('auth/two-factor/confirm', { challenge, otp }, '验证码不正确')
  return {
    recoveryCodes: Array.isArray(data.recovery_codes) ? data.recovery_codes : [],
    session: toSession(data.auth),
  }
}

/** 已绑定：验证码 / 恢复码 → 后台会话 */
export async function verifyTwoFactor(challenge, otp) {
  const data = await postAuth('auth/two-factor/verify', { challenge, otp }, '验证码不正确')
  return {
    session: toSession(data.auth),
    usedRecoveryCode: Boolean(data.used_recovery_code),
    recoveryCodesRemaining: Number(data.recovery_codes_remaining ?? 0),
  }
}
