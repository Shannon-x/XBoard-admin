<script setup>
import { computed, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, RefreshCw } from 'lucide-vue-next'
import PlanCustomizationEditor from '../components/common/PlanCustomizationEditor.vue'
import SectionCard from '../components/common/SectionCard.vue'
import { fetchSiteSettingsGroup } from '../services/settings'
import {
  fetchManagedPlans,
  saveManagedPlan,
  deleteManagedPlan,
  updateManagedPlan,
  sortManagedPlans,
  createEmptyManagedPlans,
  PERIOD_LABELS,
} from '../services/plans'
import {
  fetchManagedNodeGroups,
} from '../services/nodes'
import SortDialog from '../components/common/SortDialog.vue'
import { useRoute, useRouter } from 'vue-router'
import { toNodeGroup } from '../utils/crossLink'

const route = useRoute()
const router = useRouter()
// 套餐页无搜索框：从订单/用户/工单等处带 ?plan_id= 跳进来时高亮对应行
const highlightPlanId = ref(null)
function planRowClass({ row }) {
  return highlightPlanId.value && String(row.id) === highlightPlanId.value ? 'plan-row--highlight' : ''
}

const plans = ref(createEmptyManagedPlans())
const loading = ref(false)
const errorMsg = ref('')
const groups = ref([])

/* ───────── 流量加购（customization.traffic_topup）：与流量包 / 重置包并排配置 ─────────
   三种「流量产品」放在一起，管理员一眼分清：
     流量包   = 一次性套餐，永不过期（老功能）
     重置包   = 把本周期流量清零重来，整份卖（老功能）
     加购流量 = 按 GB 追加到本周期，流量清零时收回（新）—— 单价默认跟随站点设置 */
const siteSubscribe = ref(null)
async function loadSiteTopup() {
  try { siteSubscribe.value = await fetchSiteSettingsGroup('subscription') } catch { siteSubscribe.value = null }
}
const FIXED_RESOURCES = () => ({ transfer_enable: { mode: 'fixed' }, device_limit: { mode: 'fixed' }, speed_limit: { mode: 'fixed' } })
const topupRule = computed(() => editForm.value.customization?.traffic_topup ?? null)
function setTopupRule(rule) {
  // customization 为 null 时要连三项固定规格一起建：后端要求这三个键必须在
  const next = editForm.value.customization ? { ...editForm.value.customization } : FIXED_RESOURCES()
  if (rule) next.traffic_topup = rule
  else delete next.traffic_topup
  editForm.value.customization = next
}
const topupMode = computed({
  get: () => topupRule.value?.mode ?? 'inherit',
  set: (mode) => {
    if (mode === 'inherit') return setTopupRule(null)
    if (mode === 'off') return setTopupRule({ mode: 'off' })
    setTopupRule({ mode: 'custom', price_per_gb: Number(topupRule.value?.price_per_gb || 50) })
  },
})
function setTopupPrice(yuan) {
  setTopupRule({ ...(topupRule.value || { mode: 'custom' }), mode: 'custom', price_per_gb: Math.max(1, Math.round((Number(yuan) || 0) * 100)) })
}
/* 自定义时的选购方式：range = 滑杆（min/max/step），choices = 指定档位（每档可专价） */
const topupSelection = computed({
  get: () => topupRule.value?.selection === 'choices' ? 'choices' : 'range',
  set: (sel) => {
    const next = { ...(topupRule.value || { mode: 'custom', price_per_gb: 50 }), mode: 'custom', selection: sel }
    if (sel === 'choices' && !Array.isArray(next.choices)) next.choices = [{ gb: 10 }, { gb: 50 }, { gb: 100 }]
    setTopupRule(next)
  },
})
function setTopupInt(key, value) {
  const next = { ...(topupRule.value || { mode: 'custom' }), mode: 'custom' }
  if (value == null || value === '') delete next[key]
  else next[key] = Math.max(1, Math.round(Number(value)))
  setTopupRule(next)
}
const choicesDraft = ref(null)
const choicesText = computed(() => (topupRule.value?.choices || [])
  .map((c) => (c.price != null ? `${c.gb}:${(c.price / 100).toFixed(2).replace(/\.?0+$/, '')}` : String(c.gb))).join(', '))
