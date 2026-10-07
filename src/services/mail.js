import {
  buildSecureV2ApiUrl,
  requestDashboardApi,
  requestDashboardMutation,
} from './api'
import { formatTimestamp } from '../utils/format'

/**
 * 邮件投递闭环（admin/mail/*）：投递日志、24h / 7d 统计、暂停投递的用户与解除。
 * 分类与后端 App\Services\Mail\DeliveryMonitor 一致。
 */

export const MAIL_CATEGORY = {
  suppressed: { text: '已暂停投递', type: 'info' },
  bounce: { text: '退信', type: 'danger' },
  temporary: { text: '临时失败', type: 'warning' },
  config: { text: '配置错误', type: 'danger' },
}

// mail_suppressed_reason 存的就是触发暂停的分类
export const SUPPRESS_REASON = {
  bounce: '退信（地址无效或被对方拒收）',
  temporary: '连续 3 次临时失败',
  config: '发信配置错误',
}

export function createEmptyMailLogsPagination() {
  return {
    page: 1,
    pageSize: 20,
    total: 0,
  }
}

export function createEmptySuppressedPagination() {
  return {
    page: 1,
    pageSize: 20,
    total: 0,
  }
}

function createEmptyWindow() {
  return { sent: 0, failed: 0, byCategory: {} }
}

export function createEmptyMailStats() {
  return {
    last24h: createEmptyWindow(),
    last7d: createEmptyWindow(),
    suppressedUsers: 0,
    suppressedRecent: [],
    pendingDocuments: 0,
    loaded: false,
  }
}

// 后端 pluck 出来的分组计数：有数据是对象，空集合会序列化成 []
function normalizeCounts(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw).map(function mapEntry([key, value]) {
      return [String(key), Number(value || 0)]
    }),
  )
}

function normalizeWindow(raw) {
  return {
    sent: Number(raw?.sent || 0),
    failed: Number(raw?.failed || 0),
    byCategory: normalizeCounts(raw?.by_category),
  }
}

export function normalizeSuppressedUser(raw) {
  const reason = raw?.reason ? String(raw.reason) : ''
  return {
    id: Number(raw?.id || 0),
    email: String(raw?.email || '--'),
    reason,
    reasonText: SUPPRESS_REASON[reason] || reason || '--',
    suppressedAt: raw?.suppressed_at ? Number(raw.suppressed_at) : null,
    suppressedAtText: formatTimestamp(raw?.suppressed_at),
    failedCount: Number(raw?.failed_count || 0),
    telegramBound: Boolean(raw?.telegram_bound),
    pendingDocuments: Number(raw?.pending_documents || 0),
  }
}

function normalizeMailLog(raw) {
  const category = raw?.category ? String(raw.category) : ''
  const categoryInfo = MAIL_CATEGORY[category] || null
  return {
    id: Number(raw?.id || 0),
    email: String(raw?.email || '--'),
    userId: raw?.user_id ? Number(raw.user_id) : null,
    subject: String(raw?.subject || '--'),
    templateName: String(raw?.template_name || '--'),
    ok: Number(raw?.status ?? 1) === 1,
    category,
    categoryText: categoryInfo ? categoryInfo.text : category,
    categoryType: categoryInfo ? categoryInfo.type : 'info',
    error: raw?.error ? String(raw.error) : '',
    createdAt: Number(raw?.created_at || 0),
    createdAtText: formatTimestamp(raw?.created_at),
  }
}

export async function fetchMailStats() {
  const payload = await requestDashboardApi(buildSecureV2ApiUrl('mail/stats'))
  const data = payload?.data || {}
  return {
    last24h: normalizeWindow(data.last_24h),
    last7d: normalizeWindow(data.last_7d),
    suppressedUsers: Number(data.suppressed_users || 0),
    suppressedRecent: (Array.isArray(data.suppressed_recent) ? data.suppressed_recent : []).map(normalizeSuppressedUser),
    pendingDocuments: Number(data.pending_documents || 0),
    loaded: true,
  }
}

export async function fetchMailLogs(options = {}) {
  const current = Number(options.page || 1)
  const pageSize = Number(options.pageSize || 20)
  const apiUrl = buildSecureV2ApiUrl('mail/log/fetch', [
    ['current', current],
    ['pageSize', pageSize],
    ['email', options.email || ''],
    ['user_id', options.userId || ''],
    ['status', options.status === '' || options.status === null || options.status === undefined ? '' : Number(options.status)],
    ['category', options.category || ''],
    ['template', options.template || ''],
    ['start_at', options.startAt || ''],
    ['end_at', options.endAt || ''],
  ])
  const payload = await requestDashboardApi(apiUrl)
  const list = Array.isArray(payload?.data) ? payload.data : []

  return {
    list: list.map(normalizeMailLog),
    pagination: {
      page: current,
      pageSize,
      total: Number(payload?.total ?? 0),
    },
  }
}

export async function fetchSuppressedUsers(options = {}) {
  const current = Number(options.page || 1)
  const pageSize = Number(options.pageSize || 20)
  const apiUrl = buildSecureV2ApiUrl('mail/suppressed', [
    ['current', current],
    ['pageSize', pageSize],
  ])
  const payload = await requestDashboardApi(apiUrl)
  const list = Array.isArray(payload?.data) ? payload.data : []

  return {
    list: list.map(normalizeSuppressedUser),
    pagination: {
      page: current,
      pageSize,
      total: Number(payload?.total ?? 0),
    },
  }
}

/** 解除暂停投递：用户修好邮箱却没自己点自测，或是误判时用。 */
export async function unsuppressUser(userId) {
  return requestDashboardMutation(buildSecureV2ApiUrl('mail/unsuppress'), { user_id: Number(userId) })
}
