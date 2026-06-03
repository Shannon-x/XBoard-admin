import {
  buildDashboardApiUrl,
  getDashboardApiHeaders,
  requestDashboardApi,
  requestDashboardMutation,
} from './api'

function normalizeTemplate(raw) {
  return {
    id: raw.id,
    name: raw.name || '',
    planId: raw.plan_id ?? null,
    planName: raw.plan_name || '',
    period: raw.period || '',
    price: raw.price ?? 0,
    codesCount: raw.codes_count ?? 0,
    usedCount: raw.used_count ?? 0,
    createdAt: raw.created_at ?? null,
  }
}

function normalizeCode(raw) {
  return {
    id: raw.id,
    templateId: raw.template_id,
    code: raw.code || '',
    status: raw.status ?? 0,
    usedAt: raw.used_at ?? null,
    usedByUserId: raw.used_by_user_id ?? null,
    createdAt: raw.created_at ?? null,
  }
}

export async function fetchGiftCardTemplates() {
  const apiUrl = buildDashboardApiUrl('gift-card/templates')
  const payload = await requestDashboardApi(apiUrl)
  const list = Array.isArray(payload?.data) ? payload.data : []
  return list.map(normalizeTemplate)
}

export async function createGiftCardTemplate(formData) {
  const apiUrl = buildDashboardApiUrl('gift-card/create-template')
  return requestDashboardMutation(apiUrl, {
    name: formData.name,
    plan_id: formData.planId,
    period: formData.period,
    price: formData.price,
  })
}

export async function generateGiftCardCodes(templateId, count = 1) {
  const apiUrl = buildDashboardApiUrl('gift-card/generate-codes')
  return requestDashboardMutation(apiUrl, {
    template_id: templateId,
    count,
  })
}

export async function fetchGiftCardCodes(templateId, { page = 1, pageSize = 15 } = {}) {
  const queryEntries = [
    ['template_id', templateId],
    ['page', page],
    ['page_size', pageSize],
  ]
  const apiUrl = buildDashboardApiUrl('gift-card/codes', queryEntries)
  const payload = await requestDashboardApi(apiUrl)
  const rawData = payload?.data ?? {}
  const listSource = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : [])

  // 兼容 total: 0 的真实零结果（旧代码用 || 会被当成 missing）
  const total = Number(rawData?.total ?? payload?.total ?? listSource.length)
  const currentPage = Number(rawData?.current_page ?? payload?.current_page ?? page)
  const perPage = Number(rawData?.per_page ?? payload?.per_page ?? pageSize)

  return {
    list: listSource.map(normalizeCode),
    pagination: {
      page: currentPage,
      pageSize: perPage,
      total: total,
    },
  }
}

export async function toggleGiftCardCode(id) {
  const apiUrl = buildDashboardApiUrl('gift-card/toggle-code')
  return requestDashboardMutation(apiUrl, { id })
}

export async function exportGiftCardCodes(templateId) {
  // 导出返回 blob，必须保留原生 fetch；但仍在 401 时主动调用 signalAuthExpired。
  const apiUrl = buildDashboardApiUrl('gift-card/export-codes', [['template_id', templateId]])
  const response = await fetch(apiUrl, {
    headers: getDashboardApiHeaders(),
  })

  if (response.status === 401 || response.status === 403) {
    // 动态 import 避免循环依赖
    const { signalAuthExpired } = await import('./auth')
    signalAuthExpired(`blob:${response.status}`)
    throw new Error('登录状态已失效，请重新登录')
  }

  if (!response.ok) {
    throw new Error(`导出兑换码失败 (${response.status})`)
  }

  return response.blob()
}
