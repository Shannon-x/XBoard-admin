import {
  buildCommonApiUrl,
  buildDashboardApiUrl,
  requestDashboardApi,
  requestDashboardMutation,
} from "./api";

const DEFAULT_OVERVIEW_RANGE_DAYS = 30;
const DEFAULT_RANK_RANGE_DAYS = 1;
const TRAFFIC_RANK_PERIOD_DAYS = {
  today: 1,
  "7d": 7,
  "30d": 30,
};

function createDateRange(days) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  return {
    startDate: formatDateValue(startDate),
    endDate: formatDateValue(endDate),
  };
}

function getTrafficRankPeriodDays(rangeKey) {
  return TRAFFIC_RANK_PERIOD_DAYS[rangeKey] || DEFAULT_RANK_RANGE_DAYS;
}

function createUnixTimeRange(rangeKey) {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const bjMs = utcMs + 8 * 3600000;
  const bjNow = new Date(bjMs);

  const bjMidnight = new Date(bjNow);
  bjMidnight.setHours(0, 0, 0, 0);

  const periodDays = getTrafficRankPeriodDays(rangeKey);
  const daysBack = Math.max(periodDays - 1, 0);

  if (daysBack > 0) {
    bjMidnight.setDate(bjMidnight.getDate() - daysBack);
  }

  const startUtcMs =
    bjMidnight.getTime() - 8 * 3600000 - now.getTimezoneOffset() * 60000;

  return {
    startTime: Math.floor(startUtcMs / 1000),
    endTime: Math.floor(now.getTime() / 1000),
  };
}

function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDashboardStatsUrl() {
  const configuredUrl = import.meta.env.VITE_DASHBOARD_STATS_URL;

  if (configuredUrl) {
    return configuredUrl;
  }

  return buildDashboardApiUrl("stat/getStats");
}

function formatCurrencyFromCent(value) {
  const amount = Number(value || 0) / 100;
  return `¥${amount.toFixed(2)}`;
}