function commitChoices(text) {
  // 「10, 50:22.5, 100:40」→ [{gb:10},{gb:50,price:2250},{gb:100,price:4000}]；非法项丢掉，留给后端再校验一次
  const seen = new Set()
  const choices = String(text || '').split(/[\s,，、;；]+/).map((entry) => {
    const m = entry.match(/^(\d+)(?::(\d+(?:\.\d{1,2})?))?$/)
    if (!m) return null
    const gb = Number(m[1])
    if (gb < 1 || seen.has(gb)) return null
    seen.add(gb)
    return m[2] != null ? { gb, price: Math.round(Number(m[2]) * 100) } : { gb }
  }).filter(Boolean).sort((a, b) => a.gb - b.gb)
  choicesDraft.value = null
  setTopupRule({ ...(topupRule.value || { mode: 'custom' }), mode: 'custom', selection: 'choices', choices })
}
const topupHint = computed(() => {
  const site = Number(siteSubscribe.value?.trafficTopupPricePerGb || 0)
  if (topupMode.value === 'off') return '本套餐不卖加购流量，用户端不显示入口。'
  if (topupMode.value === 'custom') return '用户在仪表盘订阅卡「加购流量」购买；持有增值组的用户按组另加价。'
  return site > 0
    ? `跟随站点设置：¥${site.toFixed(2)} / GB。用户在仪表盘订阅卡「加购流量」购买。`
    : '站点还没设单价 → 全站关闭。到「系统设置 → 订阅 → 流量加购单价」填一个即可对所有套餐生效。'
})
const sortDialogVisible = ref(false)

const editDialogVisible = ref(false)
const editForm = ref(createEmptyPlanForm())
const editSaving = ref(false)
const isEditing = ref(false)
const hasSelectableResources = computed(() => {
  const form = editForm.value
  const bases = { transfer_enable: form.transferEnableGB, device_limit: form.deviceLimit, speed_limit: form.speedLimit }
  const { addon_groups: addons, ...resources } = form.customization || {}
  // 可选购的增值节点组同样是「客户可选」，与资源规则一并计入
  if (Object.values(addons || {}).some((rule) => rule?.mode === 'optional')) return true
  return Object.entries(resources).some(([key, rule]) => rule.mode !== 'fixed'
    && (rule.mode === 'choices' ? rule.choices?.length > 1 : rule.max > Number(bases[key] || 0)))
})

function createEmptyPlanForm() {
  return {
    id: null,
    name: '',
    groupId: null,
    transferEnableGB: 0,
    speedLimit: null,
    deviceLimit: null,
    show: true,
    sell: true,
    renew: true,
    content: '',
    resetTrafficMethod: -1,
    capacityLimit: null,
    forceUpdate: false,
    customization: null,
    prices: {
      month_price: null,
      quarter_price: null,
      half_year_price: null,
      year_price: null,
      two_year_price: null,
      three_year_price: null,
      onetime_price: null,
      reset_price: null,
    },
  }
}

async function loadPlans() {
  loading.value = true
  errorMsg.value = ''
  try {
    plans.value = await fetchManagedPlans()
  } catch (err) {
    errorMsg.value = err.message || '加载套餐列表失败'
  } finally {
    loading.value = false
  }
}

async function loadGroups() {
  try {
    const result = await fetchManagedNodeGroups()
    groups.value = Array.isArray(result) ? result : []
  } catch (err) {
    // 非关键错误，静默处理
  }
}

function openCreateDialog() {
  editForm.value = createEmptyPlanForm()
  isEditing.value = false
  editDialogVisible.value = true
}

function openEditDialog(plan) {
  editForm.value = {
    id: plan.id,
    name: plan.name,
    groupId: plan.groupId,
    transferEnableGB: plan.transferEnableGB,
    speedLimit: plan.speedLimit,
    deviceLimit: plan.deviceLimit,
    show: plan.show,
    sell: plan.sell,
    renew: plan.renew,
    content: plan.content,
    resetTrafficMethod: plan.resetTrafficMethod ?? -1,
    capacityLimit: plan.capacityLimit,
    forceUpdate: false,
    prices: { ...plan.prices },
    customization: plan.customization ? JSON.parse(JSON.stringify(plan.customization)) : null,
  }
  isEditing.value = true
  editDialogVisible.value = true
}

