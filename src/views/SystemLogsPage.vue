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
const activeAction = ref('all')
const expandedRows = ref(new Set())
const searchKeyword = ref('')

// Pagination
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

const actionOptions = [
  { label: '全部', value: 'all' },
  { label: '登录', value: 'login' },
  { label: '更新', value: 'update' },
  { label: '创建', value: 'create' },
  { label: '删除', value: 'delete' },
]

async function loadLogs() {
  loading.value = true
  error.value = ''
  try {
    const queryEntries = [
      ['current', currentPage.value],
      ['page_size', pageSize.value],
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
      logs.value = raw.map(normalizeLog)
      total.value = Number(payload?.total || raw.length)
    } else if (raw && typeof raw === 'object' && Array.isArray(raw.data)) {
      logs.value = raw.data.map(normalizeLog)
      total.value = Number(raw.total || raw.data.length)
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
  const action = String(item.action || '--')
  const uri = item.uri || ''
  const adminEmail = item.admin?.email || '--'
  const adminId = item.admin_id || item.admin?.id || '--'
  const createdAt = item.created_at || 0
  const id = item.id || 0

  let requestData = null
  if (item.request_data) {
    if (typeof item.request_data === 'string') {
      try { requestData = JSON.parse(item.request_data) } catch { requestData = item.request_data }
    } else {
      requestData = item.request_data
    }
  }

  // For truncation
  const displayText = uri || action
  const firstLine = displayText.substring(0, 120)
  const isLong = displayText.length > 120

  return {
    id,
    action,
    uri,
    adminEmail,
    adminId,
    requestData,
    createdAt,
    firstLine,
    isLong,
    displayText,
  }
}

function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(typeof ts === 'number' ? ts * 1000 : ts)
  if (Number.isNaN(d.getTime())) return '--'
  return d.toLocaleString('zh-CN')
}

function actionTagType(action) {
  const map = {
    login: 'success',
    create: '',
    update: 'warning',
    delete: 'danger',
  }
  return map[action] || 'info'
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

watch(activeAction, () => {
  currentPage.value = 1
  loadLogs()
})

onMounted(() => {
  const actionParam = route.query.action
  if (actionParam) {
    activeAction.value = actionParam
  }
  loadLogs()
})
</script>

<template>
  <section class="page-stack">
    <SectionCard title="审计日志" description="查看管理员操作审计日志，按操作类型筛选，支持关键词搜索和翻页。">
      <template #actions>
        <el-button :icon="Refresh" type="info" plain size="small" @click="loadLogs">刷新</el-button>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

      <div style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
        <el-radio-group v-model="activeAction" size="small">
          <el-radio-button v-for="opt in actionOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </el-radio-button>
        </el-radio-group>

        <el-input
          v-model="searchKeyword"
          clearable
          placeholder="搜索 URI / 请求数据"
          size="small"
          style="max-width: 240px;"
          @keyup.enter="loadLogs"
          @clear="loadLogs"
        />
      </div>

      <el-table :data="logs" v-loading="loading" class="dashboard-table" max-height="640">
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
        <el-table-column label="URI" min-width="300">
          <template #default="{ row }">
            <div class="log-request-cell">
              <div class="log-request-header">
                <span class="log-title-text" v-if="!row.isLong || isExpanded(row.id)">{{ row.uri }}</span>
                <span class="log-title-text" v-else>{{ row.firstLine }}...</span>
              </div>
              <div v-if="row.isLong" class="log-expand-toggle">
                <el-button link size="small" type="primary" @click="toggleExpand(row.id)">
                  {{ isExpanded(row.id) ? '收起' : '展开详情' }}
                </el-button>
              </div>
            </div>
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
                  <tr><td style="padding:4px 8px;font-weight:600;white-space:nowrap;">操作</td><td style="padding:4px 8px;">{{ row.action }}</td></tr>
                  <tr><td style="padding:4px 8px;font-weight:600;white-space:nowrap;">URI</td><td style="padding:4px 8px;word-break:break-all;">{{ row.uri }}</td></tr>
                  <tr><td style="padding:4px 8px;font-weight:600;white-space:nowrap;">管理员</td><td style="padding:4px 8px;">{{ row.adminEmail }} (ID: {{ row.adminId }})</td></tr>
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

.log-expand-toggle {
  margin-top: 4px;
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
