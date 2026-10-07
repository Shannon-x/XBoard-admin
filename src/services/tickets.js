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

// 与 v2_ticket.reply_status 的列注释一致：0 待回复 / 1 已回复。
// 这里曾经是反的，配合后端同样反了的写入恰好显示正常，但用户前端按注释
// 语义渲染，于是新工单一建就在用户端显示「官方已回复」。后端已扳正，这里跟上。
const TICKET_REPLY_STATUS = {
  0: { text: '待回复', type: 'warning' },
  1: { text: '已回复', type: 'success' },
}

// 工单类型：求助（要客服解决）/ 建议与反馈（要答复 + 跟进状态）。与 v2_ticket.type 一致。
export const TICKET_TYPE_SUPPORT = 0
export const TICKET_TYPE_FEEDBACK = 1

// 分类与反馈状态的字典正常来自 ticket/stat（带隐藏状态与计数）；
// 这里是接口不可用（比如后端还没升级）时的兜底，文案与后端 TicketCategories 一致。
export const DEFAULT_TICKET_CATEGORIES = [
  { code: 'connection', type: TICKET_TYPE_SUPPORT, name: '节点与连接', selectable: true, hidden: false },
  { code: 'client', type: TICKET_TYPE_SUPPORT, name: '客户端使用', selectable: true, hidden: false },
  { code: 'subscription', type: TICKET_TYPE_SUPPORT, name: '订阅与套餐', selectable: true, hidden: false },
  { code: 'billing', type: TICKET_TYPE_SUPPORT, name: '支付与订单', selectable: true, hidden: false },
  { code: 'account', type: TICKET_TYPE_SUPPORT, name: '账号与安全', selectable: true, hidden: false },
  { code: 'other', type: TICKET_TYPE_SUPPORT, name: '其他问题', selectable: true, hidden: false },
  { code: 'suggestion', type: TICKET_TYPE_FEEDBACK, name: '功能建议', selectable: true, hidden: false },
  { code: 'experience', type: TICKET_TYPE_FEEDBACK, name: '意见与体验', selectable: true, hidden: false },
  { code: 'withdraw', type: TICKET_TYPE_SUPPORT, name: '佣金提现', selectable: false, hidden: false },
]

export const DEFAULT_FEEDBACK_STATES = [
  { code: 'received', name: '已收到' },
  { code: 'accepted', name: '已采纳' },
  { code: 'planned', name: '排期中' },
  { code: 'shipped', name: '已上线' },
  { code: 'declined', name: '暂不采纳' },
]

// 用户端按 received → accepted → planned → shipped 画进度条，declined 是终态分支。
// 配色与用户端一致：待分拣的「已收到」醒目，「暂不采纳」置灰。
// 注意 styles.css 里 --primary 与 --danger 同为 #c94f2e，两者不能分给意思相反的状态。
export const FEEDBACK_STATE_TAG = {
  received: 'warning',
  accepted: 'primary',
  planned: 'primary',
  shipped: 'success',
  declined: 'info',
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
    category: String(ticket?.category || 'other'),
    type: Number(ticket?.type ?? TICKET_TYPE_SUPPORT),
    isFeedback: Number(ticket?.type ?? TICKET_TYPE_SUPPORT) === TICKET_TYPE_FEEDBACK,
    feedbackState: ticket?.feedback_state ? String(ticket.feedback_state) : null,
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

  // 分类 / 类型 / 跟进状态走精确匹配（后端 whereIn），不走 filter[] 的 like
  if (Array.isArray(options.category) && options.category.length > 0) {
    body.category = options.category
  }

  if (Array.isArray(options.type) && options.type.length > 0) {
    body.type = options.type.map(function toNumber(value) { return Number(value) })
  }

  if (Array.isArray(options.feedbackState) && options.feedbackState.length > 0) {
    body.feedback_state = options.feedbackState
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

function normalizeCategoryCounts(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw).map(function mapEntry([code, value]) {
      return [String(code), { open: Number(value?.open || 0), pending: Number(value?.pending || 0) }]
    }),
  )
}

function normalizePlainCounts(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw).map(function mapEntry([code, value]) {
      return [String(code), Number(value || 0)]
    }),
  )
}

export function createEmptyTicketStat() {
  return {
    categories: DEFAULT_TICKET_CATEGORIES,
    feedbackStates: DEFAULT_FEEDBACK_STATES,
    counts: {
      byCategory: {},
      feedbackByState: {},
      pendingReply: 0,
    },
    loaded: false,
  }
}

/**
 * 分类字典 + 工作台计数（ticket/stat）。
 * counts.byCategory 只数开启中的工单（待处理工作量），feedbackByState 数全部建议与反馈。
 */
export async function fetchTicketStat() {
  const payload = await requestDashboardApi(buildSecureV2ApiUrl('ticket/stat'))
  const data = payload?.data || {}
  const categories = Array.isArray(data.categories) && data.categories.length
    ? data.categories.map(function mapCategory(item) {
        return {
          code: String(item?.code || ''),
          type: Number(item?.type ?? TICKET_TYPE_SUPPORT),
          name: String(item?.name || item?.code || ''),
          selectable: item?.selectable !== false,
          hidden: Boolean(item?.hidden),
        }
      })
    : DEFAULT_TICKET_CATEGORIES
  const feedbackStates = Array.isArray(data.feedback_states) && data.feedback_states.length
    ? data.feedback_states.map(function mapState(item) {
        return { code: String(item?.code || ''), name: String(item?.name || item?.code || '') }
      })
    : DEFAULT_FEEDBACK_STATES

  return {
    categories,
    feedbackStates,
    counts: {
      byCategory: normalizeCategoryCounts(data.counts?.by_category),
      feedbackByState: normalizePlainCounts(data.counts?.feedback_by_state),
      pendingReply: Number(data.counts?.pending_reply || 0),
    },
    loaded: true,
  }
}

/** 改分类 / 优先级 / 建议反馈的跟进状态，只发传了的字段。 */
export async function updateTicket(id, patch = {}) {
  const body = { id: Number(id) }
  if (patch.category !== undefined && patch.category !== null && patch.category !== '') {
    body.category = String(patch.category)
  }
  if (patch.level !== undefined && patch.level !== null && patch.level !== '') {
    body.level = Number(patch.level)
  }
  if (patch.feedbackState !== undefined && patch.feedbackState !== null && patch.feedbackState !== '') {
    body.feedback_state = String(patch.feedbackState)
  }
  const payload = await requestDashboardMutation(buildSecureV2ApiUrl('ticket/update'), body)
  return payload?.data ? normalizeTicket(payload.data) : null
}

export { TICKET_STATUS, TICKET_REPLY_STATUS }
