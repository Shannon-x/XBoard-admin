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
  let level = ''
  let message = ''
  let datetime = ''
  let context = null

  if (typeof item === 'string') {
    const match = item.match(/^\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\]]*)\]\s*\w+\.(\w+):\s*(.*)$/s)
    if (match) {
      datetime = match[1]
      level = match[2].toLowerCase()
      message = match[3]
    } else {
      message = item
      level = 'info'
    }
  } else if (item && typeof item === 'object') {
    level = String(item.level || item.level_name || 'info').toLowerCase()
    message = item.message || item.text || item.msg || ''
    datetime = item.datetime || item.timestamp || item.created_at || item.date || ''
    context = item.context || item.extra || null

    if (!message && item.formatted) {
      message = item.formatted
    }
  }

  return { level, message, datetime, context }
}

function formatTime(dt) {
  if (!dt) return '--'
  if (typeof dt === 'number') {
    const d = dt > 1e12 ? new Date(dt) : new Date(dt * 1000)
    return d.toLocaleString('zh-CN')
  }
  if (typeof dt === 'string') {
    const parsed = new Date(dt)
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleString('zh-CN')
    }
    return dt
  }
  return String(dt)
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
    info: 'success', debug: '',
  }
  return map[level] || 'info'
}

onMounted(loadLogs)
</script>

<template>
  <section class="page-stack">
    <SectionCard title="系统日志" description="查看分类系统日志，按级别筛选。">
      <template #actions>
        <el-button type="info" plain size="small" @click="loadLogs">刷新</el-button>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

      <div style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
        <el-radio-group v-model="activeLevel" size="small">
          <el-radio-button value="all">全部 ({{ levelCounts.all }})</el-radio-button>
          <el-radio-button v-for="level in ['error', 'warning', 'info', 'debug', 'critical', 'emergency']" :key="level" :value="level">
            {{ level }} ({{ levelCounts[level] || 0 }})
          </el-radio-button>
        </el-radio-group>
      </div>

      <el-table :data="displayLogs" v-loading="loading" class="dashboard-table" max-height="600">
        <el-table-column label="级别" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="levelTagType(row.level)">{{ row.level.toUpperCase() }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ formatTime(row.datetime) }}</template>
        </el-table-column>
        <el-table-column label="消息" min-width="400">
          <template #default="{ row }">
            <div style="word-break: break-all; line-height: 1.5; font-size: 13px; white-space: pre-wrap;">{{ row.message || '--' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="上下文" width="100">
          <template #default="{ row }">
            <el-popover v-if="row.context && typeof row.context === 'object' && Object.keys(row.context).length" placement="left" :width="400" trigger="click">
              <template #reference>
                <el-button link size="small" type="primary">详情</el-button>
              </template>
              <pre style="font-size: 12px; max-height: 300px; overflow: auto;">{{ JSON.stringify(row.context, null, 2) }}</pre>
            </el-popover>
            <span v-else>--</span>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>
  </section>
</template>
