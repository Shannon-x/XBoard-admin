<script setup>
import { computed, ref } from 'vue'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'

import { formatAgo, formatDuration, formatSchedule } from './dashboardFormat'

/**
 * 每条定时任务：频率、上次开始、耗时、结果。有问题的（没按时跑 / 失败 / 运行中）排前面并默认展开，
 * 其余收起成一句「N 条按时运行」，点开看全部。
 */
const props = defineProps({
  tasks: { type: Array, required: true },
  now: { type: Number, required: true },
})

const expanded = ref(false)

const STATUS = {
  overdue: { text: '没按时跑', tone: 'bad' },
  failed: { text: '失败', tone: 'warn' },
  running: { text: '运行中', tone: 'info' },
  never: { text: '等待首次运行', tone: 'muted' },
  ok: { text: '成功', tone: 'ok' },
}

const flagged = computed(function flagged() {
  return props.tasks.filter(function needsEye(t) { return t.status === 'overdue' || t.status === 'failed' || t.status === 'running' })
})

const healthyCount = computed(function healthyCount() {
  return props.tasks.length - flagged.value.length
})

const visible = computed(function visible() {
  return expanded.value ? props.tasks : flagged.value
})

function resultText(task) {
  if (task.status === 'failed') return `失败（退出码 ${task.exitCode}）${task.failures > 1 ? ` ×${task.failures}` : ''}`
  if (task.status === 'overdue' && task.running) return '没按时跑：上一次还没结束'
  if (task.status === 'overdue') return '没按时跑：到点没启动'
  return STATUS[task.status]?.text || task.status
}

function durationText(task) {
  if (task.running) return `已运行 ${formatDuration(task.duration)}`
  return task.duration === null ? '—' : formatDuration(task.duration)
}
</script>

<template>
  <div class="ms">
    <div v-if="visible.length" class="ms-wrap">
      <table class="ms-table">
        <thead>
          <tr>
            <th>任务</th>
            <th>频率</th>
            <th>上次开始</th>
            <th>耗时</th>
            <th>结果</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in visible" :key="task.command" :class="`is-${STATUS[task.status]?.tone || 'muted'}`">
            <td>
              <div class="ms__name">
                <span class="ms__dot" aria-hidden="true" />
                <span>
                  <strong>{{ task.label }}</strong>
                  <code :title="task.args ? `${task.command} ${task.args}` : task.command">{{ task.command }}</code>
                </span>
              </div>
            </td>
            <td>{{ formatSchedule(task.expression, task.interval) }}</td>
            <td>{{ task.startedAt ? formatAgo(task.startedAt, now) : '还没跑过' }}</td>
            <td>{{ durationText(task) }}</td>
            <td class="ms__result">
              {{ resultText(task) }}
              <small v-if="task.status === 'failed' && task.lastSuccessAt">上次成功 {{ formatAgo(task.lastSuccessAt, now) }}</small>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button v-if="tasks.length" type="button" class="ms__toggle" @click="expanded = !expanded">
      <template v-if="expanded">
        收起 <ChevronUp :size="14" />
      </template>
      <template v-else>
        <span v-if="flagged.length">另外 {{ healthyCount }} 条按时运行</span>
        <span v-else>{{ tasks.length }} 条定时任务全部按时运行</span>
        · 查看全部 <ChevronDown :size="14" />
      </template>
    </button>
    <p v-else class="ms__muted">没有拿到定时任务数据</p>
  </div>
</template>

<style scoped>
.ms-wrap {
  overflow-x: auto;
  margin: 0 -4px 6px;
  padding: 0 4px;
}

.ms-table {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  font-size: 13px;
}

.ms-table th {
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
}

.ms-table td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--line);
  font-variant-numeric: tabular-nums;
  vertical-align: top;
  white-space: nowrap;
}

.ms__name {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.ms__name strong {
  display: block;
  color: var(--text);
  font-weight: 600;
}

.ms__name code {
  color: var(--muted);
  font-family: "Fira Code", ui-monospace, monospace;
  font-size: 11.5px;
}

.ms__dot {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--line-strong);
}

tr.is-ok .ms__dot {
  background: var(--success);
}

tr.is-info .ms__dot {
  background: var(--info);
}

tr.is-warn .ms__dot {
  background: var(--warning);
}

tr.is-bad .ms__dot {
  background: var(--danger);
  box-shadow: 0 0 0 3px rgba(201, 79, 46, 0.18);
}

tr.is-bad td {
  background: rgba(201, 79, 46, 0.05);
}

tr.is-bad .ms__result {
  color: var(--primary-strong);
  font-weight: 600;
}

tr.is-warn .ms__result {
  color: #8a5a22;
  font-weight: 600;
}

.ms__result small {
  display: block;
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 400;
}

.ms__toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
  border: 0;
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
}

.ms__toggle:hover {
  color: var(--text);
}

.ms__muted {
  margin: 0;
  color: var(--muted);
  font-size: 12.5px;
}
</style>
