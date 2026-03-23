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
      width="700px"
      destroy-on-close
    >
      <el-form :model="editForm" label-width="120px">
        <el-form-item label="名称" required>
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
        <el-form-item label="流量（GB）">
          <el-input-number v-model="editForm.transferEnableGB" :min="0" :step="10" />
        </el-form-item>
        <el-form-item label="速率限制（Mbps）">
          <el-input-number v-model="editForm.speedLimit" :min="0" />
        </el-form-item>
        <el-form-item label="设备限制">
          <el-input-number v-model="editForm.deviceLimit" :min="0" />
        </el-form-item>
        <el-form-item label="流量重置方式">
          <el-select v-model="editForm.resetTrafficMethod" clearable style="width: 100%">
            <el-option
              v-for="opt in resetTrafficOptions"
              :key="String(opt.value)"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="容量限制">
          <el-input-number v-model="editForm.capacityLimit" :min="0" placeholder="如留空则不限制" />
        </el-form-item>

        <el-divider>价格设置（元）</el-divider>

        <el-form-item
          v-for="[key, label] in periodLabelEntries"
          :key="key"
          :label="label"
        >
          <el-input-number v-model="editForm.prices[key]" :min="0" :precision="2" :step="1" />
        </el-form-item>

        <el-divider>显示设置</el-divider>

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

        <el-form-item label="描述">
          <el-input v-model="editForm.content" type="textarea" :rows="3" placeholder="套餐描述（可选）" />
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
