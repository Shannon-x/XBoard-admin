import {
  buildOriginUrl,
  buildSecureV2ApiUrl,
  requestDashboardApi,
  requestDashboardMutation,
  requestDashboardUpload,
} from './api'
import { formatBytes } from '../utils/format'

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
  0: { text: '已回复', type: 'success' },
  1: { text: '待回复', type: 'warning' },
}

function formatTimestamp(value) {
  const timestamp = Number(value ?? 0)

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

/**
 * 后端两种形态都收：admin ticket/fetch 里的 messages[].attachments[]（模型 toArray，
 * 带 download_path / download_url / original_name），以及 attachment/upload 返回的
 * TicketAttachmentResource（path / url / name）。
 */
export function normalizeAttachment(raw) {
  const path = raw?.download_path || raw?.path || ''
  return {
    id: Number(raw?.id ?? 0),
    name: String(raw?.original_name || raw?.name || '附件'),
    size: Number(raw?.size ?? 0),
    sizeText: formatBytes(Number(raw?.size ?? 0)),
    mime: String(raw?.mime || ''),
    isImage: Boolean(raw?.is_image),
    width: Number(raw?.width ?? 0) || null,
    height: Number(raw?.height ?? 0) || null,
    // 优先用相对路径拼后台正在访问的后端 origin —— 后端按 app_url 拼的绝对地址在
    // 内网 / 备用域名下打开后台时不一定可达
    url: path ? buildOriginUrl(path) : String(raw?.download_url || raw?.url || ''),
  }
}

function normalizeTicket(ticket) {
  const status = Number(ticket?.status ?? 0)
  const statusInfo = TICKET_STATUS[status] || { text: '未知', type: 'info' }
  const replyStatus = Number(ticket?.reply_status ?? 0)
  const replyStatusInfo = TICKET_REPLY_STATUS[replyStatus] || { text: '未知', type: 'info' }
  const level = Number(ticket?.level ?? 0)

  const rawMessages = Array.isArray(ticket?.messages) ? ticket.messages : []
  const ticketUserId = Number(ticket?.user_id ?? 0)

  return {
    id: Number(ticket?.id ?? 0),
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
      const msgUserId = Number(msg?.user_id ?? 0)
      const isAdmin = Boolean(msg?.is_from_admin) || (ticketUserId > 0 && msgUserId !== ticketUserId)
      return {
        id: Number(msg?.id ?? 0),
        userId: msgUserId,
        message: String(msg?.message || ''),
        createdAt: formatTimestamp(msg?.created_at),
        isAdmin,
        attachments: (Array.isArray(msg?.attachments) ? msg.attachments : []).map(normalizeAttachment),
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

  const apiUrl = buildSecureV2ApiUrl('ticket/fetch', queryEntries)
  const body = {}

  if (options.status !== null && options.status !== undefined && options.status !== '') {
    body.status = options.status
  }

  if (options.email) {
    body.email = options.email
  }

  if (Array.isArray(options.replyStatus) && options.replyStatus.length > 0) {
    body.reply_status = options.replyStatus
  }

  if (Array.isArray(options.filter) && options.filter.length > 0) {
    body.filter = options.filter
  }

  if (Array.isArray(options.sort) && options.sort.length > 0) {
    body.sort = options.sort
  }

  const payload = await requestDashboardMutation(apiUrl, body)
  const rawData = payload?.data ?? {}
  const listSource = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : [])

  const total = Number(rawData?.total ?? payload?.total ?? 0)
  const currentPage = Number(rawData?.current_page ?? payload?.current_page ?? current)
  const perPage = Number(rawData?.per_page ?? payload?.per_page ?? pageSize)

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

export async function replyTicket(id, message, attachmentIds = []) {
  const apiUrl = buildSecureV2ApiUrl('ticket/reply')
  const body = {
    id: Number(id),
    message: String(message ?? ''),
  }
  const ids = (Array.isArray(attachmentIds) ? attachmentIds : [])
    .map(function toNumber(value) { return Number(value) })
    .filter(function isPositive(value) { return value > 0 })
  if (ids.length) {
    body.attachment_ids = ids
  }
  return requestDashboardMutation(apiUrl, body)
}

/**
 * 上传一个待绑定附件（multipart）。返回归一化后的附件对象，id 随后放进 replyTicket 的 attachmentIds。
 */
export async function uploadTicketAttachment(file) {
  const formData = new FormData()
  formData.append('file', file, file.name)
  const payload = await requestDashboardUpload(buildSecureV2ApiUrl('ticket/attachment/upload'), formData)
  return normalizeAttachment(payload?.data)
}

export async function deleteTicketAttachment(id) {
  return requestDashboardMutation(buildSecureV2ApiUrl('ticket/attachment/delete'), { id: Number(id) })
}

export async function closeTicket(id) {
  const apiUrl = buildSecureV2ApiUrl('ticket/close')
  return requestDashboardMutation(apiUrl, { id: Number(id) })
}

export { TICKET_STATUS, TICKET_REPLY_STATUS }
