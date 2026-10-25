import {
  buildSecureV2ApiUrl,
  requestDashboardApi,
  requestDashboardMutation,
} from './api'
import { formatCents, formatTimestamp } from '../utils/format'

/**
 * 余额充值单（admin/recharge/*）。金额一律是后端的「分」，展示时经 formatCents 转成「元」。
 * 充值相关设置在系统设置的 recharge 分组（services/settings.js）。
 */

// 与后端 RechargeOrder::STATUS_* 一致
export const RECHARGE_STATUS = {
  0: { text: '待支付', type: 'warning' },
  2: { text: '已取消', type: 'info' },
  3: { text: '已到账', type: 'success' },
}

export function createEmptyRechargePagination() {
  return {
    page: 1,
    pageSize: 20,
    total: 0,
  }
}

function normalizeRecharge(raw) {
  const status = Number(raw?.status ?? 0)
  const statusInfo = RECHARGE_STATUS[status] || { text: raw?.status_text || String(status), type: 'info' }
  const bonus = Number(raw?.bonus_amount || 0)
  const handling = raw?.handling_amount == null ? 0 : Number(raw.handling_amount)

  return {
    id: Number(raw?.id || 0),
    tradeNo: String(raw?.trade_no || ''),
    userId: Number(raw?.user_id || 0),
    userEmail: raw?.user_email ? String(raw.user_email) : '',
    depositAmount: Number(raw?.deposit_amount || 0),
    depositText: formatCents(raw?.deposit_amount),
    bonusAmount: bonus,
    bonusText: formatCents(bonus),
    totalCredit: Number(raw?.total_credit || 0),
    totalCreditText: formatCents(raw?.total_credit),
    payAmount: Number(raw?.pay_amount || 0),
    payText: formatCents(raw?.pay_amount),
    handlingAmount: handling,
    handlingText: formatCents(handling),
    paymentId: raw?.payment_id ? Number(raw.payment_id) : null,
    paymentName: raw?.payment_name ? String(raw.payment_name) : '',
    paymentMethod: raw?.payment_method ? String(raw.payment_method) : '',
    status,
    statusText: statusInfo.text,
    statusType: statusInfo.type,
    callbackNo: raw?.callback_no ? String(raw.callback_no) : '',
    manual: Boolean(raw?.manual),
    inviteUserId: raw?.invite_user_id ? Number(raw.invite_user_id) : null,
    paidAt: raw?.paid_at ? Number(raw.paid_at) : null,
    paidAtText: formatTimestamp(raw?.paid_at),
    createdAt: Number(raw?.created_at || 0),
    createdAtText: formatTimestamp(raw?.created_at),
  }
}

export async function fetchRecharges(options = {}) {
  const current = Number(options.page || 1)
  const pageSize = Number(options.pageSize || 20)
  const apiUrl = buildSecureV2ApiUrl('recharge/fetch', [
    ['current', current],
    ['pageSize', pageSize],
    ['status', options.status ?? ''],
    ['trade_no', options.tradeNo || ''],
    ['email', options.email || ''],
    ['user_id', options.userId || ''],
  ])
  const payload = await requestDashboardApi(apiUrl)
  const list = Array.isArray(payload?.data) ? payload.data : []

  return {
    list: list.map(normalizeRecharge),
    pagination: {
      page: current,
      pageSize,
      total: Number(payload?.total ?? 0),
    },
  }
}

export async function fetchRechargeDetail(tradeNo) {
  const payload = await requestDashboardMutation(buildSecureV2ApiUrl('recharge/detail'), { trade_no: String(tradeNo) })
  const raw = payload?.data || {}
  const verification = raw.verification || null

  return {
    ...normalizeRecharge(raw),
    userBalanceText: raw.user_balance == null ? '' : formatCents(raw.user_balance),
    inviteUserEmail: raw.invite_user?.email ? String(raw.invite_user.email) : '',
    ledger: (Array.isArray(raw.ledger) ? raw.ledger : []).map(function mapLedger(row) {
      return {
        id: Number(row?.id || 0),
        amountText: formatCents(row?.amount),
        balanceBeforeText: formatCents(row?.balance_before),
        balanceAfterText: formatCents(row?.balance_after),
        remark: row?.remark ? String(row.remark) : '',
        operatorId: row?.operator_id ? Number(row.operator_id) : null,
        createdAtText: formatTimestamp(row?.created_at),
      }
    }),
    verification: verification ? {
      verdict: String(verification.verdict || ''),
      verdictText: String(verification.verdict_text || verification.verdict || ''),
      gatewayMoneyText: verification.gateway_money == null ? '' : formatCents(verification.gateway_money),
      checkedAtText: formatTimestamp(verification.checked_at),
      lastError: verification.last_error ? String(verification.last_error) : '',
      refunded: Boolean(verification.refunded_at),
    } : null,
  }
}

/** 手动确认到账：网关回调没进来、已在商户后台核实收到钱。待支付与已取消的单都能确认。 */
export async function confirmRechargePaid(tradeNo) {
  return requestDashboardMutation(buildSecureV2ApiUrl('recharge/paid'), { trade_no: String(tradeNo) })
}

export async function cancelRecharge(tradeNo) {
  return requestDashboardMutation(buildSecureV2ApiUrl('recharge/cancel'), { trade_no: String(tradeNo) })
}

export async function fetchRechargeStats() {
  const payload = await requestDashboardApi(buildSecureV2ApiUrl('recharge/stats'))
  const data = payload?.data || {}
  const bucket = function bucket(raw) {
    return {
      count: Number(raw?.count || 0),
      depositText: formatCents(raw?.deposit_amount),
      bonusText: formatCents(raw?.bonus_amount),
      users: Number(raw?.users || 0),
    }
  }

  return {
    today: bucket(data.today),
    month: bucket(data.month),
    lastMonth: bucket(data.last_month),
    pendingCount: Number(data.pending_count || 0),
  }
}
