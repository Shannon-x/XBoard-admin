<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { RefreshCw, Search } from 'lucide-vue-next'
import SectionCard from '../components/common/SectionCard.vue'
import {
  MAIL_CATEGORY,
  createEmptyMailLogsPagination,
  createEmptyMailStats,
  createEmptySuppressedPagination,
  fetchMailLogs,
  fetchMailStats,
  fetchSuppressedUsers,
  unsuppressUser,
} from '../services/mail'
import { toBillingDocuments, toUser } from '../utils/crossLink'
import { createSequence } from '../utils/sequence'
import { createPageSizePreference } from '../utils/pageSizePreference'

const route = useRoute()
const router = useRouter()

const activeTab = ref('logs')
const stats = ref(createEmptyMailStats())
const statsLoading = ref(false)

// ===== 投递日志 =====
const logs = ref([])
const logsPageSizePreference = createPageSizePreference('mail-logs', 20, [20, 50, 100])
const logsPagination = ref({ ...createEmptyMailLogsPagination(), pageSize: logsPageSizePreference.initialSize })
const logsLoading = ref(false)
const logsError = ref('')
const emailSearch = ref('')
const templateSearch = ref('')
const statusFilter = ref('')     // '' / '1' 成功 / '0' 失败
const categoryFilter = ref('')
const logsSeq = createSequence()

const statusOptions = [
  { label: '全部', value: '' },
  { label: '成功', value: '1' },
  { label: '失败', value: '0' },
]

const categoryOptions = computed(function categoryOptions() {
  return [
    { label: '全部原因', value: '' },
    ...Object.entries(MAIL_CATEGORY).map(function toOption([value, info]) {
      return { label: info.text, value }
    }),
  ]
})

async function loadLogs() {
  const my = logsSeq.next()
  logsLoading.value = true
  logsError.value = ''
  try {
    const result = await fetchMailLogs({
      page: logsPagination.value.page,
      pageSize: logsPagination.value.pageSize,
      email: emailSearch.value.trim(),
      template: templateSearch.value.trim(),
      status: statusFilter.value,
      category: categoryFilter.value,
    })
    if (!logsSeq.isCurrent(my)) return
    logs.value = result.list
    logsPagination.value = result.pagination
  } catch (err) {
    if (!logsSeq.isCurrent(my)) return
    logsError.value = err?.message || '加载投递日志失败'
  } finally {
    if (logsSeq.isCurrent(my)) logsLoading.value = false
  }
}

function handleLogsSearch() {
  logsPagination.value.page = 1
  loadLogs()
}

function handleLogsPageChange(page) {
  logsPagination.value.page = page
  loadLogs()
}

function handleLogsPageSizeChange(size) {
  logsPageSizePreference.save(size)
  logsPagination.value.pageSize = size
  logsPagination.value.page = 1
  loadLogs()
}

function setStatusFilter(value) {
  statusFilter.value = value
  // 只有失败的邮件才有原因分类；切回成功 / 全部时把原因筛选一起清掉，避免出现「成功 + 退信」的空集
  if (value === '1') categoryFilter.value = ''
  handleLogsSearch()
}

function setCategoryFilter(value) {
  categoryFilter.value = value
  if (value) statusFilter.value = '0'
  handleLogsSearch()
}

// ===== 暂停投递 =====
const suppressed = ref([])
const suppressedPageSizePreference = createPageSizePreference('mail-suppressed', 20, [20, 50, 100])
const suppressedPagination = ref({ ...createEmptySuppressedPagination(), pageSize: suppressedPageSizePreference.initialSize })
const suppressedLoading = ref(false)
const suppressedError = ref('')
const unsuppressingId = ref(0)
const suppressedSeq = createSequence()

async function loadSuppressed() {
  const my = suppressedSeq.next()
  suppressedLoading.value = true
  suppressedError.value = ''
  try {
    const result = await fetchSuppressedUsers({
      page: suppressedPagination.value.page,
      pageSize: suppressedPagination.value.pageSize,
    })
    if (!suppressedSeq.isCurrent(my)) return
    suppressed.value = result.list
    suppressedPagination.value = result.pagination
  } catch (err) {
    if (!suppressedSeq.isCurrent(my)) return
    suppressedError.value = err?.message || '加载暂停投递名单失败'
  } finally {
    if (suppressedSeq.isCurrent(my)) suppressedLoading.value = false
  }
}

