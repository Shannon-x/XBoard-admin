<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, RefreshCw } from 'lucide-vue-next'

import { formatAgo, formatCount } from './dashboardFormat'

const props = defineProps({
  status: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['refresh'])
const router = useRouter()

const MODE = {
  relay: { text: '投递服务', type: 'success' },
  fallback: { text: '面板直发（投递服务离线）', type: 'warning' },
  direct: { text: '面板直发', type: 'info' },
}

const serviceTag = computed(function serviceTag() {
  const s = props.status
  if (!s.loaded) return { text: '投递服务状态未知', type: 'info' }
  if (s.online) return { text: '投递服务在线', type: 'success' }
  if (s.anyEnabled) return { text: '投递服务离线，面板在直发', type: 'danger' }
  return { text: '投递服务未开启', type: 'info' }
})

// 额度和限流只在出状况时才挂标签，平时不占位置
const alertTags = computed(function alertTags() {
  const s = props.status
  const tags = []
  if (s.daily.full) tags.push({ text: '24 小时额度已用完', type: 'danger' })
  else if (s.daily.bulkPaused) tags.push({ text: '批量已暂停，额度留给验证码和收据', type: 'warning' })
  if (s.online && s.bulkFactor < 1) tags.push({ text: `被限流，批量降到 ${Math.round(s.bulkFactor * 100)}%`, type: 'warning' })
  return tags
})

const totalPending = computed(function totalPending() {
  const lanes = props.status.lanes.filter(function relayed(lane) { return lane.pending !== null })
  if (!lanes.length) return null
  return lanes.reduce(function sum(acc, lane) { return acc + lane.pending }, 0)
})

const metrics = computed(function metrics() {
  const s = props.status
  return [
    {
      key: 'pending',
      label: '待发',
      value: totalPending.value === null ? '—' : formatCount(totalPending.value),
      unit: totalPending.value === null ? '' : '封',
      hint: s.delayed ? `另有 ${formatCount(s.delayed)} 封等重试` : '',
      warn: totalPending.value > 0,
    },
    {
      key: 'rate',
      label: '每分钟发送',
      value: s.online ? formatCount(s.rate.lastMinute) : '—',
      unit: s.online ? '封' : '',
      hint: s.rate.limit ? `上限 ${formatCount(s.rate.limit)}` : '',
    },
    {
      key: 'hour',
      label: '近 1 小时发送',
      value: s.online ? formatCount(s.rate.lastHour) : '—',
      unit: s.online ? '封' : '',
    },
    {
      key: 'failed',
      label: '近 24 小时失败',
      value: formatCount(s.last24h.failed),
      unit: '封',
      hint: `成功 ${formatCount(s.last24h.sent)} 封`,
      warn: s.last24h.failed > 0,
      to: { name: 'mailDelivery', query: { status: '0' } },
    },
  ]
})

const quota = computed(function quota() {
  const d = props.status.daily
  const limit = d.limit > 0 ? d.limit : 0
  const pct = limit ? Math.min(100, (d.used / limit) * 100) : 0
  const capPct = limit && d.bulkCap < limit ? (d.bulkCap / limit) * 100 : null
  let tone = 'ok'
  if (d.full) tone = 'danger'
  else if (d.bulkPaused || (d.bulkCap && d.used >= d.bulkCap * 0.9)) tone = 'warn'
  return { limit, pct, capPct, tone, reserve: limit && d.bulkCap < limit ? limit - d.bulkCap : 0 }
})

// 最近 60 分钟的柱子：高度按这段时间里最多的一分钟算，最后一根是还没走完的这一分钟
const bars = computed(function bars() {
  const series = props.status.rate.perMinute
  const peak = Math.max(1, ...series)
  return series.map(function toBar(value, index) {
    return {
      key: index,
      value,
      height: value > 0 ? Math.max(6, (value / peak) * 100) : 0,
      current: index === series.length - 1,
      title: `${index === series.length - 1 ? '这一分钟' : `${series.length - 1 - index} 分钟前`}：${formatCount(value)} 封`,
    }
  })
})

const peakMinute = computed(function peakMinute() {
  return Math.max(0, ...props.status.rate.perMinute)
})

const footer = computed(function footer() {
  const s = props.status
  if (!s.online) return ''
  const parts = []
  if (s.startedAt) parts.push(`启动于 ${formatAgo(s.startedAt)}`)
  if (s.connections) parts.push(`${formatCount(s.connections)} 条 SMTP 连接`)
  parts.push(`455 限流 ${formatCount(s.sinceStart.throttled)} 次`)
  parts.push(`重试 ${formatCount(s.sinceStart.retried)} 次`)
  if (s.sinceStart.deferred) parts.push(`因额度延后 ${formatCount(s.sinceStart.deferred)} 次`)
  if (s.sinceStart.expired) parts.push(`验证码过期未发 ${formatCount(s.sinceStart.expired)} 封`)
  return `${parts.join(' · ')}（启动以来）`
})

function go(to) {
  if (to) router.push(to)
}
</script>

<template>
  <el-card v-loading="loading && !status.loaded" class="section-card dash-mail" shadow="never">
    <div class="dash-mail__head">
      <div>
        <h3>邮件投递</h3>
        <p>验证码、收据和批量提醒由谁在发、发得多快、24 小时额度还剩多少</p>
      </div>
      <div class="dash-mail__tags">
        <el-tag :type="serviceTag.type" effect="light" size="small">{{ serviceTag.text }}</el-tag>
        <el-tag v-for="tag in alertTags" :key="tag.text" :type="tag.type" effect="light" size="small">{{ tag.text }}</el-tag>
        <el-button size="small" plain @click="go({ name: 'mailDelivery' })">
          投递日志 <ArrowRight :size="13" style="margin-left: 2px" />
        </el-button>
        <el-button :icon="RefreshCw" size="small" plain :loading="loading" @click="emit('refresh')">刷新</el-button>
      </div>
    </div>

    <el-alert v-if="error" type="warning" :closable="false" show-icon :title="error" style="margin-top: 12px" />

    <div class="dash-mail__metrics">
      <div
        v-for="item in metrics"
        :key="item.key"
        class="dash-mail__metric"
        :class="{ 'is-warn': item.warn, 'is-link': item.to }"
        @click="go(item.to)"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}<small v-if="item.unit">{{ item.unit }}</small></strong>
        <em v-if="item.hint">{{ item.hint }}</em>
      </div>
    </div>

    <div class="dash-mail__body">
      <div class="dash-mail__panel">
        <span class="dash-mail__section-title">各通道</span>
        <table v-if="status.lanes.length">
          <thead>
            <tr>
              <th>通道</th>
              <th>由谁发</th>
              <th>待发</th>
              <th>启动以来发出</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lane in status.lanes" :key="lane.name" :class="{ 'is-backlog': lane.pending > 0 }">
              <td>{{ lane.label }}</td>
              <td>
                <span class="dash-mail__mode" :class="`is-${MODE[lane.mode]?.type || 'info'}`">
                  <i />{{ MODE[lane.mode]?.text || lane.mode }}
                </span>
              </td>
              <td>{{ lane.pending === null ? '—' : formatCount(lane.pending) }}</td>
              <td>{{ lane.mode === 'relay' ? formatCount(lane.sent) : '—' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="dash-mail__muted">没有拿到投递服务的数据</p>
      </div>

      <div class="dash-mail__panel">
        <span class="dash-mail__section-title">
          24 小时额度
          <em>滚动 24 小时，按收件人计</em>
        </span>
        <template v-if="quota.limit">
          <div class="dash-mail__quota-figure">
            <strong>{{ formatCount(status.daily.used) }}</strong>
            <span>/ {{ formatCount(quota.limit) }} 封</span>
            <b :class="`is-${quota.tone}`">{{ quota.pct.toFixed(quota.pct < 10 ? 1 : 0) }}%</b>
          </div>
          <div class="dash-mail__quota-bar" :class="`is-${quota.tone}`">
            <div class="dash-mail__quota-fill" :style="{ width: `${quota.pct}%` }" />
            <div
              v-if="quota.capPct !== null"
              class="dash-mail__quota-cap"
              :style="{ left: `${quota.capPct}%` }"
              :title="`批量到 ${formatCount(status.daily.bulkCap)} 封停`"
            />
          </div>
          <p class="dash-mail__muted">
            <template v-if="quota.reserve">批量发到 {{ formatCount(status.daily.bulkCap) }} 封就停，最后 {{ formatCount(quota.reserve) }} 封留给验证码和收据</template>
            <template v-else>不分通道，用完后延后到有空余再发</template>
          </p>
        </template>
        <p v-else class="dash-mail__muted">{{ status.online ? '没有设每日上限' : '投递服务离线，看不到额度' }}</p>

        <span class="dash-mail__section-title dash-mail__section-title--spaced">
          最近 60 分钟
          <em v-if="status.online && bars.length">最多一分钟 {{ formatCount(peakMinute) }} 封</em>
        </span>
        <div v-if="status.online && bars.length" class="dash-mail__spark" role="img" :aria-label="`最近 60 分钟共发送 ${status.rate.lastHour} 封`">
          <span
            v-for="bar in bars"
            :key="bar.key"
            :class="{ 'is-current': bar.current, 'is-empty': !bar.value }"
            :style="{ height: bar.value ? `${bar.height}%` : '' }"
            :title="bar.title"
          />
        </div>
        <div v-if="status.online && bars.length" class="dash-mail__spark-axis">
          <span>60 分钟前</span>
          <span>现在</span>
        </div>
        <p v-else class="dash-mail__muted">投递服务在线后显示每分钟发送量</p>
      </div>
    </div>

    <p v-if="footer" class="dash-mail__footer">{{ footer }}</p>
  </el-card>
</template>

<style scoped>
.dash-mail :deep(.el-card__body) {
  padding: 18px 20px;
}

.dash-mail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.dash-mail__head h3 {
  margin: 0;
  font-size: 17px;
}

.dash-mail__head p {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 12.5px;
}

.dash-mail__tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.dash-mail__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.dash-mail__metric {
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

.dash-mail__metric strong {
  color: var(--text);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}

.dash-mail__metric strong small {
  margin-left: 3px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
}

.dash-mail__metric em {
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dash-mail__metric.is-link {
  cursor: pointer;
}

.dash-mail__metric.is-link:hover {
  border-color: var(--line-strong);
}

.dash-mail__metric.is-warn strong {
  color: var(--primary-strong);
}

.dash-mail__body {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 24px;
  margin-top: 16px;
}

.dash-mail__panel {
  min-width: 0;
}

.dash-mail__section-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

.dash-mail__section-title em {
  color: var(--muted);
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
}

.dash-mail__section-title--spaced {
  margin-top: 16px;
}

.dash-mail__panel table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.dash-mail__panel th {
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
}

.dash-mail__panel td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--line);
  font-variant-numeric: tabular-nums;
}

.dash-mail__panel th:nth-child(n + 3),
.dash-mail__panel td:nth-child(n + 3) {
  text-align: right;
}

.dash-mail__panel tr.is-backlog td:nth-child(3) {
  color: var(--primary-strong);
  font-weight: 600;
}

.dash-mail__mode {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
  font-size: 12.5px;
  white-space: nowrap;
}

.dash-mail__mode i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--muted);
}

