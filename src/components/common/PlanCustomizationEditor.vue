<script setup>
import { computed, reactive } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: null },
  traffic: { type: Number, default: 1 },
  devices: { type: Number, default: 1 },
  speed: { type: Number, default: 1 },
  monthlyPrice: { type: Number, default: 0 },
  /** 全部权限组（含基础组，组件内部会把基础组排除）。 */
  groups: { type: Array, default: () => [] },
  /** 套餐当前选中的基础权限组 id；基础组不能再作为增值组出售。 */
  baseGroupId: { type: [Number, String], default: null },
})
const emit = defineEmits(['update:modelValue'])
const choiceDrafts = reactive({})
const fields = computed(() => [
  { key: 'transfer_enable', label: '流量 (GB)', base: props.traffic, limit: 1000000 },
  { key: 'device_limit', label: '设备数 (台)', base: props.devices, limit: 100 },
  { key: 'speed_limit', label: '速度 (Mbps)', base: props.speed, limit: 10000 },
])
function mode(field) {
  const rule = props.modelValue?.[field.key]
  return rule?.mode ?? (!rule || rule.max === field.base ? 'fixed' : 'range')
}

/* ───────── 增值节点组：一个权限组 = 一档 ───────── */
const addonRules = computed(() => props.modelValue?.addon_groups ?? {})
const addonCandidates = computed(() => props.groups.filter((group) =>
  props.baseGroupId == null || String(group.id) !== String(props.baseGroupId)))
const hasOptionalAddon = computed(() => Object.values(addonRules.value).some((rule) => rule?.mode === 'optional'))
const addonMonthlyTotal = computed(() => Object.values(addonRules.value)
  .reduce((sum, rule) => sum + (rule?.mode === 'optional' ? Number(rule.price || 0) : 0), 0) / 100)
function addonMode(group) {
  return addonRules.value[String(group.id)]?.mode ?? 'off'
}
function emitAddons(next) {
  const value = { ...props.modelValue }
  if (Object.keys(next).length) value.addon_groups = next
  else delete value.addon_groups
  emit('update:modelValue', value)
}
function setAddonMode(group, selectedMode) {
  const next = { ...addonRules.value }
  const key = String(group.id)
  if (selectedMode === 'off') delete next[key]
  else if (selectedMode === 'included') next[key] = { mode: 'included' }
  else next[key] = { mode: 'optional', price: Number(next[key]?.price || 0) }
  emitAddons(next)
}
function setAddonPrice(group, yuan) {
  const key = String(group.id)
  emitAddons({ ...addonRules.value, [key]: { mode: 'optional', price: Math.round((Number(yuan) || 0) * 100) } })
}

const allFixed = computed(() => !hasOptionalAddon.value && fields.value.every((field) => mode(field) === 'fixed'
  || (mode(field) === 'range' && props.modelValue[field.key].max === field.base)
  || (mode(field) === 'choices' && props.modelValue[field.key].choices?.length <= 1)))
const maximumPrice = computed(() => Number(props.monthlyPrice || 0) + addonMonthlyTotal.value + fields.value.reduce((sum, field) => {
  if (mode(field) === 'fixed') return sum
  const rule = props.modelValue[field.key]
  return sum + Math.round(Math.max(0, (rule.max - field.base) / Math.max(1, rule.step)) * rule.price_per_step) / 100
}, 0))
function toggle(enabled) {
  emit('update:modelValue', enabled ? Object.fromEntries(fields.value.map((field) => [field.key, { mode: 'fixed' }])) : null)
}
function updateRule(key, rule) {
  emit('update:modelValue', { ...props.modelValue, [key]: rule })
}
function update(key, field, value) {
  updateRule(key, { ...props.modelValue[key], [field]: value })
}
function changeMode(field, selectedMode) {
  if (selectedMode === 'fixed') return updateRule(field.key, { mode: 'fixed' })
  const old = props.modelValue[field.key]
  const base = Math.max(1, field.base || 1)
  const rule = { mode: selectedMode, max: Math.max(base, old.max || base), step: old.step || 1, price_per_step: old.price_per_step || 0 }
  if (selectedMode === 'choices') rule.choices = [...new Set([base, rule.max])]
  updateRule(field.key, rule)
}
function updateChoices(field, text) {
  // Keep invalid numbers for server validation; never silently round entered capacities.
  const choices = text.trim() ? text.trim().split(/[\s,，、;；]+/).map(Number).sort((a, b) => a - b) : []
  delete choiceDrafts[field.key]
  updateRule(field.key, { ...props.modelValue[field.key], choices, max: choices.at(-1) ?? field.base })
}
</script>

