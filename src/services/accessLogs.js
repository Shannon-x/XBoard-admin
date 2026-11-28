import { buildSecureV2ApiUrl, requestDashboardMutation } from './api'

/**
 * 用户访问记录（admin/accessLog/*）。后端全部是 POST、路径不以 fetch / detail 结尾：
 * 只读令牌调不到，每次查看都进后台审计日志。见 Xboard-sh App\Http\Controllers\V2\Admin\AccessLogController。
 */

export const QUERY_STATUS = {
  0: { text: '排队中', type: 'info' },
  1: { text: '查询中', type: 'warning' },
  2: { text: '完成', type: 'success' },
  3: { text: '失败', type: 'danger' },
}

function post(path, payload) {
  return requestDashboardMutation(buildSecureV2ApiUrl(`accessLog/${path}`), payload || {}, 'POST')
}

export async function fetchAccessLogOverview() {
  const payload = await post('overview')
  const data = payload?.data || {}
  return {
    enable: Boolean(data.enable),
    storageConfigured: Boolean(data.storage_configured),
    recording: Boolean(data.recording),
    retentionDays: Number(data.retention_days || 30),
    maxQueryDays: Number(data.max_query_days || 7),
    nodes: Array.isArray(data.nodes) ? data.nodes : [],
  }
}

export async function fetchAccessLogSummary({ userId, from, to }) {
  const payload = await post('summary', { user_id: Number(userId), from, to })
  const data = payload?.data || {}
  return {
    user: data.user || null,
    from: data.from,
    to: data.to,
    days: Array.isArray(data.days) ? data.days : [],
    total: data.total || { records: 0, up: 0, down: 0 },
  }
}

export async function createAccessLogQuery({ userId, from, to, host, network }) {
  const payload = await post('query', {
    user_id: Number(userId),
    from,
    to,
    host: host ? String(host).trim() : undefined,
    network: network || undefined,
  })
  return Number(payload?.data?.id || 0)
}

export async function fetchAccessLogQueries({ userId, page = 1, pageSize = 20 } = {}) {
  const payload = await post('queries', {
    user_id: userId ? Number(userId) : undefined,
    current: page,
    pageSize,
  })
  return {
    list: Array.isArray(payload?.data) ? payload.data : [],
    pagination: {
      page: Number(payload?.current_page || page),
      pageSize: Number(payload?.per_page || pageSize),
      total: Number(payload?.total || 0),
    },
  }
}

export async function fetchAccessLogResult(id) {
  const payload = await post('result', { id: Number(id) })
  return payload?.data || null
}
