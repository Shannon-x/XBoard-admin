<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Info, OctagonAlert, RefreshCw, TriangleAlert } from 'lucide-vue-next'

import MonitorQueueTable from './MonitorQueueTable.vue'
import MonitorScheduleTable from './MonitorScheduleTable.vue'
import { formatAgo, formatCount, formatDuration } from './dashboardFormat'

/**
 * 「队列与定时任务」：后端每分钟巡检（monitor:check）的同一份报告。
 * 上面是现状概览和当前问题，下面是每条队列、每条定时任务的明细。
 */
const props = defineProps({
  report: { type: Object, required: true },
  failedByJob: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['refresh'])
const router = useRouter()

const now = computed(function now() {
  return props.report.generatedAt || Math.floor(Date.now() / 1000)
})

const overallTag = computed(function overallTag() {
  const r = props.report
  if (!r.loaded) return { text: '状态未知', type: 'info' }
  const critical = r.issues.filter(function c(i) { return i.level === 'critical' }).length
  const warning = r.issues.filter(function w(i) { return i.level === 'warning' }).length
  if (critical) return { text: `${critical} 个严重问题`, type: 'danger' }
  if (warning) return { text: `${warning} 个需要留意`, type: 'warning' }
  return { text: '一切正常', type: 'success' }
})

const HORIZON = {
  running: { text: '运行中', tone: 'ok' },
  paused: { text: '已暂停', tone: 'bad' },
  stopped: { text: '没在运行', tone: 'bad' },
  unknown: { text: '读不到状态', tone: 'bad' },
}

const SCHEDULER = {
  ok: { text: '专用进程运行中', tone: 'ok' },
  stale: { text: '心跳延迟', tone: 'warn' },
  fallback: { text: '网页进程在代跑', tone: 'warn' },
  stopped: { text: '停了', tone: 'bad' },
  unknown: { text: '状态未知', tone: 'muted' },
}

const facts = computed(function facts() {
  const r = props.report
  const horizon = HORIZON[r.horizon.status] || HORIZON.unknown
  const scheduler = SCHEDULER[r.scheduler.status] || SCHEDULER.unknown
  const telegram = r.alerting.telegram
  let alertText = 'Telegram 直发'
  let alertTone = 'ok'
  if (!telegram.botConfigured) {
    alertText = '没配置 Bot'
    alertTone = 'bad'
  } else if (!telegram.recipients) {
    alertText = '没有管理员绑定'
    alertTone = 'bad'
  } else if (telegram.last && telegram.last.direct === 0 && telegram.last.error) {
    alertText = '最近一次直发失败'
    alertTone = 'warn'
  }
  const heartbeat = r.alerting.heartbeatConfigured
    ? (r.alerting.heartbeatLast && !r.alerting.heartbeatLast.ok ? '外部心跳上报失败' : '外部心跳已配置')
    : '外部心跳未配置'

  return [
    {
      key: 'horizon',
      label: '队列进程 Horizon',
      value: horizon.text,
      tone: horizon.tone,
      sub: r.horizon.status === 'running' ? `${formatCount(r.horizon.processes)} 个工作进程 · ${r.horizon.supervisors.length} 组` : '所有队列任务都不会被处理',
    },
    {
      key: 'scheduler',
      label: '定时任务调度',
      value: scheduler.text,
      tone: scheduler.tone,
      sub: r.scheduler.heartbeatAge === null ? '从未上报心跳' : `心跳 ${formatDuration(r.scheduler.heartbeatAge)}前`,
    },
    {
      key: 'rate',
      label: '处理速度',
      value: r.horizon.jobsPerMinute === null ? '—' : formatCount(r.horizon.jobsPerMinute),
      unit: '个 / 分钟',
      tone: 'plain',
      sub: '所有队列合计',
    },
    {
      key: 'failed',
      label: '失败任务',
      value: formatCount(r.failed.last1h),
      unit: '个 / 近 1 小时',
      tone: r.failed.last10m > 0 ? 'warn' : 'plain',
      sub: `近 10 分钟 ${formatCount(r.failed.last10m)} 个${r.failed.truncated ? '（只统计了最近 500 条）' : ''}`,
      to: { name: 'logs', query: { tab: 'failed' } },
    },
    {
      key: 'alerting',
      label: '告警通道',
      value: alertText,
      tone: alertTone === 'ok' && !r.alerting.heartbeatConfigured ? 'warn' : alertTone,
      sub: `${formatCount(telegram.recipients)} 位管理员 · ${heartbeat}`,
    },
  ]
})

const ISSUE_ICON = { critical: OctagonAlert, warning: TriangleAlert, info: Info }

const checkedText = computed(function checkedText() {
  const age = props.report.scheduler.monitorAge
  if (age === null) return '巡检还没跑过'
  return `巡检于 ${formatDuration(age)}前`
})

function go(to) {
  if (to) router.push(to)
}

function shortJobName(name) {
  return String(name || '').split('\\').pop()
}
</script>

<template>
  <el-card v-loading="loading && !report.loaded" class="section-card dash-monitor" shadow="never">
    <div class="dash-monitor__head">
      <div>
        <h3>队列与定时任务</h3>
        <p>每分钟巡检一次，发现问题直接发 Telegram，不经过队列</p>
      </div>
      <div class="dash-monitor__tags">
        <el-tag :type="overallTag.type" effect="light" size="small">{{ overallTag.text }}</el-tag>
        <span class="dash-monitor__checked">{{ checkedText }}</span>
        <el-button :icon="RefreshCw" size="small" plain :loading="loading" @click="emit('refresh')">刷新</el-button>
      </div>
    </div>

    <el-alert v-if="error" type="warning" :closable="false" show-icon :title="error" style="margin-top: 12px" />

    <div class="dash-monitor__facts">
      <div
        v-for="fact in facts"
        :key="fact.key"
        class="dash-monitor__fact"
        :class="[`tone-${fact.tone}`, { 'is-link': fact.to }]"
        @click="go(fact.to)"
      >
        <span>{{ fact.label }}</span>
        <strong>{{ fact.value }}<small v-if="fact.unit">{{ fact.unit }}</small></strong>
        <em>{{ fact.sub }}</em>
      </div>
    </div>

    <ul v-if="report.issues.length" class="dash-monitor__issues">
      <li v-for="issue in report.issues" :key="issue.key" :class="`is-${issue.level}`">
        <component :is="ISSUE_ICON[issue.level] || Info" :size="16" class="dash-monitor__issue-icon" />
        <div class="dash-monitor__issue-body">
          <div class="dash-monitor__issue-title">
            <strong>{{ issue.title }}</strong>
            <span class="dash-monitor__issue-meta">
              持续 {{ formatDuration(now - issue.since) }}<template v-if="!issue.notify"> · 不发告警</template>
            </span>
          </div>
          <p v-if="issue.detail">{{ issue.detail }}</p>
        </div>
      </li>
    </ul>

    <section class="dash-monitor__block">
      <div class="dash-monitor__block-title">
        <span>各队列</span>
        <em>「探测延迟」是巡检每分钟投进队列的空任务排了多久才被执行，它被执行才说明队列真的在干活</em>
      </div>
      <MonitorQueueTable v-if="report.queues.length" :queues="report.queues" :now="now" />
      <p v-else class="dash-monitor__muted">没有拿到队列数据</p>
    </section>

    <section v-if="failedByJob.length" class="dash-monitor__block">
      <div class="dash-monitor__block-title">
        <span>失败最多的任务</span>
        <em>Horizon 保留的失败记录</em>
      </div>
      <ul class="dash-monitor__failed">
        <li v-for="job in failedByJob" :key="job.name" @click="go({ name: 'logs', query: { tab: 'failed' } })">
          <span :title="job.name">{{ shortJobName(job.name) }}</span>
          <span>{{ formatCount(job.total) }} 次 · 最近 {{ formatAgo(job.lastFailedAt, now) }}</span>
        </li>
      </ul>
    </section>

    <section id="dash-monitor-schedule" class="dash-monitor__block">
      <div class="dash-monitor__block-title">
        <span>定时任务</span>
        <em>到点 2 分半还没启动算「没按时跑」，多半是上一次卡住占着锁</em>
      </div>
      <MonitorScheduleTable :tasks="report.schedule" :now="now" />
    </section>
  </el-card>
</template>

<style scoped>
.dash-monitor :deep(.el-card__body) {
  padding: 18px 20px;
}

.dash-monitor__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.dash-monitor__head h3 {
  margin: 0;
  font-size: 17px;
}

.dash-monitor__head p {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 12.5px;
}

.dash-monitor__tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dash-monitor__checked {
  color: var(--muted);
  font-size: 12px;
}

.dash-monitor__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.dash-monitor__fact {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--muted);
  font-size: 12.5px;
}

