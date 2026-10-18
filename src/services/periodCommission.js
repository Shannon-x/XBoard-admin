import {
  buildSecureV2ApiUrl,
  requestDashboardApi,
  requestDashboardMutation,
} from './api'
import { formatTimestamp } from '../utils/format'

// 与后端 CommissionPeriodApplication::STATUS_* 一致
export const PERIOD_APPLICATION_STATUS = {
  0: { text: '待审核', type: 'warning' },
  1: { text: '已开通', type: 'success' },
  2: { text: '已驳回', type: 'danger' },
  3: { text: '已取消', type: 'info' },
}

export function createEmptyPeriodApplicationsPagination() {
  return { page: 1, pageSize: 15, total: 0 }
}

function normalizeSettings(raw) {
  return {
    enable: Boolean(raw?.enable),
    minInvitees: Number(raw?.min_invitees ?? 0),
  }
}

export function normalizePeriodApplication(raw) {
  const status = Number(raw?.status ?? 0)
  const statusInfo = PERIOD_APPLICATION_STATUS[status] || { text: '未知', type: 'info' }
  return {
    id: Number(raw?.id ?? 0),
    userId: Number(raw?.user_id ?? 0),
    userEmail: String(raw?.user_email || '--'),
    // 0 = 跟随站点；1 / 2 = 管理员在用户编辑里单设了周期 / 一次性，此时申请结果不生效
    userCommissionType: Number(raw?.user_commission_type ?? 0),
    status,
    statusText: statusInfo.text,
    statusType: statusInfo.type,
    activeCount: Number(raw?.active_count ?? 0),
    minInvitees: Number(raw?.min_invitees ?? 0),
    currentActiveCount: Number(raw?.current_active_count ?? 0),
    reason: String(raw?.reason || ''),
    adminEmail: String(raw?.admin_email || ''),
    decidedAt: formatTimestamp(raw?.decided_at),
    revokedAt: formatTimestamp(raw?.revoked_at),
    revokedCount: raw?.revoked_count ?? null,
    createdAt: formatTimestamp(raw?.created_at),
  }
}

export async function fetchPeriodApplications(options = {}) {
  const current = Number(options.page || 1)
  const pageSize = Number(options.pageSize || 15)
  const queryEntries = [
    ['current', current],
    ['pageSize', pageSize],
  ]
  const body = {}
  if (options.status !== null && options.status !== undefined && options.status !== '') {
    body.status = options.status
  }
  if (options.email) {
    body.email = options.email
  }

  const payload = await requestDashboardMutation(buildSecureV2ApiUrl('commission-period/fetch', queryEntries), body)
  const rawData = payload?.data ?? {}
  const list = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : [])

  return {
    list: list.map(normalizePeriodApplication),
    pagination: {
      page: current,
      pageSize,
      total: Number(rawData?.total ?? payload?.total ?? 0),
    },
    settings: normalizeSettings(rawData?.settings ?? payload?.settings),
  }
}

export async function fetchPeriodApplicationStats() {
  const payload = await requestDashboardApi(buildSecureV2ApiUrl('commission-period/stats'))
  return {
    pendingCount: Number(payload?.data?.pending_count ?? 0),
    approvedCount: Number(payload?.data?.approved_count ?? 0),
    settings: normalizeSettings(payload?.data?.settings),
  }
}

export async function approvePeriodApplication(id) {
  const payload = await requestDashboardMutation(buildSecureV2ApiUrl('commission-period/approve'), {
    id: Number(id),
  })
  return normalizePeriodApplication(payload?.data)
}

export async function rejectPeriodApplication(id, reason) {
  const payload = await requestDashboardMutation(buildSecureV2ApiUrl('commission-period/reject'), {
    id: Number(id),
    reason: String(reason || '').trim(),
  })
  return normalizePeriodApplication(payload?.data)
}
