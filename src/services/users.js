import {
  buildSecureV2ApiUrl,
  getDashboardApiHeaders,
  requestDashboardApi,
  requestDashboardMutation,
} from './api'

export function createEmptyManagedUsers() {
  return []
}

export function createEmptyManagedUsersPagination() {
  return {
    page: 1,
    pageSize: 10,
    total: 0,
  }
}

export function createEmptyManagedUsersFilters() {
  return {
    filter: [],
    sort: [],
  }
}

function formatTimestamp(value) {
  const timestamp = Number(value || 0)

  if (!timestamp) {
    return '--'
  }

  const date = new Date(timestamp * 1000)

  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
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

function normalizeUser(user) {
  const isBanned = Boolean(user?.banned)
  const planName = user?.plan?.name || '--'
  const groupName = user?.group?.name || '--'
  const inviteEmail = user?.invite_user?.email || '--'
  const totalUsed = Number(user?.u || 0) + Number(user?.d || 0)
  const transferEnable = Number(user?.transfer_enable || 0)
  const remainTraffic = Math.max(transferEnable - totalUsed, 0)

  return {
    id: Number(user?.id || 0),
    email: String(user?.email || '--'),
    planId: user?.plan_id || null,
    planName,
    groupId: user?.group_id || null,
    groupName,
    inviteUserId: user?.invite_user_id || null,
    inviteUserEmail: inviteEmail,
    balance: Number(user?.balance || 0).toFixed(2),
    commissionBalance: Number(user?.commission_balance || 0).toFixed(2),
    transferEnable: formatBytes(transferEnable),
    transferEnableRaw: transferEnable,
    totalUsed: formatBytes(totalUsed),
    totalUsedRaw: totalUsed,
    remainTraffic: formatBytes(remainTraffic),
    upload: formatBytes(user?.u),
    uploadRaw: Number(user?.u || 0),
    download: formatBytes(user?.d),
    downloadRaw: Number(user?.d || 0),
    speedLimit: user?.speed_limit || null,
    deviceLimit: user?.device_limit || null,
    onlineCount: Number(user?.online_count || 0),
    expiredAt: formatTimestamp(user?.expired_at),
    expiredAtRaw: user?.expired_at || null,
    createdAt: formatTimestamp(user?.created_at),
    lastLoginAt: formatTimestamp(user?.last_login_at),
    isBanned,
    banned: user?.banned ? 1 : 0,
    statusText: isBanned ? '已封禁' : '正常',
    statusType: isBanned ? 'danger' : 'success',
    uuid: user?.uuid || '--',
    token: user?.token || '',
    subscribeUrl: user?.subscribe_url || '',
    remindExpire: Boolean(user?.remind_expire),
    remindTraffic: Boolean(user?.remind_traffic),
    commissionRate: user?.commission_rate ?? null,
    commissionType: user?.commission_type ?? 0,
    discount: user?.discount ?? null,
    isAdmin: Boolean(user?.is_admin),
    isStaff: Boolean(user?.is_staff),
    remarks: user?.remarks || '',
  }
}

export async function fetchManagedUsers(options = {}) {
  const current = Number(options.page || 1)
  const pageSize = Number(options.pageSize || 10)
  const queryEntries = [
    ['current', current],
    ['pageSize', pageSize],
  ]

  const apiUrl = buildSecureV2ApiUrl('user/fetch', queryEntries)
  const body = {}

  if (Array.isArray(options.filter) && options.filter.length > 0) {
    body.filter = options.filter
  }

  if (Array.isArray(options.sort) && options.sort.length > 0) {
    body.sort = options.sort
  }

  const headers = {
    ...getDashboardApiHeaders(),
    'Content-Type': 'application/json',
  }
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error('鉴权失败，请重新登录')
  }

  if (!response.ok) {
    let errMsg = `用户列表请求失败: ${response.status}`
    try {
      const errBody = await response.json()
      if (errBody?.message) errMsg += ` - ${errBody.message}`
      else if (errBody?.errors) errMsg += ` - ${JSON.stringify(errBody.errors)}`
    } catch (_) { /* ignore parse failure */ }
    throw new Error(errMsg)
  }

  const payload = await response.json()
  console.log('[Users] API response structure:', JSON.stringify({
    hasData: !!payload?.data,
    dataType: typeof payload?.data,
    dataKeys: payload?.data ? Object.keys(payload.data) : [],
    topTotal: payload?.total,
    dataTotal: payload?.data?.total,
    nestedTotal: payload?.data?.data ? 'has nested data' : 'no nested data',
  }))
  const rawData = payload?.data ?? {}
  const listSource = Array.isArray(rawData?.data) ? rawData.data : (Array.isArray(rawData) ? rawData : [])

  // Xboard API can return pagination at different nesting levels
  const total = Number(
    rawData?.total
    || payload?.data?.total
    || payload?.total
    || 0
  )
  const currentPage = Number(
    rawData?.current_page
    || payload?.data?.current_page
    || payload?.current_page
    || current
  )
  const perPage = Number(
    rawData?.per_page
    || payload?.data?.per_page
    || payload?.per_page
    || pageSize
  )

  console.log('[Users] Parsed pagination:', { total, currentPage, perPage, listCount: listSource.length })

  return {
    list: listSource.map(function mapUser(user) {
      return normalizeUser(user)
    }),
    pagination: {
      page: currentPage,
      pageSize: perPage,
      total: total,
    },
  }
}

