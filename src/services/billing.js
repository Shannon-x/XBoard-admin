import {
  buildOriginUrl,
  buildSecureV2ApiUrl,
  requestDashboardApi,
  requestDashboardMutation,
} from './api'
import { formatBytes, formatCents, formatTimestamp } from '../utils/format'

/**
 * 财务面板：归档的收据 / 续费账单（admin/billing/document/*）与余额流水（admin/billing/balance/*）。
 * 金额一律是后端的「分」，展示时经 formatCents 转成「元」。
 */

export const DOCUMENT_KIND = {
  receipt: { text: '收据', type: 'success' },
  invoice: { text: '续费账单', type: 'warning' },
}

export const DOCUMENT_STAGE = {
  first: '到期前首张',
  final: '到期前 24 小时',
}

// 与后端 BillingDocument::statusFor 一致：收据恒为 paid；账单看用户现在的到期时间
export const DOCUMENT_STATUS = {
  paid: { text: '已支付', type: 'success' },
  open: { text: '待付款', type: 'warning' },
  settled: { text: '已续费', type: 'success' },
  void: { text: '已失效', type: 'info' },
}

export const DOCUMENT_CHANNEL = {
  email: '邮件',
  telegram: 'Telegram',
}

// 与后端 BalanceLog::TYPE_* 一致
export const BALANCE_LOG_TYPES = {
  order_pay: { text: '余额支付', type: 'danger' },
  order_cancel: { text: '取消订单退回', type: 'success' },
  order_refund: { text: '折抵退回', type: 'success' },
  gift_card: { text: '礼品卡', type: 'success' },
  commission_transfer: { text: '佣金划转', type: 'success' },
  admin_adjust: { text: '后台调整', type: 'warning' },
  recharge: { text: '充值', type: 'success' },
}

export function createEmptyBillingDocumentsPagination() {
  return {
    page: 1,
    pageSize: 20,
    total: 0,
  }
}

export function createEmptyBalanceLogPagination() {
  return {
    page: 1,
    pageSize: 20,
    total: 0,
  }
}

function normalizeDocument(raw) {
  const kind = String(raw?.kind || 'receipt')
  const kindInfo = DOCUMENT_KIND[kind] || { text: kind, type: 'info' }
  const status = String(raw?.status || (kind === 'receipt' ? 'paid' : 'open'))
  const statusInfo = DOCUMENT_STATUS[status] || { text: status, type: 'info' }
  const stage = raw?.stage ? String(raw.stage) : ''
  const channel = raw?.channel ? String(raw.channel) : ''
  const sentAt = Number(raw?.sent_at || 0)
  const downloadPath = String(raw?.download_path || '')

  return {
    id: Number(raw?.id || 0),
    userId: Number(raw?.user_id || 0),
    email: String(raw?.email || '--'),
    mailSuppressed: Boolean(raw?.mail_suppressed),
    telegramBound: Boolean(raw?.telegram_bound),
    kind,
    kindText: kindInfo.text,
    kindType: kindInfo.type,
    docNo: String(raw?.doc_no || '--'),
    stage,
    stageText: DOCUMENT_STAGE[stage] || '',
    amount: Number(raw?.amount || 0),
    amountText: formatCents(raw?.amount),
    status,
    statusText: statusInfo.text,
    statusType: statusInfo.type,
    orderId: raw?.order_id ? Number(raw.order_id) : null,
    orderTradeNo: raw?.order_trade_no ? String(raw.order_trade_no) : '',
    expiredAt: raw?.expired_at ? Number(raw.expired_at) : null,
    expiredAtText: formatTimestamp(raw?.expired_at),
    size: Number(raw?.size || 0),
    // size = 0：文件已按保留期清理，记录仍在，下载 / 重发时按订单重新生成
    filePruned: Number(raw?.size || 0) === 0,
    sizeText: Number(raw?.size || 0) === 0 ? '文件已清理' : formatBytes(raw?.size),
    disk: String(raw?.disk || 'local'),
    sentAt: sentAt || null,
    sentAtText: formatTimestamp(sentAt),
    sendCount: Number(raw?.send_count || 0),
    channel,
    channelText: DOCUMENT_CHANNEL[channel] || channel,
    // 签名下载链接：凭据就在 URL 里，<a href> 直接打开即可，不需要 Bearer
    downloadUrl: downloadPath ? buildOriginUrl(downloadPath) : '',
    createdAt: Number(raw?.created_at || 0),
    createdAtText: formatTimestamp(raw?.created_at),
  }
}

