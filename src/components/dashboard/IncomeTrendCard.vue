<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'

import { createEmptyIncomeTrend, fetchIncomeTrend } from '../../services/dashboardOverview'
import {
  computeDelta,
  deltaTone,
  formatCount,
  formatDelta,
  formatMoney,
  formatMoneyShort,
} from './dashboardFormat'

const props = defineProps({
  refreshKey: { type: Number, default: 0 },
})

const RANGE_OPTIONS = [
  { label: '7 天', value: 7 },
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
  { label: '半年', value: 180 },
  { label: '一年', value: 365 },
  { label: '自定义', value: 'custom' },
]

const METRIC_OPTIONS = [
  { label: '收入', value: 'amount' },
  { label: '订单数', value: 'count' },
]

const rangeKey = ref(30)
const customRange = ref([])
const metric = ref('amount')
const trend = ref(createEmptyIncomeTrend())
const loading = ref(false)
const error = ref('')
let requestSeq = 0

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function resolveRange() {
  if (rangeKey.value === 'custom' && customRange.value?.length === 2) {
    return { startDate: customRange.value[0], endDate: customRange.value[1] }
  }
  const days = rangeKey.value === 'custom' ? 30 : Number(rangeKey.value)
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (days - 1))
  return { startDate: formatDate(start), endDate: formatDate(end) }
}

async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchIncomeTrend(resolveRange())
    if (seq !== requestSeq) return
    trend.value = result
  } catch (err) {
    if (seq !== requestSeq) return
    error.value = err?.message || '收入趋势加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function handleRangeChange(value) {
  rangeKey.value = value
  if (value !== 'custom') {
    load()
  }
}

function applyCustomRange(value) {
  customRange.value = value || []
  if (customRange.value.length === 2) {
    load()
  }
}

watch(() => props.refreshKey, load)
onMounted(load)

/* ───────── 汇总 ───────── */

const summaryItems = computed(function summaryItems() {
  const { summary, previous, range } = trend.value
  const compareLabel = `较前 ${range.days || ''} 天`
  // 含今天时后端只拿上一段「过去同样长的时间」来比（最后一天截到同一时刻），文案里写明「同期」
  const previousName = `前 ${range.days || ''} 天${range.includesToday ? '同期' : ''}`
  const commissionShare = summary.amount > 0 ? (summary.commissionTotal / summary.amount) * 100 : 0
  return [
    {
      key: 'amount',
      label: '实收',
      value: formatMoney(summary.amount),
      delta: computeDelta(summary.amount, previous.amount),
      compareLabel,
      note: `${previousName} ${formatMoney(previous.amount)}`,
    },
    {
      key: 'count',
      label: '付费订单',
      value: `${formatCount(summary.paidCount)} 笔`,
      delta: computeDelta(summary.paidCount, previous.paidCount),
      compareLabel,
      note: summary.zeroCount ? `另有 ${formatCount(summary.zeroCount)} 笔 0 元单（余额抵扣、赠送）未计入` : '只数实付大于 0 的订单（含余额充值）',
    },
    {
      key: 'avg',
      label: '客单价',
      value: formatMoney(summary.avgAmount),
      delta: computeDelta(summary.avgAmount, previous.avgAmount),
      compareLabel,
      note: `${previousName} ${formatMoney(previous.avgAmount)}`,
    },
    {
      key: 'users',
      label: '付费用户',
      value: `${formatCount(summary.payingUsers)} 人`,
      note: summary.payingUsers ? `人均 ${(summary.paidCount / summary.payingUsers).toFixed(2)} 笔` : '',
    },
    {
      key: 'commission',
      label: '佣金支出',
      value: formatMoney(summary.commissionTotal),
      delta: computeDelta(summary.commissionTotal, previous.commissionTotal),
      compareLabel,
      upIsGood: false,
      note: `占实收 ${commissionShare.toFixed(1)}% · ${formatCount(summary.commissionCount)} 笔`,
    },
  ]
})

const rangeText = computed(function rangeText() {
  const { range } = trend.value
  if (!range.startDate) return '--'
  return `${range.startDate} 至 ${range.endDate}${range.includesToday ? '（含今天，今日数据为实时）' : ''}`
})

/* ───────── 收入构成 ───────── */

