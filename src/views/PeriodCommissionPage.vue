<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { RefreshCw, Search } from 'lucide-vue-next'
import SectionCard from '../components/common/SectionCard.vue'
import {
  approvePeriodApplication,
  createEmptyPeriodApplicationsPagination,
  fetchPeriodApplicationStats,
  fetchPeriodApplications,
  rejectPeriodApplication,
} from '../services/periodCommission'
import { createSequence } from '../utils/sequence'
import { createPageSizePreference } from '../utils/pageSizePreference'

const router = useRouter()

const list = ref([])
const pageSizePreference = createPageSizePreference('periodCommission', 15, [15, 30, 50, 100])
const pagination = ref({ ...createEmptyPeriodApplicationsPagination(), pageSize: pageSizePreference.initialSize })
const loading = ref(false)
const errorMsg = ref('')
const statusFilter = ref('0')
const emailSearch = ref('')
const stats = ref({ pendingCount: 0, approvedCount: 0 })
// 开关与门槛（系统设置 → 邀请佣金）；列表与统计接口都会带回来
const settings = ref(null)
const actingId = ref(0)

const statusOptions = [
  { label: '待审核', value: '0' },
  { label: '已开通', value: '1' },
  { label: '已驳回', value: '2' },
  { label: '已取消', value: '3' },
  { label: '全部', value: '' },
]

const listSeq = createSequence()

async function loadList() {
  const my = listSeq.next()
  loading.value = true
  errorMsg.value = ''
  try {
    const result = await fetchPeriodApplications({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      status: statusFilter.value,
      email: emailSearch.value.trim(),
    })
    if (!listSeq.isCurrent(my)) return
    list.value = result.list
    pagination.value = result.pagination
    settings.value = result.settings
  } catch (err) {
    if (!listSeq.isCurrent(my)) return
    errorMsg.value = err?.message || '加载周期返佣申请失败'
  } finally {
    if (listSeq.isCurrent(my)) loading.value = false
  }
}

async function loadStats() {
  try {
    const result = await fetchPeriodApplicationStats()
    stats.value = result
    settings.value = result.settings
  } catch (err) {
    console.warn('[PeriodCommissionPage] 加载统计失败', err)
  }
}

function refreshAll() {
  loadList()
  loadStats()
}

function handleSearch() {
  pagination.value.page = 1
  loadList()
}

function handlePageChange(page) {
  pagination.value.page = page
  loadList()
}

function handlePageSizeChange(size) {
  pageSizePreference.save(size)
  pagination.value.pageSize = size
  pagination.value.page = 1
  loadList()
}

function openUser(row) {
  if (!row?.userId) return
  const href = router.resolve({ name: 'users', query: { user_id: row.userId, user_email: row.userEmail } }).href
  window.open(href, '_blank', 'noopener,noreferrer')
}

// 只对待审核 / 已开通的标红：这两种才需要关心「现在还够不够」
function belowThreshold(row) {
  if (row.status !== 0 && row.status !== 1) return false
  const min = settings.value?.minInvitees || row.minInvitees
  return min > 0 && row.currentActiveCount < min
}

async function handleApprove(row) {
  if (!row) return
  const min = settings.value?.minInvitees || row.minInvitees
  try {
    await ElMessageBox.confirm(
      `通过后 ${row.userEmail} 立即按周期返佣（好友每次付费、含续费都返），并邮件通知用户。`
        + `当前有效付费被邀请人 ${row.currentActiveCount} 位，门槛 ${min} 位；之后低于门槛会自动取消资格。`,
      `通过周期返佣申请 #${row.id}`,
      { confirmButtonText: '确认通过', cancelButtonText: '取消', type: 'success' },
    )
  } catch {
    return
  }
  actingId.value = row.id
  try {
    await approvePeriodApplication(row.id)
    ElMessage.success(`已通过 ${row.userEmail} 的周期返佣申请，已邮件通知用户`)
    refreshAll()
  } catch (err) {
    ElMessage.error(err?.message || '通过失败')
  } finally {
    actingId.value = 0
  }
}

async function handleReject(row) {
  if (!row) return
  let reason = ''
  try {
    const { value } = await ElMessageBox.prompt(
      '驳回原因会显示在用户的邀请页上，并写进通知邮件。用户之后仍可重新申请。',
      `驳回周期返佣申请 #${row.id}`,
      {
        confirmButtonText: '确认驳回',
        cancelButtonText: '取消',
        inputPlaceholder: '请填写驳回原因（用户可见）',
        inputValidator: function validate(v) { return String(v || '').trim() ? true : '请填写驳回原因' },
        type: 'warning',
      },
    )
    reason = value
  } catch {
    return
  }
  actingId.value = row.id
  try {
    await rejectPeriodApplication(row.id, reason)
    ElMessage.success(`已驳回 ${row.userEmail} 的周期返佣申请，已邮件通知用户`)
    refreshAll()
  } catch (err) {
    ElMessage.error(err?.message || '驳回失败')
  } finally {
    actingId.value = 0
  }
}

onMounted(function onMount() {
  refreshAll()
})
</script>

