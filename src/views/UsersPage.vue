<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toPlan } from '../utils/crossLink'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, RefreshCw, Download, Plus, SlidersHorizontal, Mail, PlusCircle, X, HelpCircle } from 'lucide-vue-next'
import SectionCard from '../components/common/SectionCard.vue'
import {
  fetchManagedUsers,
  updateManagedUser,
  generateManagedUser,
  banManagedUsers,
  resetManagedUserSecret,
  destroyManagedUser,
  dumpUsersCSV,
  sendMailToUsers,
  createEmptyManagedUsersPagination,
  fetchUserTrafficStats,
} from '../services/users'
import { fetchManagedPlans, PERIOD_LABELS } from '../services/plans'
import { assignOrder } from '../services/orders'
import { createSequence } from '../utils/sequence'
import { copyText } from '../utils/clipboard'

const router = useRouter()
const route = useRoute()

const users = ref([])
const pagination = ref(createEmptyManagedUsersPagination())
const loading = ref(false)
const errorMsg = ref('')
const searchKeyword = ref('')
const showFilters = ref(false)
const filterConditions = ref([])

const sendMailDialogVisible = ref(false)
const sendMailForm = ref({ subject: '', content: '' })
const sendMailSending = ref(false)
const sendMailScope = ref('all') // 'all' or 'filter'

const assignDialogVisible = ref(false)
const assignSaving = ref(false)
const assignForm = ref({
  email: '',
  planId: null,
  period: '',
  totalAmount: 0,
})

function formatResetCountdown(timestamp) {
  if (!timestamp) return ''
  const diffMs = timestamp * 1000 - Date.now()
  if (diffMs <= 0) return '待重置'
  const totalMinutes = Math.floor(diffMs / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  if (days >= 1) return `${days} 天后`
  const hours = Math.floor(totalMinutes / 60)
  if (hours >= 1) return `${hours} 小时后`
  return `${totalMinutes} 分钟后`
}

const trafficDialogVisible = ref(false)
const trafficLoading = ref(false)
const trafficData = ref([])
const trafficPagination = ref({ page: 1, pageSize: 10, total: 0 })
const currentTrafficUserId = ref(null)

async function loadTrafficData() {
  if (!currentTrafficUserId.value) return
  trafficLoading.value = true
  try {
    const result = await fetchUserTrafficStats(currentTrafficUserId.value, {
      page: trafficPagination.value.page,
      pageSize: trafficPagination.value.pageSize,
    })
    trafficData.value = result.list
    trafficPagination.value = result.pagination
  } catch (err) {
    ElMessage.error(err.message || '加载流量详情失败')
  } finally {
    trafficLoading.value = false
  }
}

function handleViewTraffic(row) {
  currentTrafficUserId.value = row.id
  trafficPagination.value.page = 1
  trafficDialogVisible.value = true
  loadTrafficData()
}

function handleTrafficPageChange(page) {
  trafficPagination.value.page = page
  loadTrafficData()
}

const periodOptions = computed(function getPeriodOptions() {
  if (!assignForm.value.planId) return []
  const plan = plans.value.find(p => p.id === assignForm.value.planId)
  if (!plan) return []
  const result = []
  Object.keys(PERIOD_LABELS).forEach(function mapKey(key) {
    if (plan.prices[key] !== null && plan.prices[key] !== undefined) {
      result.push({ value: key, label: PERIOD_LABELS[key], price: plan.prices[key] })
    }
  })
  return result
})

// 静态部分提到模块作用域，避免每次 reactivity tick 都重建 16 个 option 对象 +
// 给 plans 做一次 .map。只有 plan_id 这一项依赖响应式 plans，单独合并。
const FILTER_FIELD_STATIC = Object.freeze([
  { id: 'email', label: '邮箱', type: 'text', operators: ['模糊', '精确'] },
  { id: 'id', label: '用户ID', type: 'number', operators: ['等于', '大于', '小于'] },
  // plan_id 见下方
  { id: 'transfer_enable', label: '流量', type: 'number', operators: ['大于', '小于', '等于'] },
  { id: 'd', label: '已用流量', type: 'number', operators: ['大于', '小于', '等于'] },
  { id: 'online_count', label: '在线设备', type: 'number', operators: ['大于', '小于', '等于'] },
  { id: 'expired_at', label: '到期时间', type: 'date', operators: ['早于', '晚于'] },
  { id: 'next_reset_at', label: '下次重置', type: 'date', operators: ['早于', '晚于'] },
  { id: 'last_reset_at', label: '上次重置', type: 'date', operators: ['早于', '晚于'] },
  { id: 'uuid', label: 'UUID', type: 'text', operators: ['精确'] },
  { id: 'token', label: 'Token', type: 'text', operators: ['精确'] },
  { id: 'banned', label: '账号状态', type: 'select', operators: ['等于'], selectOptions: [{ label: '正常', value: '0' }, { label: '已封禁', value: '1' }] },
  { id: 'remarks', label: '备注', type: 'text', operators: ['模糊'] },
  { id: 'invite_user.email', label: '邀请人邮箱', type: 'text', operators: ['模糊', '精确'] },
  { id: 'invite_user_id', label: '邀请人ID', type: 'number', operators: ['等于'] },
  { id: 'is_admin', label: '管理员', type: 'select', operators: ['等于'], selectOptions: [{ label: '是', value: '1' }, { label: '否', value: '0' }] },
  { id: 'is_staff', label: '员工', type: 'select', operators: ['等于'], selectOptions: [{ label: '是', value: '1' }, { label: '否', value: '0' }] },
])

const filterFieldOptions = computed(() => {
  const planEntry = {
    id: 'plan_id',
    label: '订阅',
    type: 'select',
    operators: ['等于'],
    selectOptions: plans.value.map(p => ({ label: p.name, value: String(p.id) })),
  }
  // 插在 'id' 之后（保留原先位置）
  return [FILTER_FIELD_STATIC[0], FILTER_FIELD_STATIC[1], planEntry, ...FILTER_FIELD_STATIC.slice(2)]
})

function getFieldDef(fieldId) {
  return filterFieldOptions.value.find(f => f.id === fieldId)
}

function onFilterFieldChange(cond) {
  cond.value = ''
  const def = getFieldDef(cond.field)
  // 总是预选第一个运算符，而不是只在唯一运算符时预选。留空会让
  // buildFilterArray 拿不到运算符，之前会静默退化成裸值（后端按 LIKE 处理）：
  // 字段选「用户ID」、值填 5，实际匹配到 5/15/50/105，用户以为在查 ID=5。
  cond.operator = def?.operators?.[0] || ''
}

// 用 perf-now 单调时间戳 + 随机数生成稳定唯一 id —— 避免 crypto.randomUUID
// 在非 secure context 不可用。v-for :key 用稳定 id 而不是 index，
// 防止删除中间项时 v-model 串到下一行。
let nextFilterCondId = 1
function makeFilterCondId() {
  nextFilterCondId += 1
  return `fc-${nextFilterCondId}-${Math.random().toString(36).slice(2, 6)}`
}

function addFilterCondition() {
  filterConditions.value.push({ id: makeFilterCondId(), field: '', operator: '', value: '' })
}

function removeFilterCondition(index) {
  filterConditions.value.splice(index, 1)
}

// 顶部搜索框在语义上就是一条「邮箱 模糊」条件。后端把 filter 数组逐项 AND
// 到查询上，所以搜索框和一条 email 高级条件会同时命中 email 列
// （LIKE '%a%' AND = 'b'）→ 结果恒为空，而界面上两个控件都还亮着，
// 用户完全看不出是自己把条件写冲了。这里让显式条件优先、搜索框让位，
// 并用 keywordShadowed 在界面上明说搜索框已被条件覆盖。
const keywordShadowed = computed(function keywordShadowed() {
  if (!searchKeyword.value.trim()) return false
  return filterConditions.value.some(function isEmailCond(cond) {
    return cond.field === 'email'
      && cond.value !== ''
      && cond.value !== null
      && cond.value !== undefined
  })
})

// 选了字段和值、却没有运算符的条件是无效条件：不能按裸值下发（会被后端
// 当模糊匹配），也不能一声不响地丢掉。这里统计出来在界面上提示。
const incompleteConditionCount = computed(function incompleteConditionCount() {
  return filterConditions.value.filter(function isIncomplete(cond) {
    const hasValue = cond.value !== '' && cond.value !== null && cond.value !== undefined
    return cond.field && hasValue && !cond.operator
  }).length
})

// key 与 FILTER_FIELD_STATIC 里的 operators 文案一一对应，改文案必须同步改这里。
const OPERATOR_PREFIX = Object.freeze({
  '大于': 'gt:',
  '晚于': 'gt:',
  '小于': 'lt:',
  '早于': 'lt:',
  '等于': 'eq:',
  '精确': 'eq:',
  '模糊': '', // 裸值，后端做 LIKE
})

function buildFilterArray() {
  const filter = []
  if (searchKeyword.value.trim() && !keywordShadowed.value) {
    filter.push({ id: 'email', value: searchKeyword.value.trim() })
  }
  filterConditions.value.forEach(cond => {
    if (!cond.field || cond.value === '' || cond.value === null || cond.value === undefined) return
    const def = getFieldDef(cond.field)
    if (!def) return
    // 运算符缺失或不认识时跳过 —— 由 incompleteConditionCount 负责提示，
    // 绝不退化成裸值偷偷改变匹配语义。
    const prefix = OPERATOR_PREFIX[cond.operator]
    if (prefix === undefined) return
    filter.push({ id: cond.field, value: `${prefix}${cond.value}` })
  })
  return filter
}

const editDialogVisible = ref(false)
const editForm = ref({})
const editSaving = ref(false)
const editFormRef = ref(null)
const editRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不合法', trigger: 'blur' },
  ],
}
const plans = ref([])