const typeRows = computed(function typeRows() {
  const total = trend.value.summary.amount
  const rows = trend.value.byType.filter(function hasValue(row) { return row.count > 0 || row.zeroCount > 0 })
  const max = Math.max(...rows.map(function toAmount(row) { return row.amount }), 0)
  return rows
    .slice()
    .sort(function byAmount(a, b) { return b.amount - a.amount })
    .map(function toRow(row) {
      return {
        ...row,
        share: total > 0 ? (row.amount / total) * 100 : 0,
        width: max > 0 ? Math.max((row.amount / max) * 100, row.amount > 0 ? 2 : 0) : 0,
      }
    })
})

/* ───────── 图表 ───────── */

const chartEl = ref(null)
const chartWidth = ref(720)
const CHART_HEIGHT = 240
const PAD = { top: 16, right: 12, bottom: 28, left: 56 }
let resizeObserver = null

onMounted(function observeWidth() {
  if (!chartEl.value || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(function onResize(entries) {
    const width = Math.round(entries[0]?.contentRect?.width || 0)
    if (width > 0) chartWidth.value = width
  })
  resizeObserver.observe(chartEl.value)
})

onBeforeUnmount(function stopObserving() {
  resizeObserver?.disconnect()
})

/** 超过 92 天按周汇总，否则一年 365 根柱子挤成一片 */
const buckets = computed(function buckets() {
  const list = trend.value.list.filter(function notFuture(point) { return !point.future })
  if (list.length <= 92) {
    return list.map(function toBucket(point) {
      return {
        key: point.date,
        label: point.date.slice(5),
        title: point.date,
        paidTotal: point.paidTotal,
        paidCount: point.paidCount,
        zeroCount: point.zeroCount,
        commissionTotal: point.commissionTotal,
        partial: point.partial,
      }
    })
  }
  const weeks = []
  let current = null
  list.forEach(function addPoint(point) {
    const date = new Date(`${point.date}T00:00:00`)
    const isMonday = date.getDay() === 1
    if (!current || isMonday) {
      current = {
        key: point.date,
        label: point.date.slice(5),
        start: point.date,
        end: point.date,
        paidTotal: 0,
        paidCount: 0,
        zeroCount: 0,
        commissionTotal: 0,
        partial: false,
      }
      weeks.push(current)
    }
    current.end = point.date
    current.paidTotal += point.paidTotal
    current.paidCount += point.paidCount
    current.zeroCount += point.zeroCount
    current.commissionTotal += point.commissionTotal
    current.partial = current.partial || point.partial
  })
  return weeks.map(function withTitle(week) {
    return { ...week, title: `${week.start} 至 ${week.end}（周）` }
  })
})

const isWeekly = computed(function isWeekly() {
  return trend.value.list.filter(function notFuture(point) { return !point.future }).length > 92
})

function valueOf(bucket) {
  return metric.value === 'count' ? bucket.paidCount : bucket.paidTotal
}

function niceStep(max, targetTicks) {
  const rough = Math.max(max, 1) / targetTicks
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  return factor * magnitude
}

const scale = computed(function scale() {
  const max = Math.max(...buckets.value.map(valueOf), 0)
  const step = niceStep(max, 4)
  const tickCount = Math.max(1, Math.ceil(max / step))
  return { step, axisMax: step * tickCount, tickCount }
})

const plot = computed(function plot() {
  const width = Math.max(chartWidth.value, 320)
  const plotWidth = width - PAD.left - PAD.right
  const plotHeight = CHART_HEIGHT - PAD.top - PAD.bottom
  const baseline = PAD.top + plotHeight
  const count = Math.max(buckets.value.length, 1)
  const slot = plotWidth / count
  const barWidth = Math.max(2, Math.min(24, slot - 2))
  const { axisMax, step, tickCount } = scale.value

  const yOf = function yOf(value) {
    return baseline - (axisMax > 0 ? (value / axisMax) * plotHeight : 0)
  }

  const ticks = []
  for (let i = 0; i <= tickCount; i += 1) {
    const value = step * i
    ticks.push({
      value,
      y: yOf(value),
      label: metric.value === 'count' ? formatCount(value) : formatMoneyShort(value),
    })
  }

  // x 轴标签：按可用宽度隔几个显示一个，避免旧版 30 个日期挤成一行
  const labelEvery = Math.max(1, Math.ceil(52 / slot))
  const bars = buckets.value.map(function toBar(bucket, index) {
    const value = valueOf(bucket)
    const top = yOf(value)
    const height = value > 0 ? Math.max(baseline - top, 2) : 0
    const center = PAD.left + slot * index + slot / 2
    return {
      ...bucket,
      value,
      x: center - barWidth / 2,
      center,
      y: baseline - height,
      width: barWidth,
      height,
      slotX: PAD.left + slot * index,
      slotWidth: slot,
      showLabel: (buckets.value.length - 1 - index) % labelEvery === 0,
    }
  })

  const total = buckets.value.reduce(function sum(acc, bucket) { return acc + valueOf(bucket) }, 0)
  const completeBuckets = buckets.value.filter(function complete(bucket) { return !bucket.partial })
  const completeTotal = completeBuckets.reduce(function sum(acc, bucket) { return acc + valueOf(bucket) }, 0)
  const average = completeBuckets.length ? completeTotal / completeBuckets.length : 0

  return {
    width,
    height: CHART_HEIGHT,
    baseline,
    ticks,
    bars,
    total,
    average,
    averageY: yOf(average),
    plotRight: width - PAD.right,
  }
})

function barPath(bar) {
  // 顶端 4px 圆角、底端直角，长在同一条基线上
  const r = Math.min(4, bar.width / 2, bar.height)
  const x = bar.x
  const y = bar.y
  const w = bar.width
  const h = bar.height
  if (h <= 0) return ''
  return `M ${x} ${y + h} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h} Z`
}

const hoverIndex = ref(-1)
const hoverBar = computed(function hoverBar() {
  return hoverIndex.value >= 0 ? plot.value.bars[hoverIndex.value] : null
})

const tooltipStyle = computed(function tooltipStyle() {
  const bar = hoverBar.value
  if (!bar) return {}
  const left = Math.min(Math.max(bar.center, 90), plot.value.width - 90)
  return { left: `${left}px`, top: `${Math.max(bar.y - 8, 8)}px` }
})

const averageLabel = computed(function averageLabel() {
  const unit = isWeekly.value ? '周均' : '日均'
  if (metric.value === 'count') return `${unit} ${formatCount(Math.round(plot.value.average))} 笔`
  return `${unit} ${formatMoney(Math.round(plot.value.average))}`
})

function toneOf(item) {
  return deltaTone(item.delta, item.upIsGood !== false)
}
</script>

<template>
  <el-card class="section-card dash-income" shadow="never">
    <div class="dash-income__head">
      <div>
        <h3>收入趋势</h3>
        <p>{{ rangeText }}</p>
      </div>
      <div class="dash-income__controls">
        <el-segmented
          :model-value="rangeKey"
          :options="RANGE_OPTIONS"
          size="small"
          @change="handleRangeChange"
        />
        <el-date-picker
          v-if="rangeKey === 'custom'"
          :model-value="customRange"
          type="daterange"
          size="small"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          unlink-panels
          style="width: 240px"
          @update:model-value="applyCustomRange"
        />
        <el-segmented v-model="metric" :options="METRIC_OPTIONS" size="small" />
        <el-button :icon="RefreshCw" size="small" plain :loading="loading" @click="load">刷新</el-button>
      </div>
    </div>

    <el-alert v-if="error" type="warning" :closable="false" show-icon :title="error" style="margin-bottom: 12px" />

    <div class="dash-income__summary" :class="{ 'is-loading': loading && trend.loaded }">
      <div v-for="item in summaryItems" :key="item.key" class="dash-income__stat">
        <span class="dash-income__stat-label">{{ item.label }}</span>
        <strong class="dash-income__stat-value">{{ item.value }}</strong>
        <span v-if="item.compareLabel" class="dash-income__delta" :class="`is-${toneOf(item)}`">
          {{ item.compareLabel }} {{ formatDelta(item.delta) }}
        </span>
        <small v-if="item.note">{{ item.note }}</small>
      </div>
    </div>

    <div class="dash-income__body">
      <div class="dash-income__chart-wrap">
        <div class="dash-income__chart-caption">
          <span>{{ metric === 'count' ? '每' + (isWeekly ? '周' : '日') + '付费订单数' : '每' + (isWeekly ? '周' : '日') + '实收' }}</span>
          <span class="dash-income__legend-today"><i></i>今天（进行中）</span>
        </div>
        <div
          ref="chartEl"
          v-loading="loading && !trend.loaded"
          class="dash-income__chart"
          :class="{ 'is-loading': loading && trend.loaded }"
          @mouseleave="hoverIndex = -1"
        >
          <svg
            :width="plot.width"
            :height="plot.height"
            :viewBox="`0 0 ${plot.width} ${plot.height}`"
            role="img"
            :aria-label="`收入趋势，${rangeText}`"
          >
            <g class="dash-income__grid">
              <line
                v-for="tick in plot.ticks"
                :key="`g-${tick.value}`"
                :x1="56"
                :x2="plot.plotRight"
                :y1="tick.y"
                :y2="tick.y"
              />
            </g>
            <g class="dash-income__yaxis">
              <text
                v-for="tick in plot.ticks"
                :key="`t-${tick.value}`"
                :x="48"
                :y="tick.y"
                text-anchor="end"
                dominant-baseline="middle"
              >{{ tick.label }}</text>
            </g>
            <g>
              <path
                v-for="(bar, index) in plot.bars"
                :key="bar.key"
                :d="barPath(bar)"
                :style="{ '--i': index }"
                class="dash-income__bar"
                :class="{ 'is-partial': bar.partial, 'is-hover': index === hoverIndex }"
              />
            </g>
            <g v-if="plot.average > 0" class="dash-income__avg">
              <line :x1="56" :x2="plot.plotRight" :y1="plot.averageY" :y2="plot.averageY" />
              <text :x="plot.plotRight" :y="plot.averageY - 6" text-anchor="end">{{ averageLabel }}</text>
            </g>
            <g class="dash-income__xaxis">
              <text
                v-for="bar in plot.bars.filter((item) => item.showLabel)"
                :key="`x-${bar.key}`"
                :x="bar.center"
                :y="plot.baseline + 18"
                text-anchor="middle"
              >{{ bar.partial && !isWeekly ? '今天' : bar.label }}</text>
            </g>
            <g>
              <rect
                v-for="(bar, index) in plot.bars"
                :key="`h-${bar.key}`"
                :x="bar.slotX"
                y="0"
                :width="bar.slotWidth"
                :height="plot.baseline"
                fill="transparent"
                @mouseenter="hoverIndex = index"
              />
            </g>
          </svg>
          <div v-if="hoverBar" class="dash-income__tooltip" :style="tooltipStyle">
            <strong>{{ hoverBar.title }}{{ hoverBar.partial ? '（进行中）' : '' }}</strong>
            <span>实收 {{ formatMoney(hoverBar.paidTotal) }}</span>
            <span>付费订单 {{ formatCount(hoverBar.paidCount) }} 笔<template v-if="hoverBar.zeroCount"> · 0 元单 {{ formatCount(hoverBar.zeroCount) }}</template></span>
            <span v-if="hoverBar.paidCount">客单价 {{ formatMoney(Math.round(hoverBar.paidTotal / hoverBar.paidCount)) }}</span>
            <span>佣金 {{ formatMoney(hoverBar.commissionTotal) }}</span>
          </div>
          <el-empty
            v-if="trend.loaded && !plot.total"
            class="dash-income__empty"
            :image-size="56"
            description="这段时间没有付费订单"
          />
        </div>
      </div>

      <aside class="dash-income__types">
        <h4>收入构成</h4>
        <p class="dash-income__types-hint">按订单类型，实付金额；余额充值按充值金额计（不含赠送），用余额付的订单记 0，不重复计算</p>
        <ul v-if="typeRows.length">
          <li v-for="row in typeRows" :key="row.type">
            <div class="dash-income__type-head">
              <span>{{ row.label }}</span>
              <strong>{{ formatMoney(row.amount) }}</strong>
            </div>
            <div class="dash-income__type-bar"><i :style="{ width: `${row.width}%` }"></i></div>
            <small>{{ formatCount(row.count) }} 笔 · 占 {{ row.share.toFixed(1) }}%<template v-if="row.zeroCount"> · 0 元单 {{ formatCount(row.zeroCount) }}</template></small>
          </li>
        </ul>
        <p v-else class="dash-income__types-empty">暂无数据</p>
      </aside>
    </div>
  </el-card>
</template>

<style scoped>
.dash-income :deep(.el-card__body) {
  padding: 18px 20px 16px;
}

.dash-income__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.dash-income__head h3 {
  margin: 0;
  font-size: 17px;
}

.dash-income__head p {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 12.5px;
}

.dash-income__controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dash-income__summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--line);
  transition: opacity 0.15s ease;
}

