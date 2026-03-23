import { buildDashboardApiUrl, getDashboardApiHeaders, requestDashboardApi } from './api'

function normalizePayment(raw) {
  return {
    id: raw.id,
    name: raw.name || '',
    payment: raw.payment || '',
    icon: raw.icon || '',
    config: raw.config ?? {},
    enable: Boolean(raw.enable),
    show: Boolean(raw.show),
    sort: raw.sort ?? 0,
    notifyDomain: raw.notify_domain || '',
    notifyUrl: raw.notify_url || '',
    handlingFeePercent: raw.handling_fee_percent ?? null,
    handlingFeeFixed: raw.handling_fee_fixed ?? null,
    uuid: raw.uuid || '',
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
  }
}

export async function fetchPayments() {
  const apiUrl = buildDashboardApiUrl('payment/fetch')
  const payload = await requestDashboardApi(apiUrl)
  const list = Array.isArray(payload?.data) ? payload.data : []
  return list.map(normalizePayment)
}

export async function fetchPaymentMethods() {
  const apiUrl = buildDashboardApiUrl('payment/getPaymentMethods')
  const payload = await requestDashboardApi(apiUrl)
  return Array.isArray(payload?.data) ? payload.data : []
}

export async function fetchPaymentForm(payment, id = null) {
  const apiUrl = buildDashboardApiUrl('payment/getPaymentForm')
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getDashboardApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ payment, id }),
  })

  if (!response.ok) {
    throw new Error(`获取支付配置表单失败 (${response.status})`)
  }

  const payload = await response.json()
  return payload?.data ?? []
}

export async function savePayment(formData) {
  const apiUrl = buildDashboardApiUrl('payment/save')
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getDashboardApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: formData.id || null,
      name: formData.name,
      icon: formData.icon || null,
      payment: formData.payment,
      config: formData.config || {},
      enable: formData.enable ? 1 : 0,
      notify_domain: formData.notifyDomain || '',
      handling_fee_percent: formData.handlingFeePercent ?? null,
      handling_fee_fixed: formData.handlingFeeFixed ?? null,
    }),
  })

  if (!response.ok) {
    throw new Error(`保存支付方式失败 (${response.status})`)
  }

  return response.json()
}

export async function deletePayment(id) {
  const apiUrl = buildDashboardApiUrl('payment/drop')
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getDashboardApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  })

  if (!response.ok) {
    throw new Error(`删除支付方式失败 (${response.status})`)
  }

  return response.json()
}

export async function togglePaymentShow(id) {
  const apiUrl = buildDashboardApiUrl('payment/show')
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getDashboardApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  })

  if (!response.ok) {
    throw new Error(`切换支付方式状态失败 (${response.status})`)
  }

  return response.json()
}

export async function sortPayments(ids) {
  const apiUrl = buildDashboardApiUrl('payment/sort')
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getDashboardApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  })

  if (!response.ok) {
    throw new Error(`排序支付方式失败 (${response.status})`)
  }

  return response.json()
}