const generateDialogVisible = ref(false)
const generateForm = ref({
  emailPrefix: '',
  emailSuffix: 'gmail.com',
  password: '',
  planId: null,
  expiredAt: null,
  generateCount: null,
})
const generateSaving = ref(false)
const generateFormRef = ref(null)
const generateRules = {
  emailSuffix: [{ required: true, message: '请填写邮箱后缀（如 gmail.com）', trigger: 'blur' }],
}

const sendMailFormRef = ref(null)
const sendMailRules = {
  subject: [{ required: true, message: '请输入邮件主题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入邮件内容', trigger: 'blur' }],
}

const assignFormRef = ref(null)
const assignRules = {
  planId: [{ required: true, message: '请选择订阅计划', trigger: 'change' }],
  period: [{ required: true, message: '请选择购买时长', trigger: 'change' }],
  totalAmount: [
    {
      validator: (_r, v, cb) => {
        const n = Number(v)
        if (!Number.isFinite(n) || n < 0) cb(new Error('金额必须为非负数字'))
        else cb()
      },
      trigger: 'blur',
    },
  ],
}

const sortField = ref('')
const sortOrder = ref('desc')
const sortOptions = [
  { label: '默认', value: '' },
  { label: '已用流量', value: 'd' },
  { label: '到期时间', value: 'expired_at' },
  { label: '下次重置', value: 'next_reset_at' },
  { label: '余额', value: 'balance' },
  { label: '佣金', value: 'commission_balance' },
  { label: '在线设备', value: 'online_count' },
]

const USERS_PAGE_STATE_KEY = 'xboard-admin:users-page-state'

