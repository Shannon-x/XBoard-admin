<script setup>
import { onMounted, ref, computed } from 'vue'
import SectionCard from '../components/common/SectionCard.vue'
import { buildDashboardApiUrl, requestDashboardApi } from '../services/api'

const logs = ref([])
const loading = ref(false)
const error = ref('')
const activeLevel = ref('all')
const rawDebug = ref('')

async function loadLogs() {
  loading.value = true
  error.value = ''
  try {
    const apiUrl = buildDashboardApiUrl('system/getSystemLog')
    const payload = await requestDashboardApi(apiUrl)
    const raw = payload?.data

    // Debug: show raw structure of first entry
    if (Array.isArray(raw) && raw.length > 0) {
      rawDebug.value = JSON.stringify(raw[0], null, 2)
    }

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
  if (typeof item === 'string') {
    return parseLogString(item)
  }
  if (item && typeof item === 'object') {
    return parseLogObject(item)
  }
  return { level: 'info', message: String(item), datetime: '', context: null }
}

function parseLogString(str) {
  // Laravel format: [2026-03-23 11:00:57] production.INFO: some message {"context":"value"}
  const match = str.match(/^\[([^\]]+)\]\s*\S+\.(\w+):\s*(.*?)(\s*\{.*\})?\s*$/s)
  if (match) {
    let context = null
    if (match[4]) {
      try { context = JSON.parse(match[4].trim()) } catch {}
    }
    return {
      level: (match[2] || 'info').toLowerCase(),
      message: match[3] || '',
      datetime: match[1],
      context,
    }
  }
  return { level: 'info', message: str, datetime: '', context: null }
}

function parseLogObject(item) {
  const level = String(item.level || item.level_name || 'info').toLowerCase()

  // Try all possible message field names
  const message = item.message
    || item.msg
    || item.text
    || item.content
    || item.log
    || item.body
    || item.description
    || item.formatted
    || item.channel_name
    || ''

  // Try all possible datetime field names
  const datetime = item.datetime
    || item.timestamp
    || item.created_at
    || item.date
    || item.time
    || item.logged_at
    || ''

  // Try all possible context fields
  const context = item.context
    || item.extra
    || item.data
    || item.details
    || item.meta
    || null

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
  if (dt && typeof dt === 'object' && dt.date) {
    return formatTime(dt.date)
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

function getLogPreview(item) {
  // Try to find any renderable text from the original raw data
  if (item.message) return item.message
  // If context is a non-empty object, show JSON preview
  if (item.context && typeof item.context === 'object' && Object.keys(item.context).length) {
    return JSON.stringify(item.context).slice(0, 200)
  }
  return '--'
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

      <!-- Debug: show raw data structure of first log entry -->
      <el-collapse v-if="rawDebug" style="margin-bottom: 16px;">
        <el-collapse-item title="🔍 调试: API 返回的原始日志条目格式 (第一条)">
          <pre style="font-size: 11px; background: #1e1e2e; color: #a6adc8; padding: 12px; border-radius: 8px; overflow-x: auto;">{{ rawDebug }}</pre>
        </el-collapse-item>
      </el-collapse>

      <div style="margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
        <el-radio-group v-model="activeLevel" size="small">
          <el-radio-button value="all">全部 ({{ levelCounts.all }})</el-radio-button>
          <el-radio-button v-for="level in ['error', 'warning', 'info', 'debug', 'critical', 'emergency']" :key="level" :value="level">
            {{ level.toUpperCase() }} ({{ levelCounts[level] || 0 }})
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
            <div style="word-break: break-all; line-height: 1.5; font-size: 13px; white-space: pre-wrap;">{{ getLogPreview(row) }}</div>
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
