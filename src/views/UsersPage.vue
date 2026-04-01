<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, RefreshCw, Download, Plus, SlidersHorizontal, Mail, PlusCircle, X } from 'lucide-vue-next'
import SectionCard from '../components/common/SectionCard.vue'
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n()
const router = useRouter()

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

const filterFieldOptions = computed(() => [
  { id: 'email', label: '邮箱', type: 'text', operators: ['模糊', '精确'] },
  { id: 'id', label: '用户ID', type: 'number', operators: ['等于', '大于', '小于'] },
  { id: 'plan_id', label: '订阅', type: 'select', operators: ['等于'], selectOptions: plans.value.map(p => ({ label: p.name, value: String(p.id) })) },
  { id: 'transfer_enable', label: '流量', type: 'number', operators: ['大于', '小于', '等于'] },
  { id: 'd', label: '已用流量', type: 'number', operators: ['大于', '小于', '等于'] },
  { id: 'online_count', label: '在线设备', type: 'number', operators: ['大于', '小于', '等于'] },
  { id: 'expired_at', label: '到期时间', type: 'date', operators: ['早于', '晚于'] },
  { id: 'uuid', label: 'UUID', type: 'text', operators: ['精确'] },
  { id: 'token', label: 'Token', type: 'text', operators: ['精确'] },
  { id: 'banned', label: '账号状态', type: 'select', operators: ['等于'], selectOptions: [{ label: '正常', value: '0' }, { label: '已封禁', value: '1' }] },
  { id: 'remarks', label: '备注', type: 'text', operators: ['模糊'] },
  { id: 'invite_user_email', label: '邀请人邮箱', type: 'text', operators: ['模糊', '精确'] },
  { id: 'invite_user_id', label: '邀请人ID', type: 'number', operators: ['等于'] },
  { id: 'is_admin', label: '管理员', type: 'select', operators: ['等于'], selectOptions: [{ label: '是', value: '1' }, { label: '否', value: '0' }] },
  { id: 'is_staff', label: '员工', type: 'select', operators: ['等于'], selectOptions: [{ label: '是', value: '1' }, { label: '否', value: '0' }] },
])

function getFieldDef(fieldId) {
  return filterFieldOptions.value.find(f => f.id === fieldId)
}

function onFilterFieldChange(cond) {
  cond.value = ''
  const def = getFieldDef(cond.field)
  if (def?.operators?.length === 1) {
    cond.operator = def.operators[0]
  } else {
    cond.operator = ''
  }
}

function addFilterCondition() {
  filterConditions.value.push({ field: '', operator: '', value: '' })
}

function removeFilterCondition(index) {
  filterConditions.value.splice(index, 1)
}

function buildFilterArray() {
  const filter = []
  if (searchKeyword.value.trim()) {
    filter.push({ id: 'email', value: searchKeyword.value.trim() })
  }
  filterConditions.value.forEach(cond => {
    if (!cond.field || cond.value === '' || cond.value === null || cond.value === undefined) return
    const def = getFieldDef(cond.field)
    if (!def) return
    let val = cond.value
    if (cond.operator === '大于') val = `gt:${val}`
    else if (cond.operator === '小于') val = `lt:${val}`
    else if (cond.operator === '等于' || cond.operator === '精确') val = `eq:${val}`
    else if (cond.operator === '早于') val = `lt:${val}`
    else if (cond.operator === '晚于') val = `gt:${val}`
    // '模糊' uses raw value (backend does LIKE)
    filter.push({ id: cond.field, value: String(val) })
  })
  return filter
}

const editDialogVisible = ref(false)
const editForm = ref({})
const editSaving = ref(false)
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

const sortField = ref('')
const sortOrder = ref('desc')
const sortOptions = [
  { label: '默认', value: '' },
  { label: '已用流量', value: 'd' },
  { label: '到期时间', value: 'expired_at' },
  { label: '余额', value: 'balance' },
  { label: '佣金', value: 'commission_balance' },
  { label: '在线设备', value: 'online_count' },
]

async function loadUsers() {
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
    users.value = result.list
    pagination.value = result.pagination
  } catch (err) {
    errorMsg.value = err.message || '加载用户列表失败'
  } finally {
    loading.value = false
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
  editSaving.value = true
  try {
    const payload = { ...editForm.value }
    if (!payload.password) {
      delete payload.password
    }
    // Convert balance/commission from display format to numeric
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
    await ElMessageBox.confirm(`确定要重置用户 ${user.email} 的订阅密钥吗？`, '重置密钥', {
      type: 'warning',
    })
    await resetManagedUserSecret(user.id)
    ElMessage.success('密钥已重置')
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
    period: '',
    totalAmount: 0,
  }
  assignDialogVisible.value = true
}

function onAssignPlanChange() {
  assignForm.value.period = ''
  assignForm.value.totalAmount = 0
}

function onAssignPeriodChange(period) {
  const opt = periodOptions.value.find(o => o.value === period)
  if (opt) {
    assignForm.value.totalAmount = opt.price
  }
}

