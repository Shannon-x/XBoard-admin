<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: null },
  traffic: { type: Number, default: 1 },
  devices: { type: Number, default: 1 },
  speed: { type: Number, default: 1 },
  monthlyPrice: { type: Number, default: 0 },
})
const emit = defineEmits(['update:modelValue'])
const fields = computed(() => [
  { key: 'transfer_enable', label: '流量 (GB)', base: props.traffic, limit: 1000000 },
  { key: 'device_limit', label: '设备数 (台)', base: props.devices, limit: 100 },
  { key: 'speed_limit', label: '速度 (Mbps)', base: props.speed, limit: 10000 },
])
const maximumPrice = computed(() => {
  if (!props.modelValue) return 0
  return Number(props.monthlyPrice || 0) + fields.value.reduce((sum, field) => {
    const rule = props.modelValue[field.key]
    return sum + Math.max(0, (rule.max - field.base) / Math.max(1, rule.step)) * rule.price_per_step / 100
  }, 0)
})
function toggle(enabled) {
  emit('update:modelValue', enabled ? Object.fromEntries(fields.value.map((field) => [field.key, {
    max: Math.max(1, field.base || 1), step: 1, price_per_step: 0,
  }])) : null)
}
function update(key, field, value) {
  emit('update:modelValue', { ...props.modelValue, [key]: { ...props.modelValue[key], [field]: value } })
}
</script>

<template>
  <section class="customization-editor">
    <el-divider content-position="left">自选规格与自动计价</el-divider>
    <el-switch :model-value="!!modelValue" active-text="允许客户自选流量、设备数和速度" @change="toggle" />
    <template v-if="modelValue">
      <el-alert
        type="info"
        :closable="false"
        title="上方流量、设备数和速度为基础价包含的规格。增加部分按每步加价计费，长周期沿用基础套餐折扣。上限等于基础值时，该规格固定。"
        style="margin: 12px 0"
      />
      <div v-for="field in fields" :key="field.key" class="customization-rule">
        <strong>{{ field.label }} · 基础 {{ field.base || '请设置正整数' }}</strong>
        <div class="customization-inputs">
          <el-form-item label="最大值">
            <el-input-number
              :model-value="modelValue[field.key].max"
              :min="Math.max(1, field.base || 1)"
              :max="field.limit"
              :precision="0"
              @update:model-value="update(field.key, 'max', $event)"
            />
          </el-form-item>
          <el-form-item label="每次增加">
            <el-input-number
              :model-value="modelValue[field.key].step"
              :min="1"
              :max="field.limit"
              :precision="0"
              @update:model-value="update(field.key, 'step', $event)"
            />
          </el-form-item>
          <el-form-item label="每步加价（元 / 月或次）">
            <el-input-number
              :model-value="modelValue[field.key].price_per_step / 100"
              :min="0"
              :max="1000000"
              :precision="2"
              :step="0.1"
              @update:model-value="update(field.key, 'price_per_step', Math.round(($event || 0) * 100))"
            />
          </el-form-item>
        </div>
      </div>
      <p>最高规格基础周期价：¥{{ maximumPrice.toFixed(2) }}；重置流量只收取流量加价，不重复收设备和速度费用。</p>
      <p class="customization-note">周期套餐与不限时流量包应分别建立。合并旧套餐时保留旧记录及续费入口，避免覆盖已有用户权益。</p>
    </template>
  </section>
</template>

<style scoped>
.customization-rule { margin: 16px 0; padding: 14px; border: 1px solid var(--el-border-color); border-radius: 8px; }
.customization-inputs { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
.customization-inputs :deep(.el-form-item) { margin-bottom: 0; }
.customization-note { color: var(--el-text-color-secondary); font-size: 12px; }
</style>