<template>
  <section class="customization-editor">
    <el-divider content-position="left">自选规格与自动计价</el-divider>
    <el-switch :model-value="!!modelValue" active-text="配置规格选择方式" @change="toggle" />
    <template v-if="modelValue">
      <el-alert
        type="info"
        :closable="false"
        title="每项可单独固定、按范围选择或指定选项。固定值使用上方套餐规格，包含在基础价内；全部固定且没有可选购的增值节点组时，沿用原来的周期价格和购买流程。"
        style="margin: 12px 0"
      />
      <div v-for="field in fields" :key="field.key" class="customization-rule" :data-resource="field.key">
        <strong>{{ field.label }} · 基础 {{ field.base || '不限' }}</strong>
        <el-form-item label="选择方式" style="margin-top: 12px">
          <el-radio-group :model-value="mode(field)" @update:model-value="changeMode(field, $event)">
            <el-radio-button value="fixed">固定</el-radio-button>
            <el-radio-button value="range">范围选择</el-radio-button>
            <el-radio-button value="choices">指定选项</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <p v-if="mode(field) === 'fixed'" class="customization-note">客户不可更改；按上方固定规格提供服务，不另加价。</p>
        <template v-else>
          <p v-if="!field.base" class="customization-error">开放自选前，请先在上方设置正整数基础值。</p>
          <el-form-item v-if="mode(field) === 'choices'" label="可售选项">
            <el-input
              :model-value="choiceDrafts[field.key] ?? modelValue[field.key].choices?.join(', ')"
              placeholder="例如 100, 250, 500；必须包含基础值"
              @update:model-value="choiceDrafts[field.key] = $event"
              @change="updateChoices(field, $event)"
            />
            <span class="customization-note">逗号分隔，最多 100 项；客户只能购买列出的值。上限取最大选项，不能超过 {{ field.limit }}。</span>
          </el-form-item>
          <div class="customization-inputs">
            <el-form-item v-if="mode(field) === 'range'" label="最大值">
              <el-input-number :model-value="modelValue[field.key].max" :min="Math.max(1, field.base || 1)" :max="field.limit" :precision="0" @update:model-value="update(field.key, 'max', $event)" />
            </el-form-item>
            <el-form-item :label="mode(field) === 'choices' ? '每多少单位计价' : '每次增加'">
              <el-input-number :model-value="modelValue[field.key].step" :min="1" :max="field.limit" :precision="0" @update:model-value="update(field.key, 'step', $event)" />
            </el-form-item>
            <el-form-item label="每单位加价（元 / 月或次）">
              <el-input-number :model-value="modelValue[field.key].price_per_step / 100" :min="0" :max="1000000" :precision="2" :step="0.1" @update:model-value="update(field.key, 'price_per_step', Math.round(($event || 0) * 100))" />
            </el-form-item>
          </div>
          <p v-if="mode(field) === 'choices'" class="customization-note">超出基础值的部分按计价单位比例加价，例如每 100GB 加 1 元，额外 150GB 加 1.50 元。</p>
        </template>
      </div>

      <div class="customization-rule" data-resource="addon_groups">
        <strong>增值节点组</strong>
        <p class="customization-note" style="margin-top: 6px">
          一个增值等级 = 一个权限组：把 10x 等节点加进对应权限组就完成了打标签，这里只决定该组随本套餐「不提供 / 包含 / 可选购」。
          可选购的组按月加价，长周期沿用套餐折扣；流量重置包不重复收费。客户已购买的组不能再撤下，只能新建套餐。
        </p>
        <p v-if="baseGroupId == null" class="customization-error">请先在上方选择套餐的基础权限组，再配置增值组。</p>
        <p v-else-if="!addonCandidates.length" class="customization-note">除基础组外没有其他权限组；请先在「节点 → 权限组」里新建增值组。</p>
        <div v-for="group in addonCandidates" :key="group.id" class="addon-row" :data-group="group.id">
          <span class="addon-name">{{ group.name }}</span>
          <el-radio-group :model-value="addonMode(group)" size="small" @update:model-value="setAddonMode(group, $event)">
            <el-radio-button value="off">不提供</el-radio-button>
            <el-radio-button value="included">包含</el-radio-button>
            <el-radio-button value="optional">可选购</el-radio-button>
          </el-radio-group>
          <template v-if="addonMode(group) === 'optional'">
            <el-input-number
              :model-value="Number(addonRules[String(group.id)]?.price || 0) / 100"
              :min="0" :max="1000000" :precision="2" :step="1" size="small"
              @update:model-value="setAddonPrice(group, $event)"
            />
            <span class="customization-note">元 / 月</span>
          </template>
          <span v-else-if="addonMode(group) === 'included'" class="customization-note">随套餐赠送，不加价</span>
        </div>
      </div>

      <el-alert v-if="allFixed" type="success" :closable="false" title="当前全部固定且无可选购增值组：使用原套餐定价，客户无需选择。" />
      <template v-else>
        <p>最高规格基础周期价：¥{{ maximumPrice.toFixed(2) }}（含全部可选购增值组）；长周期沿用基础套餐折扣。</p>
        <p class="customization-note">不限时流量包可用“指定选项”设置可售容量，设备数和速度可保持固定。周期套餐与不限时流量包分别建立；重置流量沿用当前订阅容量与已购增值组。</p>
      </template>
    </template>
  </section>
</template>

<style scoped>
.customization-rule { margin: 16px 0; padding: 14px; border: 1px solid var(--el-border-color); border-radius: 8px; }
.customization-inputs { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
.customization-inputs :deep(.el-form-item) { margin-bottom: 0; }
.customization-note { color: var(--el-text-color-secondary); font-size: 12px; }
.customization-error { color: var(--el-color-danger); font-size: 12px; }
.addon-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 10px; }
.addon-name { min-width: 120px; font-weight: 500; }
</style>
