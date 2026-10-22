/**
 * 仪表盘专用的展示格式：金额（分 → ¥ 带千分位）、数量、环比、多久以前。
 * 只做展示，不碰口径。
 */
const moneyFormatter = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const moneyShortFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 })
const countFormatter = new Intl.NumberFormat('zh-CN')

/** 分 → ¥12,345.67 */
export function formatMoney(cents) {
  const n = Number(cents || 0) / 100
  return `¥${moneyFormatter.format(Number.isFinite(n) ? n : 0)}`
}

/** 分 → ¥12,346（坐标轴、紧凑场景；≥10 万用「万」） */
export function formatMoneyShort(cents) {
  const n = Number(cents || 0) / 100
  if (Math.abs(n) >= 100000) {
    return `¥${(n / 10000).toFixed(n >= 1000000 ? 0 : 1)}万`
  }
  return `¥${moneyShortFormatter.format(n)}`
}

export function formatCount(value) {
  return countFormatter.format(Number(value || 0))
}

/**
 * 环比：current 对 base 的变化。base 为 0 时没有可比性，返回 null（界面显示「—」，
 * 不再像旧版那样把「上期 0」显示成 +0.0% 或 +100%）。
 */
export function computeDelta(current, base) {
  const c = Number(current || 0)
  const b = Number(base || 0)
  if (b <= 0) {
    return null
  }
  return ((c - b) / b) * 100
}

export function formatDelta(delta) {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) {
    return '—'
  }
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±'
  const abs = Math.abs(delta)
  return `${sign}${abs >= 100 ? abs.toFixed(0) : abs.toFixed(1)}%`
}

export function deltaTone(delta, upIsGood = true) {
  if (delta === null || delta === undefined || !Number.isFinite(delta) || Math.abs(delta) < 0.05) {
    return 'flat'
  }
  const isUp = delta > 0
  return isUp === upIsGood ? 'good' : 'bad'
}

/** unix 秒 → 「3 分钟前」「2 小时前」「10-21 18:02」 */
export function formatAgo(timestamp, now = Date.now() / 1000) {
  const ts = Number(timestamp || 0)
  if (!ts) {
    return '从未上报'
  }
  const diff = Math.max(0, Math.round(now - ts))
  if (diff < 60) return `${diff} 秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`
  const date = new Date(ts * 1000)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 分钟数 → 「1 小时」「7 天」（Horizon 的 trim 窗口是分钟） */
export function formatMinutesWindow(minutes) {
  const m = Number(minutes || 0)
  if (!m) return ''
  if (m % 1440 === 0) return `${m / 1440} 天`
  if (m % 60 === 0) return `${m / 60} 小时`
  return `${m} 分钟`
}

/** 秒 → 「12 秒」「3 分钟」 */
export function formatWaitSeconds(seconds) {
  const s = Number(seconds || 0)
  if (s <= 0) return '无需等待'
  if (s < 60) return `${s} 秒`
  if (s < 3600) return `${Math.round(s / 60)} 分钟`
  return `${(s / 3600).toFixed(1)} 小时`
}