export const STORAGE_DRIVER = {
  local: '本地存储',
  s3: 'S3 兼容对象存储',
}

/** 归档整体占用与当前策略（后端 fetch 响应的 summary） */
function normalizeSummary(raw) {
  const driver = String(raw?.driver || 'local')
  const receiptDays = Number(raw?.receipt_retention_days ?? 0)
  const invoiceDays = Number(raw?.invoice_retention_days ?? 0)

  return {
    total: Number(raw?.total || 0),
    bytes: Number(raw?.bytes || 0),
    bytesText: formatBytes(raw?.bytes || 0),
    pruned: Number(raw?.pruned || 0),
    driver,
    driverText: STORAGE_DRIVER[driver] || driver,
    location: String(raw?.location || ''),
    receiptRetentionDays: receiptDays,
    receiptRetentionText: receiptDays > 0 ? `${receiptDays} 天` : '永久',
    invoiceRetentionDays: invoiceDays,
    invoiceRetentionText: invoiceDays > 0 ? `${invoiceDays} 天` : '永久',
  }
}

export async function fetchBillingDocuments(options = {}) {
  const current = Number(options.page || 1)
  const pageSize = Number(options.pageSize || 20)
  const apiUrl = buildSecureV2ApiUrl('billing/document/fetch', [
    ['current', current],
    ['pageSize', pageSize],
    ['kind', options.kind || ''],
    ['email', options.email || ''],
    ['order_id', options.orderId || ''],
    ['user_id', options.userId || ''],
  ])
  const payload = await requestDashboardApi(apiUrl)
  const list = Array.isArray(payload?.data) ? payload.data : []

  return {
    list: list.map(normalizeDocument),
    pagination: {
      page: current,
      pageSize,
      total: Number(payload?.total ?? 0),
    },
    summary: payload?.summary ? normalizeSummary(payload.summary) : null,
  }
}

/** 重发：收据按订单重新渲染后再发；账单只有仍是当前到期日时后端才接受。 */
export async function resendBillingDocument(id) {
  return requestDashboardMutation(buildSecureV2ApiUrl('billing/document/resend'), { id: Number(id) })
}

function normalizeBalanceLog(raw) {
  const type = String(raw?.type || '')
  const typeInfo = BALANCE_LOG_TYPES[type] || { text: type || '--', type: 'info' }
  const amount = Number(raw?.amount || 0)

  return {
    id: Number(raw?.id || 0),
    type,
    typeText: typeInfo.text,
    typeTag: typeInfo.type,
    amount,
    amountText: `${amount > 0 ? '+' : amount < 0 ? '-' : ''}${formatCents(Math.abs(amount))}`,
    balanceBefore: Number(raw?.balance_before || 0),
    balanceBeforeText: formatCents(raw?.balance_before),
    balanceAfter: Number(raw?.balance_after || 0),
    balanceAfterText: formatCents(raw?.balance_after),
    orderId: raw?.order_id ? Number(raw.order_id) : null,
    refType: raw?.ref_type ? String(raw.ref_type) : '',
    refId: raw?.ref_id ? String(raw.ref_id) : '',
    remark: raw?.remark ? String(raw.remark) : '',
    operatorId: raw?.operator_id ? Number(raw.operator_id) : null,
    createdAt: Number(raw?.created_at || 0),
    createdAtText: formatTimestamp(raw?.created_at),
  }
}

export async function fetchBalanceLog(userId, options = {}) {
  const current = Number(options.page || 1)
  const pageSize = Number(options.pageSize || 20)
  const apiUrl = buildSecureV2ApiUrl('billing/balance/log', [
    ['user_id', Number(userId)],
    ['current', current],
    ['pageSize', pageSize],
  ])
  const payload = await requestDashboardApi(apiUrl)
  const list = Array.isArray(payload?.data) ? payload.data : []

  return {
    list: list.map(normalizeBalanceLog),
    pagination: {
      page: current,
      pageSize,
      total: Number(payload?.total ?? 0),
    },
    // 当前余额（分）
    balance: Number(payload?.balance ?? 0),
  }
}

/** 手工调整余额：amount 单位「元」，正数入账、负数扣减；备注会进流水，用户端可见。 */
export async function adjustBalance(userId, amount, remark = '') {
  const payload = await requestDashboardMutation(buildSecureV2ApiUrl('billing/balance/adjust'), {
    user_id: Number(userId),
    amount: Number(amount),
    remark: String(remark || '').trim(),
  })
  return Number(payload?.data?.balance ?? 0)
}
