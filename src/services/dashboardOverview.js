import { buildDashboardApiUrl, requestDashboardApi } from './api'

/**
 * 新仪表盘的数据层：stat/getDashboard（今日概况、待办、订阅、节点、流量）与
 * stat/getIncome（收入趋势）。口径都在后端 DashboardStatService，这里只做归一化，
 * 金额一律保留「分」，展示时再格式化，避免旧版那种「元当分、分当元」的混用
 * （旧收入卡把后端以分计的均价当成元显示，¥31.87 显示成了 ¥3187.00）。
 */

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizePaid(raw) {
  return {
    amount: num(raw?.amount),
    paidCount: num(raw?.paid_count),
    zeroCount: num(raw?.zero_count),
  }
}

function normalizeTypeRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(function toRow(row) {
    return {
      type: num(row.type),
      label: String(row.label || row.type || ''),
      count: num(row.count),
      amount: num(row.amount),
      zeroCount: num(row.zero_count),
    }
  })
}

export function createEmptyDashboardOverview() {
  const paid = { amount: 0, paidCount: 0, zeroCount: 0 }
  return {
    loaded: false,
    generatedAt: 0,
    income: {
      today: { ...paid },
      yesterdaySameTime: { ...paid },
      yesterday: { ...paid },
      month: { ...paid },
      lastMonthSameTime: { ...paid },
      lastMonth: { ...paid },
      todayByType: [],
      commission: { month: 0, lastMonthSameTime: 0, lastMonth: 0 },
    },
    users: {
      total: 0,
      newToday: 0,
      newYesterdaySameTime: 0,
      newYesterday: 0,
      newMonth: 0,
      newLastMonthSameTime: 0,
      newLastMonth: 0,
      online: 0,
      onlineDevices: 0,
    },
    subscriptions: {
      active: 0,
      autoRenew: 0,
      expiringToday: 0,
      expiring7d: 0,
      lapsed7d: 0,
      byPlan: [],
    },
    nodes: { total: 0, shown: 0, hidden: 0, online: 0, offline: 0, offlineList: [] },
    traffic: {
      today: { upload: 0, download: 0, total: 0 },
      yesterday: { upload: 0, download: 0, total: 0 },
      month: { upload: 0, download: 0, total: 0 },
      lastMonthSameTime: { upload: 0, download: 0, total: 0 },
    },
    todo: {
      ticketsWaiting: 0,
      ticketsOpen: 0,
      withdrawalsPending: 0,
      withdrawalsAmount: 0,
      periodCommissionPending: 0,
      commissionUnconfirmed: 0,
      mailSuppressed: 0,
    },
  }
}

function normalizeTraffic(raw) {
  return {
    upload: num(raw?.upload),
    download: num(raw?.download),
    total: num(raw?.total),
  }
}

export async function fetchDashboardOverview() {
  const payload = await requestDashboardApi(buildDashboardApiUrl('stat/getDashboard'))
  const data = payload?.data ?? {}
  const income = data.income ?? {}
  const users = data.users ?? {}
  const subs = data.subscriptions ?? {}
  const nodes = data.nodes ?? {}
  const traffic = data.traffic ?? {}
  const todo = data.todo ?? {}

  return {
    loaded: true,
    generatedAt: num(data.generated_at),
    income: {
      today: normalizePaid(income.today),
      yesterdaySameTime: normalizePaid(income.yesterday_same_time),
      yesterday: normalizePaid(income.yesterday),
      month: normalizePaid(income.month),
      lastMonthSameTime: normalizePaid(income.last_month_same_time),
      lastMonth: normalizePaid(income.last_month),
      todayByType: normalizeTypeRows(income.today_by_type),
      commission: {
        month: num(income.commission?.month),
        lastMonthSameTime: num(income.commission?.last_month_same_time),
        lastMonth: num(income.commission?.last_month),
      },
    },
    users: {
      total: num(users.total),
      newToday: num(users.new_today),
      newYesterdaySameTime: num(users.new_yesterday_same_time),
      newYesterday: num(users.new_yesterday),
      newMonth: num(users.new_month),
      newLastMonthSameTime: num(users.new_last_month_same_time),
      newLastMonth: num(users.new_last_month),
      online: num(users.online),
      onlineDevices: num(users.online_devices),
    },
    subscriptions: {
      active: num(subs.active),
      autoRenew: num(subs.auto_renew),
      expiringToday: num(subs.expiring_today),
      expiring7d: num(subs.expiring_7d),
      lapsed7d: num(subs.lapsed_7d),
      byPlan: (Array.isArray(subs.by_plan) ? subs.by_plan : []).map(function toPlan(row) {
        return { planId: num(row.plan_id), name: String(row.name || ''), total: num(row.total) }
      }),
    },
    nodes: {
      total: num(nodes.total),
      shown: num(nodes.shown),
      hidden: num(nodes.hidden),
      online: num(nodes.online),
      offline: num(nodes.offline),
      offlineList: (Array.isArray(nodes.offline_list) ? nodes.offline_list : []).map(function toNode(row) {
        return { id: num(row.id), name: String(row.name || ''), lastCheckAt: num(row.last_check_at) }
      }),
    },
    traffic: {
      today: normalizeTraffic(traffic.today),
      yesterday: normalizeTraffic(traffic.yesterday),
      month: normalizeTraffic(traffic.month),
      lastMonthSameTime: normalizeTraffic(traffic.last_month_same_time),
    },
    todo: {
      ticketsWaiting: num(todo.tickets_waiting),
      ticketsOpen: num(todo.tickets_open),
      withdrawalsPending: num(todo.withdrawals_pending),
      withdrawalsAmount: num(todo.withdrawals_amount),
      periodCommissionPending: num(todo.period_commission_pending),
      commissionUnconfirmed: num(todo.commission_unconfirmed),
      mailSuppressed: num(todo.mail_suppressed),
    },
  }
}

