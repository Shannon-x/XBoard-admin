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

function numOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
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

export function createEmptySystemHealth() {
  return {
    loaded: false,
    failedJobs: 0,
    failedWindowMinutes: 0,
    failedByJob: [],
    failedByJobScanned: 0,
  }
}

/**
 * Horizon 失败任务（system/getQueueStats）：待办里的「N 个队列任务失败」和巡检面板里的「失败最多的任务」。
 * 队列、进程、调度的现状改由 system/getMonitorReport 提供（fetchMonitorReport）。
 */
export async function fetchSystemHealth() {
  const statsPayload = await requestDashboardApi(buildDashboardApiUrl('system/getQueueStats'))
  const stats = statsPayload?.data ?? {}
  return {
    loaded: true,
    failedJobs: num(stats.failedJobs),
    failedWindowMinutes: num(stats.periods?.failedJobs),
    failedByJob: (Array.isArray(stats.failedByJob) ? stats.failedByJob : []).map(function toFailed(row) {
      return { name: String(row.name || ''), total: num(row.total), lastFailedAt: num(row.last_failed_at) }
    }),
    failedByJobScanned: num(stats.failedByJobScanned),
  }
}

/**
 * 仪表盘「队列与定时任务」面板：system/getMonitorReport（后端 App\Services\Monitor\SystemMonitor）。
 * 和每分钟巡检 monitor:check 是同一份报告：面板上看到的问题，就是会（或已经）发到 Telegram 的那些。
 */
export function createEmptyMonitorReport() {
  return {
    loaded: false,
    generatedAt: 0,
    overall: 'unknown', // ok | warning | critical | unknown
    issues: [],
    horizon: { status: 'unknown', masters: 0, processes: 0, jobsPerMinute: null, supervisors: [] },
    queues: [],
    failed: { last10m: 0, last1h: 0, truncated: false },
    scheduler: { status: 'unknown', heartbeatAge: null, fallbackAt: null, tickMode: 'auto', monitorAge: null },
    schedule: [],
    mailRelay: { enabled: [], online: false },
    alerting: {
      telegram: { botConfigured: false, recipients: 0, last: null },
      heartbeatConfigured: false,
      heartbeatLast: null,
    },
  }
}

function normalizeCanary(raw) {
  if (!raw) return null
  return {
    ranAt: numOrNull(raw.ran_at),
    latencyMs: numOrNull(raw.latency_ms),
    pendingSince: numOrNull(raw.pending_since),
  }
}

export async function fetchMonitorReport() {
  const payload = await requestDashboardApi(buildDashboardApiUrl('system/getMonitorReport'))
  const d = payload?.data ?? {}
  const horizon = d.horizon ?? {}
  const scheduler = d.scheduler ?? {}
  const alerting = d.alerting ?? {}
  const telegram = alerting.telegram ?? {}
  const last = telegram.last
  const push = alerting.heartbeat_last
  return {
    loaded: true,
    generatedAt: num(d.generated_at),
    overall: ['ok', 'warning', 'critical'].includes(d.overall) ? d.overall : 'unknown',
    issues: (Array.isArray(d.issues) ? d.issues : []).map(function toIssue(row) {
      return {
        key: String(row.key || ''),
        level: String(row.level || 'info'),
        title: String(row.title || ''),
        detail: String(row.detail || ''),
        notify: Boolean(row.notify),
        since: num(row.since),
      }
    }),
    horizon: {
      status: String(horizon.status || 'unknown'),
      masters: num(horizon.masters),
      processes: num(horizon.processes),
      jobsPerMinute: numOrNull(horizon.jobs_per_minute),
      supervisors: (Array.isArray(horizon.supervisors) ? horizon.supervisors : []).map(function toSupervisor(row) {
        return { name: String(row.name || ''), status: String(row.status || ''), processes: num(row.processes) }
      }),
    },
    queues: (Array.isArray(d.queues) ? d.queues : []).map(function toQueue(row) {
      return {
        name: String(row.name || ''),
        label: String(row.label || row.name || ''),
        length: numOrNull(row.length),
        wait: numOrNull(row.wait),
        waitThreshold: num(row.wait_threshold),
        processes: num(row.processes),
        canary: normalizeCanary(row.canary),
        stallAfter: num(row.stall_after),
        perMinute: numOrNull(row.throughput?.per_minute),
        runtimeMs: numOrNull(row.throughput?.runtime_ms),
        failed1h: num(row.failed_1h),
        status: String(row.status || 'ok'),
      }
    }),
    failed: {
      last10m: num(d.failed?.last_10m),
      last1h: num(d.failed?.last_1h),
      truncated: Boolean(d.failed?.truncated),
    },
    scheduler: {
      status: String(scheduler.status || 'unknown'),
      heartbeatAge: numOrNull(scheduler.heartbeat_age),
      fallbackAt: numOrNull(scheduler.fallback_at),
      tickMode: String(scheduler.tick_mode || 'auto'),
      monitorAge: numOrNull(scheduler.monitor_age),
    },
    schedule: (Array.isArray(d.schedule) ? d.schedule : []).map(function toTask(row) {
      return {
        command: String(row.command || ''),
        args: String(row.args || ''),
        label: String(row.label || row.command || ''),
        expression: String(row.expression || ''),
        interval: numOrNull(row.interval),
        startedAt: numOrNull(row.started_at),
        finishedAt: numOrNull(row.finished_at),
        duration: numOrNull(row.duration),
        running: Boolean(row.running),
        exitCode: numOrNull(row.exit_code),
        failures: num(row.failures),
        lastSuccessAt: numOrNull(row.last_success_at),
        status: String(row.status || 'ok'),
      }
    }),
    mailRelay: {
      enabled: Array.isArray(d.mail_relay?.enabled) ? d.mail_relay.enabled.map(String) : [],
      online: Boolean(d.mail_relay?.online),
    },
    alerting: {
      telegram: {
        botConfigured: Boolean(telegram.bot_configured),
        recipients: num(telegram.recipients),
        last: last
          ? {
            at: num(last.at),
            direct: num(last.direct),
            queued: num(last.queued),
            recipients: num(last.recipients),
            error: last.error ? String(last.error) : '',
          }
          : null,
      },
      heartbeatConfigured: Boolean(alerting.heartbeat_configured),
      heartbeatLast: push
        ? { at: num(push.at), ok: Boolean(push.ok), status: String(push.status || ''), error: push.error ? String(push.error) : '' }
        : null,
    },
  }
}

