/**
 * 统一的展示层格式化工具，从多个 service 抽出（之前每个 service 各自 copy）。
 * 这些函数都不应该 import 任何业务依赖。
 */

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

/**
 * 把 unix 秒级时间戳转为 'YYYY-MM-DD HH:mm' 字符串。
 * - 0 / null / undefined / NaN 返回 '--'
 * - 非数字也返回 '--'
 */
export function formatTimestamp(value) {
  const timestamp = Number(value || 0)
  if (!timestamp) return '--'
  const date = new Date(timestamp * 1000)
  if (Number.isNaN(date.getTime())) return '--'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

/**
 * 字节数 → 人类可读字符串。
 * - 0/null/undefined 返回 '0 B'
 * - 单位最多到 PB
 */
export function formatBytes(value) {
  const bytes = Number(value || 0)
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  let i = 0
  let n = bytes
  while (n >= 1024 && i < BYTE_UNITS.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)} ${BYTE_UNITS[i]}`
}

/**
 * 金额：分 → 显示字符串（默认两位小数）。
 */
export function formatCents(value) {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return '0.00'
  return (n / 100).toFixed(2)
}