export function createEmptyIncomeTrend() {
  const paid = { amount: 0, paidCount: 0, zeroCount: 0, avgAmount: 0, commissionTotal: 0, commissionCount: 0 }
  return {
    loaded: false,
    range: { startDate: '', endDate: '', days: 0, previousStartDate: '', previousEndDate: '', includesToday: false },
    summary: { ...paid, payingUsers: 0 },
    previous: { ...paid },
    byType: [],
    list: [],
  }
}

function normalizeIncomeSummary(raw) {
  return {
    amount: num(raw?.amount),
    paidCount: num(raw?.paid_count),
    zeroCount: num(raw?.zero_count),
    avgAmount: num(raw?.avg_amount),
    commissionTotal: num(raw?.commission_total),
    commissionCount: num(raw?.commission_count),
    payingUsers: num(raw?.paying_users),
  }
}

export async function fetchIncomeTrend({ startDate, endDate } = {}) {
  const apiUrl = buildDashboardApiUrl('stat/getIncome', [
    ['start_date', startDate],
    ['end_date', endDate],
  ])
  const payload = await requestDashboardApi(apiUrl)
  const data = payload?.data ?? {}
  const range = data.range ?? {}
  return {
    loaded: true,
    range: {
      startDate: String(range.start_date || ''),
      endDate: String(range.end_date || ''),
      days: num(range.days),
      previousStartDate: String(range.previous_start_date || ''),
      previousEndDate: String(range.previous_end_date || ''),
      includesToday: Boolean(range.includes_today),
    },
    summary: normalizeIncomeSummary(data.summary),
    previous: normalizeIncomeSummary(data.previous),
    byType: normalizeTypeRows(data.by_type),
    list: (Array.isArray(data.list) ? data.list : []).map(function toPoint(row) {
      return {
        date: String(row.date || ''),
        paidTotal: num(row.paid_total),
        paidCount: num(row.paid_count),
        zeroCount: num(row.zero_count),
        commissionTotal: num(row.commission_total),
        commissionCount: num(row.commission_count),
        partial: Boolean(row.partial),
        future: Boolean(row.future),
      }
    }),
  }
}

/**
 * 队列负载（Horizon WorkloadRepository）：每个队列等待中的任务数、预计等待秒数、进程数。
 */
export async function fetchQueueWorkload() {
  const payload = await requestDashboardApi(buildDashboardApiUrl('system/getQueueWorkload'))
  const list = Array.isArray(payload?.data) ? payload.data : []
  return list.map(function toQueue(row) {
    return {
      name: String(row.name || ''),
      length: num(row.length),
      wait: num(row.wait),
      processes: num(row.processes),
    }
  })
}

export function createEmptySystemHealth() {
  return {
    loaded: false,
    horizon: 'unknown', // running | paused | stopped | unknown
    schedule: false,
    scheduleLastRunAt: 0,
    jobsPerMinute: 0,
    recentJobs: 0,
    recentWindowMinutes: 0,
    failedJobs: 0,
    failedWindowMinutes: 0,
    failedByJob: [],
    failedByJobScanned: 0,
    processes: 0,
    pausedMasters: 0,
    queues: [],
  }
}

/**
 * 队列与定时任务的健康度。getQueueStats 里的 periods 是 Horizon 的保留窗口（分钟），
 * 不是数量 —— 旧卡片把 periods.failedJobs（10080 分钟 = 7 天）当成「近周期失败 10080」显示了。
 */
export async function fetchSystemHealth() {
  const [statsPayload, statusPayload, queues] = await Promise.all([
    requestDashboardApi(buildDashboardApiUrl('system/getQueueStats')),
    requestDashboardApi(buildDashboardApiUrl('system/getSystemStatus')),
    fetchQueueWorkload().catch(function ignoreWorkloadError() { return [] }),
  ])
  const stats = statsPayload?.data ?? {}
  const status = statusPayload?.data ?? {}
  const pausedMasters = num(stats.pausedMasters)
  let horizon = 'stopped'
  if (stats.status) horizon = 'running'
  else if (pausedMasters > 0) horizon = 'paused'

  return {
    loaded: true,
    horizon,
    schedule: Boolean(status.schedule),
    scheduleLastRunAt: num(status.schedule_last_runtime),
    jobsPerMinute: num(stats.jobsPerMinute),
    recentJobs: num(stats.recentJobs),
    recentWindowMinutes: num(stats.periods?.recentJobs),
    failedJobs: num(stats.failedJobs),
    failedWindowMinutes: num(stats.periods?.failedJobs),
    failedByJob: (Array.isArray(stats.failedByJob) ? stats.failedByJob : []).map(function toFailed(row) {
      return { name: String(row.name || ''), total: num(row.total), lastFailedAt: num(row.last_failed_at) }
    }),
    failedByJobScanned: num(stats.failedByJobScanned),
    processes: num(stats.processes),
    pausedMasters,
    queues: queues
      .slice()
      .sort(function byBacklog(a, b) { return b.length - a.length || b.wait - a.wait || a.name.localeCompare(b.name) }),
  }
}
