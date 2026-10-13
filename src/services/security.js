import { buildDashboardApiUrl, requestDashboardApi, requestDashboardMutation } from './api'

/**
 * 「账号安全」页：两步验证状态 / 重新绑定 / 恢复码、登录会话、最近登录记录。
 * 改动类接口都要带一次当前验证器里的验证码（otp），后端再验一遍。
 */

export function createEmptySecurityStatus() {
  return {
    enabled: false,
    confirmedAt: 0,
    recoveryCodesRemaining: 0,
    sessionDays: 7,
    currentSession: null,
  }
}

function normalizeSession(item) {
  return {
    id: Number(item?.id || 0),
    admin: Boolean(item?.admin),
    ip: String(item?.ip || ''),
    userAgent: String(item?.user_agent || ''),
    createdAt: Number(item?.created_at || 0),
    lastUsedAt: Number(item?.last_used_at || 0),
    expiresAt: Number(item?.expires_at || 0),
    current: Boolean(item?.current),
  }
}

export async function fetchSecurityStatus() {
  const payload = await requestDashboardApi(buildDashboardApiUrl('security/two-factor'))
  const data = payload?.data || {}
  return {
    enabled: Boolean(data.enabled),
    confirmedAt: Number(data.confirmed_at || 0),
    recoveryCodesRemaining: Number(data.recovery_codes_remaining || 0),
    sessionDays: Number(data.session_days || 7),
    currentSession: data.current_session ? normalizeSession(data.current_session) : null,
  }
}

/** 重新绑定第一步：验当前验证码，返回新密钥与二维码 */
export async function beginRebind(otp) {
  const payload = await requestDashboardMutation(buildDashboardApiUrl('security/two-factor/setup'), { otp })
  const data = payload?.data || {}
  return {
    secret: data.secret || '',
    secretGrouped: data.secret_grouped || data.secret || '',
    otpauthUrl: data.otpauth_url || '',
    qrSvg: data.qr_svg || '',
    issuer: data.issuer || '',
    account: data.account || '',
  }
}

/** 重新绑定第二步：用新条目的验证码确认，返回新恢复码 */
export async function confirmRebind(otp) {
  const payload = await requestDashboardMutation(buildDashboardApiUrl('security/two-factor/confirm'), { otp })
  return Array.isArray(payload?.data?.recovery_codes) ? payload.data.recovery_codes : []
}

export async function regenerateRecoveryCodes(otp) {
  const payload = await requestDashboardMutation(buildDashboardApiUrl('security/two-factor/recovery-codes'), { otp })
  return Array.isArray(payload?.data?.recovery_codes) ? payload.data.recovery_codes : []
}

export async function fetchSessions() {
  const payload = await requestDashboardApi(buildDashboardApiUrl('security/sessions'))
  return Array.isArray(payload?.data) ? payload.data.map(normalizeSession) : []
}

export async function revokeSession(id) {
  await requestDashboardMutation(buildDashboardApiUrl('security/sessions/revoke'), { id })
  return true
}

export async function revokeOtherSessions() {
  const payload = await requestDashboardMutation(buildDashboardApiUrl('security/sessions/revoke-others'), {})
  return Number(payload?.data?.revoked || 0)
}

export const LOGIN_LOG_ACTION = Object.freeze({
  'auth.login': { text: '登录成功', type: 'success' },
  'auth.login_failed': { text: '密码错误', type: 'danger' },
  'auth.two_factor_failed': { text: '验证码错误', type: 'warning' },
  'auth.two_factor_locked': { text: '验证码错满作废', type: 'danger' },
  'auth.two_factor_enrolled': { text: '绑定验证器', type: 'info' },
  'auth.recovery_code_used': { text: '使用恢复码', type: 'warning' },
  'auth.recovery_codes_regenerated': { text: '重新生成恢复码', type: 'info' },
  'auth.session_revoked': { text: '注销会话', type: 'info' },
  'auth.sessions_revoked': { text: '注销其他会话', type: 'info' },
})

export async function fetchLoginLog(limit = 20) {
  const payload = await requestDashboardApi(buildDashboardApiUrl('security/login-log', [['limit', limit]]))
  const rows = Array.isArray(payload?.data) ? payload.data : []
  return rows.map(function normalize(item) {
    const action = String(item?.action || '')
    const meta = LOGIN_LOG_ACTION[action] || { text: action, type: 'info' }
    return {
      id: Number(item?.id || 0),
      action,
      actionText: meta.text,
      actionType: meta.type,
      email: String(item?.email || ''),
      ip: String(item?.ip || ''),
      userAgent: String(item?.user_agent || ''),
      reason: String(item?.reason || ''),
      recoveryCode: Boolean(item?.recovery_code),
      createdAt: Number(item?.created_at || 0),
    }
  })
}
