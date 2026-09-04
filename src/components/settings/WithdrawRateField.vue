<script setup>
import { computed, onMounted, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'

import { fetchWithdrawalRate } from '../../services/withdrawals'

const props = defineProps({
  // 兜底汇率：只有自动获取失败（或来源设为手动）时才会用到
  modelValue: {
    type: [Number, String],
    default: 0,
  },
  source: {
    type: String,
    default: 'auto',
  },
})

const emit = defineEmits(['update:modelValue'])

const loading = ref(false)
const error = ref('')
const snapshot = ref(null)

const isAuto = computed(function isAuto() {
  return props.source !== 'manual'
})

const rateText = computed(function rateText() {
  if (!snapshot.value || snapshot.value.rate === null || snapshot.value.rate === undefined) {
    return ''
  }
  const symbol = snapshot.value.currencySymbol || ''
  return `1 USDT ≈ ${symbol}${snapshot.value.rate}`
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
    if (snapshot.value.rate === null || snapshot.value.rate === undefined) {
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
    <div class="withdraw-rate__live">
      <div class="withdraw-rate__value">
        <span v-if="loading" class="withdraw-rate__muted">正在获取实时行情…</span>
        <template v-else-if="rateText">
          <strong>{{ rateText }}</strong>
          <el-tag v-if="snapshot.sourceLabel" size="small" type="info" effect="plain">{{ snapshot.sourceLabel }}</el-tag>
          <el-tag v-if="snapshot.isStale" size="small" type="warning" effect="plain">缓存已过期</el-tag>
          <span v-if="ageText" class="withdraw-rate__muted">{{ ageText }}</span>
        </template>
        <span v-else class="withdraw-rate__muted">未取到实时行情</span>
      </div>
      <el-button size="small" text :icon="RefreshCw" :loading="loading" @click="load(true)">刷新</el-button>
    </div>

    <p v-if="error" class="withdraw-rate__error">{{ error }}</p>
    <p v-else-if="isAuto" class="withdraw-rate__hint">
      汇率由系统每 10 分钟自动从公开行情接口获取，申请与结算时都按当时的实时汇率折算，无需手动维护。
    </p>

    <label class="withdraw-rate__fallback">
      <span>兜底汇率（行情接口全部不可用时使用，0 表示届时不显示估算）</span>
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
  color: var(--el-text-color-placeholder);
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