function saveUsersPageState() {
  try {
    sessionStorage.setItem(USERS_PAGE_STATE_KEY, JSON.stringify({
      searchKeyword: searchKeyword.value,
      filterConditions: filterConditions.value,
      showFilters: showFilters.value,
      sortField: sortField.value,
      sortOrder: sortOrder.value,
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    }))
  } catch (_) {
    // sessionStorage 不可用时静默忽略
  }
}

function restoreUsersPageState() {
  try {
    const raw = sessionStorage.getItem(USERS_PAGE_STATE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (typeof data.searchKeyword === 'string') searchKeyword.value = data.searchKeyword
    if (Array.isArray(data.filterConditions)) {
      // 兼容旧版 sessionStorage 没 id 的项 —— 补一个稳定 id
      filterConditions.value = data.filterConditions.map(c => c.id ? c : { ...c, id: makeFilterCondId() })
    }
    if (typeof data.showFilters === 'boolean') showFilters.value = data.showFilters
    if (typeof data.sortField === 'string') sortField.value = data.sortField
    if (typeof data.sortOrder === 'string') sortOrder.value = data.sortOrder
    if (Number.isFinite(data.page)) pagination.value.page = data.page
    if (Number.isFinite(data.pageSize)) pagination.value.pageSize = data.pageSize
  } catch (_) {
    // 反序列化失败时忽略，使用默认状态
  }
}

// Sequence guard：快速切筛选/翻页时，旧响应若回得比新响应晚，
// 之前会覆盖 users / pagination / sessionStorage —— 现在丢弃所有非最新响应。
const usersSeq = createSequence()

async function loadUsers() {
  const my = usersSeq.next()
  loading.value = true
  errorMsg.value = ''
  try {
    const filter = buildFilterArray()
    const sort = []
    if (sortField.value) {
      sort.push({ id: sortField.value, desc: sortOrder.value === 'desc' })
    }
    const result = await fetchManagedUsers({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      filter,
      sort,
    })
    if (!usersSeq.isCurrent(my)) return
    users.value = result.list
    pagination.value = result.pagination
    // 兜底 clamp：若服务器返回 page > totalPages（往往是 sessionStorage 恢复
    // 到了一个被筛掉的页码），自动回到第 1 页再拉一次，避免"空白页"卡死。
    const totalPages = Math.max(Math.ceil((result.pagination.total ?? 0) / (result.pagination.pageSize ?? 1)), 1)
    if (
      result.pagination.page > totalPages
      && result.pagination.page > 1
      && result.list.length === 0
    ) {
      pagination.value.page = 1
      // 触发下一帧重新拉，避免同一帧内递归
      Promise.resolve().then(() => loadUsers())
      return
    }
    saveUsersPageState()
  } catch (err) {
    if (!usersSeq.isCurrent(my)) return
    errorMsg.value = err.message || '加载用户列表失败'
  } finally {
    if (usersSeq.isCurrent(my)) loading.value = false
  }
}

function handlePageChange(page) {
  pagination.value.page = page
  loadUsers()
}

function handlePageSizeChange(size) {
  pagination.value.pageSize = size
  pagination.value.page = 1
  loadUsers()
}

function handleSearch() {
  pagination.value.page = 1
  loadUsers()
}

function handleSortChange({ prop, order }) {
  const fieldMap = {
    totalUsedRaw: 'd',
    expiredAtRaw: 'expired_at',
    nextResetAtRaw: 'next_reset_at',
    balance: 'balance',
    commissionBalance: 'commission_balance',
    onlineCount: 'online_count',
  }
  if (prop && order && fieldMap[prop]) {
    sortField.value = fieldMap[prop]
    sortOrder.value = order === 'ascending' ? 'asc' : 'desc'
  } else {
    sortField.value = ''
    sortOrder.value = 'desc'
  }
  pagination.value.page = 1
  loadUsers()
}

function openEditDialog(user) {
  editForm.value = {
    id: user.id,
    email: user.email,
    password: '',
    balance: user.balance,
    commission_balance: user.commissionBalance,
    u: user.uploadRaw ? Number((user.uploadRaw / 1073741824).toFixed(2)) : 0,
    d: user.downloadRaw ? Number((user.downloadRaw / 1073741824).toFixed(2)) : 0,
    transfer_enable: user.transferEnableRaw ? user.transferEnableRaw / 1073741824 : 0,
    speed_limit: user.speedLimit,
    device_limit: user.deviceLimit,
    expired_at: user.expiredAtRaw,
    next_reset_at_raw: user.nextResetAtRaw,
    next_reset_at_display: user.nextResetAt,
    last_reset_at_display: user.lastResetAt,
    plan_id: user.planId,
    banned: user.banned,
    is_admin: user.isAdmin ? 1 : 0,
    is_staff: user.isStaff ? 1 : 0,
    commission_type: user.commissionType ?? 0,
    commission_rate: user.commissionRate,
    discount: user.discount,
    remarks: user.remarks,
    invite_user_email: user.inviteUserEmail !== '--' ? user.inviteUserEmail : '',
  }
  editDialogVisible.value = true
}

async function saveEditForm() {
  if (editFormRef.value) {
    try { await editFormRef.value.validate() } catch { return }
  }
  editSaving.value = true
  try {
    const payload = { ...editForm.value }
    if (!payload.password) {
      delete payload.password
    }
    // 余额/佣金：界面与后端 update 均以「元」交互（后端 UserController::update 会自行 ×100 存「分」）。
    // 前端按原值（元）发送即可，切勿在此再 ×100，否则与后端叠加成 100 倍。
    if (payload.balance !== undefined) {
      payload.balance = Number(payload.balance) || 0
    }
    if (payload.commission_balance !== undefined) {
      payload.commission_balance = Number(payload.commission_balance) || 0
    }
    // Convert GB to bytes and round to integer (backend requires integer)
    if (payload.transfer_enable !== undefined) {
      payload.transfer_enable = Math.round(Number(payload.transfer_enable) * 1073741824)
    }
    if (payload.u !== undefined) {
      payload.u = Math.round(Number(payload.u) * 1073741824)
    }
    if (payload.d !== undefined) {
      payload.d = Math.round(Number(payload.d) * 1073741824)
    }
    // Ensure integer types for boolean-like fields
    payload.banned = Number(payload.banned) || 0
    payload.is_admin = Number(payload.is_admin) || 0
    payload.is_staff = Number(payload.is_staff) || 0
    payload.commission_type = Number(payload.commission_type) || 0
    if (payload.commission_rate !== null && payload.commission_rate !== undefined) {
      payload.commission_rate = Number(payload.commission_rate)
    }
    if (payload.discount !== null && payload.discount !== undefined) {
      payload.discount = Number(payload.discount)
    }
    await updateManagedUser(payload)
    ElMessage.success('用户信息已更新')
    editDialogVisible.value = false
    loadUsers()
  } catch (err) {
    ElMessage.error(err.message || '保存失败')
  } finally {
    editSaving.value = false
  }
}

async function handleBan(user) {
  try {
    await ElMessageBox.confirm(`确定要封禁用户 ${user.email} 吗？`, '封禁用户', {
      type: 'warning',
    })
    await banManagedUsers({ scope: 'selected', user_ids: [user.id] })
    ElMessage.success('用户已封禁')
    loadUsers()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '封禁失败')
    }
  }
}

