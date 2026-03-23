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
  const rawData = payload?.data ?? {}
  const listSource = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : [])

  return {
    list: listSource.map(normalizeCoupon),
    pagination: {
      page: Number(rawData?.current_page || page),
      pageSize: Number(rawData?.per_page || pageSize),
      total: Number(rawData?.total || payload?.total || listSource.length),
    },
  }
}

export async function generateCoupons(formData) {
  const apiUrl = buildDashboardApiUrl('coupon/generate')
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getDashboardApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: formData.name,
      type: formData.type,
      value: formData.value,
      generate_count: formData.generateCount || 1,
      limit_use: formData.limitUse || null,
      limit_use_with_user: formData.limitUseWithUser || null,
      limit_plan_ids: formData.limitPlanIds || [],
      limit_period: formData.limitPeriod || [],
      started_at: formData.startedAt || null,
      ended_at: formData.endedAt || null,
    }),
  })

  if (!response.ok) {
    throw new Error(`生成优惠券失败 (${response.status})`)
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