.dash-mail__mode.is-success i {
  background: var(--success);
  box-shadow: 0 0 0 3px var(--success-soft);
}

.dash-mail__mode.is-warning i {
  background: var(--warning);
  box-shadow: 0 0 0 3px var(--warning-soft);
}

.dash-mail__mode.is-warning {
  color: var(--el-color-warning-dark-2, #b88230);
}

.dash-mail__quota-figure {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-variant-numeric: tabular-nums;
}

.dash-mail__quota-figure strong {
  color: var(--text);
  font-size: 22px;
  font-weight: 700;
}

.dash-mail__quota-figure span {
  color: var(--muted);
  font-size: 13px;
}

.dash-mail__quota-figure b {
  margin-left: auto;
  color: var(--success);
  font-size: 13px;
  font-weight: 600;
}

.dash-mail__quota-figure b.is-warn {
  color: var(--warning);
}

.dash-mail__quota-figure b.is-danger {
  color: var(--danger);
}

.dash-mail__quota-bar {
  position: relative;
  height: 8px;
  margin: 8px 0 8px;
  border-radius: var(--radius-pill);
  background: var(--panel-strong);
}

.dash-mail__quota-fill {
  height: 100%;
  min-width: 2px;
  border-radius: inherit;
  background: var(--success);
  transition: width 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.dash-mail__quota-bar.is-warn .dash-mail__quota-fill {
  background: var(--warning);
}

.dash-mail__quota-bar.is-danger .dash-mail__quota-fill {
  background: var(--danger);
}

/* 批量停止线 */
.dash-mail__quota-cap {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  margin-left: -1px;
  border-radius: 1px;
  background: var(--text);
  opacity: 0.35;
}

.dash-mail__spark {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 56px;
  padding: 0 1px;
  border-bottom: 1px solid var(--line);
}

.dash-mail__spark span {
  flex: 1 1 0;
  min-width: 0;
  border-radius: 2px 2px 0 0;
  background: var(--primary);
  opacity: 0.72;
  transition: height 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.dash-mail__spark span:hover {
  opacity: 1;
}

.dash-mail__spark span.is-current {
  opacity: 0.35;
}

.dash-mail__spark span.is-empty {
  height: 2px;
  background: var(--line-strong);
  opacity: 1;
}

.dash-mail__spark-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  color: var(--muted);
  font-size: 11.5px;
}

.dash-mail__muted {
  margin: 0;
  color: var(--muted);
  font-size: 12.5px;
}

.dash-mail__footer {
  margin: 14px 0 0;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 900px) {
  .dash-mail__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dash-mail__body {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

@media (max-width: 520px) {
  .dash-mail__panel th:nth-child(4),
  .dash-mail__panel td:nth-child(4) {
    display: none;
  }
}
</style>
