<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, RefreshCw } from 'lucide-vue-next'

import {
  formatAgo,
  formatCount,
  formatMinutesWindow,
  formatWaitSeconds,
} from './dashboardFormat'

const props = defineProps({
  health: { type: Object, required: true },
  nodes: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['refresh'])
const router = useRouter()

const horizonTag = computed(function horizonTag() {
  const map = {
    running: { text: '队列运行中', type: 'success' },
    paused: { text: '队列已暂停', type: 'warning' },
    stopped: { text: '队列未运行', type: 'danger' },
    unknown: { text: '队列状态未知', type: 'info' },
  }
  return map[props.health.horizon] || map.unknown
})

const scheduleTag = computed(function scheduleTag() {
  if (!props.health.loaded) return { text: '定时任务状态未知', type: 'info' }
  const ago = props.health.scheduleLastRunAt ? `（${formatAgo(props.health.scheduleLastRunAt)}）` : ''
  return props.health.schedule
    ? { text: `定时任务正常${ago}`, type: 'success' }
    : { text: `定时任务停了${ago}`, type: 'danger' }
})

const recentWindow = computed(() => formatMinutesWindow(props.health.recentWindowMinutes) || '近期')
const failedWindow = computed(() => formatMinutesWindow(props.health.failedWindowMinutes) || '近期')

const metrics = computed(function metrics() {
  const h = props.health
  return [
    { key: 'rate', label: '每分钟处理', value: formatCount(h.jobsPerMinute), unit: '个任务' },
    { key: 'recent', label: `近 ${recentWindow.value}处理`, value: formatCount(h.recentJobs), unit: '个任务' },
    {
      key: 'failed',
      label: `近 ${failedWindow.value}失败`,
      value: formatCount(h.failedJobs),
      unit: '个任务',
      warn: h.failedJobs > 0,
      to: { name: 'logs', query: { tab: 'failed' } },
    },
    { key: 'proc', label: '工作进程', value: formatCount(h.processes), unit: '个' },
  ]
})

const busiestQueues = computed(function busiestQueues() {
  return props.health.queues
})

function go(to) {
  if (to) router.push(to)
}

function shortJobName(name) {
  return String(name || '').split('\\').pop()
}
</script>

<template>
  <el-card v-loading="loading && !health.loaded" class="section-card dash-health" shadow="never">
    <div class="dash-health__head">
      <div>
        <h3>系统状态</h3>
        <p>队列、定时任务与节点是否正常</p>
      </div>
      <div class="dash-health__tags">
        <el-tag :type="horizonTag.type" effect="light" size="small">{{ horizonTag.text }}</el-tag>
        <el-tag :type="scheduleTag.type" effect="light" size="small">{{ scheduleTag.text }}</el-tag>
        <el-button :icon="RefreshCw" size="small" plain :loading="loading" @click="emit('refresh')">刷新</el-button>
      </div>
    </div>

    <el-alert v-if="error" type="warning" :closable="false" show-icon :title="error" style="margin-bottom: 12px" />

    <div class="dash-health__metrics">
      <div
        v-for="item in metrics"
        :key="item.key"
        class="dash-health__metric"
        :class="{ 'is-warn': item.warn, 'is-link': item.to }"
        @click="go(item.to)"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}<small>{{ item.unit }}</small></strong>
      </div>
    </div>

    <div v-if="health.failedByJob.length" class="dash-health__failed">
      <span class="dash-health__section-title">
        失败最多的任务
        <!-- 失败太多时后端只翻最近几百条，这里说清楚统计范围 -->
        <em v-if="health.failedByJobScanned && health.failedByJobScanned < health.failedJobs">按最近 {{ formatCount(health.failedByJobScanned) }} 条统计</em>
      </span>
      <ul>
        <li v-for="job in health.failedByJob" :key="job.name" @click="go({ name: 'logs', query: { tab: 'failed' } })">
          <span :title="job.name">{{ shortJobName(job.name) }}</span>
          <span>{{ formatCount(job.total) }} 次 · 最近 {{ formatAgo(job.lastFailedAt) }}</span>
        </li>
      </ul>
    </div>

    <div class="dash-health__queues">
      <span class="dash-health__section-title">各队列积压</span>
      <table v-if="busiestQueues.length">
        <thead>
          <tr>
            <th>队列</th>
            <th>等待中</th>
            <th>预计等待</th>
            <th>进程</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="queue in busiestQueues" :key="queue.name" :class="{ 'is-backlog': queue.length > 0 }">
            <td>{{ queue.name }}</td>
            <td>{{ formatCount(queue.length) }}</td>
            <td>{{ formatWaitSeconds(queue.wait) }}</td>
            <td>{{ formatCount(queue.processes) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="dash-health__muted">没有拿到队列负载数据</p>
    </div>

    <div class="dash-health__nodes">
      <span class="dash-health__section-title">
        节点
        <em>在线 {{ formatCount(nodes.online) }} / {{ formatCount(nodes.shown) }}<template v-if="nodes.hidden"> · 另有 {{ formatCount(nodes.hidden) }} 个未显示</template></em>
      </span>
      <ul v-if="nodes.offlineList.length" class="dash-health__offline">
        <li v-for="node in nodes.offlineList" :key="node.id" @click="go({ name: 'nodes', query: { status: '0' } })">
          <span :title="node.name">{{ node.name }}</span>
          <span>最后上报 {{ formatAgo(node.lastCheckAt) }}</span>
        </li>
        <li v-if="nodes.offline > nodes.offlineList.length" class="dash-health__more" @click="go({ name: 'nodes', query: { status: '0' } })">
          还有 {{ formatCount(nodes.offline - nodes.offlineList.length) }} 个离线节点 <ArrowRight :size="12" />
        </li>
      </ul>
      <p v-else class="dash-health__muted">显示中的节点全部在线</p>
    </div>
  </el-card>
</template>

<style scoped>
.dash-health :deep(.el-card__body) {
  padding: 18px 20px;
}

.dash-health__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.dash-health__head h3 {
  margin: 0;
  font-size: 17px;
}

.dash-health__head p {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 12.5px;
}

.dash-health__tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.dash-health__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.dash-health__metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--muted);
  font-size: 12.5px;
}