function handleSuppressedPageChange(page) {
  suppressedPagination.value.page = page
  loadSuppressed()
}

function handleSuppressedPageSizeChange(size) {
  suppressedPageSizePreference.save(size)
  suppressedPagination.value.pageSize = size
  suppressedPagination.value.page = 1
  loadSuppressed()
}

async function handleUnsuppress(row) {
  unsuppressingId.value = row.id
  try {
    await unsuppressUser(row.id)
    ElMessage.success(`已恢复向 ${row.email} 投递${row.pendingDocuments ? '，积压的文档会在下一轮发送' : ''}`)
    loadSuppressed()
    loadStats()
  } catch (err) {
    ElMessage.error(err?.message || '解除失败')
  } finally {
    unsuppressingId.value = 0
  }
}

// ===== 统计 =====
async function loadStats() {
  statsLoading.value = true
  try {
    stats.value = await fetchMailStats()
  } catch (err) {
    console.warn('[MailDeliveryPage] 加载投递统计失败', err)
  } finally {
    statsLoading.value = false
  }
}

const failedByCategory7d = computed(function failedByCategory7d() {
  return Object.entries(MAIL_CATEGORY)
    .map(function toRow([code, info]) {
      return { code, text: info.text, type: info.type, count: stats.value.last7d.byCategory[code] || 0 }
    })
    .filter(function hasCount(row) { return row.count > 0 })
})

function failureRate(window) {
  const total = window.sent + window.failed
  if (!total) return '--'
  return `${((window.failed / total) * 100).toFixed(1)}%`
}

function refreshAll() {
  loadStats()
  loadLogs()
  loadSuppressed()
}

function openUser(id, email) {
  const location = toUser(id, email)
  if (location) router.push(location)
}

function openPendingDocuments(row) {
  router.push(toBillingDocuments({ userId: row.id, email: row.email }))
}

onMounted(function onMount() {
  if (route.query.email) emailSearch.value = String(route.query.email)
  if (route.query.tab === 'suppressed') activeTab.value = 'suppressed'
  refreshAll()
})
</script>

