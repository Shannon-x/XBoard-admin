import {
  buildSecureV2ApiUrl,
  requestDashboardApi,
  requestDashboardMutation,
} from './api'

export function createEmptyManagedPlans() {
  return []
}

function formatBytes(value) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let size = Number(value || 0)
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

const PERIOD_LABELS = {
  month_price: '月付',
  quarter_price: '季付',
  half_year_price: '半年付',
  year_price: '年付',
  two_year_price: '两年付',
  three_year_price: '三年付',
  onetime_price: '一次性',
  reset_price: '重置包',
}

// Maps frontend form keys to backend API price keys (inside the prices JSON column)
const FORM_TO_API_PRICE_KEY = {
  month_price: 'monthly',
  quarter_price: 'quarterly',
  half_year_price: 'half_yearly',
  year_price: 'yearly',
  two_year_price: 'two_yearly',
  three_year_price: 'three_yearly',
  onetime_price: 'onetime',
  reset_price: 'reset_traffic',
}

// Reverse mapping: backend API keys to frontend form keys
const API_TO_FORM_PRICE_KEY = Object.fromEntries(
  Object.entries(FORM_TO_API_PRICE_KEY).map(([formKey, apiKey]) => [apiKey, formKey])
)

function normalizePlan(plan) {
  const prices = {}
  const priceTexts = []
  const rawPrices = plan?.prices || {}

  // Read from the nested prices object using API keys, map to form keys
  Object.keys(PERIOD_LABELS).forEach(function mapPeriod(formKey) {
    const apiKey = FORM_TO_API_PRICE_KEY[formKey]
    const priceValue = rawPrices[apiKey]

    if (priceValue !== null && priceValue !== undefined && Number(priceValue) > 0) {
      const amount = Number(priceValue)
      prices[formKey] = amount
      priceTexts.push(`${PERIOD_LABELS[formKey]}: ¥${amount.toFixed(2)}`)
    } else {
      prices[formKey] = null
    }
  })

  const transferEnable = Number(plan?.transfer_enable || 0)
  const groupName = plan?.group?.name || '--'

  return {
    id: Number(plan?.id || 0),
    name: String(plan?.name || '--'),
    groupId: plan?.group_id != null ? String(plan.group_id) : null,
    groupName,
    transferEnable: transferEnable,
    transferEnableText: formatBytes(transferEnable * 1073741824),
    transferEnableGB: transferEnable,
    speedLimit: plan?.speed_limit || null,
    deviceLimit: plan?.device_limit || null,
    prices,
    priceTexts,
    show: Boolean(plan?.show),
    sell: Boolean(plan?.sell),
    renew: Boolean(plan?.renew),
    resetTrafficMethod: plan?.reset_traffic_method ?? -1,
    sort: plan?.sort || null,
    content: plan?.content || '',
    usersCount: Number(plan?.users_count || 0),
    activeUsersCount: Number(plan?.active_users_count || 0),
    capacityLimit: plan?.capacity_limit || null,
    forceUpdate: false,
  }
}

export async function fetchManagedPlans() {
  const apiUrl = buildSecureV2ApiUrl('plan/fetch')
  const payload = await requestDashboardApi(apiUrl)
  const rawData = payload?.data ?? {}
  const list = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : [])

  return list.map(function mapPlan(plan) {
    return normalizePlan(plan)
  })
}

export async function saveManagedPlan(data) {
  const apiUrl = buildSecureV2ApiUrl('plan/save')

  // Build the prices object using API keys (prices are stored in yuan)
  const apiPrices = {}
  Object.keys(PERIOD_LABELS).forEach(function mapPeriod(formKey) {
    const apiKey = FORM_TO_API_PRICE_KEY[formKey]
    if (data.prices && data.prices[formKey] !== undefined && data.prices[formKey] !== null && data.prices[formKey] !== '') {
      apiPrices[apiKey] = Number(Number(data.prices[formKey]).toFixed(2))
    }
  })

  const requestBody = {
    name: String(data.name || '').trim(),
    group_id: data.groupId != null ? Number(data.groupId) : null,
    transfer_enable: Number(data.transferEnableGB || 0),
    speed_limit: data.speedLimit ? Number(data.speedLimit) : null,
    device_limit: data.deviceLimit ? Number(data.deviceLimit) : null,
    show: data.show ? 1 : 0,
    sell: data.sell ? 1 : 0,
    renew: data.renew ? 1 : 0,
    content: data.content || null,
    reset_traffic_method: data.resetTrafficMethod === -1 ? null : (data.resetTrafficMethod ?? null),
    capacity_limit: data.capacityLimit ? Number(data.capacityLimit) : null,
    prices: apiPrices,
  }

  if (data.id) {
    requestBody.id = Number(data.id)
  }

  if (data.forceUpdate) {
    requestBody.force_update = 1
  }

  return requestDashboardMutation(apiUrl, requestBody)
}

export async function deleteManagedPlan(id) {
  const apiUrl = buildSecureV2ApiUrl('plan/drop')
  return requestDashboardMutation(apiUrl, { id: Number(id) })
}

export async function updateManagedPlan(id, updateData) {
  const apiUrl = buildSecureV2ApiUrl('plan/update')
  const body = { id: Number(id) }

  if (updateData.show !== undefined) {
    body.show = updateData.show ? 1 : 0
  }

  if (updateData.renew !== undefined) {
    body.renew = updateData.renew ? 1 : 0
  }

  if (updateData.sell !== undefined) {
    body.sell = updateData.sell ? 1 : 0
  }

  return requestDashboardMutation(apiUrl, body)
}

export async function sortManagedPlans(ids) {
  const apiUrl = buildSecureV2ApiUrl('plan/sort')
  return requestDashboardMutation(apiUrl, {
    ids: ids.map(function mapId(id) {
      return Number(id)
    }),
  })
}

export { PERIOD_LABELS }
