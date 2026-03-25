<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Refresh, View } from '@element-plus/icons-vue'
import SectionCard from '../components/common/SectionCard.vue'
import { buildDashboardApiUrl, requestDashboardApi, getDashboardApiHeaders } from '../services/api'

const route = useRoute()

// --- Tab ---
const activeTab = ref('audit')

// --- Audit Log State ---
const auditLogs = ref([])
const auditLoading = ref(false)
const auditError = ref('')
const activeAction = ref('all')
const searchKeyword = ref('')
const auditPage = ref(1)
const auditPageSize = ref(20)
const auditTotal = ref(0)

const actionOptions = [
  { label: '全部', value: 'all' },
  { label: '登录', value: 'login' },
  { label: '更新', value: 'update' },
  { label: '创建', value: 'create' },
  { label: '删除', value: 'delete' },
]

// --- Failed Jobs State ---
const failedJobs = ref([])
const failedLoading = ref(false)
const failedError = ref('')
const failedPage = ref(1)
const failedPageSize = ref(10)
const failedTotal = ref(0)
const failedDetailVisible = ref(false)
const failedDetailJob = ref(null)

// ===================== Audit Log =====================

async function loadAuditLogs() {
  auditLoading.value = true
  auditError.value = ''
  try {
    const queryEntries = [
      ['current', auditPage.value],
      ['page_size', auditPageSize.value],
    ]
    if (activeAction.value !== 'all') {
      queryEntries.push(['action', activeAction.value])
    }
    if (searchKeyword.value.trim()) {
      queryEntries.push(['keyword', searchKeyword.value.trim()])
    }
    const apiUrl = buildDashboardApiUrl('system/getAuditLog', queryEntries)
    const payload = await requestDashboardApi(apiUrl)
    const raw = payload?.data
    if (Array.isArray(raw)) {
      auditLogs.value = raw.map(normalizeAuditLog)
      auditTotal.value = Number(payload?.total || raw.length)
    } else {
      auditLogs.value = []
      auditTotal.value = 0
    }
  } catch (err) {
    auditError.value = err.message
  } finally {
    auditLoading.value = false
  }
}

function normalizeAuditLog(item) {
  const action = String(item.action || '--')
  const uri = item.uri || ''
  const adminEmail = item.admin?.email || '--'
  const adminId = item.admin_id || item.admin?.id || '--'
  const createdAt = item.created_at || 0
  let requestData = null
  if (item.request_data) {
    if (typeof item.request_data === 'string') {
      try { requestData = JSON.parse(item.request_data) } catch { requestData = item.request_data }
    } else {
      requestData = item.request_data
    }
  }
  return { id: item.id, action, uri, adminEmail, adminId, requestData, createdAt }
}

// ===================== Failed Jobs =====================

async function loadFailedJobs() {
  failedLoading.value = true
  failedError.value = ''
  try {
    const queryEntries = [
      ['current', failedPage.value],
      ['page_size', failedPageSize.value],
    ]
    const apiUrl = buildDashboardApiUrl('system/getHorizonFailedJobs', queryEntries)
    const res = await fetch(apiUrl, {
      headers: getDashboardApiHeaders(),
    })
    if (!res.ok) {
      throw new Error(`请求失败: ${res.status}`)
    }
    const payload = await res.json()
    const raw = payload?.data
    if (Array.isArray(raw)) {
      failedJobs.value = raw
      failedTotal.value = Number(payload?.total || raw.length)
    } else {
      failedJobs.value = []
      failedTotal.value = 0
    }
  } catch (err) {
    failedError.value = err.message
  } finally {
    failedLoading.value = false
  }
}

function getJobDisplayName(job) {
  if (job.name) return job.name
  if (job.payload) {
    try {
      const p = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload
      return p.displayName || p.job || '--'
    } catch { /* ignore */ }
  }
  return '--'
}

function getExceptionSummary(job) {
  const ex = job.exception || ''
  if (!ex) return '--'
  const firstLine = ex.split('\n')[0] || ''
  return firstLine.length > 80 ? firstLine.substring(0, 80) + '...' : firstLine
}

