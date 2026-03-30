import {
  buildSecureV2ApiUrl,
  getDashboardApiHeaders,
  requestDashboardApi,
  requestDashboardMutation,
} from './api'

export function createEmptyManagedOrders() {
  return []
}

export function createEmptyManagedOrdersPagination() {
  return {
    page: 1,
    pageSize: 10,
    total: 0,
  }
}

export function createEmptyManagedOrdersFilters() {
  return {
    filter: [],
    sort: [],
    isCommission: false,
  }
}

const ORDER_STATUS_MAP = {
  0: { text: '待支付', type: 'warning' },
  1: { text: '开通中', type: 'primary' },
  2: { text: '已取消', type: 'info' },
  3: { text: '已完成', type: 'success' },
  4: { text: '已折抵', type: 'info' },
}

const ORDER_TYPE_MAP = {
  1: '新购',
  2: '续费',
  3: '升级',
  4: '重置流量',
}

const COMMISSION_STATUS_MAP = {
  0: { text: '待确认', type: 'warning' },
  1: { text: '发放中', type: 'primary' },
  2: { text: '已发放', type: 'success' },
  3: { text: '无效', type: 'info' },
}

const PERIOD_LABEL_MAP = {
  month_price: '月付',
  quarter_price: '季付',
  half_year_price: '半年付',
  year_price: '年付',
  two_year_price: '两年付',
  three_year_price: '三年付',
  onetime_price: '一次性',
  reset_price: '重置包',
}

function formatTimestamp(value) {
  const timestamp = Number(value || 0)

  if (!timestamp) {
    return '--'
  }

  const date = new Date(timestamp * 1000)

  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function normalizeOrder(order) {
  const status = Number(order?.status ?? 0)
  const statusInfo = ORDER_STATUS_MAP[status] || { text: '未知', type: 'info' }
  const type = Number(order?.type ?? 0)
  const commissionBalance = order?.commission_balance ? Number(order.commission_balance) : 0
  const hasCommission = commissionBalance > 0
  const commissionStatus = order?.commission_status
  const commissionInfo = hasCommission
    ? COMMISSION_STATUS_MAP[Number(commissionStatus)] || { text: '--', type: 'info' }
    : null
  const planName = order?.plan?.name || '--'

  return {
    id: Number(order?.id || 0),
    tradeNo: String(order?.trade_no || '--'),
    userId: Number(order?.user_id || 0),
    userEmail: order?.user?.email || '--',
    planId: order?.plan_id || null,
    planName,
    period: String(order?.period || '--'),
    periodText: PERIOD_LABEL_MAP[order?.period] || String(order?.period || '--'),
    type,
    typeText: ORDER_TYPE_MAP[type] || '未知',
    totalAmount: Number(order?.total_amount || 0) / 100,
    totalAmountText: `¥${(Number(order?.total_amount || 0) / 100).toFixed(2)}`,
    discountAmount: order?.discount_amount ? Number(order.discount_amount) / 100 : null,
    status,
    statusText: statusInfo.text,
    statusType: statusInfo.type,
    commissionStatus: hasCommission ? Number(commissionStatus) : null,
    commissionStatusText: commissionInfo ? commissionInfo.text : '--',
    commissionStatusType: commissionInfo ? commissionInfo.type : 'info',
    commissionBalance: order?.commission_balance ? Number(order.commission_balance) / 100 : 0,
    inviteUserId: order?.invite_user_id || null,
    inviteUserEmail: order?.invite_user?.email || null,
    paymentId: order?.payment_id || null,
    paymentName: order?.payment?.name || (order?.payment_id ? `#${order.payment_id}` : '--'),
    couponId: order?.coupon_id || null,
    callbackNo: order?.callback_no || null,
    paidAt: formatTimestamp(order?.paid_at),
    createdAt: formatTimestamp(order?.created_at),
    updatedAt: formatTimestamp(order?.updated_at),
    surplusOrderIds: order?.surplus_order_ids || [],
  }
}

export async function fetchManagedOrders(options = {}) {
  const current = Number(options.page || 1)
  const pageSize = Number(options.pageSize || 10)
  const queryEntries = [
    ['current', current],
    ['pageSize', pageSize],
  ]

  if (options.isCommission) {
    queryEntries.push(['is_commission', 1])
  }

  const apiUrl = buildSecureV2ApiUrl('order/fetch', queryEntries)
  const body = {}

  if (Array.isArray(options.filter) && options.filter.length > 0) {
    body.filter = options.filter
  }

  if (Array.isArray(options.sort) && options.sort.length > 0) {
    body.sort = options.sort
  }

  const headers = {
    ...getDashboardApiHeaders(),
    'Content-Type': 'application/json',
  }
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error('鉴权失败，请重新登录')
  }

  if (!response.ok) {
    throw new Error(`订单列表请求失败: ${response.status}`)
  }

  const payload = await response.json()
  console.log('[Orders] API response structure:', JSON.stringify({
    dataKeys: payload?.data ? Object.keys(payload.data) : [],
    dataTotal: payload?.data?.total,
    nestedTotal: payload?.data?.data ? 'has nested data' : 'no nested data',
  }))
  const rawData = payload?.data ?? {}
  const listSource = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : [])

  const total = Number(rawData?.total || payload?.total || 0)
  const currentPage = Number(rawData?.current_page || payload?.current_page || current)
  const perPage = Number(rawData?.per_page || payload?.per_page || pageSize)
  console.log('[Orders] Parsed pagination:', { total, currentPage, perPage, listCount: listSource.length })

  return {
    list: listSource.map(function mapOrder(order) {
      return normalizeOrder(order)
    }),
    pagination: {
      page: currentPage,
      pageSize: perPage,
      total: total,
    },
  }
}

export async function fetchOrderDetail(id) {
  const apiUrl = buildSecureV2ApiUrl('order/detail')
  const payload = await requestDashboardMutation(apiUrl, { id: Number(id) })
  const order = payload?.data

  return normalizeOrder(order)
}

export async function markOrderPaid(tradeNo) {
  const apiUrl = buildSecureV2ApiUrl('order/paid')
  return requestDashboardMutation(apiUrl, { trade_no: tradeNo })
}

export async function cancelOrder(tradeNo) {
  const apiUrl = buildSecureV2ApiUrl('order/cancel')
  return requestDashboardMutation(apiUrl, { trade_no: tradeNo })
}

export async function updateOrder(data) {
  const apiUrl = buildSecureV2ApiUrl('order/update')
  return requestDashboardMutation(apiUrl, {
    trade_no: data.tradeNo,
    commission_status: data.commissionStatus,
  })
}

export async function assignOrder(data) {
  const apiUrl = buildSecureV2ApiUrl('order/assign')
  return requestDashboardMutation(apiUrl, {
    email: data.email,
    plan_id: Number(data.planId),
    period: data.period,
    total_amount: Number(data.totalAmount),
  })
}

export { ORDER_STATUS_MAP, ORDER_TYPE_MAP, COMMISSION_STATUS_MAP, PERIOD_LABEL_MAP }
