import {
  buildSecureV2ApiUrl,
  requestDashboardApi,
  requestDashboardMutation,
} from './api'

export function createEmptyManagedNotices() {
  return []
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

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function createExcerpt(content) {
  const plainContent = stripHtml(content)

  if (!plainContent) {
    return '--'
  }

  if (plainContent.length <= 110) {
    return plainContent
  }

  return `${plainContent.slice(0, 110)}...`
}

function resolveNoticeShow(value) {
  if (value === true || value === false) {
    return value
  }

  if (value === 1 || value === '1' || value === 'true') {
    return true
  }

  if (value === 0 || value === '0' || value === 'false') {
    return false
  }

  return false
}

function normalizeNotice(notice, index) {
  const tags = Array.isArray(notice?.tags)
    ? notice.tags
        .map(function mapTag(tag) {
          return String(tag || '').trim()
        })
        .filter(Boolean)
    : []
  const show = resolveNoticeShow(notice?.show)
  const sortValue =
    notice?.sort === null || notice?.sort === undefined || notice?.sort === ''
      ? null
      : Number(notice.sort)

  return {
    id: Number(notice?.id || index + 1),
    sort: Number.isFinite(sortValue) ? sortValue : null,
    title: String(notice?.title || `公告 ${index + 1}`).trim(),
    content: String(notice?.content || ''),
    plainContent: stripHtml(notice?.content),
    excerpt: createExcerpt(notice?.content),
    show,
    showUpdating: false,
    statusLabel: show ? '展示中' : '已隐藏',
    imgUrl: String(notice?.img_url || '').trim(),
    hasImage: Boolean(notice?.img_url),
    tags,
    createdAt: formatTimestamp(notice?.created_at),
    createdAtRaw: Number(notice?.created_at || 0),
    updatedAt: formatTimestamp(notice?.updated_at),
    updatedAtRaw: Number(notice?.updated_at || 0),
  }
}

export async function fetchManagedNotices() {
  const apiUrl = buildSecureV2ApiUrl('notice/fetch')
  const payload = await requestDashboardApi(apiUrl)
  const list = Array.isArray(payload?.data) ? payload.data : []

  return list.map(function mapNotice(notice, index) {
    return normalizeNotice(notice, index)
  })
}

export async function toggleManagedNoticeShow(id) {
  const noticeId = Number(id || 0)

  if (!noticeId) {
    throw new Error('缺少公告ID')
  }

  const apiUrl = buildSecureV2ApiUrl('notice/show')
  await requestDashboardMutation(apiUrl, {
    id: noticeId,
  })
}

export async function saveManagedNotice(payload = {}) {
  const title = String(payload.title || '').trim()
  const content = String(payload.content || '').trim()

  if (!title) {
    throw new Error('公告标题不能为空')
  }

  if (!content) {
    throw new Error('公告内容不能为空')
  }

  const apiUrl = buildSecureV2ApiUrl('notice/save')
  const requestPayload = {
    title,
    content,
    show: Boolean(payload.show),
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    img_url: payload.imgUrl ? String(payload.imgUrl).trim() : null,
  }

  if (payload.id) {
    requestPayload.id = Number(payload.id)
  }

  if (payload.sort !== null && payload.sort !== undefined && payload.sort !== '') {
    requestPayload.sort = Number(payload.sort)
  }

  await requestDashboardMutation(apiUrl, requestPayload)
}

export async function deleteManagedNotice(id) {
  const noticeId = Number(id || 0)

  if (!noticeId) {
    throw new Error('缺少公告ID')
  }

  const apiUrl = buildSecureV2ApiUrl('notice/drop')
  await requestDashboardMutation(apiUrl, {
    id: noticeId,
  })
}

export async function sortManagedNotices(ids) {
  const apiUrl = buildSecureV2ApiUrl('notice/sort')
  await requestDashboardMutation(apiUrl, {
    ids: ids.map(function mapId(id) {
      return Number(id)
    }),
  })
}