function formatCurrencyFromNumber(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function formatPercent(value) {
  const amount = Number(value || 0);
  const sign = amount > 0 ? "+" : "";

  return `${sign}${amount.toFixed(1)}%`;
}

function formatBytes(value) {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = Number(value || 0);
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function normalizeGrowthText(value, compareLabel) {
  const amount = Number(value || 0);
  const trend = amount >= 0 ? "↑" : "↘";

  return `${trend} ${formatPercent(amount)} ${compareLabel}`;
}

function normalizeRankName(name) {
  return String(name || "")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
    .trim();
}

function formatTrafficValue(value) {
  return formatBytes(value);
}

function formatChangeText(value) {
  const amount = Number(value || 0);
  const prefix = amount > 0 ? "+" : "";

  return `${prefix}${amount.toFixed(1)}%`;
}


export function createDefaultDashboardStats() {
  return {
    summary: {
      todayIncome: "¥0.00",
      todayIncomeGrowthText: "↑ +0.0% 对比昨日",
      currentMonthIncome: "¥0.00",
      monthIncomeGrowthText: "↑ +0.0% 对比上月",
      ticketPendingTotal: 0,
      commissionPendingTotal: 0,
      currentMonthNewUsers: 0,
      totalUsers: 0,
      activeUsers: 0,
      monthUpload: "0 B",
      monthDownload: "0 B",
      todayUpload: "0 B",
      todayDownload: "0 B",
      todayTotalTraffic: "0 B",
      monthTotalTraffic: "0 B",
      totalTraffic: "0 B",
      onlineUsers: 0,
      onlineDevices: 0,
      onlineNodes: 0,
    },
    metrics: [
      {
        label: "今日收入",
        value: "¥0.00",
        change: "↑ +0.0% 对比昨日",
        tone: "metric-green",
      },
      {
        label: "月收入",
        value: "¥0.00",
        change: "↑ +0.0% 对比上月",
        tone: "metric-blue",
      },
      {
        label: "待处理工单",
        value: "0",
        change: "无待处理工单",
        tone: "metric-slate",
      },
      {
        label: "待处理佣金",
        value: "0",
        change: "无佣金需要确认",
        tone: "metric-slate",
      },
      {
        label: "月新增用户",
        value: "0",
        change: "↑ +0.0% 对比上月",
        tone: "metric-blue",
      },
      {
        label: "总用户",
        value: "0",
        change: "活跃用户: 0",
        tone: "metric-slate",
      },
      {
        label: "月上传",
        value: "0 B",
        change: "今日: 0 B",
        tone: "metric-emerald",
      },
      {
        label: "月下载",
        value: "0 B",
        change: "今日: 0 B",
        tone: "metric-blue",
      },
      {
        label: "在线节点 / 用户",
        value: "0 / 0",
        change: "节点在线与用户在线概览",
        tone: "metric-emerald",
        compact: true,
      },
      {
        label: "在线设备 / 总流量",
        value: "0 / 0 B",
        change: "设备在线与累计总流量",
        tone: "metric-slate",
        compact: true,
      },
    ],
  };
}

export function createEmptyIncomeOverview() {
  return {
    range: {
      startDate: "",
      endDate: "",
    },
    summary: {
      paidTotal: "¥0.00",
      paidCount: "0",
      commissionTotal: "¥0.00",
      commissionCount: "0",
      avgPaidAmount: "¥0.00",
      avgCommissionAmount: "¥0.00",
      commissionRate: "0.00%",
    },
    chart: [],
  };
}

export function createEmptyTrafficRank() {
  return {
    type: "node",
    updatedAt: "",
    list: [],
  };
}

export function createEmptyUserInfo() {
  return {
    email: "--",
    avatarUrl: "",
    planId: "--",
    balance: "¥0.00",
    commissionBalance: "¥0.00",
    commissionRate: "0%",
    transferEnable: "0 B",
    expiredAt: "--",
    createdAt: "--",
    lastLoginAt: "--",
    telegramId: "--",
    uuid: "--",
    remindExpire: false,
    remindTraffic: false,
    isBanned: false,
    statusText: "未登录",
    statusTone: "info",
  };
}

export function createEmptyQueueStats() {
  return {
    queueStatus: {
      statusText: "离线",
      statusTone: "danger",
      jobsPerMinute: "0",
      recentJobs: "0",
      failedJobs: "0",
      failedPeriodJobs: "0",
      pausedMasters: "0",
      processes: "0",
    },
    jobDetail: {
      queueWithMaxRuntime: "--",
      queueWithMaxThroughput: "--",
      redisOnlineSyncWait: "0",
      recentPeriodJobs: "0",
    },
  };
}

export function createEmptySystemStatus() {
  return {
    runtimeStatus: {
      scheduleStatusText: "离线",
      scheduleStatusTone: "danger",
      horizonStatusText: "离线",
      horizonStatusTone: "danger",
      scheduleLastRuntime: "--",
    },
  };
}

function formatTimestamp(value) {
  const timestamp = Number(value || 0);

  if (!timestamp) {
    return "--";
  }

  const date = new Date(timestamp * 1000);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function normalizeUserInfo(payload) {
  const data = payload?.data ?? {};
  const isBanned = Boolean(data.banned);
  const statusTone = isBanned ? "danger" : "success";
  const statusText = isBanned ? "已封禁" : "正常";

  return {
    email: data.email || "--",
    avatarUrl: data.avatar_url || data.avatar || "",
    planId: data.plan_id ? `#${data.plan_id}` : "--",
    balance: formatCurrencyFromCent(data.balance),
    commissionBalance: formatCurrencyFromCent(data.commission_balance),
    commissionRate: `${Number(data.commission_rate || 0)}%`,
    transferEnable: formatBytes(data.transfer_enable),
    expiredAt: formatTimestamp(data.expired_at),
    createdAt: formatTimestamp(data.created_at),
    lastLoginAt: formatTimestamp(data.last_login_at),
    telegramId: data.telegram_id ? String(data.telegram_id) : "--",
    uuid: data.uuid || "--",
    remindExpire: Boolean(data.remind_expire),
    remindTraffic: Boolean(data.remind_traffic),
    isBanned,
    statusText,
    statusTone,
  };
}

function normalizeQueueStats(payload) {
  const data = payload?.data ?? {};
  const waitData = data.wait ?? {};
  const isQueueOnline = Boolean(data.status);

  return {
    queueStatus: {
      statusText: isQueueOnline ? "运行中" : "异常",
      statusTone: isQueueOnline ? "success" : "danger",
      jobsPerMinute: String(Number(data.jobsPerMinute || 0)),
      recentJobs: String(Number(data.recentJobs || 0)),
      failedJobs: String(Number(data.failedJobs || 0)),
      failedPeriodJobs: String(Number(data.periods?.failedJobs || 0)),
      pausedMasters: String(Number(data.pausedMasters || 0)),
      processes: String(Number(data.processes || 0)),
    },
    jobDetail: {
      queueWithMaxRuntime: data.queueWithMaxRuntime || "--",
      queueWithMaxThroughput: data.queueWithMaxThroughput || "--",
      redisOnlineSyncWait: String(Number(waitData["redis:online_sync"] || 0)),
      recentPeriodJobs: String(Number(data.periods?.recentJobs || 0)),
    },
  };
}

function normalizeSystemStatus(payload) {
  const data = payload?.data ?? {};
  const scheduleOnline = Boolean(data.schedule);
  const horizonOnline = Boolean(data.horizon);

  return {
    runtimeStatus: {
      scheduleStatusText: scheduleOnline ? "运行中" : "异常",
      scheduleStatusTone: scheduleOnline ? "success" : "danger",
      horizonStatusText: horizonOnline ? "运行中" : "异常",
      horizonStatusTone: horizonOnline ? "success" : "danger",
      scheduleLastRuntime: formatTimestamp(data.schedule_last_runtime),
    },
  };
}

export function normalizeDashboardStats(payload) {
  const data = payload?.data ?? {};
  const todayIncome = formatCurrencyFromCent(data.todayIncome);
  const currentMonthIncome = formatCurrencyFromCent(data.currentMonthIncome);
  const ticketPendingTotal = Number(data.ticketPendingTotal || 0);
  const commissionPendingTotal = Number(data.commissionPendingTotal || 0);
  const currentMonthNewUsers = Number(data.currentMonthNewUsers || 0);
  const totalUsers = Number(data.totalUsers || 0);
  const activeUsers = Number(data.activeUsers || 0);
  const onlineUsers = Number(data.onlineUsers || 0);
  const onlineDevices = Number(data.onlineDevices || 0);
  const onlineNodes = Number(data.onlineNodes || 0);
  const monthUpload = formatBytes(data.monthTraffic?.upload);
  const monthDownload = formatBytes(data.monthTraffic?.download);
  const todayUpload = formatBytes(data.todayTraffic?.upload);
  const todayDownload = formatBytes(data.todayTraffic?.download);
  const todayTotalTraffic = formatBytes(data.todayTraffic?.total);
  const monthTotalTraffic = formatBytes(data.monthTraffic?.total);
  const totalTraffic = formatBytes(data.totalTraffic?.total);

  return {
    summary: {
      todayIncome,
      todayIncomeGrowthText: normalizeGrowthText(
        data.dayIncomeGrowth,
        "对比昨日",
      ),
      currentMonthIncome,
      monthIncomeGrowthText: normalizeGrowthText(
        data.monthIncomeGrowth,
        "对比上月",
      ),
      ticketPendingTotal,
      commissionPendingTotal,
      currentMonthNewUsers,
      totalUsers,
      activeUsers,
      monthUpload,
      monthDownload,
      todayUpload,
      todayDownload,
      todayTotalTraffic,
      monthTotalTraffic,
      totalTraffic,
      onlineUsers,
      onlineDevices,
      onlineNodes,
    },
    metrics: [
      {
        label: "今日收入",
        value: todayIncome,
        change: normalizeGrowthText(data.dayIncomeGrowth, "对比昨日"),
        tone: "metric-green",
      },
      {
        label: "月收入",
        value: currentMonthIncome,
        change: normalizeGrowthText(data.monthIncomeGrowth, "对比上月"),
        tone: "metric-blue",
      },
      {
        label: "待处理工单",
        value: String(ticketPendingTotal),
        change:
          ticketPendingTotal > 0
            ? `有 ${ticketPendingTotal} 笔待处理工单`
            : "无待处理工单",
        tone: "metric-slate",
      },
      {
        label: "待处理佣金",
        value: String(commissionPendingTotal),
        change:
          commissionPendingTotal > 0 ? "有佣金需要确认" : "无佣金需要确认",
        tone: "metric-slate",
      },
      {
        label: "月新增用户",
        value: String(currentMonthNewUsers),
        change: normalizeGrowthText(data.userGrowth, "对比上月"),
        tone: "metric-blue",
      },
      {
        label: "总用户",
        value: String(totalUsers),
        change: `活跃用户: ${activeUsers}`,
        tone: "metric-slate",
      },
      {
        label: "月上传",
        value: monthUpload,
        change: `今日: ${todayUpload}`,
        tone: "metric-emerald",
      },
      {
        label: "月下载",
        value: monthDownload,
        change: `今日: ${todayDownload}`,
        tone: "metric-blue",
      },
      {
        label: "在线节点 / 用户",
        value: `${onlineNodes} / ${onlineUsers}`,
        change: `活跃用户: ${activeUsers}`,
        tone: "metric-emerald",
        compact: true,
      },
      {
        label: "在线设备 / 总流量",
        value: `${onlineDevices} / ${totalTraffic}`,
        change: `今日总流量: ${todayTotalTraffic}`,
        tone: "metric-slate",
        compact: true,
      },
    ],
  };
}

function normalizeIncomeOverview(payload) {
  const data = payload?.data ?? {};
  const list = Array.isArray(data.list) ? data.list : [];
  const summary = data.summary ?? {};

  return {
    range: {
      startDate: summary.start_date || "",
      endDate: summary.end_date || "",
    },
    summary: {
      paidTotal: formatCurrencyFromCent(summary.paid_total),
      paidCount: String(Number(summary.paid_count || 0)),
      commissionTotal: formatCurrencyFromCent(summary.commission_total),
      commissionCount: String(Number(summary.commission_count || 0)),
      avgPaidAmount: formatCurrencyFromNumber(summary.avg_paid_amount),
      avgCommissionAmount: formatCurrencyFromNumber(
        summary.avg_commission_amount,
      ),
      commissionRate: `${Number(summary.commission_rate || 0).toFixed(2)}%`,
    },
    chart: list.map(function mapOrderPoint(item) {
      return {
        date: item.date,
        shortDate: item.date ? item.date.slice(5) : "",
        paidTotal: Number(item.paid_total || 0),
        paidCount: Number(item.paid_count || 0),
        commissionTotal: Number(item.commission_total || 0),
        commissionCount: Number(item.commission_count || 0),
        avgOrderAmount: Number(item.avg_order_amount || 0),
        avgCommissionAmount: Number(item.avg_commission_amount || 0),
      };
    }),
  };
}

export async function fetchDashboardStats() {
  const apiUrl = getDashboardStatsUrl();
  const payload = await requestDashboardApi(apiUrl);

  return normalizeDashboardStats(payload);
}

export async function fetchIncomeOverview(range = {}) {
  const fallbackRange = createDateRange(DEFAULT_OVERVIEW_RANGE_DAYS);
  const apiUrl = buildDashboardApiUrl("stat/getOrder", [
    ["start_date", range.startDate || fallbackRange.startDate],
    ["end_date", range.endDate || fallbackRange.endDate],
  ]);
  const payload = await requestDashboardApi(apiUrl);

  return normalizeIncomeOverview(payload);
}

export async function fetchTrafficRank(options = {}) {
  const rangeKey = options.rangeKey || "today";
  const fallbackRange = createUnixTimeRange(rangeKey);
  const rankType = options.type || "node";

  const currentStartTime = options.startTime || fallbackRange.startTime;
  const currentEndTime = options.endTime || fallbackRange.endTime;

  const apiUrl = buildDashboardApiUrl("stat/getTrafficRank", [
    ["type", rankType],
    ["start_time", currentStartTime],
    ["end_time", currentEndTime],
  ]);

  const payload = await requestDashboardApi(apiUrl);
  const list = Array.isArray(payload?.data) ? payload.data : [];
  const hasPreviousValue = list.some(function hasPreviousValueField(item) {
    return Object.prototype.hasOwnProperty.call(item, "previousValue");
  });

  const prevMap = new Map();
  if (!hasPreviousValue) {
    const periodDays = getTrafficRankPeriodDays(rangeKey);
    const prevStartTime = currentStartTime - periodDays * 86400;
    const prevEndTime = currentStartTime;
    const prevApiUrl = buildDashboardApiUrl("stat/getTrafficRank", [
      ["type", rankType],
      ["start_time", prevStartTime],
      ["end_time", prevEndTime],
    ]);
    const prevPayload = await requestDashboardApi(prevApiUrl).catch(() => ({
      data: [],
    }));
    const prevList = Array.isArray(prevPayload?.data) ? prevPayload.data : [];

    for (const item of prevList) {
      prevMap.set(String(item.id), Number(item.value || 0));
    }
  }

  return {
    type: rankType,
    updatedAt: list[0]?.timestamp || "",
    list: list.map(function mapRankItem(item, index) {
      const idStr = String(item.id || index + 1);
      const value = Number(item.value || 0);
      const previousValue = hasPreviousValue
        ? Number(item.previousValue || 0)
        : prevMap.get(idStr) || 0;

      let change = 0;
      if (previousValue > 0) {
        change = ((value - previousValue) / previousValue) * 100;
      } else if (value > 0) {
        change = 100; // If previous was 0 and now has value, consider it 100% growth
      }

      return {
        id: idStr,
        rank: index + 1,
        name: normalizeRankName(item.name),
        value: value,
        previousValue: previousValue,
        trafficText: formatTrafficValue(value),
        previousTrafficText: formatTrafficValue(previousValue),
        change: change,
        changeText: formatChangeText(change),
        timestamp: item.timestamp || "",
      };
    }),
  };
}

export async function fetchUserInfo() {
  const apiUrl = buildCommonApiUrl("user/info");
  const payload = await requestDashboardApi(apiUrl);

  return normalizeUserInfo(payload);
}

export async function fetchQueueStats() {
  const apiUrl = buildDashboardApiUrl("system/getQueueStats");
  const payload = await requestDashboardApi(apiUrl);

  return normalizeQueueStats(payload);
}

export async function fetchSystemStatus() {
  const apiUrl = buildDashboardApiUrl("system/getSystemStatus");
  const payload = await requestDashboardApi(apiUrl);

  return normalizeSystemStatus(payload);
}