async function submitAssignOrder() {
  if (!assignForm.value.planId || !assignForm.value.period) {
    ElMessage.warning('请选择订阅计划和周期')
    return
  }
  assignSaving.value = true
  try {
    await assignOrder(assignForm.value)
    ElMessage.success('订单已分配')
    assignDialogVisible.value = false
  } catch (err) {
    ElMessage.error(err.message || '分配订单失败')
  } finally {
    assignSaving.value = false
  }
}

function copySubscribeUrl(user) {
  if (!user.subscribeUrl) {
    ElMessage.warning('该用户没有订阅URL')
    return
  }
  navigator.clipboard.writeText(user.subscribeUrl).then(() => {
    ElMessage.success('订阅URL已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

function copyLoginUrl(user) {
  const origin = window.location.origin
  const loginUrl = `${origin}/#/login?token=${user.token}`
  if (!user.token) {
    ElMessage.warning('该用户没有token')
    return
  }
  navigator.clipboard.writeText(loginUrl).then(() => {
    ElMessage.success('登录URL已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

function navigateToUserOrders(user) {
  router.push({ path: 'orders', query: { user_id: user.id, user_email: user.email } })
}

function navigateToUserInvites(user) {
  filterConditions.value = [{
    field: 'invite_user_id',
    operator: '等于',
    value: String(user.id)
  }]
  handleSearch()
}

function navigateToUserTickets(user) {
  router.push({ path: 'tickets', query: { user_email: user.email } })
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
  try {
    await dumpUsersCSV({ scope: 'all' })
    ElMessage.success('导出成功')
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
  if (!sendMailForm.value.subject.trim()) {
    ElMessage.warning('请输入邮件主题')
    return
  }
  if (!sendMailForm.value.content.trim()) {
    ElMessage.warning('请输入邮件内容')
    return
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

onMounted(function onMount() {
  loadUsers()
  fetchManagedPlans().then(list => { plans.value = list }).catch(() => {})
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
        <div v-for="(cond, idx) in filterConditions" :key="idx" class="user-filter-row">
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
        <el-table-column label="订阅" prop="planName" min-width="120" show-overflow-tooltip />
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
    <el-dialog v-model="editDialogVisible" title="用户管理" width="480px" destroy-on-close>
      <el-form :model="editForm" label-position="top" style="padding: 0 4px">
        <el-form-item label="邮箱">
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

        <el-form-item label="佣金类型">
          <el-select v-model="editForm.commission_type" style="width:100%">
            <el-option label="跟随系统设置" :value="0" />
            <el-option label="按周期发放" :value="1" />
            <el-option label="一次性发放" :value="2" />
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
    <el-dialog v-model="generateDialogVisible" title="生成用户" width="500px" destroy-on-close>
      <el-form :model="generateForm" label-width="120px">
        <el-form-item label="邮箱前缀">
          <el-input v-model="generateForm.emailPrefix" placeholder="指定前缀或留空批量生成" />
        </el-form-item>
        <el-form-item label="邮箱后缀">
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
    <el-dialog v-model="sendMailDialogVisible" :title="sendMailScope === 'all' ? '发送邮件给全部用户' : '发送邮件给筛选用户'" width="600px" destroy-on-close>
      <el-alert v-if="sendMailScope === 'filter' && filterConditions.length === 0" type="warning" title="未设置筛选条件，将发送给所有用户" :closable="false" show-icon style="margin-bottom: 16px" />
      <el-form :model="sendMailForm" label-position="top">
        <el-form-item label="邮件主题" required>
          <el-input v-model="sendMailForm.subject" placeholder="输入邮件主题" />
        </el-form-item>
        <el-form-item label="邮件内容" required>
          <el-input v-model="sendMailForm.content" type="textarea" :rows="8" placeholder="支持 HTML 格式" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sendMailDialogVisible = false">取消</el-button>
        <el-button :loading="sendMailSending" type="primary" @click="submitSendMail">发送</el-button>
      </template>
    </el-dialog>

    <!-- 分配订单对话框 -->
    <el-dialog v-model="assignDialogVisible" title="分配订单" width="480px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="用户邮箱">
          <el-input :model-value="assignForm.email" disabled />
        </el-form-item>
        <el-form-item label="订阅计划" required>
          <el-select v-model="assignForm.planId" placeholder="请选择订阅计划" style="width:100%" @change="onAssignPlanChange">
            <el-option v-for="plan in plans" :key="plan.id" :label="plan.name" :value="plan.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="订阅周期" required>
          <el-select v-model="assignForm.period" placeholder="请先选择订阅计划" style="width:100%" :disabled="!assignForm.planId" @change="onAssignPeriodChange">
            <el-option v-for="opt in periodOptions" :key="opt.value" :label="`${opt.label} - ¥${opt.price}`" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="支付金额" required>
          <el-input-number v-model="assignForm.totalAmount" :min="0" :precision="2" :step="1" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button :loading="assignSaving" type="primary" @click="submitAssignOrder">确认分配</el-button>
      </template>
    </el-dialog>
    <!-- 流量详情对话框 -->
    <el-dialog v-model="trafficDialogVisible" title="流量详情" width="600px" destroy-on-close>
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