/**
 * 仪表盘「邮件投递」卡片：system/getMailRelayStats（后端 App\Services\Mail\MailRelayStatus）。
 * 数字来自 Rust 投递服务每 5 秒写一次的心跳，24 小时成功 / 失败来自 v2_mail_log。
 */
export function createEmptyMailRelayStatus() {
  return {
    loaded: false,
    online: false,
    anyEnabled: false,
    heartbeatAge: null,
    version: '',
    startedAt: 0,
    connections: 0,
    inflight: 0,
    delayed: null,
    bulkFactor: 1,
    lanes: [],
    rate: { limit: null, lastMinute: 0, lastHour: 0, perMinute: [] },
    daily: { used: 0, limit: 0, bulkCap: 0, bulkPaused: false, full: false },
    sinceStart: { throttled: 0, retried: 0, deferred: 0, expired: 0, failed: 0 },
    last24h: { sent: 0, failed: 0, byCategory: {} },
  }
}


export async function fetchMailRelayStatus() {
  const payload = await requestDashboardApi(buildDashboardApiUrl('system/getMailRelayStats'))
  const d = payload?.data ?? {}
  const rate = d.rate ?? {}
  const daily = d.daily ?? {}
  const since = d.since_start ?? {}
  const log = d.last_24h ?? {}
  const byCategory = {}
  Object.entries(log.by_category ?? {}).forEach(function toCount([key, value]) {
    byCategory[key] = num(value)
  })
  return {
    loaded: true,
    online: Boolean(d.online),
    anyEnabled: Boolean(d.any_enabled),
    heartbeatAge: numOrNull(d.heartbeat_age),
    version: String(d.version || ''),
    startedAt: num(d.started_at),
    connections: num(d.connections),
    inflight: num(d.inflight),
    delayed: numOrNull(d.delayed),
    bulkFactor: d.bulk_factor === undefined ? 1 : num(d.bulk_factor),
    lanes: (Array.isArray(d.lanes) ? d.lanes : []).map(function toLane(lane) {
      return {
        name: String(lane.name || ''),
        label: String(lane.label || lane.name || ''),
        mode: String(lane.mode || 'direct'),
        pending: numOrNull(lane.pending),
        sent: num(lane.sent),
      }
    }),
    rate: {
      limit: numOrNull(rate.limit),
      lastMinute: num(rate.last_minute),
      lastHour: num(rate.last_hour),
      perMinute: (Array.isArray(rate.per_minute) ? rate.per_minute : []).map(num),
    },
    daily: {
      used: num(daily.used),
      limit: num(daily.limit),
      bulkCap: num(daily.bulk_cap),
      bulkPaused: Boolean(daily.bulk_paused),
      full: Boolean(daily.full),
    },
    sinceStart: {
      throttled: num(since.throttled),
      retried: num(since.retried),
      deferred: num(since.deferred),
      expired: num(since.expired),
      failed: num(since.failed),
    },
    last24h: { sent: num(log.sent), failed: num(log.failed), byCategory },
  }
}
