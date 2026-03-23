<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Refresh } from '@element-plus/icons-vue'
import SectionCard from '../components/common/SectionCard.vue'
import { buildDashboardApiUrl, requestDashboardApi } from '../services/api'

const route = useRoute()

const logs = ref([])
const loading = ref(false)
const error = ref('')
const activeLevel = ref('all')
const expandedRows = ref(new Set())

// Pagination
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

async function loadLogs() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      current: currentPage.value,
      pageSize: pageSize.value,
    })
    if (activeLevel.value !== 'all') {
      params.set('level', activeLevel.value.toUpperCase())
    }
    const apiUrl = buildDashboardApiUrl('system/getSystemLog') + '&' + params.toString()
    const payload = await requestDashboardApi(apiUrl)
    const raw = payload?.data

    if (Array.isArray(raw)) {
      logs.value = raw.map(normalizeLog)
      total.value = payload?.total || raw.length
    } else if (raw && typeof raw === 'object' && Array.isArray(raw.data)) {
      logs.value = raw.data.map(normalizeLog)
      total.value = raw.total || raw.data.length
    } else {
      logs.value = []
      total.value = 0
    }
    expandedRows.value = new Set()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function normalizeLog(item) {
  const level = String(item.level || 'INFO').toLowerCase()
  const title = item.title || ''
  const uri = item.uri || ''
  const method = item.method || ''
  const ip = item.ip || ''
  const host = item.host || ''
  const createdAt = item.created_at || 0

  let requestData = null
  if (item.data) {
    if (typeof item.data === 'string') {
      try { requestData = JSON.parse(item.data) } catch { requestData = item.data }
    } else {
      requestData = item.data
    }
  }

  let context = null
  if (item.context && item.context !== '[]' && item.context !== '{}') {
    if (typeof item.context === 'string') {
      try { context = JSON.parse(item.context) } catch { context = item.context }
    } else {
      context = item.context
    }
  }

  // For truncation: extract first line and check if multi-line
  const firstLine = title.split('\n')[0].substring(0, 120)
  const isLong = title.length > 120 || title.includes('\n')

  return { id: item.id, level, title, firstLine, isLong, uri, method, ip, host, requestData, context, createdAt }
}

function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts * 1000)
  return d.toLocaleString('zh-CN')
}

function levelTagType(level) {
  const map = {
    emergency: 'danger', alert: 'danger', critical: 'danger',
    error: 'danger', warning: 'warning', notice: 'info',
    info: '', debug: '',
  }
  return map[level] || 'info'
}

function methodTagType(method) {
  const m = (method || '').toUpperCase()
  if (m === 'GET') return 'success'
  if (m === 'POST') return 'warning'
  if (m === 'DELETE') return 'danger'
  if (m === 'PUT' || m === 'PATCH') return ''
  return 'info'
}

function toggleExpand(id) {
  if (expandedRows.value.has(id)) {
    expandedRows.value.delete(id)
  } else {
    expandedRows.value.add(id)
  }
}

function isExpanded(id) {
  return expandedRows.value.has(id)
}

function handlePageChange(page) {
  currentPage.value = page
  loadLogs()
}

function handleSizeChange(size) {
  pageSize.value = size
  currentPage.value = 1
  loadLogs()
}

watch(activeLevel, () => {
  currentPage.value = 1
  loadLogs()
})

onMounted(() => {
  const levelParam = route.query.level
  if (levelParam && ['error', 'warning', 'info', 'debug'].includes(levelParam)) {
    activeLevel.value = levelParam
  }
  loadLogs()
})
</script>

<template>
  <section class="page-stack">
    <SectionCard title="系统日志" description="查看系统日志，按级别筛选，支持翻页。">
      <template #actions>
        <el-button :icon="Refresh" type="info" plain size="small" @click="loadLogs">刷新</el-button>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

      <div style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
        <el-radio-group v-model="activeLevel" size="small">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button v-for="level in ['error', 'warning', 'info', 'debug']" :key="level" :value="level">
            {{ level.toUpperCase() }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <el-table :data="logs" v-loading="loading" class="dashboard-table" max-height="640">
        <el-table-column label="ID" prop="id" width="70" sortable />
        <el-table-column label="级别" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="levelTagType(row.level)">{{ row.level.toUpperCase() }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="请求" min-width="300">
          <template #default="{ row }">
            <div class="log-request-cell">
              <div class="log-request-header">
                <el-tag size="small" :type="methodTagType(row.method)" style="margin-right:6px;">{{ row.method }}</el-tag>
                <span class="log-title-text" v-if="!row.isLong || isExpanded(row.id)">{{ row.title }}</span>
                <span class="log-title-text" v-else>{{ row.firstLine }}...</span>
              </div>
              <div v-if="row.uri" class="log-uri-text">{{ row.uri }}</div>
              <div v-if="row.isLong" class="log-expand-toggle">
                <el-button link size="small" type="primary" @click="toggleExpand(row.id)">
                  {{ isExpanded(row.id) ? '收起' : '展开详情' }}
                </el-button>
              </div>
              <div v-if="isExpanded(row.id) && row.title.length > 120" class="log-detail-block">
                <pre class="log-stack-trace">{{ row.title }}</pre>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="IP" width="130">
          <template #default="{ row }">
            <span style="font-size:12px;font-family:monospace;">{{ row.ip || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="详情" width="80">
          <template #default="{ row }">
            <el-popover placement="left" :width="480" trigger="click">
              <template #reference>
                <el-button link size="small" type="primary">详情</el-button>
              </template>
              <div style="max-height:400px;overflow:auto;">
                <h4 style="margin:0 0 8px;">请求信息</h4>
                <table style="font-size:12px;width:100%;border-collapse:collapse;">
                  <tr><td style="padding:4px 8px;font-weight:600;white-space:nowrap;">方法</td><td style="padding:4px 8px;">{{ row.method }}</td></tr>
                  <tr><td style="padding:4px 8px;font-weight:600;white-space:nowrap;">URI</td><td style="padding:4px 8px;word-break:break-all;">{{ row.uri }}</td></tr>
                  <tr><td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Host</td><td style="padding:4px 8px;">{{ row.host }}</td></tr>
                  <tr><td style="padding:4px 8px;font-weight:600;white-space:nowrap;">IP</td><td style="padding:4px 8px;">{{ row.ip }}</td></tr>
                </table>
                <template v-if="row.requestData">
                  <h4 style="margin:12px 0 8px;">请求数据</h4>
                  <pre class="log-stack-trace">{{ typeof row.requestData === 'string' ? row.requestData : JSON.stringify(row.requestData, null, 2) }}</pre>
                </template>
                <template v-if="row.context && ((typeof row.context === 'object' && Object.keys(row.context).length) || typeof row.context === 'string')">
                  <h4 style="margin:12px 0 8px;">上下文</h4>
                  <pre class="log-stack-trace">{{ typeof row.context === 'string' ? row.context : JSON.stringify(row.context, null, 2) }}</pre>
                </template>
              </div>
            </el-popover>
          </template>
        </el-table-column>
      </el-table>

      <div style="display:flex;justify-content:flex-end;margin-top:16px;">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </SectionCard>
  </section>
</template>

<style scoped>
.log-request-cell {
  line-height: 1.6;
}

.log-request-header {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.log-title-text {
  word-break: break-word;
}

.log-uri-text {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.log-expand-toggle {
  margin-top: 4px;
}

.log-detail-block {
  margin-top: 8px;
}

.log-stack-trace {
  font-size: 11px;
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
  background: #1e1e2e;
  color: #a6adc8;
  padding: 10px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
}
</style>
