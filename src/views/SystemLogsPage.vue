<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Refresh } from '@element-plus/icons-vue'
import SectionCard from '../components/common/SectionCard.vue'
import { buildDashboardApiUrl, requestDashboardApi } from '../services/api'

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
const auditExpandedRows = ref(new Set())

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
const failedPageSize = ref(20)
const failedTotal = ref(0)
const failedExpandedRows = ref(new Set())

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
    auditExpandedRows.value = new Set()
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
    const payload = await requestDashboardApi(apiUrl)
    const raw = payload?.data

    if (Array.isArray(raw)) {
      failedJobs.value = raw.map(normalizeFailedJob)
      failedTotal.value = Number(payload?.total || raw.length)
    } else {
      failedJobs.value = []
      failedTotal.value = 0
    }
    failedExpandedRows.value = new Set()
  } catch (err) {
    failedError.value = err.message
  } finally {
    failedLoading.value = false
  }
}

function normalizeFailedJob(item) {
  const name = item.name || item.payload?.displayName || '--'
  const queue = item.queue || '--'
  const failedAt = item.failed_at || ''
  const exception = item.exception || ''
  const firstLine = exception.split('\n')[0]?.substring(0, 200) || '--'
  const isLong = exception.length > 200

  return { id: item.id, name, queue, failedAt, exception, firstLine, isLong }
}

// ===================== Helpers =====================

function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(typeof ts === 'number' ? ts * 1000 : ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  return d.toLocaleString('zh-CN')
}

function actionTagType(action) {
  const map = { login: 'success', create: '', update: 'warning', delete: 'danger' }
  return map[action] || 'info'
}

function toggleExpand(set, id) {
  if (set.has(id)) { set.delete(id) } else { set.add(id) }
}

function handleRefresh() {
  if (activeTab.value === 'audit') loadAuditLogs()
  else loadFailedJobs()
}

watch(activeAction, () => { auditPage.value = 1; loadAuditLogs() })

watch(activeTab, (tab) => {
  if (tab === 'audit' && auditLogs.value.length === 0) loadAuditLogs()
  if (tab === 'failed' && failedJobs.value.length === 0) loadFailedJobs()
})

onMounted(() => {
  const tab = route.query.tab
  if (tab === 'failed') activeTab.value = 'failed'
  loadAuditLogs()
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

          <div style="margin-bottom: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <el-radio-group v-model="activeAction" size="small">
              <el-radio-button v-for="opt in actionOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </el-radio-button>
            </el-radio-group>
            <el-input
              v-model="searchKeyword"
              clearable placeholder="搜索 URI / 请求数据"
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
                      <tr><td style="padding:4px 8px;font-weight:600;">操作</td><td style="padding:4px 8px;">{{ row.action }}</td></tr>
                      <tr><td style="padding:4px 8px;font-weight:600;">URI</td><td style="padding:4px 8px;word-break:break-all;">{{ row.uri }}</td></tr>
                      <tr><td style="padding:4px 8px;font-weight:600;">管理员</td><td style="padding:4px 8px;">{{ row.adminEmail }} (ID: {{ row.adminId }})</td></tr>
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

          <div style="display:flex;justify-content:flex-end;margin-top:16px;">
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
            <el-badge v-if="failedTotal > 0" :value="failedTotal" :max="99" style="margin-left:4px;" />
          </template>

          <el-alert v-if="failedError" type="error" :closable="false" :title="failedError" style="margin-bottom:12px;" />

          <el-table :data="failedJobs" v-loading="failedLoading" class="dashboard-table" max-height="580">
            <el-table-column label="ID" prop="id" width="200" />
            <el-table-column label="任务名" min-width="200">
              <template #default="{ row }">
                <span style="font-size:12px;font-family:monospace;">{{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column label="队列" width="120" prop="queue" />
            <el-table-column label="失败时间" width="170">
              <template #default="{ row }">{{ formatTime(row.failedAt) }}</template>
            </el-table-column>
            <el-table-column label="异常" min-width="300">
              <template #default="{ row }">
                <div>
                  <span style="font-size:12px;color:var(--el-color-danger);">{{ row.firstLine }}</span>
                  <div v-if="row.isLong" style="margin-top:4px;">
                    <el-button link size="small" type="primary" @click="toggleExpand(failedExpandedRows, row.id)">
                      {{ failedExpandedRows.has(row.id) ? '收起' : '展开堆栈' }}
                    </el-button>
                  </div>
                  <pre v-if="failedExpandedRows.has(row.id)" class="log-stack-trace">{{ row.exception }}</pre>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <div style="display:flex;justify-content:flex-end;margin-top:16px;">
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
  </section>
</template>

<style scoped>
.log-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.log-stack-trace {
  font-size: 11px;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
  background: #1e1e2e;
  color: #a6adc8;
  padding: 10px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 8px 0 0;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
}
</style>
