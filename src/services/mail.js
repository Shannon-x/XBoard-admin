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
  suppressed: '在发信服务商的抑制名单里',
  bounce: '退信（地址无效或被对方拒收）',
  temporary: '多次临时失败（不同时段累计 3 次）',
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

// ===== 通知偏好（admin/notify/*）：退订统计、退订记录、单用户偏好与代改 =====

/** 与后端 App\Services\Notification\NotificationPreference::CATEGORIES 一致，顺序即展示顺序 */
export const NOTIFY_CATEGORY = {
  billing: { text: '账单与到期提醒', hint: '续费账单、到期当天的服务暂停通知、自动续费结果（对应老的 remind_expire）' },
  usage: { text: '流量与用量', hint: '流量用到 80% 的提醒（对应老的 remind_traffic）' },
  support: { text: '工单回复', hint: '工单有新回复' },
  announcement: { text: '服务公告', hint: '后台群发默认类别；带一键退订头' },
  marketing: { text: '活动与优惠', hint: '到期后的召回邮件、标为「活动」的群发；带一键退订头' },
}

export const NOTIFY_SOURCE = {
  panel: { text: '面板设置', type: 'info' },
  email_link: { text: '邮件页脚链接', type: 'warning' },
  list_unsubscribe: { text: '邮件客户端一键退订', type: 'danger' },
  admin: { text: '后台', type: '' },
  legacy: { text: '旧版开关', type: 'info' },
}

export function createEmptyNotifyStats() {
  return { categories: [], optional: [], bulk: [], recent30d: 0, usersWithOptout: 0, loaded: false }
}

export async function fetchNotifyStats() {
  const payload = await requestDashboardApi(buildSecureV2ApiUrl('notify/stats'))
  const data = payload?.data || {}
  return {
    categories: (Array.isArray(data.categories) ? data.categories : []).map(function normalizeRow(row) {
      return {
        category: String(row.category || ''),
        text: NOTIFY_CATEGORY[row.category]?.text || row.category,
        optional: Boolean(row.optional),
        disabled: Number(row.disabled || 0),
        bySource: row.by_source && typeof row.by_source === 'object' ? row.by_source : {},
      }
    }),
    optional: Array.isArray(data.optional) ? data.optional : [],
    bulk: Array.isArray(data.bulk) ? data.bulk : [],
    recent30d: Number(data.recent_30d || 0),
    usersWithOptout: Number(data.users_with_optout || 0),
    loaded: true,
  }
}

export function createEmptyNotifyLogPagination() {
  return { page: 1, pageSize: 20, total: 0 }
}

export async function fetchNotifyLog(options = {}) {
  const current = Number(options.page || 1)
  const pageSize = Number(options.pageSize || 20)
  const query = [['current', current], ['pageSize', pageSize]]
  if (options.category) query.push(['category', options.category])
  if (options.source) query.push(['source', options.source])
  const payload = await requestDashboardApi(buildSecureV2ApiUrl('notify/log', query))
  const list = Array.isArray(payload?.data) ? payload.data : []
  return {
    list: list.map(function normalizeLog(row) {
      return {
        id: Number(row.id || 0),
        userId: Number(row.user_id || 0),
        email: row.email || '',
        category: row.category || '',
        categoryText: NOTIFY_CATEGORY[row.category]?.text || row.category,
        source: row.source || '',
        sourceText: NOTIFY_SOURCE[row.source]?.text || row.source,
        sourceType: NOTIFY_SOURCE[row.source]?.type ?? 'info',
        ip: row.ip || '',
        updatedAtText: row.updated_at ? formatTimestamp(row.updated_at) : '--',
      }
    }),
    pagination: { page: current, pageSize, total: Number(payload?.total ?? 0) },
  }
}

function normalizeNotifyPrefs(data) {
  return {
    userId: Number(data?.user_id || 0),
    email: data?.email || '',
    hasKey: Boolean(data?.has_key),
    categories: (Array.isArray(data?.categories) ? data.categories : []).map(function normalizePref(row) {
      return {
        key: row.key,
        text: NOTIFY_CATEGORY[row.key]?.text || row.key,
        hint: NOTIFY_CATEGORY[row.key]?.hint || '',
        enabled: Boolean(row.enabled),
        locked: Boolean(row.locked),
        source: row.source || '',
        sourceText: row.source ? (NOTIFY_SOURCE[row.source]?.text || row.source) : '',
        updatedAtText: row.updated_at ? formatTimestamp(row.updated_at) : '',
      }
    }),
  }
}

/** 按用户 id 或邮箱查某人的通知偏好 */
export async function fetchUserNotifyPrefs(options = {}) {
  const query = []
  if (options.userId) query.push(['user_id', Number(options.userId)])
  else if (options.email) query.push(['email', String(options.email).trim()])
  const payload = await requestDashboardApi(buildSecureV2ApiUrl('notify/fetch', query))
  return normalizeNotifyPrefs(payload?.data)
}

/** 代用户改一类（来源记为 admin） */
export async function saveUserNotifyPref(userId, category, enabled) {
  const payload = await requestDashboardMutation(buildSecureV2ApiUrl('notify/save'), {
    user_id: Number(userId),
    prefs: { [category]: Boolean(enabled) },
  })
  return normalizeNotifyPrefs(payload?.data)
}

/** 换掉用户的免登录凭据：此前邮件里的偏好链接与一键退订地址全部作废 */
export async function rotateUserNotifyKey(userId) {
  return requestDashboardMutation(buildSecureV2ApiUrl('notify/rotate'), { user_id: Number(userId) })
}