<template>
  <section class="page-stack">
    <SectionCard
      title="邮件投递"
      description="所有系统邮件的投递记录与失败原因。连续退信或多次临时失败的邮箱会自动暂停投递，改走 Telegram 或留在用户面板；用户修好邮箱后可以在这里解除。"
    >
      <template #actions>
        <el-button :icon="RefreshCw" class="ghost-btn small" plain type="info" @click="refreshAll">刷新</el-button>
      </template>

      <div v-loading="statsLoading" class="mail-metrics">
        <el-card class="metric-card metric-card--unified metric-card--compact" shadow="never">
          <span class="metric-label">近 24 小时</span>
          <strong class="metric-value">{{ stats.last24h.sent }}<small class="mail-metric__unit">封送达</small></strong>
          <span class="mail-metric__foot" :class="{ 'mail-metric__foot--bad': stats.last24h.failed }">
            失败 {{ stats.last24h.failed }} · 失败率 {{ failureRate(stats.last24h) }}
          </span>
        </el-card>
        <el-card class="metric-card metric-card--unified metric-card--compact" shadow="never">
          <span class="metric-label">近 7 天</span>
          <strong class="metric-value">{{ stats.last7d.sent }}<small class="mail-metric__unit">封送达</small></strong>
          <span class="mail-metric__foot" :class="{ 'mail-metric__foot--bad': stats.last7d.failed }">
            失败 {{ stats.last7d.failed }} · 失败率 {{ failureRate(stats.last7d) }}
          </span>
        </el-card>
        <el-card
          class="metric-card metric-card--unified metric-card--compact metric-card--clickable"
          shadow="never"
          role="button"
          tabindex="0"
          @click="activeTab = 'suppressed'"
          @keyup.enter="activeTab = 'suppressed'"
        >
          <span class="metric-label">暂停投递的用户</span>
          <strong class="metric-value" :class="{ 'mail-metric__value--bad': stats.suppressedUsers }">{{ stats.suppressedUsers }}</strong>
          <span class="mail-metric__foot">点击查看名单与解除</span>
        </el-card>
        <el-card class="metric-card metric-card--unified metric-card--compact" shadow="never">
          <span class="metric-label">待投递的账单 / 收据</span>
          <strong class="metric-value" :class="{ 'mail-metric__value--warn': stats.pendingDocuments }">{{ stats.pendingDocuments }}</strong>
          <span class="mail-metric__foot">已归档但还没送到用户手里</span>
        </el-card>
      </div>

      <div v-if="failedByCategory7d.length" class="mail-category-summary">
        <span class="mail-category-summary__label">近 7 天失败原因</span>
        <el-tag
          v-for="row in failedByCategory7d"
          :key="row.code"
          :type="row.type"
          effect="plain"
          size="small"
          class="order-filter-tag"
          @click="activeTab = 'logs'; setCategoryFilter(row.code)"
        >{{ row.text }} {{ row.count }}</el-tag>
      </div>

      <el-tabs v-model="activeTab" class="mail-tabs">
        <el-tab-pane name="logs" label="投递日志">
          <div class="order-filter-bar">
            <el-space wrap :size="6">
              <el-tag
                v-for="opt in statusOptions"
                :key="opt.value"
                :effect="statusFilter === opt.value ? 'dark' : 'plain'"
                class="order-filter-tag"
                @click="setStatusFilter(opt.value)"
              >{{ opt.label }}</el-tag>
              <el-divider direction="vertical" />
              <el-tag
                v-for="opt in categoryOptions"
                :key="opt.value"
                :effect="categoryFilter === opt.value ? 'dark' : 'plain'"
                class="order-filter-tag"
                size="small"
                @click="setCategoryFilter(opt.value)"
              >{{ opt.label }}</el-tag>
              <el-divider direction="vertical" />
              <el-input
                v-model="emailSearch"
                :prefix-icon="Search"
                clearable
                placeholder="收件人邮箱"
                size="small"
                style="width: 200px"
                @keyup.enter="handleLogsSearch"
                @clear="handleLogsSearch"
              />
              <el-input
                v-model="templateSearch"
                clearable
                placeholder="模板名，如 billing.receipt"
                size="small"
                style="width: 200px"
                @keyup.enter="handleLogsSearch"
                @clear="handleLogsSearch"
              />
              <el-button size="small" type="primary" plain @click="handleLogsSearch">查询</el-button>
            </el-space>
          </div>

          <el-alert v-if="logsError" :title="logsError" closable show-icon type="error" style="margin-bottom: 16px" @close="logsError = ''" />

          <el-table v-loading="logsLoading" :data="logs" stripe style="width: 100%">
            <el-table-column label="时间" width="150" prop="createdAtText" />
            <el-table-column label="收件人" min-width="200">
              <template #default="{ row }">
                <span v-if="row.userId" class="x-link" title="在用户管理中查看该用户" @click="openUser(row.userId, row.email)">{{ row.email }}</span>
                <span v-else>{{ row.email }}</span>
              </template>
            </el-table-column>
            <el-table-column label="主题" min-width="220" prop="subject" show-overflow-tooltip />
            <el-table-column label="模板" min-width="160">
              <template #default="{ row }">
                <span class="mail-mono">{{ row.templateName }}</span>
              </template>
            </el-table-column>
            <el-table-column label="结果" width="150">
              <template #default="{ row }">
                <el-tag v-if="row.ok" size="small" type="success" effect="dark">已送达</el-tag>
                <template v-else>
                  <el-tag size="small" type="danger" effect="dark">失败</el-tag>
                  <el-tag v-if="row.category" size="small" :type="row.categoryType" effect="plain" style="margin-left: 4px">{{ row.categoryText }}</el-tag>
                </template>
              </template>
            </el-table-column>
            <el-table-column label="错误信息" min-width="260">
              <template #default="{ row }">
                <el-tooltip v-if="row.error" :content="row.error" placement="top-start" :show-after="300" popper-class="mail-error-tooltip">
                  <span class="mail-error">{{ row.error }}</span>
                </el-tooltip>
                <span v-else class="mail-muted">--</span>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="没有符合条件的投递记录" :image-size="72" />
            </template>
          </el-table>

          <el-pagination
            :current-page="logsPagination.page"
            :page-size="logsPagination.pageSize"
            :page-sizes="logsPageSizePreference.pageSizes"
            :total="logsPagination.total"
            background
            layout="total, sizes, prev, pager, next, jumper"
            style="margin-top: 16px; justify-content: flex-end"
            @current-change="handleLogsPageChange"
            @size-change="handleLogsPageSizeChange"
          />
        </el-tab-pane>

        <el-tab-pane name="suppressed">
          <template #label>
            <span>暂停投递</span>
            <el-badge v-if="suppressedPagination.total" :value="suppressedPagination.total" :max="999" class="mail-tab-badge" />
          </template>

          <el-alert
            type="info"
            :closable="false"
            show-icon
            style="margin-bottom: 16px"
            title="一次硬退信或连续三次临时失败会暂停该邮箱的投递。暂停期间收据与账单改走 Telegram（已绑定时）并留在用户面板，用户在面板里自测邮箱成功后会自动解除。"
          />

          <el-alert v-if="suppressedError" :title="suppressedError" closable show-icon type="error" style="margin-bottom: 16px" @close="suppressedError = ''" />

          <el-table v-loading="suppressedLoading" :data="suppressed" stripe style="width: 100%">
            <el-table-column label="用户" min-width="220">
              <template #default="{ row }">
                <span class="x-link" title="在用户管理中查看该用户" @click="openUser(row.id, row.email)">{{ row.email }}</span>
              </template>
            </el-table-column>
            <el-table-column label="暂停原因" min-width="200" prop="reasonText" />
            <el-table-column label="失败次数" width="100" prop="failedCount" />
            <el-table-column label="暂停时间" width="150" prop="suppressedAtText" />
            <el-table-column label="Telegram" width="110">
              <template #default="{ row }">
                <el-tag v-if="row.telegramBound" size="small" type="success" effect="plain">已绑定</el-tag>
                <span v-else class="mail-muted">未绑定</span>
              </template>
            </el-table-column>
            <el-table-column label="待投递文档" width="120">
              <template #default="{ row }">
                <span v-if="row.pendingDocuments" class="x-link" title="查看该用户积压的账单与收据" @click="openPendingDocuments(row)">{{ row.pendingDocuments }} 份</span>
                <span v-else class="mail-muted">无</span>
              </template>
            </el-table-column>
            <el-table-column fixed="right" label="操作" width="120">
              <template #default="{ row }">
                <el-popconfirm
                  :title="`恢复向 ${row.email} 投递？若邮箱仍不可达会再次暂停。`"
                  confirm-button-text="解除暂停"
                  cancel-button-text="取消"
                  width="280"
                  @confirm="handleUnsuppress(row)"
                >
                  <template #reference>
                    <el-button link size="small" type="primary" :loading="unsuppressingId === row.id">解除暂停</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="没有被暂停投递的用户" :image-size="72" />
            </template>
          </el-table>

          <el-pagination
            :current-page="suppressedPagination.page"
            :page-size="suppressedPagination.pageSize"
            :page-sizes="suppressedPageSizePreference.pageSizes"
            :total="suppressedPagination.total"
            background
            layout="total, sizes, prev, pager, next, jumper"
            style="margin-top: 16px; justify-content: flex-end"
            @current-change="handleSuppressedPageChange"
            @size-change="handleSuppressedPageSizeChange"
          />
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </section>
</template>

<style scoped>
.mail-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

@media (max-width: 1100px) {
  .mail-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .mail-metrics {
    grid-template-columns: 1fr;
  }
}

.mail-metric__unit {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  letter-spacing: 0;
}

.mail-metric__foot {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.mail-metric__foot--bad {
  color: var(--el-color-danger);
}

.mail-metric__value--bad {
  color: var(--el-color-danger);
}

.mail-metric__value--warn {
  color: var(--el-color-warning);
}

.mail-category-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 13px;
}

.mail-category-summary__label {
  color: var(--el-text-color-secondary);
  margin-right: 4px;
}

.mail-tab-badge {
  margin-left: 6px;
  vertical-align: middle;
}

.mail-tab-badge :deep(.el-badge__content) {
  position: static;
  transform: none;
}

.mail-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}

.mail-error {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--el-color-danger);
}

.mail-muted {
  color: var(--el-text-color-secondary);
}
</style>