async function saveForm() {
  if (!editForm.value.name?.trim()) {
    ElMessage.warning('请输入套餐名称')
    return
  }

  editSaving.value = true
  try {
    await saveManagedPlan(editForm.value)

    // 后端 plan/save 的 PlanSave 校验规则不包含 show / sell / renew，validated() 会
    // 把这三个字段静默过滤掉。编辑模式下补一次 plan/update 同步开关，否则用户
    // 在弹窗里的切换永远写不进 DB。
    if (isEditing.value && editForm.value.id) {
      await updateManagedPlan(editForm.value.id, {
        show: editForm.value.show,
        sell: editForm.value.sell,
        renew: editForm.value.renew,
      })
    }

    ElMessage.success(isEditing.value ? '套餐已更新' : '套餐已创建')
    editDialogVisible.value = false
    loadPlans()
  } catch (err) {
    ElMessage.error(err.message || '保存失败')
  } finally {
    editSaving.value = false
  }
}

async function handleDelete(plan) {
  try {
    await ElMessageBox.confirm(`确定要删除套餐 "${plan.name}" 吗？`, '删除套餐', {
      type: 'error',
    })
    await deleteManagedPlan(plan.id)
    ElMessage.success('套餐已删除')
    loadPlans()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除失败')
    }
  }
}

async function handleToggle(plan, field) {
  // per-row + per-field 锁：阻止用户在同一开关重复点击；
  // 之前每次点击都触发一次 loadPlans 整页 reload，连续点会丢状态。
  const lockKey = `${field}Updating`
  if (plan[lockKey]) return
  const previous = plan[field]
  const newVal = !previous
  plan[lockKey] = true
  // 乐观更新：UI 先翻，失败再回滚
  plan[field] = newVal
  try {
    await updateManagedPlan(plan.id, { [field]: newVal })
    ElMessage.success('已更新')
  } catch (err) {
    plan[field] = previous
    ElMessage.error(err.message || '更新失败')
  } finally {
    plan[lockKey] = false
  }
}

const periodKeys = Object.keys(PERIOD_LABELS)
const periodLabelEntries = Object.entries(PERIOD_LABELS)

const resetTrafficOptions = [
  { label: '跟随系统设置', value: -1 },
  { label: '每月1日', value: 0 },
  { label: '按月重置（从订阅日起算）', value: 1 },
  { label: '不重置（流量叠加）', value: 2 },
  { label: '每年1月1日', value: 3 },
  { label: '按年重置（从订阅日起算）', value: 4 },
]

const basePrice = ref(0)

const mainPeriods = [
  { key: 'month_price', label: '月付', sub: '(每月)' },
  { key: 'quarter_price', label: '季付', sub: '(3个月)' },
  { key: 'half_year_price', label: '半年付', sub: '(6个月)' },
  { key: 'year_price', label: '年付', sub: '(12个月)' },
  { key: 'two_year_price', label: '两年付', sub: '(24个月)' },
  { key: 'three_year_price', label: '三年付', sub: '(36个月)' },
]

const periodMultipliers = {
  month_price: 1,
  quarter_price: 2.85,
  half_year_price: 5.4,
  year_price: 10.2,
  two_year_price: 0,
  three_year_price: 0,
}

function fillPricesFromBase() {
  if (!basePrice.value || basePrice.value <= 0) {
    ElMessage.warning('请先输入基础价格')
    return
  }
  mainPeriods.forEach(p => {
    const m = periodMultipliers[p.key]
    if (m > 0) {
      editForm.value.prices[p.key] = Number((basePrice.value * m).toFixed(2))
    }
  })
}

function clearAllPrices() {
  Object.keys(editForm.value.prices).forEach(k => {
    editForm.value.prices[k] = null
  })
  basePrice.value = 0
}

