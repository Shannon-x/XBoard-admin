<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Download, Plus, Filter, Message, CirclePlus, Remove } from '@element-plus/icons-vue'
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
} from '../services/users'

const { t } = useI18n()

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

const filterFieldOptions = [
  { id: 'email', label: '邮箱', type: 'text', operators: ['模糊', '精确'] },
  { id: 'id', label: '用户ID', type: 'number', operators: ['等于', '大于', '小于'] },
  { id: 'plan_id', label: '订阅', type: 'number', operators: ['等于'] },
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
]

function getFieldDef(fieldId) {
  return filterFieldOptions.find(f => f.id === fieldId)
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

async function loadUsers() {
  loading.value = true
  errorMsg.value = ''
  try {
    const filter = buildFilterArray()
    const result = await fetchManagedUsers({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      filter,
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

function openEditDialog(user) {
  editForm.value = {
    id: user.id,
    email: user.email,
    password: '',
    balance: user.balance,
    commission_balance: user.commissionBalance,
    transfer_enable: user.transferEnableRaw ? user.transferEnableRaw / 1073741824 : 0,
    speed_limit: user.speedLimit,
    device_limit: user.deviceLimit,
    expired_at: user.expiredAtRaw,
    plan_id: user.planId,
    banned: user.banned,
    commission_rate: user.commissionRate,
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
    if (payload.transfer_enable !== undefined) {
      payload.transfer_enable = Number(payload.transfer_enable) * 1073741824
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
          <el-button :icon="Filter" class="ghost-btn small" plain type="info" @click="showFilters = !showFilters">
            筛选
          </el-button>
          <el-button :icon="Search" class="ghost-btn small" plain type="info" @click="handleSearch">
            搜索
          </el-button>
          <el-dropdown trigger="click">
            <el-button :icon="Message" class="ghost-btn small" plain type="info">
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
          <el-button :icon="CirclePlus" size="small" text type="primary" @click="addFilterCondition">添加条件</el-button>
        </div>
        <div v-for="(cond, idx) in filterConditions" :key="idx" class="user-filter-row">
          <span class="user-filter-row__label">条件 {{ idx + 1 }}</span>
          <el-select v-model="cond.field" placeholder="选择字段" style="width: 140px" @change="cond.operator = ''; cond.value = ''">
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
          <el-button :icon="Remove" size="small" text type="danger" @click="removeFilterCondition(idx)" />
        </div>
        <div v-if="filterConditions.length > 0" style="text-align: right; margin-top: 8px">
          <el-button size="small" type="primary" @click="handleSearch">应用筛选</el-button>
          <el-button size="small" @click="filterConditions = []; handleSearch()">清空</el-button>
        </div>
      </div>

      <el-alert v-if="errorMsg" :title="errorMsg" closable show-icon type="error" style="margin-bottom: 16px" @close="errorMsg = ''" />

      <el-table v-loading="loading" :data="users" stripe style="width: 100%">
        <el-table-column label="ID" prop="id" width="70" />
        <el-table-column label="邮箱" width="200" prop="email" show-overflow-tooltip />
        <el-table-column label="订阅计划" prop="planName" width="120" />
        <el-table-column label="余额" width="100">
          <template #default="{ row }">
            ¥{{ row.balance }}
          </template>
        </el-table-column>
        <el-table-column label="已用流量" prop="totalUsed" width="120" />
        <el-table-column label="总流量" prop="transferEnable" width="120" />
        <el-table-column label="到期时间" prop="expiredAt" width="160" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.statusType" effect="dark" size="small">
              {{ row.statusText }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column fixed="right" label="操作" width="200">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link size="small" type="warning" @click="handleBan(row)">封禁</el-button>
            <el-button link size="small" type="info" @click="handleResetSecret(row)">重置密钥</el-button>
            <el-button link size="small" type="danger" @click="handleDelete(row)">删除</el-button>
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

    <!-- 编辑用户对话框 -->
    <el-dialog v-model="editDialogVisible" title="编辑用户" width="600px" destroy-on-close>
      <el-form :model="editForm" label-width="120px">
        <el-form-item label="邮箱">
          <el-input v-model="editForm.email" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="editForm.password" placeholder="留空则不修改" show-password />
        </el-form-item>
        <el-form-item label="余额（元）">
          <el-input-number v-model="editForm.balance" :min="0" :precision="2" :step="1" />
        </el-form-item>
        <el-form-item label="佣金余额（元）">
          <el-input-number v-model="editForm.commission_balance" :min="0" :precision="2" :step="1" />
        </el-form-item>
        <el-form-item label="流量（GB）">
          <el-input-number v-model="editForm.transfer_enable" :min="0" :step="10" />
        </el-form-item>
        <el-form-item label="速率限制（Mbps）">
          <el-input-number v-model="editForm.speed_limit" :min="0" />
        </el-form-item>
        <el-form-item label="设备限制">
          <el-input-number v-model="editForm.device_limit" :min="0" />
        </el-form-item>
        <el-form-item label="佣金比例（%）">
          <el-input-number v-model="editForm.commission_rate" :min="0" :max="100" />
        </el-form-item>
        <el-form-item label="封禁">
          <el-switch v-model="editForm.banned" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item label="邀请人邮箱">
          <el-input v-model="editForm.invite_user_email" placeholder="留空则清除邀请人" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.remarks" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button :loading="editSaving" type="primary" @click="saveEditForm">保存</el-button>
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