<template>
  <section class="page-stack">
    <SectionCard
      title="周期返佣申请"
      description="有效付费被邀请人达到门槛的推广者可以在邀请页申请周期返佣（好友每次付费、含续费都返）。这里通过或驳回；已开通的人低于门槛会被自动取消资格。通过、驳回、取消都会邮件通知用户，通知里不带任何编号。"
    >
      <template #actions>
        <el-space wrap>
          <el-tag v-if="stats.pendingCount" type="warning" effect="dark">待审核 {{ stats.pendingCount }} 条</el-tag>
          <el-tag v-if="stats.approvedCount" type="success" effect="plain">已开通 {{ stats.approvedCount }} 人</el-tag>
          <el-input
            v-model="emailSearch"
            :prefix-icon="Search"
            clearable
            placeholder="搜索用户邮箱"
            style="width: 220px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-button :icon="RefreshCw" class="ghost-btn small" plain type="info" @click="refreshAll">刷新</el-button>
        </el-space>
      </template>

      <el-alert
        v-if="settings && !settings.enable"
        type="info"
        :closable="false"
        show-icon
        title="申请未开放：「系统设置 → 邀请佣金 → 开放周期返佣申请」关着。关着时用户看不到申请入口，已开通的也暂停按周期返佣。"
        style="margin-bottom: 16px"
      />
      <el-alert
        v-else-if="settings"
        type="success"
        :closable="false"
        show-icon
        :title="`申请已开放：有效付费被邀请人达到 ${settings.minInvitees} 位可以申请；已开通的低于 ${settings.minInvitees} 位自动取消资格（下单时、打开邀请页时、每天 04:10 巡检）。`"
        style="margin-bottom: 16px"
      />

      <div class="order-filter-bar">
        <el-space wrap :size="6">
          <el-tag
            v-for="opt in statusOptions"
            :key="opt.value"
            :effect="statusFilter === opt.value ? 'dark' : 'plain'"
            class="order-filter-tag"
            @click="statusFilter = opt.value; handleSearch()"
          >{{ opt.label }}</el-tag>
        </el-space>
      </div>

      <el-alert v-if="errorMsg" :title="errorMsg" closable show-icon type="error" style="margin-bottom: 16px" @close="errorMsg = ''" />

      <el-table v-loading="loading" :data="list" stripe style="width: 100%">
        <el-table-column label="#" prop="id" width="70" />
        <el-table-column label="用户" min-width="230">
          <template #default="{ row }">
            <span class="x-link" @click="openUser(row)">{{ row.userEmail }}</span>
            <div v-if="row.userCommissionType !== 0" class="muted small">已在用户编辑里单设返佣方式，以单设为准</div>
          </template>
        </el-table-column>
        <el-table-column label="有效付费被邀请人" min-width="170">
          <template #default="{ row }">
            <div>
              当前 <strong :class="{ 'is-below': belowThreshold(row) }">{{ row.currentActiveCount }}</strong>
              <span class="muted"> / 门槛 {{ settings?.minInvitees || row.minInvitees }}</span>
            </div>
            <div class="muted small">申请时 {{ row.activeCount }}（门槛 {{ row.minInvitees }}）</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.statusType" size="small" effect="dark">{{ row.statusText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" width="150" prop="createdAt" />
        <el-table-column label="处理" min-width="220">
          <template #default="{ row }">
            <template v-if="row.status === 1 || row.status === 2">
              <div>{{ row.decidedAt }}<span v-if="row.adminEmail" class="muted"> · {{ row.adminEmail }}</span></div>
              <div v-if="row.status === 2 && row.reason" class="small">原因：{{ row.reason }}</div>
            </template>
            <template v-else-if="row.status === 3">
              <div>{{ row.revokedAt }} 自动取消</div>
              <div class="muted small">取消时有效付费被邀请人 {{ row.revokedCount ?? '--' }} 位，低于门槛</div>
            </template>
            <span v-else class="muted">--</span>
          </template>
        </el-table-column>
        <el-table-column fixed="right" label="操作" width="140">
          <template #default="{ row }">
            <div v-if="row.status === 0" style="display: flex; align-items: center; gap: 4px;">
              <el-button link size="small" type="success" :loading="actingId === row.id" @click="handleApprove(row)">通过</el-button>
              <el-button link size="small" type="danger" :disabled="actingId === row.id" @click="handleReject(row)">驳回</el-button>
            </div>
            <span v-else class="muted">--</span>
          </template>
        </el-table-column>
        <template #empty>
          <span class="muted">{{ statusFilter === '0' ? '没有待审核的申请' : '暂无记录' }}</span>
        </template>
      </el-table>

      <el-pagination
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :page-sizes="pageSizePreference.pageSizes"
        :total="pagination.total"
        background
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 16px; justify-content: flex-end"
        @current-change="handlePageChange"
        @size-change="handlePageSizeChange"
      />
    </SectionCard>
  </section>
</template>

<style scoped>
.muted {
  color: var(--el-text-color-secondary);
}

.small {
  font-size: 12px;
  line-height: 1.5;
}

.is-below {
  color: var(--el-color-danger);
}
</style>
