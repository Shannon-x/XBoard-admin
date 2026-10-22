<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight } from 'lucide-vue-next'

import { toUsersFiltered } from '../../utils/crossLink'
import { formatCount } from './dashboardFormat'

const props = defineProps({
  subscriptions: { type: Object, required: true },
  loading: { type: Boolean, default: false },
})

const router = useRouter()
const DAY = 86400

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

function endOfToday() {
  const date = new Date()
  date.setHours(23, 59, 59, 0)
  return Math.floor(date.getTime() / 1000)
}

/** 续费漏斗：今天到期 → 7 天内到期 → 已过期 7 天内没续的（召回对象） */
const pipeline = computed(function pipeline() {
  const subs = props.subscriptions
  const now = nowSeconds()
  return [
    {
      key: 'today',
      label: '今日到期',
      value: subs.expiringToday,
      to: toUsersFiltered({ expiredAfter: now, expiredBefore: endOfToday() }),
    },
    {
      key: 'week',
      label: '7 天内到期',
      value: subs.expiring7d,
      to: toUsersFiltered({ expiredAfter: now, expiredBefore: now + 7 * DAY }),
    },
    {
      key: 'lapsed',
      label: '近 7 天到期未续',
      value: subs.lapsed7d,
      hint: '召回对象',
      to: toUsersFiltered({ expiredAfter: now - 7 * DAY, expiredBefore: now }),
    },
    {
      key: 'auto',
      label: '已开自动续费',
      value: subs.autoRenew,
      hint: subs.active ? `占 ${((subs.autoRenew / subs.active) * 100).toFixed(1)}%` : '',
      to: toUsersFiltered({ autoRenew: true }),
    },
  ]
})

const planRows = computed(function planRows() {
  const rows = props.subscriptions.byPlan
  const total = props.subscriptions.active
  const max = Math.max(...rows.map(function toTotal(row) { return row.total }), 0)
  return rows.map(function toRow(row) {
    return {
      ...row,
      share: total > 0 ? (row.total / total) * 100 : 0,
      width: max > 0 ? Math.max((row.total / max) * 100, 2) : 0,
      to: toUsersFiltered({ planId: row.planId, activeOnly: true }),
    }
  })
})

function go(to) {
  if (to) router.push(to)
}
</script>

<template>
  <el-card v-loading="loading" class="section-card dash-subs" shadow="never">
    <div class="dash-subs__head">
      <div>
        <h3>订阅与续费</h3>
        <p>当前有效订阅 {{ formatCount(subscriptions.active) }} 人（未封禁、未到期）</p>
      </div>
    </div>

    <div class="dash-subs__pipeline">
      <button
        v-for="item in pipeline"
        :key="item.key"
        type="button"
        class="dash-subs__step"
        @click="go(item.to)"
      >
        <span>{{ item.label }}</span>
        <strong>{{ formatCount(item.value) }}</strong>
        <small>{{ item.hint || '查看名单' }} <ArrowRight :size="12" /></small>
      </button>
    </div>

    <div class="dash-subs__plans">
      <div class="dash-subs__plans-head">
        <span>按套餐</span>
        <span>人数 · 占比</span>
      </div>
      <ul v-if="planRows.length">
        <li v-for="row in planRows" :key="row.planId" @click="go(row.to)">
          <div class="dash-subs__plan-line">
            <span class="dash-subs__plan-name" :title="row.name">{{ row.name }}</span>
            <span class="dash-subs__plan-value">{{ formatCount(row.total) }} · {{ row.share.toFixed(1) }}%</span>
          </div>
          <div class="dash-subs__bar"><i :style="{ width: `${row.width}%` }"></i></div>
        </li>
      </ul>
      <el-empty v-else :image-size="56" description="还没有有效订阅" />
    </div>
  </el-card>
</template>

<style scoped>
.dash-subs :deep(.el-card__body) {
  padding: 18px 20px;
}

.dash-subs__head h3 {
  margin: 0;
  font-size: 17px;
}

.dash-subs__head p {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 12.5px;
}

.dash-subs__pipeline {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.dash-subs__step {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--muted);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.dash-subs__step:hover {
  border-color: var(--line-strong);
}

.dash-subs__step strong {
  color: var(--text);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
}

.dash-subs__step small {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
}

.dash-subs__plans {
  margin-top: 16px;
}

.dash-subs__plans-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 12px;
}

.dash-subs__plans ul {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 300px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.dash-subs__plans li {
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.dash-subs__plans li:hover {
  background: var(--panel-strong);
}

.dash-subs__plan-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.dash-subs__plan-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dash-subs__plan-value {
  flex: none;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.dash-subs__bar {
  height: 5px;
  margin-top: 4px;
  border-radius: 3px;
  background: var(--panel-strong);
}

.dash-subs__bar i {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
}
</style>
