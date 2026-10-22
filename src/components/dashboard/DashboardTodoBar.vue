<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, CircleCheck } from 'lucide-vue-next'

import { formatCount, formatMoney } from './dashboardFormat'

const props = defineProps({
  todo: { type: Object, required: true },
  nodes: { type: Object, required: true },
  failedJobs: { type: Number, default: 0 },
  failedWindowText: { type: String, default: '' },
  loaded: { type: Boolean, default: false },
})

const router = useRouter()

/**
 * 待办：只列「需要人去点一下」的事。数量为 0 的不显示；
 * urgent 的排前面并用暖色，其余是安静的灰色提示。
 */
const items = computed(function items() {
  const todo = props.todo
  const list = [
    {
      key: 'tickets',
      count: todo.ticketsWaiting,
      label: '个工单等待回复',
      hint: todo.ticketsOpen > todo.ticketsWaiting ? `开启中共 ${formatCount(todo.ticketsOpen)} 个` : '',
      urgent: true,
      to: { name: 'tickets' },
    },
    {
      key: 'withdrawals',
      count: todo.withdrawalsPending,
      label: '笔提现待审核',
      hint: todo.withdrawalsAmount ? `合计 ${formatMoney(todo.withdrawalsAmount)}` : '',
      urgent: true,
      to: { name: 'withdrawals' },
    },
    {
      key: 'period',
      count: todo.periodCommissionPending,
      label: '个周期返佣申请待审核',
      urgent: true,
      to: { name: 'periodCommission' },
    },
    {
      key: 'nodes',
      count: props.nodes.offline,
      label: '个节点离线',
      hint: props.nodes.shown ? `共 ${formatCount(props.nodes.shown)} 个` : '',
      urgent: true,
      to: { name: 'nodes', query: { status: '0' } },
    },
    {
      key: 'failed',
      count: props.failedJobs,
      label: '个队列任务失败',
      hint: props.failedWindowText ? `近 ${props.failedWindowText}` : '',
      urgent: false,
      to: { name: 'logs', query: { tab: 'failed' } },
    },
    {
      key: 'mail',
      count: todo.mailSuppressed,
      label: '个邮箱已暂停投递',
      urgent: false,
      to: { name: 'mailDelivery', query: { tab: 'suppressed' } },
    },
    {
      key: 'commission',
      count: todo.commissionUnconfirmed,
      label: '笔佣金待确认',
      hint: '到期自动确认',
      urgent: false,
      to: { name: 'orders', query: { commission: '1' } },
    },
  ]
  return list
    .filter(function hasCount(item) { return item.count > 0 })
    .sort(function urgentFirst(a, b) { return Number(b.urgent) - Number(a.urgent) })
})

function go(item) {
  router.push(item.to)
}
</script>

<template>
  <section class="dash-todo" :class="{ 'dash-todo--empty': loaded && !items.length }">
    <span class="dash-todo__title">待处理</span>
    <template v-if="items.length">
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        class="dash-todo__chip"
        :class="{ 'dash-todo__chip--urgent': item.urgent }"
        @click="go(item)"
      >
        <strong>{{ formatCount(item.count) }}</strong>
        <span>{{ item.label }}</span>
        <small v-if="item.hint">{{ item.hint }}</small>
        <ArrowRight class="dash-todo__arrow" :size="14" />
      </button>
    </template>
    <span v-else-if="loaded" class="dash-todo__clear">
      <CircleCheck :size="16" />
      没有需要处理的事项
    </span>
    <span v-else class="dash-todo__clear">加载中…</span>
  </section>
</template>

<style scoped>
.dash-todo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--panel);
  box-shadow: var(--shadow-xs);
}

.dash-todo__title {
  margin-right: 4px;
  color: var(--text);
  font-family: var(--serif-family);
  font-size: 15px;
  font-weight: 600;
}

.dash-todo__chip {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 6px 12px;
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

.dash-todo__chip:hover {
  border-color: var(--line-strong);
  background: var(--panel-raised);
}

.dash-todo__chip strong {
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
}

.dash-todo__chip small {
  color: var(--muted);
  font-size: 12px;
}

.dash-todo__chip--urgent {
  border-color: rgba(201, 79, 46, 0.28);
  background: var(--primary-soft);
  color: var(--text);
}

.dash-todo__chip--urgent strong {
  color: var(--primary-strong);
}

.dash-todo__arrow {
  align-self: center;
  color: var(--muted);
}

.dash-todo__clear {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 13px;
}

.dash-todo--empty .dash-todo__clear {
  color: var(--success);
}
</style>
