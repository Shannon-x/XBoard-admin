import {
  buildDashboardApiUrl,
  requestDashboardApi,
  requestDashboardMutation,
} from './api'

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
  const payload = await requestDashboardMutation(apiUrl, { payment, id })

  // 兼容多种响应形态
  let fields = payload?.data ?? payload

  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    fields = Object.entries(fields).map(([key, val]) => {
      if (val && typeof val === 'object' && (val.label || val.field)) {
        return {
          field: val.field || key,
          label: val.label || key,
          tips: val.tips || val.description || '',
          placeholder: val.placeholder || '',
        }
      }
      return { field: key, label: key, tips: '', placeholder: String(val ?? '') }
    })
  }

  return Array.isArray(fields) ? fields : []
}

export async function savePayment(formData) {
  const apiUrl = buildDashboardApiUrl('payment/save')
  // 之前的 body 丢掉了 show/sort/notify_url 等字段，导致存了之后这些字段
  // 在前端 normalizePayment 里读不到对应值。这里把所有 normalize 里读的字段
  // 都回写过去（缺省时给 null/0，让后端能保留旧值或清空）。
  return requestDashboardMutation(apiUrl, {
    id: formData.id || null,
    name: formData.name,
    icon: formData.icon || null,
    payment: formData.payment,
    config: formData.config || {},
    enable: formData.enable ? 1 : 0,
    show: formData.show ? 1 : 0,
    sort: Number.isFinite(Number(formData.sort)) ? Number(formData.sort) : 0,
    notify_domain: formData.notifyDomain || '',
    notify_url: formData.notifyUrl || '',
    handling_fee_percent: formData.handlingFeePercent ?? null,
    handling_fee_fixed: formData.handlingFeeFixed ?? null,
  })
}

export async function deletePayment(id) {
  const apiUrl = buildDashboardApiUrl('payment/drop')
  return requestDashboardMutation(apiUrl, { id })
}

export async function togglePaymentShow(id) {
  // 注意：后端端点名是 payment/show，但行为是切换 enable 而非 show。
  // 保留旧端点以兼容部署，仅集中走标准 mutation 层（自动 401 处理）。
  const apiUrl = buildDashboardApiUrl('payment/show')
  return requestDashboardMutation(apiUrl, { id })
}

export async function sortPayments(ids) {
  const apiUrl = buildDashboardApiUrl('payment/sort')
  return requestDashboardMutation(apiUrl, { ids })
}
