import { buildDashboardApiUrl, getDashboardApiHeaders, requestDashboardApi } from './api'

const AMOUNT_COUPON_TYPE = 1

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
    ['current', page],
    ['pageSize', pageSize],
  ]
  if (filters.keyword) {
    queryEntries.push(['filter[0][id]', 'name'])
    queryEntries.push(['filter[0][value]', filters.keyword])
  }
  const apiUrl = buildDashboardApiUrl('coupon/fetch', queryEntries)
  const payload = await requestDashboardApi(apiUrl)
  const rawData = payload?.data ?? {}
  const listSource = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : [])

  const total = Number(rawData?.total || payload?.total || listSource.length)
  const currentPage = Number(rawData?.current_page || payload?.current_page || page)
  const perPage = Number(rawData?.per_page || payload?.per_page || pageSize)

  return {
    list: listSource.map(normalizeCoupon),
    pagination: {
      page: currentPage,
      pageSize: perPage,
      total: total,
    },
  }
}

function normalizeCouponValueForApi(type, value) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    return 0
  }

  if (Number(type) === AMOUNT_COUPON_TYPE) {
    return Math.round(numberValue * 100)
  }

  return Math.round(numberValue)
}

function getResponseErrorMessage(result, fallback) {
  if (typeof result?.message === 'string' && result.message) {
    return result.message
  }

  const firstError = Object.values(result?.errors || {})
    .flat()
    .find(Boolean)

  return firstError || fallback
}

export async function generateCoupons(formData) {
  const apiUrl = buildDashboardApiUrl('coupon/generate')
  const body = {
    name: formData.name,
    type: formData.type,
    value: normalizeCouponValueForApi(formData.type, formData.value),
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
  if (formData.code && !formData.generateCount) {
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

  const result = await response.json().catch(() => null)

  if (!response.ok) {
    const actionText = formData.id ? '保存' : '生成'
    throw new Error(getResponseErrorMessage(result, `${actionText}优惠券失败 (${response.status})`))
  }

  if (result?.code !== undefined && Number(result.code) !== 0) {
    throw new Error(result.message || `${formData.id ? '保存' : '生成'}优惠券失败`)
  }

  return result
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
