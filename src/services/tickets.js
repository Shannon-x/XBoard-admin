import {
  buildSecureV2ApiUrl,
  getDashboardApiHeaders,
  requestDashboardApi,
  requestDashboardMutation,
} from './api'

export function createEmptyManagedTickets() {
  return []
}

export function createEmptyManagedTicketsPagination() {
  return {
    page: 1,
    pageSize: 10,
    total: 0,
  }
}

export function createEmptyManagedTicketsFilters() {
  return {
    status: null,
    replyStatus: null,
    email: '',
  }
}

const TICKET_STATUS = {
  0: { text: '已开启', type: 'primary' },
  1: { text: '已关闭', type: 'info' },
}

const TICKET_REPLY_STATUS = {
  0: { text: '待回复', type: 'warning' },
  1: { text: '已回复', type: 'success' },
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

function normalizeTicket(ticket) {
  const status = Number(ticket?.status ?? 0)
  const statusInfo = TICKET_STATUS[status] || { text: '未知', type: 'info' }
  const replyStatus = Number(ticket?.reply_status ?? 0)
  const replyStatusInfo = TICKET_REPLY_STATUS[replyStatus] || { text: '未知', type: 'info' }
  const level = Number(ticket?.level ?? 0)

  const rawMessages = Array.isArray(ticket?.messages) ? ticket.messages : []
  const ticketUserId = Number(ticket?.user_id || 0)

  return {
    id: Number(ticket?.id || 0),
    userId: ticketUserId,
    userEmail: ticket?.user?.email || '--',
    subject: String(ticket?.subject || '--'),
    level,
    levelText: level === 2 ? '高' : level === 1 ? '中' : '低',
    levelType: level === 2 ? 'danger' : level === 1 ? 'warning' : 'info',
    status,
    statusText: statusInfo.text,
    statusType: statusInfo.type,
    replyStatus,
    replyStatusText: replyStatusInfo.text,
    replyStatusType: replyStatusInfo.type,
    createdAt: formatTimestamp(ticket?.created_at),
    updatedAt: formatTimestamp(ticket?.updated_at),
    messages: rawMessages.map(function mapMessage(msg) {
      const msgUserId = Number(msg?.user_id || 0)
      const isAdmin = Boolean(msg?.is_from_admin) || (ticketUserId > 0 && msgUserId !== ticketUserId)
      return {
        id: Number(msg?.id || 0),
        userId: msgUserId,
        message: String(msg?.message || ''),
        createdAt: formatTimestamp(msg?.created_at),
        isAdmin,
      }
    }),
  }
}

export async function fetchManagedTickets(options = {}) {
  const current = Number(options.page || 1)
  const pageSize = Number(options.pageSize || 10)
  const queryEntries = [
    ['current', current],
    ['pageSize', pageSize],
  ]

  if (options.status !== null && options.status !== undefined && options.status !== '') {
    queryEntries.push(['status', options.status])
  }

  if (options.email) {
    queryEntries.push(['email', options.email])
  }

  if (Array.isArray(options.replyStatus) && options.replyStatus.length > 0) {
    options.replyStatus.forEach(function mapStatus(s) {
      queryEntries.push(['reply_status[]', s])
    })
  }

  const apiUrl = buildSecureV2ApiUrl('ticket/fetch', queryEntries)
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
    throw new Error(`工单列表请求失败: ${response.status}`)
  }

  const payload = await response.json()
  console.log('[Tickets] API response structure:', JSON.stringify({
    dataKeys: payload?.data ? Object.keys(payload.data) : [],
    dataTotal: payload?.data?.total,
    nestedTotal: payload?.data?.data ? 'has nested data' : 'no nested data',
  }))
  const rawData = payload?.data ?? {}
  const listSource = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : [])

  const total = Number(rawData?.total || payload?.total || 0)
  const currentPage = Number(rawData?.current_page || payload?.current_page || current)
  const perPage = Number(rawData?.per_page || payload?.per_page || pageSize)
  console.log('[Tickets] Parsed pagination:', { total, currentPage, perPage, listCount: listSource.length })

  return {
    list: listSource.map(function mapTicket(ticket) {
      return normalizeTicket(ticket)
    }),
    pagination: {
      page: currentPage,
      pageSize: perPage,
      total: total,
    },
  }
}

export async function fetchTicketDetail(id) {
  const apiUrl = buildSecureV2ApiUrl('ticket/fetch', [['id', id]])
  const payload = await requestDashboardApi(apiUrl)
  const ticket = payload?.data

  return normalizeTicket(ticket)
}

export async function replyTicket(id, message) {
  const apiUrl = buildSecureV2ApiUrl('ticket/reply')
  return requestDashboardMutation(apiUrl, {
    id: Number(id),
    message: String(message),
  })
}

export async function closeTicket(id) {
  const apiUrl = buildSecureV2ApiUrl('ticket/close')
  return requestDashboardMutation(apiUrl, { id: Number(id) })
}

export { TICKET_STATUS, TICKET_REPLY_STATUS }
