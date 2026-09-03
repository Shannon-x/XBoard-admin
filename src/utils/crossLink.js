/**
 * 跨实体跳转（cross-entity deep-link）的统一契约。
 *
 * 这里是「query 键名」的唯一来源 —— 每个目标页面的 onMounted 读取器必须
 * 使用与此处完全一致的键名，否则跳转过去不会自动筛选。改键名只需改这一处
 * 和对应的 5 个读取器（Users / Coupons / NodeGroups / Plans 高亮）。
 *
 * 设计取舍：
 *  - 一律使用具名路由 { name }，绝不用 { path }。整个后台都挂在
 *    `frontendSecurePath`(basePath) 前缀下，相对 path 只在「兄弟路由之间」
 *    碰巧能用，换个深度或改了安全路径就会静默失效（见 router/index.js:117）。
 *  - 每个 builder 返回一个「路由位置对象」或 null。null 表示「无可跳转目标」，
 *    模板应渲染为纯文本而不是链接 —— 由 isLinkable() 统一兜底 '--' / 空值。
 *  - 不在此处捕获 router 实例：调用方自己持有 router，详情弹窗里的链接可选择
 *    新标签页打开（router.resolve(loc).href + window.open），列表单元格走
 *    同标签 router.push(loc)。把这个分支留给调用方，意图更清晰。
 */

/** 值是否值得做成可点击链接（排除 null/undefined/空串/占位符 '--'）。 */
export function isLinkable(v) {
  return v != null && v !== '' && v !== '--'
}

/**
 * 跳转到「用户管理」并定位某用户。
 * 有数字 id 时按 id 精确筛选（并把 email 作为展示伴随项）；
 * 只有 email 时退化为邮箱 LIKE 搜索。
 */
export function toUser(id, email) {
  if (isLinkable(id)) {
    const query = { user_id: String(id) }
    if (isLinkable(email)) query.user_email = String(email)
    return { name: 'users', query }
  }
  if (isLinkable(email)) {
    return { name: 'users', query: { email: String(email) } }
  }
  return null
}

/** 跳转到「订单管理」并按某用户筛选（订单页按 user_id 精确筛选）。 */
export function toOrdersByUser(id, email) {
  if (!isLinkable(id)) return null
  const query = { user_id: String(id) }
  if (isLinkable(email)) query.user_email = String(email)
  return { name: 'orders', query }
}

/** 跳转到「工单管理」并按用户邮箱筛选。 */
export function toTicketsByUser(email) {
  return isLinkable(email) ? { name: 'tickets', query: { user_email: String(email) } } : null
}

/** 跳转到「套餐管理」并高亮某套餐行（套餐页无搜索框，落地后高亮+滚动）。 */
export function toPlan(id) {
  return isLinkable(id) ? { name: 'plans', query: { plan_id: String(id) } } : null
}

/**
 * 跳转到「优惠券管理」并筛选。优先用名称；只有券码时传 coupon_code，
 * 目标页会把搜索字段一并切到 code —— 两者是不同的 filter 列，
 * 传哪个 query 键就必须搜对应的列，否则必然 0 条。
 */
export function toCoupon(name, code) {
  if (isLinkable(name)) return { name: 'coupons', query: { coupon_name: String(name) } }
  if (isLinkable(code)) return { name: 'coupons', query: { coupon_code: String(code) } }
  return null
}

/** 跳转到「权限组」并按组 id 定位（组页搜索框同时匹配名称/ID 子串）。 */
export function toNodeGroup(id) {
  return isLinkable(id) ? { name: 'nodeGroups', query: { group_id: String(id) } } : null
}
