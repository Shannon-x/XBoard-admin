<script setup>
import { computed } from 'vue'
import { Bell, CalendarClock, Layers, Mail, Server } from 'lucide-vue-next'

import { formatCount } from './dashboardFormat'

/**
 * 仪表盘顶部的「运行状态」条：队列、定时任务、邮件投递、节点、告警通道各一枚，一眼看出哪里不对。
 * 点一下跳到下面对应的详情（jump 事件带区块 id）。数字都来自已经拉到的数据，不单独请求。
 */
const props = defineProps({
  monitor: { type: Object, required: true },
  mailRelay: { type: Object, required: true },
  nodes: { type: Object, required: true },
  nodesLoaded: { type: Boolean, default: false },
})

const emit = defineEmits(['jump'])

function item(key, label, icon, target, tone, text) {
  return { key, label, icon, target, tone, text }
}

const queueItem = computed(function queueItem() {
  const m = props.monitor
  const base = ['queue', '队列', Layers, 'dash-monitor']
  if (!m.loaded) return item(...base, 'unknown', '…')
  const horizon = m.horizon.status
  if (horizon === 'stopped') return item(...base, 'bad', 'Horizon 没在运行')
  if (horizon === 'paused') return item(...base, 'bad', 'Horizon 已暂停')
  if (horizon === 'unknown') return item(...base, 'bad', '状态读不到')
  const critical = m.queues.filter(function isCritical(q) { return q.status === 'critical' }).length
  if (critical) return item(...base, 'bad', `${critical} 条卡住`)
  const warning = m.queues.filter(function isWarning(q) { return q.status === 'warning' }).length
  if (warning) return item(...base, 'warn', `${warning} 条积压或失败多`)
  if (m.issues.some(function spike(i) { return i.key === 'failed:spike' })) return item(...base, 'warn', '失败任务激增')
  return item(...base, 'ok', '正常')
})

const scheduleItem = computed(function scheduleItem() {
  const m = props.monitor
  const base = ['schedule', '定时任务', CalendarClock, 'dash-monitor-schedule']
  if (!m.loaded) return item(...base, 'unknown', '…')
  if (m.scheduler.status === 'stopped') return item(...base, 'bad', '调度停了')
  const overdue = m.schedule.filter(function isOverdue(t) { return t.status === 'overdue' }).length
  if (overdue) return item(...base, 'bad', `${overdue} 条没按时跑`)
  if (m.scheduler.status === 'fallback') return item(...base, 'warn', '网页进程在代跑')
  const failed = m.schedule.filter(function isFailed(t) { return t.status === 'failed' }).length
  if (failed) return item(...base, 'warn', `${failed} 条最近失败`)
  if (m.scheduler.status === 'stale') return item(...base, 'warn', '心跳延迟')
  return item(...base, 'ok', '正常')
})

const mailItem = computed(function mailItem() {
  const s = props.mailRelay
  const base = ['mail', '邮件投递', Mail, 'dash-mail']
  if (!s.loaded) return item(...base, 'unknown', '…')
  if (s.anyEnabled && !s.online) return item(...base, 'bad', '投递服务离线')
  if (s.daily.full) return item(...base, 'bad', '24 小时额度用完')
  if (s.daily.bulkPaused) return item(...base, 'warn', '批量已暂停')
  if (s.online && s.bulkFactor < 1) return item(...base, 'warn', '被限流降速')
  return item(...base, 'ok', s.online ? '正常' : '面板直发')
})

const nodeItem = computed(function nodeItem() {
  const n = props.nodes
  const base = ['nodes', '节点', Server, 'dash-nodes']
  if (!props.nodesLoaded) return item(...base, 'unknown', '…')
  if (n.offline > 0) return item(...base, 'warn', `${formatCount(n.offline)} 个离线`)
  return item(...base, 'ok', `${formatCount(n.online)} 个全部在线`)
})

const alertItem = computed(function alertItem() {
  const a = props.monitor.alerting
  const base = ['alerting', '告警通道', Bell, 'dash-monitor']
  if (!props.monitor.loaded) return item(...base, 'unknown', '…')
  if (!a.telegram.botConfigured || a.telegram.recipients === 0) return item(...base, 'bad', '告警发不出去')
  if (a.telegram.last && a.telegram.last.direct === 0 && a.telegram.last.error) return item(...base, 'warn', '最近一次直发失败')
  if (!a.heartbeatConfigured) return item(...base, 'warn', '未配外部心跳')
  if (a.heartbeatLast && !a.heartbeatLast.ok) return item(...base, 'warn', '外部心跳上报失败')
  return item(...base, 'ok', '正常')
})

const items = computed(function items() {
  return [queueItem.value, scheduleItem.value, mailItem.value, nodeItem.value, alertItem.value]
})
</script>

<template>
  <section class="dash-status" aria-label="运行状态">
    <span class="dash-status__title">运行状态</span>
    <button
      v-for="entry in items"
      :key="entry.key"
      type="button"
      class="dash-status__pill"
      :class="`is-${entry.tone}`"
      @click="emit('jump', entry.target)"
    >
      <component :is="entry.icon" :size="14" class="dash-status__icon" />
      <span class="dash-status__label">{{ entry.label }}</span>
      <span class="dash-status__dot" aria-hidden="true" />
      <span class="dash-status__text">{{ entry.text }}</span>
    </button>
    <slot />
  </section>
</template>

<style scoped>
.dash-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 10px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--panel);
  box-shadow: var(--shadow-xs);
}

.dash-status__title {
  margin-right: 4px;
  color: var(--text);
  font-family: var(--serif-family);
  font-size: 15px;
  font-weight: 600;
}

.dash-status__pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: #fff;
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.dash-status__pill:hover {
  border-color: var(--line-strong);
}

.dash-status__icon {
  color: var(--muted);
}

.dash-status__label {
  color: var(--text);
  font-weight: 500;
}

.dash-status__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--line-strong);
}

.dash-status__pill.is-ok .dash-status__dot {
  background: var(--success);
}

.dash-status__pill.is-warn {
  border-color: rgba(217, 156, 92, 0.45);
  background: var(--warning-soft);
}

.dash-status__pill.is-warn .dash-status__dot {
  background: var(--warning);
}

.dash-status__pill.is-warn .dash-status__text {
  color: #8a5a22;
}

.dash-status__pill.is-bad {
  border-color: rgba(201, 79, 46, 0.4);
  background: var(--danger-soft);
}

.dash-status__pill.is-bad .dash-status__dot {
  background: var(--danger);
  box-shadow: 0 0 0 3px rgba(201, 79, 46, 0.18);
}

.dash-status__pill.is-bad .dash-status__text {
  color: var(--primary-strong);
  font-weight: 600;
}
</style>
