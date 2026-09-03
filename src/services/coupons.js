import {
  buildDashboardApiUrl,
  requestDashboardApi,
  requestDashboardMutation,
} from './api'

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

/**
 * 按 id 拉单张优惠券（OrdersPage 详情对话框需要展示完整 coupon 信息时用）。
 *
 * 后端没有专门的 fetch-by-id endpoint，且 coupon/fetch 的 filter 实现是
 * `LIKE "%value%"`（CouponController.php:63）—— 完全忽略 `eq:` 之类前缀。
 * 所以这里只能发裸数字 id 作为关键字，再在客户端用 .find() 取精确等值。
 *
 * 因为 LIKE 会命中所有"包含该数字"的 id（如查 57 会返回 57 / 157 / 570 / 1570…），
 * pageSize 用 100 留余地，仍找不到精确匹配时第二次尝试取该 id 所在页码。
 * 返回 null 表示未找到。
 */
export async function fetchCouponById(id) {
  const couponId = Number(id || 0)
  if (!couponId) return null

  const buildUrl = (page) => buildDashboardApiUrl('coupon/fetch', [
    ['current', page],
    ['pageSize', 100],
    ['filter[0][id]', 'id'],
    ['filter[0][value]', String(couponId)], // 不能带 eq:，后端只做 LIKE
  ])

  // 第一页
  let payload = await requestDashboardApi(buildUrl(1))
  const firstData = payload?.data ?? {}
  const firstList = Array.isArray(firstData?.data) ? firstData.data : (Array.isArray(firstData) ? firstData : [])
  const exact = firstList.find((c) => Number(c?.id) === couponId)
  if (exact) return normalizeCoupon(exact)

  // 如果没命中、且总数较多，再扫几页（少见场景，最多扫 5 页 ≈ 500 条）
  const total = Number(firstData?.total ?? payload?.total ?? firstList.length)
  const totalPages = Math.min(Math.ceil(total / 100), 5)
  for (let page = 2; page <= totalPages; page += 1) {
    payload = await requestDashboardApi(buildUrl(page))
    const rawData = payload?.data ?? {}
    const list = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : [])
    const hit = list.find((c) => Number(c?.id) === couponId)
    if (hit) return normalizeCoupon(hit)
  }

  return null
}

// coupon/fetch 的 filter[n][id] 直接当列名用（见 fetchCouponById 用的 'id'），
// 这里白名单化可搜字段，防止把任意列名透传给后端。
export const COUPON_FILTER_FIELDS = Object.freeze(['name', 'code', 'id'])

export async function fetchManagedCoupons({ page = 1, pageSize = 15, filters = {} } = {}) {
  const queryEntries = [
    ['current', page],
    ['pageSize', pageSize],
  ]
  if (filters.keyword) {
    // 搜索字段必须由调用方显式指定。之前这里写死 'name'，导致 CouponsPage
    // 把券码（route.query.coupon_code）填进同一个 keyword 时是拿券码去搜名称，
    // 永远 0 条 —— 用户看到搜索框有内容、列表却是空的。
    const field = COUPON_FILTER_FIELDS.includes(filters.field) ? filters.field : 'name'
    queryEntries.push(['filter[0][id]', field])
    queryEntries.push(['filter[0][value]', filters.keyword])
  }
  const apiUrl = buildDashboardApiUrl('coupon/fetch', queryEntries)
  const payload = await requestDashboardApi(apiUrl)
  const rawData = payload?.data ?? {}
  const listSource = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : [])

  const total = Number(rawData?.total ?? payload?.total ?? listSource.length)
  const currentPage = Number(rawData?.current_page ?? payload?.current_page ?? page)
  const perPage = Number(rawData?.per_page ?? payload?.per_page ?? pageSize)

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
    // 编辑模式必须显式发送 show，否则后端会默默将"已隐藏的优惠券"重新置显示。
    body.show = formData.show === false || formData.show === 0 ? 0 : 1
  }
  if (formData.code && !formData.generateCount) {
    body.code = formData.code
  }
  if (!formData.id && formData.generateCount) {
    body.generate_count = formData.generateCount
  }
  return requestDashboardMutation(apiUrl, body)
}

export async function deleteCoupon(id) {
  const apiUrl = buildDashboardApiUrl('coupon/drop')
  return requestDashboardMutation(apiUrl, { id })
}

export async function toggleCouponShow(id) {
  const apiUrl = buildDashboardApiUrl('coupon/show')
  return requestDashboardMutation(apiUrl, { id })
}