async function handleResetSecret(user) {
  try {
    await ElMessageBox.confirm(
      `确定要重置用户 ${user.email} 的订阅链接和 UUID 吗？重置后该用户旧的订阅地址和客户端 UUID 将立即失效，需要重新导入订阅。`,
      '重置订阅链接/UUID',
      { type: 'warning' },
    )
    await resetManagedUserSecret(user.id)
    ElMessage.success('订阅链接和 UUID 已重置')
    loadUsers()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '重置失败')
    }
  }
}

async function handleDelete(user) {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户 ${user.email} 吗？此操作将同时删除其所有订单、工单等关联数据且不可恢复！`,
      '删除用户',
      { type: 'error' },
    )
    await destroyManagedUser(user.id)
    ElMessage.success('用户已删除')
    loadUsers()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除失败')
    }
  }
}

function handleAssignOrder(user) {
  assignForm.value = {
    email: user.email,
    planId: null,
    period: 'month_price',
    totalAmount: 0,
  }
  assignDialogVisible.value = true
}

function onAssignPlanChange() {
  assignForm.value.period = 'month_price'
  assignForm.value.totalAmount = 0
}

function onAssignPeriodChange(period) {
  const opt = periodOptions.value.find(o => o.value === period)
  if (opt) {
    assignForm.value.totalAmount = opt.price
  }
}

async function submitAssignOrder() {
  if (assignFormRef.value) {
    try { await assignFormRef.value.validate() } catch { return }
  }
  assignSaving.value = true
  try {
    await assignOrder({
      ...assignForm.value,
      totalAmount: Math.round(Number(assignForm.value.totalAmount) * 100),
    })
    ElMessage.success('订单已分配')
    assignDialogVisible.value = false
  } catch (err) {
    ElMessage.error(err.message || '分配订单失败')
  } finally {
    assignSaving.value = false
  }
}

async function copySubscribeUrl(user) {
  if (!user?.subscribeUrl) {
    ElMessage.warning('该用户没有订阅 URL')
    return
  }
  try {
    await copyText(user.subscribeUrl)
    ElMessage.success('订阅 URL 已复制到剪贴板')
  } catch (e) {
    ElMessage.error('复制失败：' + (e?.message || ''))
  }
}

async function copyLoginUrl(user) {
  if (!user?.token) {
    ElMessage.warning('该用户没有 token')
    return
  }
  const origin = window.location.origin
  const loginUrl = `${origin}/#/login?token=${encodeURIComponent(user.token)}`
  try {
    await copyText(loginUrl)
    ElMessage.success('登录 URL 已复制到剪贴板')
  } catch (e) {
    ElMessage.error('复制失败：' + (e?.message || ''))
  }
}

function navigateToUserOrders(user) {
  // 用具名路由，自动带上 frontendSecurePath 前缀（相对 path 会在改安全路径后失效）
  router.push({ name: 'orders', query: { user_id: user.id, user_email: user.email } })
}

function navigateToUserInvites(user) {
  // Clear keyword search to avoid it being combined with the new invite filter
  searchKeyword.value = ''
  // id 必须走 makeFilterCondId()：模板 :key 退化成 index 后，删除中间行会让
  // v-model 串到下一行（见 makeFilterCondId 注释）。
  filterConditions.value = [{
    id: makeFilterCondId(),
    field: 'invite_user_id',
    operator: '等于',
    value: String(user.id)
  }]
  // Show the filter panel so the user can see the active condition
  showFilters.value = true
  handleSearch()
}

function navigateToUserTickets(user) {
  router.push({ name: 'tickets', query: { user_email: user.email } })
}

async function handleResetTraffic(user) {
  try {
    await ElMessageBox.confirm(
      `确定要重置用户 ${user.email} 的已用流量吗？上行和下行将清零。`,
      '重置流量',
      { type: 'warning' },
    )
    await updateManagedUser({ id: user.id, u: 0, d: 0 })
    ElMessage.success('流量已重置')
    loadUsers()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '重置失败')
    }
  }
}

async function handleExportCSV() {
  // 导出按钮就贴在筛选栏旁边，用户必然理解为「导出筛选结果」。之前写死
  // scope:'all' 完全无视当前筛选，导出的是全量用户。这里带上与列表完全
  // 一致的 filter；无筛选时 filter 为空数组，等价于全量导出。
  const filter = buildFilterArray()
  try {
    await dumpUsersCSV(filter.length > 0 ? { filter } : {})
    ElMessage.success(filter.length > 0 ? '已按当前筛选条件导出' : '已导出全部用户')
  } catch (err) {
    ElMessage.error(err.message || '导出失败')
  }
}

