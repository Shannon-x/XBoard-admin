import {
  buildOriginUrl,
  buildSecureV2ApiUrl,
  requestDashboardApi,
  requestDashboardMutation,
} from './api'
import { formatCents, formatTimestamp } from '../utils/format'

export const WITHDRAWAL_STATUS = {
  0: { text: '待处理', type: 'warning' },
  1: { text: '已完成', type: 'success' },
  2: { text: '已驳回', type: 'danger' },
  3: { text: '已取消', type: 'info' },
}

export function createEmptyWithdrawalsPagination() {
  return { page: 1, pageSize: 15, total: 0 }
}

function normalizeAttachment(raw) {
  const path = raw?.download_path || raw?.path || ''
  return {
    id: Number(raw?.id ?? 0),
    name: String(raw?.original_name || raw?.name || '附件'),
    isImage: Boolean(raw?.is_image),
    url: path ? buildOriginUrl(path) : String(raw?.download_url || raw?.url || ''),
  }
}

export function normalizeWithdrawal(raw) {
  const status = Number(raw?.status ?? 0)
  const statusInfo = WITHDRAWAL_STATUS[status] || { text: '未知', type: 'info' }
  const chainName = String(raw?.chain_name || '')
  const network = String(raw?.network || '')
  return {
    id: Number(raw?.id ?? 0),
    userId: Number(raw?.user_id ?? 0),
    userEmail: String(raw?.user_email || '--'),
    ticketId: raw?.ticket_id ? Number(raw.ticket_id) : null,
    amount: Number(raw?.amount ?? 0),
    amountText: formatCents(raw?.amount),
    currency: String(raw?.currency || 'CNY'),
    chainCode: String(raw?.chain_code || ''),
    chainName,
    network,
    chainLabel: network ? `${chainName} · ${network}` : chainName,
    address: String(raw?.address || ''),
    usdtRate: raw?.usdt_rate ?? null,
    usdtAmount: raw?.usdt_amount ?? null,
    paidUsdt: raw?.paid_usdt ?? null,
    status,
    statusText: statusInfo.text,
    statusType: statusInfo.type,
    adminId: raw?.admin_id ?? null,
    txid: raw?.txid || '',
    explorerUrl: raw?.explorer_url || '',
    remark: raw?.remark || '',
    rejectReason: raw?.reject_reason || '',
    settledAt: formatTimestamp(raw?.settled_at),
    createdAt: formatTimestamp(raw?.created_at),
    attachments: (Array.isArray(raw?.attachments) ? raw.attachments : []).map(normalizeAttachment),
    userCommissionBalance: raw?.user_commission_balance ?? null,
    // 风控参考：同地址 / 同用户历史成功打款次数（仅详情接口返回）
    sameAddressPaidCount: raw?.same_address_paid_count ?? null,
    userPaidCount: raw?.user_paid_count ?? null,
  }
}

export async function fetchManagedWithdrawals(options = {}) {
  const current = Number(options.page || 1)
  const pageSize = Number(options.pageSize || 15)
  const queryEntries = [
    ['current', current],
    ['pageSize', pageSize],
  ]
  const body = {}
  if (options.status !== null && options.status !== undefined && options.status !== '') {
    body.status = options.status
  }
  if (options.email) {
    body.email = options.email
  }
  if (options.id) {
    body.id = options.id
  }

  const payload = await requestDashboardMutation(buildSecureV2ApiUrl('withdraw/fetch', queryEntries), body)
  const rawData = payload?.data ?? {}
  const list = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : [])

  return {
    list: list.map(normalizeWithdrawal),
    pagination: {
      page: current,
      pageSize,
      total: Number(rawData?.total ?? payload?.total ?? 0),
    },
  }
}

export async function fetchWithdrawalStats() {
  const payload = await requestDashboardApi(buildSecureV2ApiUrl('withdraw/stats'))
  return {
    pendingCount: Number(payload?.data?.pending_count ?? 0),
    pendingAmount: Number(payload?.data?.pending_amount ?? 0),
  }
}

export async function fetchWithdrawalDetail(id) {
  const payload = await requestDashboardApi(buildSecureV2ApiUrl('withdraw/detail', [['id', id]]))
  return normalizeWithdrawal(payload?.data)
}

export async function settleWithdrawal(id, { txid = '', paidUsdt = null, remark = '' } = {}) {
  const body = { id: Number(id) }
  if (String(txid || '').trim()) body.txid = String(txid).trim()
  if (paidUsdt !== null && paidUsdt !== '' && Number.isFinite(Number(paidUsdt))) body.paid_usdt = Number(paidUsdt)
  if (String(remark || '').trim()) body.remark = String(remark).trim()
  const payload = await requestDashboardMutation(buildSecureV2ApiUrl('withdraw/settle'), body)
  return normalizeWithdrawal(payload?.data)
}

export async function rejectWithdrawal(id, reason) {
  const payload = await requestDashboardMutation(buildSecureV2ApiUrl('withdraw/reject'), {
    id: Number(id),
    reason: String(reason || '').trim(),
  })
  return normalizeWithdrawal(payload?.data)
}