.dash-monitor__fact strong {
  color: var(--text);
  font-size: 17px;
  font-weight: 700;
  line-height: 1.35;
}

.dash-monitor__fact strong small {
  margin-left: 4px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
}

.dash-monitor__fact em {
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dash-monitor__fact.tone-ok strong {
  color: var(--success);
}

.dash-monitor__fact.tone-warn {
  border-color: rgba(217, 156, 92, 0.45);
  background: var(--warning-soft);
}

.dash-monitor__fact.tone-warn strong {
  color: #8a5a22;
}

.dash-monitor__fact.tone-bad {
  border-color: rgba(201, 79, 46, 0.4);
  background: var(--danger-soft);
}

.dash-monitor__fact.tone-bad strong {
  color: var(--primary-strong);
}

.dash-monitor__fact.is-link {
  cursor: pointer;
}

.dash-monitor__fact.is-link:hover {
  border-color: var(--line-strong);
}

.dash-monitor__issues {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.dash-monitor__issues li {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: #fff;
}

.dash-monitor__issues li.is-critical {
  border-color: rgba(201, 79, 46, 0.4);
  background: var(--danger-soft);
}

.dash-monitor__issues li.is-warning {
  border-color: rgba(217, 156, 92, 0.45);
  background: var(--warning-soft);
}

.dash-monitor__issue-icon {
  flex: none;
  margin-top: 2px;
  color: var(--info);
}

.is-critical .dash-monitor__issue-icon {
  color: var(--danger);
}

.is-warning .dash-monitor__issue-icon {
  color: var(--warning);
}

.dash-monitor__issues strong {
  color: var(--text);
  font-size: 13.5px;
  font-weight: 600;
}

.dash-monitor__issues p {
  margin: 2px 0 0;
  color: #3a342f;
  font-size: 12.5px;
  line-height: 1.55;
}

.dash-monitor__issue-body {
  flex: 1;
  min-width: 0;
}

.dash-monitor__issue-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
  flex-wrap: wrap;
}

.dash-monitor__issue-meta {
  flex: none;
  color: var(--muted);
  font-size: 12px;
}

.dash-monitor__block {
  margin-top: 18px;
  scroll-margin-top: 16px;
}

.dash-monitor__block-title {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-bottom: 6px;
}

.dash-monitor__block-title span {
  color: var(--text);
  font-size: 13.5px;
  font-weight: 600;
}

.dash-monitor__block-title em {
  color: var(--muted);
  font-size: 12px;
  font-style: normal;
}

.dash-monitor__failed {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dash-monitor__failed li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
}

.dash-monitor__failed li:hover {
  background: var(--panel-strong);
}

.dash-monitor__failed li span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dash-monitor__failed li span:last-child {
  flex: none;
  color: var(--muted);
  font-size: 12px;
}

.dash-monitor__muted {
  margin: 0;
  color: var(--muted);
  font-size: 12.5px;
}
</style>
