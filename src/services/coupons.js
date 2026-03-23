import { buildDashboardApiUrl, getDashboardApiHeaders, requestDashboardApi } from './api'

export function createEmptyCouponsPagination() {
  return { page: 1, pageSize: 15, total: 0 }
}

export function createEmptyCouponsFilters() {
  return { keyword: '' }
}

function normalizeCoupon(raw) {
  return {
    id: raw.id,
    name: raw.name || '',
    code: raw.code || '',
    type: raw.type ?? 1,
    value: raw.value ?? 0,
    limitUse: raw.limit_use ?? null,
    limitUseWithUser: raw.limit_use_with_user ?? null,
    limitPlanIds: Array.isArray(raw.limit_plan_ids) ? raw.limit_plan_ids : [],
    limitPeriod: Array.isArray(raw.limit_period) ? raw.limit_period : [],
    startedAt: raw.started_at ?? null,
    endedAt: raw.ended_at ?? null,
    show: Boolean(raw.show),
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  }
}

export async function fetchManagedCoupons({ page = 1, pageSize = 15, filters = {} } = {}) {
  const queryEntries = [
    ['page', page],
    ['page_size', pageSize],
  ]
  if (filters.keyword) {
    queryEntries.push(['filter[0][key]', 'keyword'])
    queryEntries.push(['filter[0][value]', filters.keyword])
  }
  const apiUrl = buildDashboardApiUrl('coupon/fetch', queryEntries)
  const payload = await requestDashboardApi(apiUrl)
  console.log('[Coupons] API response structure:', JSON.stringify({
    dataKeys: payload?.data ? Object.keys(payload.data) : [],
    dataTotal: payload?.data?.total,
  }))
  const rawData = payload?.data ?? {}
  const listSource = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : [])

  const total = Number(rawData?.total || payload?.total || listSource.length)
  const currentPage = Number(rawData?.current_page || payload?.current_page || page)
  const perPage = Number(rawData?.per_page || payload?.per_page || pageSize)
  console.log('[Coupons] Parsed pagination:', { total, currentPage, perPage, listCount: listSource.length })

  return {
    list: listSource.map(normalizeCoupon),
    pagination: {
      page: currentPage,
      pageSize: perPage,
      total: total,
    },
  }
}

export async function generateCoupons(formData) {
  const endpoint = formData.id ? 'coupon/save' : 'coupon/generate'
  const apiUrl = buildDashboardApiUrl(endpoint)
  const body = {
    name: formData.name,
    type: formData.type,
    value: formData.value,
    limit_use: formData.limitUse || null,
    limit_use_with_user: formData.limitUseWithUser || null,
    limit_plan_ids: formData.limitPlanIds || [],
    limit_period: formData.limitPeriod || [],
    started_at: formData.startedAt || null,
    ended_at: formData.endedAt || null,
  }
  if (formData.id) {
    body.id = formData.id
  }
  if (formData.code) {
    body.code = formData.code
  }
  if (!formData.id && formData.generateCount) {
    body.generate_count = formData.generateCount
  }
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getDashboardApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`${formData.id ? '保存' : '生成'}优惠券失败 (${response.status})`)
  }

  return response.json()
}

export async function deleteCoupon(id) {
  const apiUrl = buildDashboardApiUrl('coupon/drop')
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getDashboardApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  })

  if (!response.ok) {
    throw new Error(`删除优惠券失败 (${response.status})`)
  }

  return response.json()
}

export async function toggleCouponShow(id) {
  const apiUrl = buildDashboardApiUrl('coupon/show')
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getDashboardApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  })

  if (!response.ok) {
    throw new Error(`切换优惠券状态失败 (${response.status})`)
  }

  return response.json()
}