.dash-income__summary.is-loading,
.dash-income__chart.is-loading {
  opacity: 0.55;
}

@media (max-width: 1100px) {
  .dash-income__summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.dash-income__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 12px 14px;
  background: #fff;
}

.dash-income__stat-label {
  color: var(--muted);
  font-size: 12.5px;
}

.dash-income__stat-value {
  color: var(--text);
  font-family: "Inter", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
}

.dash-income__stat small {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.dash-income__delta {
  align-self: flex-start;
  padding: 0 7px;
  border-radius: var(--radius-pill);
  background: var(--panel-strong);
  color: var(--muted);
  font-size: 12px;
}

.dash-income__delta.is-good {
  background: var(--success-soft);
  color: #4f6d44;
}

.dash-income__delta.is-bad {
  background: var(--danger-soft);
  color: var(--primary-strong);
}

.dash-income__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 20px;
  margin-top: 16px;
}

@media (max-width: 1100px) {
  .dash-income__body {
    grid-template-columns: 1fr;
  }
}

.dash-income__chart-caption {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-size: 12px;
}

.dash-income__legend-today {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dash-income__legend-today i {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: var(--primary);
  opacity: 0.4;
}

.dash-income__chart {
  position: relative;
  width: 100%;
  min-height: 240px;
  margin-top: 4px;
  transition: opacity 0.15s ease;
}

.dash-income__chart svg {
  display: block;
  overflow: visible;
}

.dash-income__grid line {
  stroke: var(--line);
  stroke-width: 1;
  shape-rendering: crispEdges;
}

.dash-income__yaxis text,
.dash-income__xaxis text {
  fill: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.dash-income__bar {
  fill: var(--primary);
  opacity: 0.82;
  transition: opacity 0.12s ease;
  /* 柱子从横轴往上长出来，从左到右依次；换时间范围时新柱子重新长 */
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: incomeBarGrow 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--i, 0) * 14ms);
}

