<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import SectionCard from '../components/common/SectionCard.vue'
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n()

const plans = ref(createEmptyManagedPlans())
const loading = ref(false)
const errorMsg = ref('')
const groups = ref([])
const sortDialogVisible = ref(false)

const editDialogVisible = ref(false)
const editForm = ref(createEmptyPlanForm())
const editSaving = ref(false)
const isEditing = ref(false)

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
    resetTrafficMethod: null,
    capacityLimit: null,
    forceUpdate: false,
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
    groups.value = result?.groups || []
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
    resetTrafficMethod: plan.resetTrafficMethod,
    capacityLimit: plan.capacityLimit,
    forceUpdate: false,
    prices: { ...plan.prices },
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
  try {
    const newVal = !plan[field]
    await updateManagedPlan(plan.id, { [field]: newVal })
    ElMessage.success('已更新')
    loadPlans()
  } catch (err) {
    ElMessage.error(err.message || '更新失败')
  }
}

const periodKeys = Object.keys(PERIOD_LABELS)
const periodLabelEntries = Object.entries(PERIOD_LABELS)

const resetTrafficOptions = [
  { label: '不重置', value: null },
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
  loadPlans()
  loadGroups()
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
          <el-button :icon="Refresh" class="ghost-btn small" plain type="info" @click="loadPlans">
            刷新
          </el-button>
        </el-space>
      </template>

      <el-alert v-if="errorMsg" :title="errorMsg" closable show-icon type="error" style="margin-bottom: 16px" @close="errorMsg = ''" />

      <el-table v-loading="loading" :data="plans" stripe style="width: 100%">
        <el-table-column label="ID" prop="id" width="60" />
        <el-table-column label="名称" min-width="140" prop="name" />
        <el-table-column label="权限组" width="100" prop="groupName" />
        <el-table-column label="流量" width="100" prop="transferEnableText" />
        <el-table-column label="速率限制" width="100">
          <template #default="{ row }">
            {{ row.speedLimit ? row.speedLimit + ' Mbps' : '--' }}
          </template>
        </el-table-column>
        <el-table-column label="用户数" width="90">
          <template #default="{ row }">
            {{ row.activeUsersCount }} / {{ row.usersCount }}
          </template>
        </el-table-column>
        <el-table-column label="定价" min-width="180">
          <template #default="{ row }">
            <div v-if="row.priceTexts.length > 0" class="price-list">
              <el-tag
                v-for="(text, idx) in row.priceTexts.slice(0, 3)"
                :key="idx"
                size="small"
                type="info"
                style="margin: 2px"
              >
                {{ text }}
              </el-tag>
              <el-tag v-if="row.priceTexts.length > 3" size="small" style="margin: 2px">
                +{{ row.priceTexts.length - 3 }}
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
      width="640px"
      destroy-on-close
    >
      <el-form :model="editForm" label-position="top" style="padding: 0 8px">
        <el-form-item label="套餐名称" required>
          <el-input v-model="editForm.name" placeholder="输入套餐名称" />
        </el-form-item>

        <el-form-item label="服务器分组">
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

        <div style="display: flex; gap: 12px; margin-top: 12px">
          <div class="plan-price-card plan-price-card--special" style="flex:1">
            <div class="plan-price-card__label">流量包 <span>一次性流量包，无时间限制</span></div>
            <el-input v-model.number="editForm.prices.onetime_price" placeholder="0" type="number">
              <template #prefix>¥</template>
            </el-input>
          </div>
          <div class="plan-price-card plan-price-card--special" style="flex:1">
            <div class="plan-price-card__label">重置包 <span>重置流量包，可多次使用</span></div>
            <el-input v-model.number="editForm.prices.reset_price" placeholder="0" type="number">
              <template #prefix>¥</template>
            </el-input>
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

        <el-form-item label="显示">
          <el-switch v-model="editForm.show" />
        </el-form-item>
        <el-form-item label="销售">
          <el-switch v-model="editForm.sell" />
        </el-form-item>
        <el-form-item label="续费">
          <el-switch v-model="editForm.renew" />
        </el-form-item>

        <el-form-item v-if="isEditing" label="强制更新用户">
          <el-switch v-model="editForm.forceUpdate" />
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
