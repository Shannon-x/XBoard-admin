<script setup>
import { computed, reactive, ref } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: null },
  traffic: { type: Number, default: 1 },
  devices: { type: Number, default: 1 },
  speed: { type: Number, default: 1 },
  monthlyPrice: { type: Number, default: 0 },
  /** 各周期基础价（元），用于价格预览按周期折算；键为 month_price / quarter_price / … */
  prices: { type: Object, default: () => ({}) },
  /** 全部权限组（含基础组，组件内部会把基础组排除）；元素形状同 services/nodes 的 normalizeManagedNodeGroup。 */
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
function resourceSelectable(field) {
  const rule = props.modelValue?.[field.key]
  const m = mode(field)
  if (m === 'fixed') return false
  return m === 'choices' ? (rule?.choices?.length ?? 0) > 1 : Number(rule?.max ?? 0) > Number(field.base || 0)
}

/* ───────── 增值节点组：一个权限组 = 一档；「不提供」是默认态，不在列表里就是不提供 ───────── */
const addonRules = computed(() => props.modelValue?.addon_groups ?? {})
const groupById = computed(() => Object.fromEntries(props.groups.map((g) => [String(g.id), g])))
const configuredAddons = computed(() => Object.keys(addonRules.value)
  .map((id) => ({ id, group: groupById.value[id], rule: addonRules.value[id] }))
  .sort((a, b) => (a.group?.name || a.id).localeCompare(b.group?.name || b.id, 'zh')))
const addonCandidates = computed(() => props.groups.filter((g) =>
  (props.baseGroupId == null || String(g.id) !== String(props.baseGroupId)) && !addonRules.value[String(g.id)]))
const optionalAddons = computed(() => configuredAddons.value.filter((a) => a.rule?.mode === 'optional'))
const pendingAdd = ref(null)

function emitAddons(next) {
  const value = { ...props.modelValue }
  if (Object.keys(next).length) value.addon_groups = next
  else delete value.addon_groups
  emit('update:modelValue', value)
}
function addGroup(id) {
  if (!id) return
  // 添加后默认「可选购 ¥5.00/月」，名称与价格都可改
  emitAddons({ ...addonRules.value, [String(id)]: { mode: 'optional', price: 500, label: '' } })
  pendingAdd.value = null
}
function removeGroup(id) {
  const next = { ...addonRules.value }
  delete next[id]
  emitAddons(next)
}
function setAddonMode(id, selectedMode) {
  const old = addonRules.value[id] || {}
  const rule = selectedMode === 'included'
    ? { mode: 'included', label: old.label || '' }
    : { mode: 'optional', price: Number(old.price || 0), label: old.label || '' }
  emitAddons({ ...addonRules.value, [id]: rule })
}
function setAddonPrice(id, yuan) {
  emitAddons({ ...addonRules.value, [id]: { ...addonRules.value[id], price: Math.round((Number(yuan) || 0) * 100) } })
}
function setAddonLabel(id, text) {
  emitAddons({ ...addonRules.value, [id]: { ...addonRules.value[id], label: String(text || '').slice(0, 32) } })
}

const allFixed = computed(() => !optionalAddons.value.length && fields.value.every((field) => !resourceSelectable(field)))

