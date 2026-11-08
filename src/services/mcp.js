import {
  buildSecureV2ApiUrl,
  requestDashboardApi,
  requestDashboardMutation,
} from './api'
import { formatCents, formatTimestamp } from '../utils/format'

/**
 * 客户 AI 助手（admin/mcp/*）：客户通过 ChatGPT、Claude 等 AI 软件调用面板的记录、AI 建的单、
 * 客户连着的 AI 软件（可替客户断开）。开关与上限在系统设置的 mcp 分组（services/settings.js）。
 */

// 与后端 Order::$statusMap / RechargeOrder::$statusMap 一致
const ORDER_STATUS_TYPE = {
  order: { 0: 'warning', 1: 'primary', 2: 'info', 3: 'success', 4: 'success' },
  recharge: { 0: 'warning', 2: 'info', 3: 'success' },
}

export function createEmptyMcpPagination() {
  return { page: 1, pageSize: 20, total: 0 }
}

function normalizeOrder(raw) {
  if (!raw) return null
  const kind = raw.kind === 'recharge' ? 'recharge' : 'order'
  const status = Number(raw.status ?? 0)
  return {
    kind,
    kindText: kind === 'recharge' ? '余额充值' : '订单',
    tradeNo: String(raw.trade_no || ''),
    status,
    statusText: raw.status_text ? String(raw.status_text) : String(status),
    statusType: ORDER_STATUS_TYPE[kind][status] || 'info',
    amountText: formatCents(raw.amount),
    planName: raw.plan_name ? String(raw.plan_name) : '',
    paidAt: raw.paid_at ? Number(raw.paid_at) : null,
    paidAtText: formatTimestamp(raw.paid_at),
  }
}

function normalizeLog(raw, tools = {}) {
  const tool = String(raw?.tool || '')
  return {
    id: Number(raw?.id || 0),
    userId: Number(raw?.user_id || 0),
    email: raw?.email ? String(raw.email) : '',
    tokenId: Number(raw?.token_id || 0),
    // 令牌被删了（客户断开、过期清掉）就只剩编号
    tokenName: raw?.app_name ? String(raw.app_name) : raw?.token_name ? String(raw.token_name) : '',
    tool,
    toolTitle: tools[tool] || tool,
    ok: Boolean(raw?.ok),
    ref: raw?.ref ? String(raw.ref) : '',
    message: raw?.message ? String(raw.message) : '',
    ip: raw?.ip ? String(raw.ip) : '',
    createdAt: Number(raw?.created_at || 0),
    createdAtText: formatTimestamp(raw?.created_at),
    order: normalizeOrder(raw?.order),
  }
}

function normalizeConnection(raw) {
  const via = raw?.via === 'oauth' ? 'oauth' : 'token'
  return {
    id: Number(raw?.id || 0),
    userId: Number(raw?.user_id || 0),
    email: raw?.email ? String(raw.email) : '',
    name: raw?.app_name ? String(raw.app_name) : String(raw?.name || ''),
    via,
    viaText: via === 'oauth' ? '一键授权' : '手动令牌',
    appHost: raw?.app_host ? String(raw.app_host) : '',
    canOrder: Boolean(raw?.can_order),
    createdAtText: formatTimestamp(raw?.created_at),
    lastUsedAt: raw?.last_used_at ? Number(raw.last_used_at) : null,
    lastUsedAtText: formatTimestamp(raw?.last_used_at),
    expiresAtText: formatTimestamp(raw?.expires_at),
    lastIp: raw?.last_ip ? String(raw.last_ip) : '',
    calls7d: Number(raw?.calls_7d || 0),
    ordersTotal: Number(raw?.orders_total || 0),
  }
}

export async function fetchMcpStats() {
  const payload = await requestDashboardApi(buildSecureV2ApiUrl('mcp/stats'))
  const data = payload?.data || {}
  const tools = data.tools && typeof data.tools === 'object' ? data.tools : {}
  return {
    callsToday: Number(data.calls_today || 0),
    failedToday: Number(data.failed_today || 0),
    ordersToday: Number(data.orders_today || 0),
    calls7d: Number(data.calls_7d || 0),
    failed7d: Number(data.failed_7d || 0),
    orders7d: Number(data.orders_7d || 0),
    users7d: Number(data.users_7d || 0),
    connections: Number(data.connections || 0),
    connectedUsers: Number(data.connected_users || 0),
    topTools: (Array.isArray(data.top_tools) ? data.top_tools : []).map(function mapTool(row) {
      const tool = String(row?.tool || '')
      return { tool, title: tools[tool] || tool, calls: Number(row?.calls || 0), failed: Number(row?.failed || 0) }
    }),
    tools,
  }
}

export async function fetchMcpLogs(options = {}, tools = {}) {
  const current = Number(options.page || 1)
  const pageSize = Number(options.pageSize || 20)
  const apiUrl = buildSecureV2ApiUrl('mcp/log/fetch', [
    ['current', current],
    ['pageSize', pageSize],
    ['user_id', options.userId || ''],
    ['email', options.email || ''],
    ['token_id', options.tokenId || ''],
    ['tool', options.tool || ''],
    ['ok', options.ok ?? ''],
    ['orders_only', options.ordersOnly ? 1 : ''],
    ['ref', options.ref || ''],
  ])
  const payload = await requestDashboardApi(apiUrl)
  const list = Array.isArray(payload?.data) ? payload.data : []
  return {
    list: list.map((row) => normalizeLog(row, tools)),
    pagination: { page: current, pageSize, total: Number(payload?.total ?? 0) },
  }
}

export async function fetchMcpConnections(options = {}) {
  const current = Number(options.page || 1)
  const pageSize = Number(options.pageSize || 20)
  const apiUrl = buildSecureV2ApiUrl('mcp/connection/fetch', [
    ['current', current],
    ['pageSize', pageSize],
    ['user_id', options.userId || ''],
    ['email', options.email || ''],
  ])
  const payload = await requestDashboardApi(apiUrl)
  const list = Array.isArray(payload?.data) ? payload.data : []
  return {
    list: list.map(normalizeConnection),
    pagination: { page: current, pageSize, total: Number(payload?.total ?? 0) },
  }
}

/** 替客户断开一个 AI 连接：令牌连同一键授权一起作废，AI 软件要客户重新授权才能再用 */
export async function revokeMcpConnection(userId, tokenId) {
  return requestDashboardMutation(buildSecureV2ApiUrl('mcp/connection/revoke'), {
    user_id: Number(userId),
    id: Number(tokenId),
  })
}