@keyframes incomeBarGrow {
  from {
    transform: scaleY(0);
  }
}

.dash-income__bar.is-partial {
  opacity: 0.38;
}

.dash-income__bar.is-hover {
  opacity: 1;
}

.dash-income__avg line {
  stroke: var(--info);
  stroke-width: 1;
  opacity: 0.7;
  shape-rendering: crispEdges;
}

.dash-income__avg text {
  fill: var(--info);
  font-size: 11px;
}

.dash-income__tooltip {
  position: absolute;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 160px;
  padding: 8px 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  background: #fff;
  box-shadow: var(--shadow-md);
  color: var(--text);
  font-size: 12px;
  line-height: 1.55;
  pointer-events: none;
  transform: translate(-50%, -100%);
}

.dash-income__tooltip strong {
  font-size: 12.5px;
}

.dash-income__tooltip span {
  color: var(--muted);
}

.dash-income__empty {
  position: absolute;
  inset: 0;
  padding: 0;
}

.dash-income__types h4 {
  margin: 0;
  font-family: var(--serif-family);
  font-size: 14px;
  font-weight: 600;
}

.dash-income__types-hint,
.dash-income__types-empty {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 12px;
}

.dash-income__types ul {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dash-income__type-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}

.dash-income__type-head strong {
  font-weight: 600;
}

.dash-income__type-bar {
  height: 6px;
  margin: 4px 0 2px;
  border-radius: 3px;
  background: var(--panel-strong);
}

.dash-income__type-bar i {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--primary);
  opacity: 0.82;
}

.dash-income__types small {
  color: var(--muted);
  font-size: 12px;
}
</style>
