<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Download, Plus } from '@element-plus/icons-vue'
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
  createEmptyManagedUsersPagination,
} from '../services/users'

const { t } = useI18n()

const users = ref([])
const pagination = ref(createEmptyManagedUsersPagination())
const loading = ref(false)
const errorMsg = ref('')
const searchKeyword = ref('')

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
    const filter = []
    if (searchKeyword.value.trim()) {
      filter.push({ id: 'email', value: searchKeyword.value.trim() })
    }
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
            style="width: 240px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-button :icon="Search" class="ghost-btn small" plain type="info" @click="handleSearch">
            搜索
          </el-button>
          <el-button :icon="Download" class="ghost-btn small" plain type="info" @click="handleExportCSV">
            导出 CSV
          </el-button>
          <el-button :icon="Plus" class="primary-btn small" type="success" @click="openGenerateDialog">
            生成用户
          </el-button>
        </el-space>
      </template>

      <el-alert v-if="errorMsg" :title="errorMsg" closable show-icon type="error" style="margin-bottom: 16px" @close="errorMsg = ''" />

      <el-table v-loading="loading" :data="users" stripe style="width: 100%">
        <el-table-column label="ID" prop="id" width="70" />
        <el-table-column label="邮箱" min-width="200" prop="email" />
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
        v-if="pagination.total > 0"
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
  </section>
</template>
