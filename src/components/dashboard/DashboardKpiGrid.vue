<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Activity,
  Coins,
  Gauge,
  Repeat,
  UserPlus,
  Wallet,
} from 'lucide-vue-next'

import CountUpText from '../common/CountUpText.vue'
import { formatBytes } from '../../utils/format'
import {
  computeDelta,
  deltaTone,
  formatCount,
  formatDelta,
  formatMoney,
} from './dashboardFormat'

const props = defineProps({
  overview: { type: Object, required: true },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['open-new-users'])
const router = useRouter()

const cards = computed(function cards() {
  const { income, users, subscriptions, nodes, traffic } = props.overview
  const todayDelta = computeDelta(income.today.amount, income.yesterdaySameTime.amount)
  const monthDelta = computeDelta(income.month.amount, income.lastMonthSameTime.amount)
  const newUserDelta = computeDelta(users.newToday, users.newYesterdaySameTime)
  const monthUserDelta = computeDelta(users.newMonth, users.newLastMonthSameTime)

  return [
    {
      key: 'todayIncome',
      icon: Coins,
      label: '今日收入',
      value: formatMoney(income.today.amount),
      delta: todayDelta,
      deltaLabel: '较昨日同时段',
      lines: [
        `${formatCount(income.today.paidCount)} 笔付费订单${income.today.zeroCount ? ` · 另有 ${formatCount(income.today.zeroCount)} 笔 0 元单` : ''}`,
        `昨日同时段 ${formatMoney(income.yesterdaySameTime.amount)} · 昨日全天 ${formatMoney(income.yesterday.amount)}`,
      ],
    },
    {
      key: 'monthIncome',
      icon: Wallet,
      label: '本月收入',
      value: formatMoney(income.month.amount),
      delta: monthDelta,
      deltaLabel: '较上月同期',
      lines: [
        `${formatCount(income.month.paidCount)} 笔付费订单 · 佣金支出 ${formatMoney(income.commission.month)}`,
        `上月同期 ${formatMoney(income.lastMonthSameTime.amount)} · 上月全月 ${formatMoney(income.lastMonth.amount)}`,
      ],
    },
    {
      key: 'newUsers',
      icon: UserPlus,
      label: '今日新注册',
      value: formatCount(users.newToday),
      unit: '人',
      delta: newUserDelta,
      deltaLabel: '较昨日同时段',
      lines: [
        `本月 ${formatCount(users.newMonth)} 人（较上月同期 ${formatDelta(monthUserDelta)}）`,
        `昨日全天 ${formatCount(users.newYesterday)} 人 · 总用户 ${formatCount(users.total)}`,
      ],
      action: () => emit('open-new-users'),
      actionLabel: '查看近 30 天每日注册',
    },
    {
      key: 'subscriptions',
      icon: Repeat,
      label: '有效订阅',
      value: formatCount(subscriptions.active),
      unit: '人',
      lines: [
        `今日到期 ${formatCount(subscriptions.expiringToday)} · 7 天内到期 ${formatCount(subscriptions.expiring7d)}`,
        `已开自动续费 ${formatCount(subscriptions.autoRenew)} · 近 7 天到期未续 ${formatCount(subscriptions.lapsed7d)}`,
      ],
    },
    {
      key: 'online',
      icon: Activity,
      label: '当前在线',
      value: formatCount(users.online),
      unit: '人',
      lines: [
        `${formatCount(users.onlineDevices)} 台设备在线`,
        nodes.shown
          ? `节点在线 ${formatCount(nodes.online)} / ${formatCount(nodes.shown)}${nodes.offline ? ` · ${formatCount(nodes.offline)} 个离线` : ''}`
          : '还没有节点',
      ],
      warn: nodes.offline > 0,
      action: nodes.offline > 0 ? () => router.push({ name: 'nodes', query: { status: '0' } }) : null,
      actionLabel: '查看离线节点',
    },
    {
      key: 'traffic',
      icon: Gauge,
      label: '今日流量',
      value: formatBytes(traffic.today.total),
      lines: [
        `昨日全天 ${formatBytes(traffic.yesterday.total)}`,
        `本月 ${formatBytes(traffic.month.total)} · 上月同期 ${formatBytes(traffic.lastMonthSameTime.total)}`,
      ],
    },
  ]
})

function toneClass(delta, upIsGood = true) {
  return `dash-kpi__delta--${deltaTone(delta, upIsGood)}`
}
</script>

<template>
  <div v-loading="loading" class="dash-kpi-grid">
    <article
      v-for="card in cards"
      :key="card.key"
      class="dash-kpi"
      :class="{ 'dash-kpi--clickable': card.action, 'dash-kpi--warn': card.warn }"
      :role="card.action ? 'button' : undefined"
      :tabindex="card.action ? 0 : undefined"
      :title="card.action ? card.actionLabel : undefined"
      @click="card.action && card.action()"
      @keyup.enter="card.action && card.action()"
    >
      <header class="dash-kpi__head">
        <span class="dash-kpi__label">
          <component :is="card.icon" :size="15" />
          {{ card.label }}
        </span>
        <span
          v-if="card.deltaLabel"
          class="dash-kpi__delta"
          :class="toneClass(card.delta)"
        >
          {{ card.deltaLabel }} {{ formatDelta(card.delta) }}
        </span>
      </header>
      <strong class="dash-kpi__value">
        <CountUpText :text="card.value" /><small v-if="card.unit">{{ card.unit }}</small>
      </strong>
      <p v-for="(line, index) in card.lines" :key="index" class="dash-kpi__line">{{ line }}</p>
    </article>
  </div>
</template>

<style scoped>
.dash-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 1200px) {
  .dash-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .dash-kpi-grid {
    grid-template-columns: 1fr;
  }
}

.dash-kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 16px 18px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--panel);
  box-shadow: var(--shadow-xs);
}

.dash-kpi--clickable {
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.dash-kpi--clickable:hover {
  border-color: var(--line-strong);
  box-shadow: var(--shadow-sm);
}

.dash-kpi__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.dash-kpi__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 13px;
}

.dash-kpi__delta {
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--panel-strong);
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}

.dash-kpi__delta--good {
  background: var(--success-soft);
  color: #4f6d44;
}

.dash-kpi__delta--bad {
  background: var(--danger-soft);
  color: var(--primary-strong);
}

.dash-kpi__value {
  margin: 2px 0 2px;
  color: var(--text);
  font-family: "Inter", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}

.dash-kpi__value small {
  margin-left: 4px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 500;
}

.dash-kpi__line {
  margin: 0;
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.6;
}

.dash-kpi--warn .dash-kpi__line:last-child {
  color: var(--primary-strong);
}
</style>