export async function getUserInfoById(id) {
  const apiUrl = buildSecureV2ApiUrl('user/getUserInfoById', [['id', id]])
  const payload = await requestDashboardApi(apiUrl)
  const user = payload?.data

  return normalizeUser(user)
}

export async function updateManagedUser(userData) {
  const apiUrl = buildSecureV2ApiUrl('user/update')
  return requestDashboardMutation(apiUrl, userData)
}

export async function generateManagedUser(data) {
  const apiUrl = buildSecureV2ApiUrl('user/generate')
  return requestDashboardMutation(apiUrl, data)
}

export async function banManagedUsers(data) {
  const apiUrl = buildSecureV2ApiUrl('user/ban')
  return requestDashboardMutation(apiUrl, data)
}

export async function resetManagedUserSecret(id) {
  const apiUrl = buildSecureV2ApiUrl('user/resetSecret')
  return requestDashboardMutation(apiUrl, { id: Number(id) })
}

export async function sendMailToUsers(data) {
  const apiUrl = buildSecureV2ApiUrl('user/sendMail')
  return requestDashboardMutation(apiUrl, data)
}

export async function dumpUsersCSV(data) {
  const apiUrl = buildSecureV2ApiUrl('user/dumpCSV')
  const headers = {
    ...getDashboardApiHeaders(),
    'Content-Type': 'application/json',
  }
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`导出失败: ${response.status}`)
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

export async function destroyManagedUser(id) {
  const apiUrl = buildSecureV2ApiUrl('user/destroy')
  return requestDashboardMutation(apiUrl, { id: Number(id) })
}

export async function setInviteUser(id, inviteUserEmail) {
  const apiUrl = buildSecureV2ApiUrl('user/setInviteUser')
  return requestDashboardMutation(apiUrl, {
    id: Number(id),
    invite_user_email: inviteUserEmail,
  })
}

export async function fetchUserTrafficStats(userId, options = {}) {
  const current = Number(options.page || 1)
  const pageSize = Number(options.pageSize || 10)
  const queryEntries = [
    ['user_id', userId],
    ['current', current],
    ['pageSize', pageSize],
  ]
  const apiUrl = buildSecureV2ApiUrl('stat/getStatUser', queryEntries)

  const headers = { ...getDashboardApiHeaders() }
  const response = await fetch(apiUrl, { headers })

  if (response.status === 401 || response.status === 403) {
    throw new Error('鉴权失败，请重新登录')
  }

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`)
  }

  const payload = await response.json()
  const list = Array.isArray(payload?.data) ? payload.data : []
  const total = Number(payload?.total || 0)

  return {
    list: list.map(item => {
      const u = Number(item.u || 0)
      const d = Number(item.d || 0)
      
      const formatBytes = (val) => {
        const units = ["B", "KB", "MB", "GB", "TB", "PB"]
        let size = Number(val || 0)
        let index = 0
        while (size >= 1024 && index < units.length - 1) {
          size /= 1024
          index++
        }
        return `${size.toFixed(2)} ${units[index]}`
      }

      const date = new Date((item.record_at || 0) * 1000)
      const dateStr = date.getTime() ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '--'

      return {
        id: item.id,
        recordAt: item.record_at,
        date: dateStr,
        serverRate: item.server_rate || '1.0',
        u: u,
        d: d,
        total: u + d,
        uText: formatBytes(u),
        dText: formatBytes(d),
        totalText: formatBytes(u + d)
      }
    }),
    pagination: {
      page: current,
      pageSize,
      total,
    }
  }
}

