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

function normalizePlan(plan) {
  const prices = {}
  const priceTexts = []

  Object.keys(PERIOD_LABELS).forEach(function mapPeriod(periodKey) {
    const priceValue = plan?.[periodKey]

    if (priceValue !== null && priceValue !== undefined) {
      const amount = Number(priceValue) / 100
      prices[periodKey] = amount
      if (amount > 0) {
        priceTexts.push(`${PERIOD_LABELS[periodKey]}: ¥${amount.toFixed(2)}`)
      }
    }
  })

  const transferEnable = Number(plan?.transfer_enable || 0)
  const groupName = plan?.group?.name || '--'

  return {
    id: Number(plan?.id || 0),
    name: String(plan?.name || '--'),
    groupId: plan?.group_id || null,
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
    resetTrafficMethod: plan?.reset_traffic_method ?? null,
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

  const requestBody = {
    name: String(data.name || '').trim(),
    group_id: data.groupId || null,
    transfer_enable: Number(data.transferEnableGB || 0),
    speed_limit: data.speedLimit ? Number(data.speedLimit) : null,
    device_limit: data.deviceLimit ? Number(data.deviceLimit) : null,
    show: data.show ? 1 : 0,
    sell: data.sell ? 1 : 0,
    renew: data.renew ? 1 : 0,
    content: data.content || null,
    reset_traffic_method: data.resetTrafficMethod ?? null,
    capacity_limit: data.capacityLimit ? Number(data.capacityLimit) : null,
  }

  Object.keys(PERIOD_LABELS).forEach(function mapPeriod(periodKey) {
    if (data.prices && data.prices[periodKey] !== undefined && data.prices[periodKey] !== null && data.prices[periodKey] !== '') {
      requestBody[periodKey] = Math.round(Number(data.prices[periodKey]) * 100)
    } else {
      requestBody[periodKey] = null
    }
  })

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