/* ───────── 价格预览：客户最多付多少（按月，另给各周期折算） ───────── */
const PERIOD_LABELS = { month_price: '月付', quarter_price: '季付', half_year_price: '半年付', year_price: '年付', two_year_price: '两年付', three_year_price: '三年付' }
const previewRows = computed(() => {
  const rows = []
  fields.value.forEach((field) => {
    if (!resourceSelectable(field)) return
    const rule = props.modelValue[field.key]
    const max = mode(field) === 'choices' ? rule.choices[rule.choices.length - 1] : rule.max
    const cents = Math.round(Math.max(0, (max - field.base) / Math.max(1, rule.step)) * rule.price_per_step)
    rows.push({ label: `${field.label.replace(/ \(.*\)$/, '')}至 ${max}`, cents })
  })
  optionalAddons.value.forEach((a) => rows.push({ label: `${a.rule.label?.trim() || a.group?.name || a.id}（可选购）`, cents: Number(a.rule.price || 0) }))
  return rows
})
const extraMonthlyCents = computed(() => previewRows.value.reduce((sum, r) => sum + r.cents, 0))
const baseMonthlyCents = computed(() => Math.round(Number(props.monthlyPrice || 0) * 100))
const previewByPeriod = computed(() => {
  const monthly = Number(props.prices?.month_price || props.monthlyPrice || 0)
  if (!(monthly > 0)) return []
  return Object.entries(PERIOD_LABELS)
    .filter(([key]) => Number(props.prices?.[key]) > 0)
    .map(([key, label]) => {
      const base = Number(props.prices[key])
      const total = base + (extraMonthlyCents.value / 100) * (base / monthly)
      return `${label} ¥${total.toFixed(2)}`
    })
})
function yuan(cents) { return `¥${(cents / 100).toFixed(2)}` }

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
        <div class="addon-head">
          <strong>增值节点组</strong>
          <span class="customization-note">
            已添加 <b>{{ configuredAddons.length }}</b> 个 · 其余 <b>{{ Math.max(0, addonCandidates.length) }}</b> 个权限组不随本套餐提供
          </span>
        </div>
        <p class="customization-note" style="margin-top: 6px">
          未添加的权限组一律不随本套餐提供。把节点加进对应权限组就完成了打标签，这里只挑要随本套餐「包含」或「可选购」的组。
          可选购按月加价，长周期沿用套餐折扣；流量重置包不重复收费。已售出的组不能撤下，只能新建套餐。
        </p>
        <p v-if="baseGroupId == null" class="customization-error">请先在上方选择套餐的基础权限组，再配置增值组。</p>

        <ul v-if="configuredAddons.length" class="addon-list">
          <li v-for="item in configuredAddons" :key="item.id" class="addon-row" :data-group="item.id">
            <span class="addon-name">{{ item.group?.name || `权限组 #${item.id}` }}</span>
            <span v-if="item.group" class="customization-note">{{ item.group.serverCount }} 个节点</span>
            <span v-else class="customization-error">该权限组已不存在，保存会被拒绝，请移除</span>
            <el-radio-group :model-value="item.rule?.mode" size="small" @update:model-value="setAddonMode(item.id, $event)">
              <el-radio-button value="included">包含</el-radio-button>
              <el-radio-button value="optional">可选购</el-radio-button>
            </el-radio-group>
            <template v-if="item.rule?.mode === 'optional'">
              <el-input-number
                :model-value="Number(item.rule?.price || 0) / 100"
                :min="0" :max="1000000" :precision="2" :step="1" size="small"
                @update:model-value="setAddonPrice(item.id, $event)"
              />
              <span class="customization-note">元 / 月</span>
            </template>
            <span v-else class="customization-note">随套餐赠送，不加价</span>
            <el-button class="addon-remove" text type="danger" size="small" :aria-label="`移除 ${item.group?.name || item.id}`" @click="removeGroup(item.id)">移除</el-button>
            <label class="addon-label">
              <span>用户看到的名称</span>
              <el-input
                :model-value="item.rule?.label || ''"
                :placeholder="item.group?.name || '留空则用权限组名'"
                maxlength="32"
                size="small"
                clearable
                @update:model-value="setAddonLabel(item.id, $event)"
              />
            </label>
          </li>
        </ul>
        <div v-else class="addon-empty">还没有添加任何增值组 —— 本套餐只提供基础权限组的节点。</div>

        <div class="addon-adder">
          <el-select
            v-model="pendingAdd"
            filterable
            clearable
            placeholder="添加权限组…"
            :disabled="baseGroupId == null || !addonCandidates.length"
            style="width: 300px"
            @change="addGroup"
          >
            <el-option v-for="g in addonCandidates" :key="g.id" :label="g.name" :value="String(g.id)">
              <span>{{ g.name }}</span>
              <span class="addon-opt-count">{{ g.serverCount }} 个节点</span>
            </el-option>
          </el-select>
          <span class="customization-note">可添加 {{ addonCandidates.length }} 个；基础组与已添加的组不在列表里。添加后默认「可选购 ¥5.00/月」，名称与价格都可改。</span>
        </div>
      </div>

      <el-alert v-if="allFixed" type="success" :closable="false" title="当前全部固定且无可选购增值组：使用原套餐定价，客户无需选择。" />
      <div v-else class="price-preview">
        <div class="price-preview-head">价格预览 · 客户最多付多少（按月付基础价）</div>
        <table>
          <tbody>
            <tr><td>基础价</td><td>{{ yuan(baseMonthlyCents) }}</td></tr>
            <tr v-for="row in previewRows" :key="row.label"><td>+ {{ row.label }}</td><td>{{ yuan(row.cents) }}</td></tr>
            <tr class="total"><td>全部加购、全选最高后</td><td>{{ yuan(baseMonthlyCents + extraMonthlyCents) }} / 月</td></tr>
          </tbody>
        </table>
        <p v-if="previewByPeriod.length > 1" class="customization-note" style="margin-top: 8px">
          {{ previewByPeriod.join(' · ') }} —— 长周期按套餐折扣自动折算
        </p>
        <p class="customization-note" style="margin-top: 6px">不限时流量包可用“指定选项”设置可售容量，设备数和速度可保持固定。周期套餐与不限时流量包分别建立；重置流量沿用当前订阅容量与已购增值组。</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.customization-rule { margin: 16px 0; padding: 14px; border: 1px solid var(--el-border-color); border-radius: 8px; }
.customization-inputs { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
.customization-inputs :deep(.el-form-item) { margin-bottom: 0; }
.customization-note { color: var(--el-text-color-secondary); font-size: 12px; }
.customization-note b { color: var(--el-text-color-primary); font-weight: 600; }
.customization-error { color: var(--el-color-danger); font-size: 12px; }
.addon-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.addon-list { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 8px; }
.addon-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 9px 10px 9px 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; background: var(--el-fill-color-blank); }
.addon-name { flex: 1 1 140px; font-weight: 500; }
.addon-remove { margin-left: auto; }
.addon-label { flex: 1 1 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-top: 6px; border-top: 1px dashed var(--el-border-color-lighter); font-size: 12px; color: var(--el-text-color-secondary); }
.addon-label :deep(.el-input) { flex: 1 1 200px; }
.addon-empty { margin-top: 12px; padding: 18px; border: 1px dashed var(--el-border-color); border-radius: 6px; text-align: center; color: var(--el-text-color-secondary); font-size: 13px; }
.addon-adder { margin-top: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.addon-opt-count { float: right; color: var(--el-text-color-secondary); font-size: 12px; }
.price-preview { margin-top: 14px; padding: 12px 14px; border: 1px solid var(--el-border-color); border-radius: 8px; background: var(--el-fill-color-blank); }
.price-preview-head { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 8px; }
.price-preview table { width: 100%; border-collapse: collapse; font-size: 13px; }
.price-preview td { padding: 4px 0; }
.price-preview td:last-child { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.price-preview tr.total td { padding-top: 8px; border-top: 1px solid var(--el-border-color); font-weight: 600; }
.price-preview tr.total td:last-child { color: var(--el-color-primary); }
</style>
