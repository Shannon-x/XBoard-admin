<script setup>
import { formatAgo, formatCount, formatDuration, formatLatency, formatWaitSeconds } from './dashboardFormat'

/**
 * 每条队列一行：积压、预计等待（对照阈值）、探测任务（金丝雀）、处理速度、失败、进程。
 * 「探测」是巡检每分钟投进这条队列的空任务：它被执行了，才说明这条队列真的有人在取任务。
 */
const props = defineProps({
  queues: { type: Array, required: true },
  now: { type: Number, required: true },
})

function canaryText(queue) {
  const c = queue.canary
  if (!c) return { text: '不探测', hint: '升级前的旧队列，排空后删掉', tone: 'muted' }
  if (c.pendingSince) {
    const waited = Math.max(0, props.now - c.pendingSince)
    if (waited > queue.stallAfter) return { text: `已排队 ${formatDuration(waited)}`, hint: `超过 ${formatDuration(queue.stallAfter)} 算卡住`, tone: 'bad' }
    if (waited > 75) return { text: `已排队 ${formatDuration(waited)}`, hint: '还没被执行', tone: 'warn' }
  }
  if (c.ranAt) return { text: formatLatency(c.latencyMs), hint: formatAgo(c.ranAt, props.now), tone: 'ok' }
  return { text: '等待首次探测', hint: '', tone: 'muted' }
}

function rate(value) {
  if (value === null) return '—'
  return value >= 100 ? formatCount(Math.round(value)) : String(value)
}
</script>

<template>
  <div class="mq-wrap">
    <table class="mq">
      <thead>
        <tr>
          <th>队列</th>
          <th>等待中</th>
          <th>预计等待</th>
          <th title="巡检每分钟投一个空任务，看它排多久才被执行">探测延迟</th>
          <th>每分钟处理</th>
          <th>平均耗时</th>
          <th>近 1 小时失败</th>
          <th>进程</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="queue in queues" :key="queue.name" :class="`is-${queue.status}`">
          <td>
            <div class="mq__name">
              <span class="mq__dot" aria-hidden="true" />
              <span>
                <strong>{{ queue.label }}</strong>
                <code>{{ queue.name }}</code>
              </span>
            </div>
          </td>
          <td :class="{ 'is-hot': queue.length > 0 }">{{ queue.length === null ? '—' : formatCount(queue.length) }}</td>
          <td>
            <span :class="{ 'is-hot': queue.wait > queue.waitThreshold }">{{ queue.wait === null ? '—' : formatWaitSeconds(queue.wait) }}</span>
            <small>阈值 {{ formatDuration(queue.waitThreshold) }}</small>
          </td>
          <td :class="`tone-${canaryText(queue).tone}`">
            <span>{{ canaryText(queue).text }}</span>
            <small v-if="canaryText(queue).hint">{{ canaryText(queue).hint }}</small>
          </td>
          <td>{{ rate(queue.perMinute) }}</td>
          <td>{{ queue.runtimeMs === null ? '—' : formatLatency(queue.runtimeMs) }}</td>
          <td :class="{ 'is-hot': queue.failed1h > 0 }">{{ formatCount(queue.failed1h) }}</td>
          <td :class="{ 'is-hot': queue.processes === 0 }">{{ formatCount(queue.processes) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.mq-wrap {
  overflow-x: auto;
  margin: 0 -4px;
  padding: 0 4px;
}

.mq {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
  font-size: 13px;
}

.mq th {
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  text-align: right;
  white-space: nowrap;
}

.mq td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--line);
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  vertical-align: top;
}

.mq th:first-child,
.mq td:first-child {
  text-align: left;
}

.mq td small {
  display: block;
  color: var(--muted);
  font-size: 11.5px;
}

.mq__name {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.mq__name strong {
  display: block;
  color: var(--text);
  font-weight: 600;
}

.mq__name code {
  color: var(--muted);
  font-family: "Fira Code", ui-monospace, monospace;
  font-size: 11.5px;
}

.mq__dot {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--success);
}

tr.is-warning .mq__dot {
  background: var(--warning);
}

tr.is-critical .mq__dot {
  background: var(--danger);
  box-shadow: 0 0 0 3px rgba(201, 79, 46, 0.18);
}

tr.is-critical td {
  background: rgba(201, 79, 46, 0.05);
}

.is-hot {
  color: var(--primary-strong);
  font-weight: 600;
}

.tone-ok small,
.tone-muted,
.tone-muted small {
  color: var(--muted);
}

.tone-warn span {
  color: #8a5a22;
  font-weight: 600;
}

.tone-bad span,
.tone-bad small {
  color: var(--primary-strong);
  font-weight: 600;
}
</style>