function showJobDetail(job) {
  failedDetailJob.value = job
  failedDetailVisible.value = true
}

// ===================== Helpers =====================

function formatTime(ts) {
  if (!ts) return '--'
  if (typeof ts === 'string' && ts.includes('/')) return ts
  if (typeof ts === 'string' && ts.includes('-')) return ts
  const d = new Date(typeof ts === 'number' ? ts * 1000 : ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  return d.toLocaleString('zh-CN')
}

function actionTagType(action) {
  const map = { login: 'success', create: '', update: 'warning', delete: 'danger' }
  return map[action] || 'info'
}

function handleRefresh() {
  if (activeTab.value === 'audit') loadAuditLogs()
  else loadFailedJobs()
}

watch(activeAction, () => { auditPage.value = 1; loadAuditLogs() })

watch(activeTab, (tab) => {
  if (tab === 'failed' && failedJobs.value.length === 0 && !failedLoading.value) {
    loadFailedJobs()
  }
})

onMounted(() => {
  const tab = route.query.tab
  if (tab === 'failed') activeTab.value = 'failed'
  loadAuditLogs()
  // Pre-load failed jobs to get count for badge
  loadFailedJobs()
})
</script>

<template>
  <section class="page-stack">
    <SectionCard title="系统日志" description="审计日志记录管理员操作，失败任务记录队列异常，可用于排查系统问题。">
      <template #actions>
        <el-button :icon="Refresh" type="info" plain size="small" @click="handleRefresh">刷新</el-button>
      </template>

      <el-tabs v-model="activeTab" class="log-tabs">
        <!-- ========== 审计日志 Tab ========== -->
        <el-tab-pane label="审计日志" name="audit">
          <el-alert v-if="auditError" type="error" :closable="false" :title="auditError" style="margin-bottom:12px;" />

          <div class="log-filter-bar">
            <el-radio-group v-model="activeAction" size="small">
              <el-radio-button v-for="opt in actionOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </el-radio-button>
            </el-radio-group>
            <el-input
              v-model="searchKeyword" clearable placeholder="搜索 URI / 请求数据"
              size="small" style="max-width: 240px;"
              @keyup.enter="loadAuditLogs" @clear="loadAuditLogs"
            />
          </div>

          <el-table :data="auditLogs" v-loading="auditLoading" class="dashboard-table" max-height="580">
            <el-table-column label="ID" prop="id" width="70" sortable />
            <el-table-column label="操作" width="90">
              <template #default="{ row }">
                <el-tag size="small" :type="actionTagType(row.action)">{{ row.action }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="管理员" width="160">
              <template #default="{ row }">
                <span style="font-size:12px;">{{ row.adminEmail }}</span>
              </template>
            </el-table-column>
            <el-table-column label="时间" width="170">
              <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="URI" min-width="280">
              <template #default="{ row }">
                <span style="font-size:12px;word-break:break-all;">{{ row.uri || '--' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="详情" width="80">
              <template #default="{ row }">
                <el-popover placement="left" :width="480" trigger="click">
                  <template #reference>
                    <el-button link size="small" type="primary">详情</el-button>
                  </template>
                  <div style="max-height:400px;overflow:auto;">
                    <h4 style="margin:0 0 8px;">操作信息</h4>
                    <table style="font-size:12px;width:100%;border-collapse:collapse;">
                      <tr><td class="detail-label">操作</td><td class="detail-value">{{ row.action }}</td></tr>
                      <tr><td class="detail-label">URI</td><td class="detail-value" style="word-break:break-all;">{{ row.uri }}</td></tr>
                      <tr><td class="detail-label">管理员</td><td class="detail-value">{{ row.adminEmail }} (ID: {{ row.adminId }})</td></tr>
                    </table>
                    <template v-if="row.requestData">
                      <h4 style="margin:12px 0 8px;">请求数据</h4>
                      <pre class="log-stack-trace">{{ typeof row.requestData === 'string' ? row.requestData : JSON.stringify(row.requestData, null, 2) }}</pre>
                    </template>
                  </div>
                </el-popover>
              </template>
            </el-table-column>
          </el-table>

          <div class="log-pagination">
            <el-pagination
              v-model:current-page="auditPage" v-model:page-size="auditPageSize"
              :page-sizes="[10, 20, 50, 100]" :total="auditTotal"
              layout="total, sizes, prev, pager, next, jumper"
              @current-change="loadAuditLogs" @size-change="() => { auditPage = 1; loadAuditLogs() }"
            />
          </div>
        </el-tab-pane>

        <!-- ========== 失败任务 Tab ========== -->
        <el-tab-pane name="failed">
          <template #label>
            失败任务
            <el-badge v-if="failedTotal > 0" :value="failedTotal" :max="99" style="margin-left:6px;" />
          </template>

          <el-alert v-if="failedError" type="error" :closable="false" :title="failedError" style="margin-bottom:12px;" />

          <el-table :data="failedJobs" v-loading="failedLoading" class="dashboard-table" max-height="580">
            <el-table-column label="时间" width="170">
              <template #default="{ row }">
                <span style="font-size:12px;">{{ row.failed_at || '--' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="队列" width="140">
              <template #default="{ row }">
                <el-tag size="small" type="info">{{ row.queue || '--' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="任务名称" min-width="200">
              <template #default="{ row }">
                <span style="font-size:12px;font-family:monospace;">{{ getJobDisplayName(row) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="异常信息" min-width="260">
              <template #default="{ row }">
                <span style="font-size:12px;color:var(--el-color-danger);">{{ getExceptionSummary(row) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70" align="center">
              <template #default="{ row }">
                <el-button :icon="View" link type="primary" @click="showJobDetail(row)" />
              </template>
            </el-table-column>
          </el-table>

          <div class="log-pagination">
            <el-pagination
              v-model:current-page="failedPage" v-model:page-size="failedPageSize"
              :page-sizes="[10, 20, 50]" :total="failedTotal"
              layout="total, sizes, prev, pager, next, jumper"
              @current-change="loadFailedJobs" @size-change="() => { failedPage = 1; loadFailedJobs() }"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>

    <!-- ========== 失败任务详情对话框 ========== -->
    <el-dialog
      v-model="failedDetailVisible"
      title="失败任务详情"
      width="720px"
      destroy-on-close
    >
      <template v-if="failedDetailJob">
        <el-descriptions :column="2" border size="small" style="margin-bottom:16px;">
          <el-descriptions-item label="任务 ID" :span="2">
            <span style="font-family:monospace;font-size:12px;">{{ failedDetailJob.id }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="任务名称">
            <span style="font-family:monospace;font-size:12px;">{{ getJobDisplayName(failedDetailJob) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="队列">
            <el-tag size="small" type="info">{{ failedDetailJob.queue || '--' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="失败时间">
            {{ failedDetailJob.failed_at || '--' }}
          </el-descriptions-item>
          <el-descriptions-item label="连接">
            {{ failedDetailJob.connection || '--' }}
          </el-descriptions-item>
        </el-descriptions>

        <h4 style="margin:0 0 8px;font-size:14px;">异常堆栈</h4>
        <pre class="log-stack-trace">{{ failedDetailJob.exception || '无异常信息' }}</pre>
      </template>

      <template #footer>
        <el-button :icon="Refresh" @click="loadFailedJobs">刷新</el-button>
        <el-button type="primary" @click="failedDetailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.log-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.log-filter-bar {
  margin-bottom: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.log-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.detail-label {
  padding: 4px 8px;
  font-weight: 600;
  white-space: nowrap;
}

.detail-value {
  padding: 4px 8px;
}

.log-stack-trace {
  font-size: 11px;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
  background: #1e1e2e;
  color: #a6adc8;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
  line-height: 1.5;
}
</style>