async function handleSortSave(ids) {
  try {
    await sortManagedPlans(ids)
    ElMessage.success('排序已保存')
    sortDialogVisible.value = false
    await loadPlans()
  } catch (err) {
    ElMessage.error(err.message || '排序保存失败')
  }
}

onMounted(function onMount() {
  if (route.query.plan_id) highlightPlanId.value = String(route.query.plan_id)
  loadPlans()
  loadGroups()
  loadSiteTopup()
})
</script>

<template>
  <section class="page-stack">
    <SectionCard description="管理套餐订阅计划，支持创建、编辑、删除等操作" title="套餐管理">
      <template #actions>
        <el-space wrap>
          <el-button @click="sortDialogVisible = true" :disabled="plans.length < 2">排序</el-button>
          <el-button :icon="Plus" class="primary-btn small" type="success" @click="openCreateDialog">
            创建套餐
          </el-button>
          <el-button :icon="RefreshCw" class="ghost-btn small" plain type="info" @click="loadPlans">
            刷新
          </el-button>
        </el-space>
      </template>

      <el-alert v-if="errorMsg" :title="errorMsg" closable show-icon type="error" style="margin-bottom: 16px" @close="errorMsg = ''" />

      <el-table v-loading="loading" :data="plans" :row-class-name="planRowClass" stripe style="width: 100%" table-layout="auto">
        <el-table-column label="ID" prop="id" width="70" align="center" />
        <el-table-column label="名称" min-width="180" prop="name" show-overflow-tooltip />
        <el-table-column label="权限组" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="toNodeGroup(row.groupId)" class="x-link" @click="router.push(toNodeGroup(row.groupId))">{{ row.groupName }}</span>
            <span v-else>{{ row.groupName }}</span>
          </template>
        </el-table-column>
        <el-table-column label="流量" width="110">
          <template #default="{ row }">
            <span style="white-space:nowrap">{{ row.transferEnableText }}</span>
          </template>
        </el-table-column>
        <el-table-column label="速率限制" width="110">
          <template #default="{ row }">
            <span style="white-space:nowrap">{{ row.speedLimit ? row.speedLimit + ' Mbps' : '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="用户数" width="120">
          <template #default="{ row }">
            <span style="white-space:nowrap">
              <span style="color:var(--el-color-success);font-weight:600">{{ row.activeUsersCount }}</span>
              <span style="color:var(--el-text-color-secondary)"> / {{ row.usersCount }}</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="定价" min-width="300">
          <template #default="{ row }">
            <div v-if="row.priceTexts.length > 0" style="display:flex;flex-wrap:wrap;gap:4px;">
              <el-tag
                v-for="(text, idx) in row.priceTexts"
                :key="idx"
                size="small"
                type="info"
                style="white-space:nowrap;"
              >
                {{ text }}
              </el-tag>
            </div>
            <span v-else>--</span>
          </template>
        </el-table-column>
        <el-table-column label="显示" width="70">
          <template #default="{ row }">
            <el-switch :model-value="row.show" size="small" @change="handleToggle(row, 'show')" />
          </template>
        </el-table-column>
        <el-table-column label="销售" width="70">
          <template #default="{ row }">
            <el-switch :model-value="row.sell" size="small" @change="handleToggle(row, 'sell')" />
          </template>
        </el-table-column>
        <el-table-column label="续费" width="70">
          <template #default="{ row }">
            <el-switch :model-value="row.renew" size="small" @change="handleToggle(row, 'renew')" />
          </template>
        </el-table-column>
        <el-table-column fixed="right" label="操作" width="130">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>

    <!-- 创建/编辑套餐对话框 -->
    <el-dialog
      v-model="editDialogVisible"
      :title="isEditing ? '编辑套餐' : '创建套餐'"
      width="min(640px, calc(100vw - 32px))"
      destroy-on-close
    >
      <el-form :model="editForm" label-position="top" style="padding: 0 8px">
        <el-form-item label="套餐名称" required>
          <el-input v-model="editForm.name" placeholder="输入套餐名称" />
        </el-form-item>

        <el-form-item label="权限组">
          <el-select v-model="editForm.groupId" clearable placeholder="选择权限组" style="width: 100%">
            <el-option
              v-for="group in groups"
              :key="group.id"
              :label="group.name"
              :value="group.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="流量">
          <el-input v-model.number="editForm.transferEnableGB" placeholder="0" type="number">
            <template #suffix><span style="color:var(--el-text-color-secondary)">GB</span></template>
          </el-input>
        </el-form-item>

        <el-form-item label="速度限制">
          <el-input v-model.number="editForm.speedLimit" placeholder="不限制" type="number">
            <template #suffix><span style="color:var(--el-text-color-secondary)">Mbps</span></template>
          </el-input>
        </el-form-item>

        <!-- 价格设置 -->
        <el-divider content-position="left">价格设置</el-divider>

        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px">
          <span style="font-size: 13px; color: var(--el-text-color-regular)">¥ 基础价格</span>
          <el-input-number v-model="basePrice" :min="0" :precision="2" :step="10" size="small" style="width: 140px" />
          <el-button size="small" type="info" plain @click="fillPricesFromBase">应用</el-button>
          <el-button size="small" @click="clearAllPrices">清空</el-button>
        </div>

        <div class="plan-price-grid">
          <div class="plan-price-card" v-for="item in mainPeriods" :key="item.key">
            <div class="plan-price-card__label">{{ item.label }} <span>{{ item.sub }}</span></div>
            <el-input v-model.number="editForm.prices[item.key]" placeholder="0.00" type="number">
              <template #prefix>¥</template>
            </el-input>
          </div>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px">
          <div class="plan-price-card plan-price-card--special" style="flex:1 1 200px">
            <div class="plan-price-card__label">流量包 <span>一次性套餐，永不过期</span></div>
            <el-input v-model.number="editForm.prices.onetime_price" placeholder="0" type="number">
              <template #prefix>¥</template>
            </el-input>
          </div>
          <div class="plan-price-card plan-price-card--special" style="flex:1 1 200px">
            <div class="plan-price-card__label">重置包 <span>本周期流量清零重来，整份卖</span></div>
            <el-input v-model.number="editForm.prices.reset_price" placeholder="0" type="number">
              <template #prefix>¥</template>
            </el-input>
          </div>
          <div class="plan-price-card plan-price-card--special" style="flex:1 1 240px" data-price="traffic_topup">
            <div class="plan-price-card__label">加购流量 <span>按 GB 追加到本周期，流量清零时收回</span></div>
            <el-select v-model="topupMode" style="width: 100%">
              <el-option label="跟随站点设置" value="inherit" />
              <el-option label="本套餐不开放" value="off" />
              <el-option label="自定义单价" value="custom" />
            </el-select>
            <template v-if="topupMode === 'custom'">
              <el-input
                :model-value="Number(topupRule?.price_per_gb || 0) / 100"
                type="number" step="0.01" min="0.01" placeholder="0.50"
                style="margin-top: 8px"
                @update:model-value="setTopupPrice($event)"
              >
                <template #prefix>¥</template>
                <template #suffix><span style="color: var(--el-text-color-secondary)">/ GB</span></template>
              </el-input>
              <el-radio-group v-model="topupSelection" size="small" style="margin-top: 8px">
                <el-radio-button value="range">范围滑杆</el-radio-button>
                <el-radio-button value="choices">指定档位</el-radio-button>
              </el-radio-group>
              <div v-if="topupSelection === 'range'" style="display: flex; gap: 6px; margin-top: 8px">
                <el-input :model-value="topupRule?.min_gb ?? ''" type="number" min="1" placeholder="最少" @update:model-value="setTopupInt('min_gb', $event)"><template #suffix>GB</template></el-input>
                <el-input :model-value="topupRule?.max_gb ?? ''" type="number" min="1" placeholder="最多" @update:model-value="setTopupInt('max_gb', $event)"><template #suffix>GB</template></el-input>
                <el-input :model-value="topupRule?.step_gb ?? ''" type="number" min="1" placeholder="步长" @update:model-value="setTopupInt('step_gb', $event)"><template #suffix>GB</template></el-input>
              </div>
              <el-input
                v-else
                :model-value="choicesDraft ?? choicesText"
                placeholder="10, 50:22.5, 100:40（GB 或 GB:元）"
                style="margin-top: 8px"
                @update:model-value="choicesDraft = $event"
                @change="commitChoices($event)"
              />
            </template>
            <div style="font-size: 12px; line-height: 1.5; color: var(--el-text-color-secondary); margin-top: 6px">
              {{ topupHint }}
              <template v-if="topupMode === 'custom'">{{ topupSelection === 'range' ? ' 留空的上下限 / 步长跟随站点。' : ' 档位写 GB:元 可定专价，大包更便宜；不写价按单价。' }}</template>
            </div>
          </div>
        </div>

        <!-- 设备限制 / 容量限制 -->
        <div style="display: flex; gap: 16px; margin-top: 20px">
          <el-form-item label="设备限制" style="flex: 1">
            <el-input v-model.number="editForm.deviceLimit" placeholder="不限制" type="number">
              <template #suffix><span style="color:var(--el-text-color-secondary)">台</span></template>
            </el-input>
          </el-form-item>
          <el-form-item label="容量限制" style="flex: 1">
            <el-input v-model.number="editForm.capacityLimit" placeholder="不限制" type="number">
              <template #suffix><span style="color:var(--el-text-color-secondary)">人</span></template>
            </el-input>
          </el-form-item>
        </div>

        <PlanCustomizationEditor
          v-model="editForm.customization"
          :traffic="Number(editForm.transferEnableGB)"
          :devices="Number(editForm.deviceLimit)"
          :speed="Number(editForm.speedLimit)"
          :monthly-price="Number(editForm.prices.month_price || editForm.prices.onetime_price || 0)"
          :prices="editForm.prices"
          :groups="groups"
          :base-group-id="editForm.groupId"
        />

        <el-form-item label="流量重置方式">
          <el-select v-model="editForm.resetTrafficMethod" clearable style="width: 100%">
            <el-option
              v-for="opt in resetTrafficOptions"
              :key="String(opt.value)"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <div style="font-size: 12px; color: var(--el-text-color-secondary); margin-top: 4px">
            流量重置方式将决定如何重置流量
          </div>
        </el-form-item>

        <el-divider content-position="left">显示设置</el-divider>

        <div style="display: flex; gap: 32px; align-items: center;">
          <el-form-item label="显示" style="margin-bottom: 0;">
            <el-switch v-model="editForm.show" />
          </el-form-item>
          <el-form-item label="销售" style="margin-bottom: 0;">
            <el-switch v-model="editForm.sell" />
          </el-form-item>
          <el-form-item label="续费" style="margin-bottom: 0;">
            <el-switch v-model="editForm.renew" />
          </el-form-item>
        </div>

        <el-form-item v-if="isEditing" label="强制更新用户">
          <el-switch v-model="editForm.forceUpdate" :disabled="hasSelectableResources" />
          <span style="margin-left: 8px; color: var(--el-text-color-secondary); font-size: 12px">
            将当前套餐下所有用户的权限组、流量、速率限制同步更新
          </span>
        </el-form-item>

        <el-form-item label="套餐说明">
          <el-input v-model="editForm.content" type="textarea" :rows="4" placeholder="套餐描述（支持 Markdown）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button :loading="editSaving" type="primary" @click="saveForm">保存</el-button>
      </template>
    </el-dialog>

    <SortDialog
      v-model:visible="sortDialogVisible"
      :items="plans"
      title="排序套餐"
      @save="handleSortSave"
    />
  </section>
</template>

<style scoped>
/* 从别处带 ?plan_id= 跳进来时高亮该套餐行 */
:deep(.plan-row--highlight > td.el-table__cell) {
  background: var(--primary-soft) !important;
}
:deep(.plan-row--highlight > td.el-table__cell:first-child) {
  box-shadow: inset 3px 0 0 0 var(--el-color-primary);
}

.plan-price-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.plan-price-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 10px;
  background: var(--el-fill-color-lighter);
}
.plan-price-card--special {
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  padding: 10px;
  background: var(--el-fill-color-lighter);
}
.plan-price-card__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  margin-bottom: 6px;
}
.plan-price-card__label span {
  font-weight: 400;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
</style>
