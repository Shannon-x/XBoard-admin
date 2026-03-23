import { buildDashboardApiUrl, getDashboardApiHeaders, requestDashboardApi } from './api'

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
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getDashboardApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: formData.name,
      plan_id: formData.planId,
      period: formData.period,
      price: formData.price,
    }),
  })

  if (!response.ok) {
    throw new Error(`创建礼品卡模板失败 (${response.status})`)
  }

  return response.json()
}

export async function generateGiftCardCodes(templateId, count = 1) {
  const apiUrl = buildDashboardApiUrl('gift-card/generate-codes')
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getDashboardApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template_id: templateId,
      count,
    }),
  })

  if (!response.ok) {
    throw new Error(`生成兑换码失败 (${response.status})`)
  }

  return response.json()
}

export async function fetchGiftCardCodes(templateId, { page = 1, pageSize = 15 } = {}) {
  const queryEntries = [
    ['template_id', templateId],
    ['page', page],
    ['page_size', pageSize],
  ]
  const apiUrl = buildDashboardApiUrl('gift-card/codes', queryEntries)
  const payload = await requestDashboardApi(apiUrl)
  console.log('[GiftCards] API response structure:', JSON.stringify({
    dataKeys: payload?.data ? Object.keys(payload.data) : [],
    dataTotal: payload?.data?.total,
  }))
  const rawData = payload?.data ?? {}
  const listSource = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : [])

  const total = Number(rawData?.total || payload?.total || listSource.length)
  const currentPage = Number(rawData?.current_page || payload?.current_page || page)
  const perPage = Number(rawData?.per_page || payload?.per_page || pageSize)
  console.log('[GiftCards] Parsed pagination:', { total, currentPage, perPage, listCount: listSource.length })

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
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getDashboardApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  })

  if (!response.ok) {
    throw new Error(`切换兑换码状态失败 (${response.status})`)
  }

  return response.json()
}

export async function exportGiftCardCodes(templateId) {
  const apiUrl = buildDashboardApiUrl('gift-card/export-codes', [['template_id', templateId]])
  const response = await fetch(apiUrl, {
    headers: getDashboardApiHeaders(),
  })

  if (!response.ok) {
    throw new Error(`导出兑换码失败 (${response.status})`)
  }

  return response.blob()
}
