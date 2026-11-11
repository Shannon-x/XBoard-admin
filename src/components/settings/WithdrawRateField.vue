<script setup>
import { computed, onMounted, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'

import { fetchWithdrawalRate } from '../../services/withdrawals'

const props = defineProps({
  // 自动模式下是兜底汇率；手动模式下就是固定汇率本身
  modelValue: {
    type: [Number, String],
    default: 0,
  },
  source: {
    type: String,
    default: 'auto',
  },
  // 自动行情的上浮：percent = 加 N%，fixed = 加 N（站点货币）
  markupType: {
    type: String,
    default: 'percent',
  },
  markup: {
    type: [Number, String],
    default: 0,
  },
})

const emit = defineEmits(['update:modelValue', 'update:markupType', 'update:markup'])

// 预览用的示例金额（站点货币）
const SAMPLE_AMOUNT = 100

const loading = ref(false)
const error = ref('')
const snapshot = ref(null)

const isAuto = computed(function isAuto() {
  return props.source !== 'manual'
})

const symbol = computed(function symbol() {
  return snapshot.value?.currencySymbol || '¥'
})

// 行情原价：后端已按已保存的上浮算过 rate，这里要的是上浮前的数，好按表单里还没保存的上浮实时预览
const marketRate = computed(function marketRate() {
  const value = snapshot.value?.marketRate ?? snapshot.value?.rate
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
})

const markupNumber = computed(function markupNumber() {
  const n = Number(props.markup)
  return Number.isFinite(n) && n > 0 ? n : 0
})

const effectiveRate = computed(function effectiveRate() {
  if (marketRate.value === null) {
    return null
  }
  if (markupNumber.value <= 0) {
    return marketRate.value
  }
  const rate = props.markupType === 'fixed'
    ? marketRate.value + markupNumber.value
    : marketRate.value * (1 + markupNumber.value / 100)
  return Math.round(rate * 10000) / 10000
})

function formatRate(value) {
  if (value === null || value === undefined) {
    return '—'
  }
  return String(Math.round(Number(value) * 10000) / 10000)
}

function usdtFor(rate) {
  if (!rate) {
    return '—'
  }
  return (SAMPLE_AMOUNT / rate).toFixed(2)
}

const savingPercent = computed(function savingPercent() {
  if (!marketRate.value || !effectiveRate.value || effectiveRate.value <= marketRate.value) {
    return 0
  }
  return Math.round((1 - marketRate.value / effectiveRate.value) * 1000) / 10
})

const ageText = computed(function ageText() {
  if (!snapshot.value || !snapshot.value.fetchedAt) {
    return ''
  }
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(snapshot.value.fetchedAt))
  if (seconds < 60) {
    return '刚刚更新'
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} 分钟前更新`
  }
  return `${Math.floor(seconds / 3600)} 小时前更新`
})

async function load(force) {
  loading.value = true
  error.value = ''
  try {
    snapshot.value = await fetchWithdrawalRate({ force })
    if (isAuto.value && (snapshot.value.rate === null || snapshot.value.rate === undefined)) {
      // 带上失败原因，管理员才知道是服务器出不了网还是缺 CA 证书
      error.value = snapshot.value.error
        ? `暂时取不到实时行情，已回退到下面的兜底汇率。原因：${snapshot.value.error}`
        : '暂时取不到实时行情，已回退到下面的兜底汇率'
    }
  } catch (e) {
    error.value = e && e.message ? e.message : '获取失败'
  } finally {
    loading.value = false
  }
}

onMounted(function initialLoad() {
  load(false)
})
</script>

<template>
  <div class="withdraw-rate">
    <template v-if="isAuto">
      <div class="withdraw-rate__live">
        <div class="withdraw-rate__value">
          <span v-if="loading" class="withdraw-rate__muted">正在获取实时行情…</span>
          <template v-else-if="marketRate !== null && snapshot.isLive">
            <span class="withdraw-rate__muted">行情价</span>
            <strong>1 USDT ≈ {{ symbol }}{{ formatRate(marketRate) }}</strong>
            <el-tag v-if="snapshot.sourceLabel" size="small" type="info" effect="plain">{{ snapshot.sourceLabel }}</el-tag>
            <el-tag v-if="snapshot.isStale" size="small" type="warning" effect="plain">缓存已过期</el-tag>
            <span v-if="ageText" class="withdraw-rate__muted">{{ ageText }}</span>
          </template>
          <span v-else class="withdraw-rate__muted">未取到实时行情</span>
        </div>
        <el-button size="small" text :icon="RefreshCw" :loading="loading" @click="load(true)">刷新</el-button>
      </div>

      <p v-if="error" class="withdraw-rate__error">{{ error }}</p>

      <div class="withdraw-rate__markup">
        <div class="withdraw-rate__markup-row">
          <span class="withdraw-rate__label">在行情价上上浮</span>
          <el-radio-group
            :model-value="markupType === 'fixed' ? 'fixed' : 'percent'"
            size="small"
            @update:model-value="emit('update:markupType', $event)"
          >
            <el-radio-button value="percent">按百分比</el-radio-button>
            <el-radio-button value="fixed">按固定值</el-radio-button>
          </el-radio-group>
          <el-input-number
            :model-value="Number(markup || 0)"
            :min="0"
            :max="markupType === 'fixed' ? 100000 : 50"
            :step="markupType === 'fixed' ? 0.05 : 0.5"
            :precision="markupType === 'fixed' ? 4 : 2"
            controls-position="right"
            class="withdraw-rate__markup-number"
            @update:model-value="emit('update:markup', $event ?? 0)"
          />
          <span class="withdraw-rate__muted">{{ markupType === 'fixed' ? `${symbol} / USDT` : '%' }}</span>
        </div>

        <div v-if="effectiveRate !== null" class="withdraw-rate__preview">
          <div>
            <span class="withdraw-rate__muted">实际折算汇率</span>
            <strong class="withdraw-rate__effective">1 USDT = {{ symbol }}{{ formatRate(effectiveRate) }}</strong>
          </div>
          <div class="withdraw-rate__compare">
            用户提现 {{ symbol }}{{ SAMPLE_AMOUNT }}：
            <span v-if="markupNumber > 0">
              <s class="withdraw-rate__muted">{{ usdtFor(marketRate) }}</s>
              →
            </span>
            <strong>{{ usdtFor(effectiveRate) }} USDT</strong>
            <span v-if="savingPercent > 0" class="withdraw-rate__saving">每笔少付约 {{ savingPercent }}%</span>
            <span class="withdraw-rate__muted">（未扣通道费）</span>
          </div>
        </div>

        <p class="withdraw-rate__hint">
          汇率是「1 USDT 折合多少{{ symbol === '¥' ? '人民币' : '站点货币' }}」，数字越大，同样的佣金折出的 USDT 越少。
          行情价取的是币安 C2C 上用户卖出 USDT 的价，你买 USDT 打款要付更高的价，上浮就是把这段差价和手续费补回来。
          系统每 10 分钟取一次行情，申请和打款时都按「行情价 + 上浮」折算；用户只看到折算后的汇率，看不到行情价和上浮。
        </p>
      </div>

      <label class="withdraw-rate__fallback">
        <span>兜底汇率（行情接口全部不可用时原样使用，不再上浮；0 表示届时不显示估算）</span>
        <el-input-number
          :model-value="Number(modelValue || 0)"
          :min="0"
          :step="0.01"
          :precision="4"
          controls-position="right"
          class="withdraw-rate__number"
          @update:model-value="emit('update:modelValue', $event)"
        />
      </label>
    </template>

    <template v-else>
      <label class="withdraw-rate__fallback">
        <span class="withdraw-rate__label">固定汇率：1 USDT = ? {{ symbol === '¥' ? '元' : '' }}</span>
        <el-input-number
          :model-value="Number(modelValue || 0)"
          :min="0"
          :step="0.01"
          :precision="4"
          controls-position="right"
          class="withdraw-rate__number"
          @update:model-value="emit('update:modelValue', $event)"
        />
      </label>
      <p class="withdraw-rate__hint">
        申请和打款都按这个数折算，不跟行情，也不加上浮。数字越大，用户折出的 USDT 越少。
        <template v-if="marketRate !== null && snapshot && snapshot.isLive">
          当前币安 C2C 行情约 {{ symbol }}{{ formatRate(marketRate) }}，供参考。
        </template>
      </p>
      <div v-if="Number(modelValue) > 0" class="withdraw-rate__compare">
        用户提现 {{ symbol }}{{ SAMPLE_AMOUNT }}：<strong>{{ usdtFor(Number(modelValue)) }} USDT</strong>
        <span class="withdraw-rate__muted">（未扣通道费）</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.withdraw-rate {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.withdraw-rate__live {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.withdraw-rate__value {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 14px;
}

.withdraw-rate__markup {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}

.withdraw-rate__markup-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.withdraw-rate__label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.withdraw-rate__markup-number {
  width: 150px;
}

.withdraw-rate__preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  font-size: 13px;
}

.withdraw-rate__preview > div:first-child {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.withdraw-rate__effective {
  font-size: 16px;
  color: var(--el-color-primary);
}

.withdraw-rate__compare {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.withdraw-rate__saving {
  margin-left: 6px;
  color: var(--el-color-success);
}

.withdraw-rate__muted {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.withdraw-rate__hint,
.withdraw-rate__error {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
}

.withdraw-rate__hint {
  color: var(--el-text-color-secondary);
}

.withdraw-rate__error {
  color: var(--el-color-warning);
}

.withdraw-rate__fallback {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.withdraw-rate__number {
  width: 220px;
}
</style>