function openGenerateDialog() {
  generateForm.value = {
    emailPrefix: '',
    emailSuffix: 'gmail.com',
    password: '',
    planId: null,
    expiredAt: null,
    generateCount: null,
  }
  generateDialogVisible.value = true
}

async function submitGenerate() {
  if (generateFormRef.value) {
    try { await generateFormRef.value.validate() } catch { return }
  }
  // 至少要填一个：邮箱前缀 or 批量数量
  const hasPrefix = !!generateForm.value.emailPrefix?.trim()
  const hasCount = Number(generateForm.value.generateCount) > 0
  if (!hasPrefix && !hasCount) {
    ElMessage.warning('请填写邮箱前缀或批量数量')
    return
  }
  generateSaving.value = true
  try {
    const data = {
      email_suffix: generateForm.value.emailSuffix,
      password: generateForm.value.password || null,
      plan_id: generateForm.value.planId || null,
      expired_at: generateForm.value.expiredAt || null,
    }

    if (generateForm.value.generateCount) {
      data.generate_count = Number(generateForm.value.generateCount)
    } else {
      data.email_prefix = generateForm.value.emailPrefix
    }

    await generateManagedUser(data)
    ElMessage.success('用户生成成功')
    generateDialogVisible.value = false
    loadUsers()
  } catch (err) {
    ElMessage.error(err.message || '生成失败')
  } finally {
    generateSaving.value = false
  }
}

function openSendMailDialog(scope) {
  sendMailScope.value = scope
  sendMailForm.value = { subject: '', content: '' }
  sendMailDialogVisible.value = true
}

async function submitSendMail() {
  if (sendMailFormRef.value) {
    try { await sendMailFormRef.value.validate() } catch { return }
  }
  sendMailSending.value = true
  try {
    const payload = {
      subject: sendMailForm.value.subject,
      content: sendMailForm.value.content,
    }
    if (sendMailScope.value === 'filter') {
      payload.filter = buildFilterArray()
    }
    await sendMailToUsers(payload)
    ElMessage.success('邮件发送任务已提交')
    sendMailDialogVisible.value = false
  } catch (err) {
    ElMessage.error(err.message || '发送失败')
  } finally {
    sendMailSending.value = false
  }
}

// 消费跨页跳转的 query：从订单/工单/邀请等处点过来时自动定位用户。
// 必须在 restoreUsersPageState() 之后执行 —— 否则恢复的 sessionStorage
// 旧筛选会把这里注入的条件覆盖掉。
function applyQueryFilter() {
  const q = route.query
  // 注入一套全新筛选后必须回到第 1 页：restoreUsersPageState() 刚刚可能恢复
  // 了一个属于旧筛选的页码（如第 7 页），带着新条件请求第 7 页会拿到空列表。
  // loadUsers 里的 clamp 能兜底，但要多打一次请求且列表会闪一下空白。
  if (q.user_id || q.email || q.user_email) {
    pagination.value.page = 1
  }
  if (q.user_id) {
    // 按用户 id 精确筛选（清空关键词，避免和旧的高级筛选 AND 串味）
    searchKeyword.value = ''
    filterConditions.value = [{ id: makeFilterCondId(), field: 'id', operator: '等于', value: String(q.user_id) }]
    showFilters.value = true
    return true
  }
  const email = q.email || q.user_email
  if (email) {
    // 邮箱 LIKE：直接填进主搜索框
    searchKeyword.value = String(email)
    filterConditions.value = []
    return true
  }
  return false
}

onMounted(function onMount() {
  restoreUsersPageState()
  applyQueryFilter()
  loadUsers()
  fetchManagedPlans()
    .then(list => { plans.value = list })
    .catch(err => { console.warn('[UsersPage] 加载订阅计划失败', err) })
})
</script>

