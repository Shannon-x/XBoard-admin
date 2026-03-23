<script setup>
import { onMounted, ref, computed } from 'vue'
import SectionCard from '../components/common/SectionCard.vue'
import { buildDashboardApiUrl, requestDashboardApi } from '../services/api'

const logs = ref([])
const loading = ref(false)
const error = ref('')
const activeLevel = ref('all')

async function loadLogs() {
  loading.value = true
  error.value = ''
  try {
    const apiUrl = buildDashboardApiUrl('system/getSystemLog')
    const payload = await requestDashboardApi(apiUrl)
    const raw = payload?.data
    if (Array.isArray(raw)) {
      logs.value = raw.map(normalizeLog)
    } else {
      logs.value = []
    }
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

  // Parse request data
  let requestData = null
  if (item.data) {
    if (typeof item.data === 'string') {
      try { requestData = JSON.parse(item.data) } catch { requestData = item.data }
    } else {
      requestData = item.data
    }
  }

  // Parse context
  let context = null
  if (item.context && item.context !== '[]' && item.context !== '{}') {
    if (typeof item.context === 'string') {
      try { context = JSON.parse(item.context) } catch { context = item.context }
    } else {
      context = item.context
    }
  }

  return {
    id: item.id,
    level,
    title,
    uri,
    method,
    ip,
    host,
    requestData,
    context,
    createdAt,
  }
}

function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts * 1000)
  return d.toLocaleString('zh-CN')
}

const displayLogs = computed(() => {
  if (activeLevel.value === 'all') return logs.value
  return logs.value.filter(log => log.level === activeLevel.value)
})

const levelCounts = computed(() => {
  const counts = { all: logs.value.length, emergency: 0, alert: 0, critical: 0, error: 0, warning: 0, notice: 0, info: 0, debug: 0 }
  logs.value.forEach(log => {
    if (counts[log.level] !== undefined) counts[log.level]++
  })
  return counts
})

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

onMounted(loadLogs)
</script>

<template>
  <section class="page-stack">
    <SectionCard title="系统日志" description="查看管理员操作日志，按级别筛选。">
      <template #actions>
        <el-button type="info" plain size="small" @click="loadLogs">刷新</el-button>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

      <div style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
        <el-radio-group v-model="activeLevel" size="small">
          <el-radio-button value="all">全部 ({{ levelCounts.all }})</el-radio-button>
          <el-radio-button v-for="level in ['error', 'warning', 'info', 'debug']" :key="level" :value="level">
            {{ level.toUpperCase() }} ({{ levelCounts[level] || 0 }})
          </el-radio-button>
        </el-radio-group>
      </div>

      <el-table :data="displayLogs" v-loading="loading" class="dashboard-table" max-height="640">
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
            <div style="line-height:1.6;">
              <div style="font-size:13px;font-weight:500;color:var(--el-text-color-primary);">
                <el-tag size="small" :type="methodTagType(row.method)" style="margin-right:6px;">{{ row.method }}</el-tag>
                <span>{{ row.title }}</span>
              </div>
              <div style="font-size:11px;color:var(--el-text-color-secondary);margin-top:2px;">
                {{ row.uri }}
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
                  <pre style="font-size:11px;background:#1e1e2e;color:#a6adc8;padding:10px;border-radius:8px;overflow-x:auto;margin:0;">{{ typeof row.requestData === 'string' ? row.requestData : JSON.stringify(row.requestData, null, 2) }}</pre>
                </template>
                <template v-if="row.context && ((typeof row.context === 'object' && Object.keys(row.context).length) || typeof row.context === 'string')">
                  <h4 style="margin:12px 0 8px;">上下文</h4>
                  <pre style="font-size:11px;background:#1e1e2e;color:#a6adc8;padding:10px;border-radius:8px;overflow-x:auto;margin:0;">{{ typeof row.context === 'string' ? row.context : JSON.stringify(row.context, null, 2) }}</pre>
                </template>
              </div>
            </el-popover>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>
  </section>
</template>