.dash-health__metric strong {
  color: var(--text);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
}

.dash-health__metric strong small {
  margin-left: 3px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
}

.dash-health__metric.is-link {
  cursor: pointer;
}

.dash-health__metric.is-link:hover {
  border-color: var(--line-strong);
}

.dash-health__metric.is-warn strong {
  color: var(--primary-strong);
}

.dash-health__section-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

.dash-health__section-title em {
  color: var(--muted);
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
}

.dash-health__failed,
.dash-health__queues,
.dash-health__nodes {
  margin-top: 16px;
}

.dash-health__failed ul,
.dash-health__offline {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dash-health__failed li,
.dash-health__offline li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
}

.dash-health__failed li:hover,
.dash-health__offline li:hover {
  background: var(--panel-strong);
}

.dash-health__failed li span:first-child,
.dash-health__offline li span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dash-health__failed li span:last-child,
.dash-health__offline li span:last-child {
  flex: none;
  color: var(--muted);
  font-size: 12px;
}

.dash-health__more {
  color: var(--muted);
}

.dash-health__queues table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.dash-health__queues th {
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
}

.dash-health__queues td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  font-variant-numeric: tabular-nums;
}

.dash-health__queues th:not(:first-child),
.dash-health__queues td:not(:first-child) {
  text-align: right;
}

.dash-health__queues tr.is-backlog td:nth-child(2) {
  color: var(--primary-strong);
  font-weight: 600;
}

.dash-health__muted {
  margin: 0;
  color: var(--muted);
  font-size: 12.5px;
}
</style>