<template>
  <section class="page-stack">
    <SectionCard description="管理所有系统用户，支持搜索、编辑、封禁等操作" title="用户管理">
      <template #actions>
        <el-space wrap>
          <el-input
            v-model="searchKeyword"
            :prefix-icon="Search"
            clearable
            placeholder="搜索邮箱..."
            style="width: 200px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-button :icon="SlidersHorizontal" class="ghost-btn small" plain type="info" @click="showFilters = !showFilters">
            筛选
          </el-button>
          <el-select v-model="sortField" placeholder="排序" style="width:120px" size="default" @change="handleSearch">
            <el-option v-for="opt in sortOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <el-button v-if="sortField" size="default" plain @click="sortOrder = sortOrder === 'desc' ? 'asc' : 'desc'; handleSearch()">
            {{ sortOrder === 'desc' ? '↓ 降序' : '↑ 升序' }}
          </el-button>
          <el-button :icon="Search" class="ghost-btn small" plain type="info" @click="handleSearch">
            搜索
          </el-button>
          <el-dropdown trigger="click">
            <el-button :icon="Mail" class="ghost-btn small" plain type="info">
              发送邮件
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="openSendMailDialog('all')">发送给全部用户</el-dropdown-item>
                <el-dropdown-item @click="openSendMailDialog('filter')">发送给筛选用户</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button :icon="Download" class="ghost-btn small" plain type="info" @click="handleExportCSV">
            导出 CSV
          </el-button>
          <el-button :icon="Plus" class="primary-btn small" type="success" @click="openGenerateDialog">
            生成用户
          </el-button>
        </el-space>
      </template>

      <!-- 高级筛选条件 -->
      <div v-if="showFilters" class="user-filter-panel">
        <div class="user-filter-panel__header">
          <span>筛选条件</span>
          <el-button :icon="PlusCircle" size="small" text type="primary" @click="addFilterCondition">添加条件</el-button>
        </div>
        <!-- 冲突必须显式告知，不能让用户对着两个都亮着的控件猜哪个生效 -->
        <el-alert
          v-if="keywordShadowed"
          type="warning"
          :closable="false"
          show-icon
          title="上方搜索框已被下面的「邮箱」条件覆盖，本次筛选只使用邮箱条件"
          style="margin-bottom: 8px"
        />
        <el-alert
          v-if="incompleteConditionCount > 0"
          type="warning"
          :closable="false"
          show-icon
          :title="`有 ${incompleteConditionCount} 条条件未选择运算符，已被忽略`"
          style="margin-bottom: 8px"
        />
        <div v-for="(cond, idx) in filterConditions" :key="cond.id || idx" class="user-filter-row">
          <span class="user-filter-row__label">条件 {{ idx + 1 }}</span>
          <el-select v-model="cond.field" placeholder="选择字段" style="width: 140px" @change="onFilterFieldChange(cond)">
            <el-option v-for="f in filterFieldOptions" :key="f.id" :label="f.label" :value="f.id" />
          </el-select>
          <el-select v-model="cond.operator" placeholder="条件" style="width: 100px" :disabled="!cond.field">
            <el-option v-for="op in (getFieldDef(cond.field)?.operators || [])" :key="op" :label="op" :value="op" />
          </el-select>
          <template v-if="getFieldDef(cond.field)?.type === 'select'">
            <el-select v-model="cond.value" placeholder="选择" style="width: 140px">
              <el-option v-for="opt in (getFieldDef(cond.field)?.selectOptions || [])" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </template>
          <template v-else-if="getFieldDef(cond.field)?.type === 'date'">
            <el-date-picker v-model="cond.value" type="datetime" placeholder="选择日期" value-format="X" style="width: 200px" />
          </template>
          <template v-else>
            <el-input v-model="cond.value" placeholder="输入值" style="width: 180px" :type="getFieldDef(cond.field)?.type === 'number' ? 'number' : 'text'" />
          </template>
          <el-button :icon="X" size="small" text type="danger" @click="removeFilterCondition(idx)" />
        </div>
        <div v-if="filterConditions.length > 0" style="text-align: right; margin-top: 8px">
          <el-button size="small" type="primary" @click="handleSearch">应用筛选</el-button>
          <el-button size="small" @click="filterConditions = []; handleSearch()">清空</el-button>
        </div>
      </div>

      <el-alert v-if="errorMsg" :title="errorMsg" closable show-icon type="error" style="margin-bottom: 16px" @close="errorMsg = ''" />

      <el-table v-loading="loading" :data="users" stripe style="width: 100%" @sort-change="handleSortChange">
        <el-table-column label="ID" prop="id" width="88" />
        <el-table-column label="邮箱" prop="email" width="180" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.statusType" effect="dark" size="small">{{ row.statusText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="订阅" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="toPlan(row.planId)" class="x-link" @click="router.push(toPlan(row.planId))">{{ row.planName }}</span>
            <span v-else>{{ row.planName }}</span>
          </template>
        </el-table-column>
        <el-table-column label="已用/总量" min-width="140" prop="totalUsedRaw" sortable="custom">
          <template #default="{ row }">
            <span :style="{ color: row.totalUsedRaw > row.transferEnableRaw ? 'var(--el-color-danger)' : '', fontWeight: row.totalUsedRaw > row.transferEnableRaw ? '600' : '' }">
              {{ row.totalUsed }} / {{ row.transferEnable }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="到期时间" prop="expiredAtRaw" width="140" sortable="custom">
          <template #default="{ row }">
            <span :style="{ color: !row.expiredAtRaw || row.expiredAtRaw * 1000 < Date.now() ? 'var(--el-color-danger)' : '', fontWeight: !row.expiredAtRaw || row.expiredAtRaw * 1000 < Date.now() ? '600' : '' }">
              {{ row.expiredAt }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="下次重置" prop="nextResetAtRaw" width="160" sortable="custom">
          <template #default="{ row }">
            <template v-if="row.nextResetAtRaw">
              <div :style="{ color: row.nextResetAtRaw * 1000 < Date.now() ? 'var(--el-color-danger)' : '', fontWeight: row.nextResetAtRaw * 1000 < Date.now() ? '600' : '' }">
                {{ row.nextResetAt }}
              </div>
              <div style="font-size: 12px; color: var(--el-text-color-secondary)">
                {{ formatResetCountdown(row.nextResetAtRaw) }}
              </div>
            </template>
            <span v-else style="color: var(--el-text-color-secondary)">不重置</span>
          </template>
        </el-table-column>
        <el-table-column label="余额" width="100" prop="balance" sortable="custom">
          <template #default="{ row }">¥{{ row.balance }}</template>
        </el-table-column>
        <el-table-column label="佣金" width="100" prop="commissionBalance" sortable="custom">
          <template #default="{ row }">¥{{ row.commissionBalance }}</template>
        </el-table-column>
        <el-table-column label="在线设备" width="110" prop="onlineCount" sortable="custom">
          <template #default="{ row }">
            <span :style="{ color: row.deviceLimit && row.onlineCount > row.deviceLimit ? 'var(--el-color-danger)' : '' }">
              {{ row.onlineCount }}<span v-if="row.deviceLimit" style="color:var(--el-text-color-secondary)"> / {{ row.deviceLimit }}</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" prop="createdAt" width="140" />
        <el-table-column fixed="right" label="操作" width="120">
          <template #default="{ row }">
            <el-dropdown trigger="click">
              <el-button link size="small" type="primary">操作</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="openEditDialog(row)">编辑</el-dropdown-item>
                  <el-dropdown-item @click="handleAssignOrder(row)">分配订单</el-dropdown-item>
                  <el-dropdown-item divided @click="copySubscribeUrl(row)">复制订阅URL</el-dropdown-item>
                  <el-dropdown-item @click="copyLoginUrl(row)">生成登录/订阅URL</el-dropdown-item>
                  <el-dropdown-item divided @click="navigateToUserOrders(row)">TA的订单</el-dropdown-item>
                  <el-dropdown-item @click="navigateToUserTickets(row)">TA的工单</el-dropdown-item>
                  <el-dropdown-item @click="navigateToUserInvites(row)">TA的邀请</el-dropdown-item>
                  <el-dropdown-item divided @click="handleResetTraffic(row)">重置流量</el-dropdown-item>
                  <el-dropdown-item @click="handleViewTraffic(row)">流量详情</el-dropdown-item>
                  <el-dropdown-item @click="handleResetSecret(row)">重置订阅链接/UUID</el-dropdown-item>
                  <el-dropdown-item divided @click="handleDelete(row)" style="color:var(--el-color-danger)">删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        background
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 16px; justify-content: flex-end"
        @current-change="handlePageChange"
        @size-change="handlePageSizeChange"
      />
    </SectionCard>

    <!-- 用户管理对话框 -->
    <el-dialog v-model="editDialogVisible" title="用户管理" width="min(480px, calc(100vw - 32px))" destroy-on-close>
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        label-position="top"
        style="padding: 0 4px"
      >
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="editForm.email" />
        </el-form-item>
        <el-form-item label="邀请人邮箱">
          <el-input v-model="editForm.invite_user_email" placeholder="留空则清除邀请人" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="editForm.password" placeholder="如需修改密码请输入" show-password />
        </el-form-item>

        <div style="display:flex;gap:12px">
          <el-form-item label="余额" style="flex:1">
            <el-input v-model.number="editForm.balance" placeholder="请输入余额" type="number">
              <template #suffix>¥</template>
            </el-input>
          </el-form-item>
          <el-form-item label="佣金余额" style="flex:1">
            <el-input v-model.number="editForm.commission_balance" placeholder="请输入佣金余额" type="number">
              <template #suffix>¥</template>
            </el-input>
          </el-form-item>
        </div>

        <div style="display:flex;gap:12px">
          <el-form-item label="已用上行" style="flex:1">
            <el-input v-model.number="editForm.u" placeholder="已用上行" type="number">
              <template #suffix>GB</template>
            </el-input>
          </el-form-item>
          <el-form-item label="已用下行" style="flex:1">
            <el-input v-model.number="editForm.d" placeholder="已用下行" type="number">
              <template #suffix>GB</template>
            </el-input>
          </el-form-item>
        </div>
        <div style="margin-top: -10px; margin-bottom: 12px; text-align: right;">
          <el-button size="small" type="primary" link icon="DataLine" @click="handleViewTraffic({ id: editForm.id })">
            查看流量明细
          </el-button>
        </div>

        <el-form-item label="流量">
          <el-input v-model.number="editForm.transfer_enable" placeholder="请输入流量" type="number">
            <template #suffix>GB</template>
          </el-input>
        </el-form-item>

        <el-form-item label="到期时间">
          <el-date-picker
            v-model="editForm.expired_at"
            type="datetime"
            placeholder="请选择用户到期日期，留空为长期有效"
            value-format="X"
            style="width:100%"
            clearable
          />
        </el-form-item>

        <el-form-item label="流量重置">
          <div style="width:100%; font-size: 13px; color: var(--el-text-color-regular); line-height: 1.7">
            <div>
              <span style="color: var(--el-text-color-secondary)">下次重置：</span>
              <span v-if="editForm.next_reset_at_display && editForm.next_reset_at_display !== '--'">
                {{ editForm.next_reset_at_display }}
                <span style="color: var(--el-text-color-secondary); margin-left: 6px">
                  ({{ formatResetCountdown(editForm.next_reset_at_raw) }})
                </span>
              </span>
              <span v-else style="color: var(--el-text-color-secondary)">不重置（一次性套餐或未设置）</span>
            </div>
            <div>
              <span style="color: var(--el-text-color-secondary)">上次重置：</span>
              <span>{{ editForm.last_reset_at_display || '--' }}</span>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="订阅计划">
          <el-select v-model="editForm.plan_id" placeholder="无" clearable style="width:100%">
            <el-option :label="'无'" :value="null" />
            <el-option v-for="p in plans" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="账户状态">
          <el-select v-model="editForm.banned" style="width:100%">
            <el-option label="正常" :value="0" />
            <el-option label="封禁" :value="1" />
          </el-select>
        </el-form-item>

        <el-form-item>
          <template #label>
            <el-tooltip placement="top" effect="dark">
              <template #content>
                <div style="max-width: 260px; line-height: 1.6">
                  <b>跟随系统设置（0）</b>：由后台「仅首次支付返佣」开关决定，开启则仅首单返佣，关闭则每单返佣。<br />
                  <b>每单均返佣（1）</b>：无论首单还是续费，每次付款均产生佣金（循环佣金）。<br />
                  <b>仅首单返佣（2）</b>：该用户名下无任何有效历史订单时才触发佣金，之后续费不再返。
                </div>
              </template>
              佣金类型 <HelpCircle :size="14" style="vertical-align: middle; cursor: help; display: inline-block; margin-left: 2px" />
            </el-tooltip>
          </template>
          <el-select v-model="editForm.commission_type" style="width:100%">
            <el-option label="跟随系统设置（由全局开关决定）" :value="0" />
            <el-option label="每单均返佣（循环佣金）" :value="1" />
            <el-option label="仅首单返佣（一次性佣金）" :value="2" />
          </el-select>
        </el-form-item>

        <el-form-item label="推荐返利比例">
          <el-input v-model.number="editForm.commission_rate" placeholder="为空则跟随站点设置返利比例" type="number">
            <template #suffix>%</template>
          </el-input>
        </el-form-item>

        <el-form-item label="专享折扣比例">
          <el-input v-model.number="editForm.discount" placeholder="为空则不享受专享折扣" type="number">
            <template #suffix>%</template>
          </el-input>
        </el-form-item>

        <el-form-item label="限速">
          <el-input v-model.number="editForm.speed_limit" placeholder="留空则不限速" type="number">
            <template #suffix>Mbps</template>
          </el-input>
        </el-form-item>

        <el-form-item label="设备限制">
          <el-input v-model.number="editForm.device_limit" placeholder="留空则不限制" type="number">
            <template #suffix>台</template>
          </el-input>
        </el-form-item>

        <el-form-item label="是否管理员">
          <el-switch v-model="editForm.is_admin" :active-value="1" :inactive-value="0" />
        </el-form-item>

        <el-form-item label="是否员工">
          <el-switch v-model="editForm.is_staff" :active-value="1" :inactive-value="0" />
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="editForm.remarks" type="textarea" :rows="3" placeholder="请在这里记录" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button :loading="editSaving" type="primary" @click="saveEditForm">提交</el-button>
      </template>
    </el-dialog>

    <!-- 生成用户对话框 -->
    <el-dialog v-model="generateDialogVisible" title="生成用户" width="min(500px, calc(100vw - 32px))" destroy-on-close>
      <el-form
        ref="generateFormRef"
        :model="generateForm"
        :rules="generateRules"
        label-width="120px"
      >
        <el-form-item label="邮箱前缀">
          <el-input v-model="generateForm.emailPrefix" placeholder="指定前缀或留空批量生成" />
        </el-form-item>
        <el-form-item label="邮箱后缀" prop="emailSuffix">
          <el-input v-model="generateForm.emailSuffix" />
        </el-form-item>
        <el-form-item label="批量数量">
          <el-input-number v-model="generateForm.generateCount" :min="1" :max="500" placeholder="留空为单个生成" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="generateForm.password" placeholder="留空则使用邮箱作为密码" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateDialogVisible = false">取消</el-button>
        <el-button :loading="generateSaving" type="primary" @click="submitGenerate">生成</el-button>
      </template>
    </el-dialog>

    <!-- 发送邮件对话框 -->
    <el-dialog v-model="sendMailDialogVisible" :title="sendMailScope === 'all' ? '发送邮件给全部用户' : '发送邮件给筛选用户'" width="min(600px, calc(100vw - 32px))" destroy-on-close>
      <el-alert v-if="sendMailScope === 'filter' && filterConditions.length === 0" type="warning" title="未设置筛选条件，将发送给所有用户" :closable="false" show-icon style="margin-bottom: 16px" />
      <el-form
        ref="sendMailFormRef"
        :model="sendMailForm"
        :rules="sendMailRules"
        label-position="top"
      >
        <el-form-item label="邮件主题" prop="subject">
          <el-input v-model="sendMailForm.subject" placeholder="输入邮件主题" />
        </el-form-item>
        <el-form-item label="邮件内容" prop="content">
          <el-input v-model="sendMailForm.content" type="textarea" :rows="8" placeholder="支持 HTML 格式" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sendMailDialogVisible = false">取消</el-button>
        <el-button :loading="sendMailSending" type="primary" @click="submitSendMail">发送</el-button>
      </template>
    </el-dialog>

    <!-- 分配订单对话框 -->
    <el-dialog v-model="assignDialogVisible" title="分配订单" width="min(480px, calc(100vw - 32px))" destroy-on-close>
      <el-form
        ref="assignFormRef"
        :model="assignForm"
        :rules="assignRules"
        label-width="90px"
      >
        <el-form-item label="用户邮箱">
          <el-input :model-value="assignForm.email" disabled />
        </el-form-item>
        <el-form-item label="订阅计划" prop="planId">
          <el-select v-model="assignForm.planId" placeholder="请选择订阅计划" style="width:100%" @change="onAssignPlanChange">
            <el-option v-for="plan in plans" :key="plan.id" :label="plan.name" :value="plan.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="订阅周期" prop="period">
          <el-select v-model="assignForm.period" placeholder="请先选择订阅计划" style="width:100%" :disabled="!assignForm.planId" @change="onAssignPeriodChange">
            <el-option v-for="opt in periodOptions" :key="opt.value" :label="`${opt.label} - ¥${opt.price}`" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="支付金额" prop="totalAmount">
          <el-input-number v-model="assignForm.totalAmount" :min="0" :precision="2" :step="1" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button :loading="assignSaving" type="primary" @click="submitAssignOrder">确认分配</el-button>
      </template>
    </el-dialog>
    <!-- 流量详情对话框 -->
    <el-dialog v-model="trafficDialogVisible" title="流量详情" width="min(600px, calc(100vw - 32px))" destroy-on-close>
      <el-table v-loading="trafficLoading" :data="trafficData" stripe style="width: 100%">
        <el-table-column prop="date" label="统计日期" width="120" />
        <el-table-column prop="uText" label="上行流量" />
        <el-table-column prop="dText" label="下行流量" />
        <el-table-column prop="totalText" label="合计流量" />
        <el-table-column prop="serverRate" label="最后倍率" width="100" />
      </el-table>
      <el-pagination
        :current-page="trafficPagination.page"
        :page-size="trafficPagination.pageSize"
        :total="trafficPagination.total"
        layout="total, prev, pager, next"
        style="margin-top: 16px; justify-content: flex-end"
        @current-change="handleTrafficPageChange"
      />
    </el-dialog>
  </section>
</template>

<style scoped>
.user-filter-panel {
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}
.user-filter-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.user-filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.user-filter-row__label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  min-width: 50px;
}
</style>
