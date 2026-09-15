<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, RefreshCw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import SectionCard from '../components/common/SectionCard.vue'
import NodeGroupDetailsDialog from '../components/nodes/NodeGroupDetailsDialog.vue'
import {
  fetchManagedNodeGroups,
  saveManagedNodeGroup,
  deleteManagedNodeGroup,
} from '../services/nodes'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const groups = ref([])
const loading = ref(false)
const error = ref('')
const searchWord = ref('')
const usageFilter = ref('all')
const detailsVisible = ref(false)
const detailGroupId = ref(null)
const exactGroupId = computed(() => String(route.query.group_id || ''))
const modeLabels = { base: '基础组', included: '套餐包含', optional: '可选购增值' }

const dialogVisible = ref(false)
const dialogMode = ref('create')
const form = ref({ id: null, name: '' })
const saving = ref(false)
const formRef = ref(null)
const formRules = computed(() => ({
  name: [{ required: true, message: t('nodeGroupsPage.fields.nameRequired'), trigger: 'blur' }],
}))

async function loadGroups() {
  loading.value = true
  error.value = ''
  try {
    const result = await fetchManagedNodeGroups({ includeDetails: true })
    groups.value = Array.isArray(result) ? result : (result?.groups || [])
  } catch (err) {
    error.value = err.message || '加载权限组失败'
  } finally {
    loading.value = false
  }
}

const displayGroups = computed(() => {
  const kw = searchWord.value.trim().toLowerCase()
  return groups.value.filter(group => {
    if (exactGroupId.value && group.id !== exactGroupId.value) return false
    if (usageFilter.value !== 'all' && !group.plans.some(plan => plan.mode === usageFilter.value)) return false
    if (!kw) return true
    return [group.id, group.name, ...group.plans.map(plan => plan.name), ...group.nodes.map(node => node.name)]
      .some(value => String(value).toLowerCase().includes(kw))
  })
})

function openDetails(group) {
  detailGroupId.value = group.id
  detailsVisible.value = true
}

function clearGroupFocus() {
  const query = { ...route.query }
  delete query.group_id
  router.replace({ query })
}

watch(exactGroupId, () => { searchWord.value = ''; usageFilter.value = 'all' })

function openCreateDialog() {
  dialogMode.value = 'create'
  form.value = { id: null, name: '' }
  dialogVisible.value = true
}

function openEditDialog(group) {
  dialogMode.value = 'edit'
  form.value = { id: group.id, name: group.name }
  dialogVisible.value = true
}

async function handleSave() {
  if (formRef.value) {
    try { await formRef.value.validate() } catch { return }
  }
  saving.value = true
  try {
    await saveManagedNodeGroup({
      id: form.value.id || undefined,
      name: form.value.name.trim(),
    })
    ElMessage.success(
      dialogMode.value === 'create'
        ? t('nodeGroupsPage.messages.createSuccess')
        : t('nodeGroupsPage.messages.updateSuccess'),
    )
    dialogVisible.value = false
    await loadGroups()
  } catch (err) {
    ElMessage.error(err.message || t('nodeGroupsPage.messages.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function handleDelete(group) {
  try {
    await ElMessageBox.confirm(
      t('nodeGroupsPage.messages.deleteConfirm', { name: group.name }),
      t('nodeGroupsPage.messages.deleteConfirmTitle'),
      { type: 'warning' },
    )
    await deleteManagedNodeGroup(group.id)
    ElMessage.success(t('nodeGroupsPage.messages.deleteSuccess'))
    await loadGroups()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(err.message || t('nodeGroupsPage.messages.deleteFailed'))
  }
}

onMounted(loadGroups)
</script>

<template>
  <section class="page-stack">
    <SectionCard
      :title="t('nodeGroupsPage.sectionTitle')"
      description="按节点范围区分权限组，核对各套餐的基础、包含和可选购增值权限。点击节点数量可查看组内节点。"
    >
      <template #actions>
        <el-space wrap>
          <el-button :icon="Plus" type="primary" @click="openCreateDialog">{{ t('nodeGroupsPage.addButton') }}</el-button>
          <el-button :icon="RefreshCw" :loading="loading" plain type="info" aria-label="刷新权限组" @click="loadGroups" />
        </el-space>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

      <div class="group-filters">
        <el-input v-model="searchWord" placeholder="搜索组名、ID、套餐或节点" aria-label="搜索权限组" clearable class="group-search" />
        <el-select v-model="usageFilter" aria-label="按套餐关联方式筛选" style="width: 180px">
          <el-option label="全部关联方式" value="all" />
          <el-option label="基础权限组" value="base" />
          <el-option label="随套餐包含" value="included" />
          <el-option label="可选购增值组" value="optional" />
        </el-select>
        <el-tag v-if="exactGroupId" closable @close="clearGroupFocus">定位权限组 #{{ exactGroupId }}</el-tag>
        <span class="group-note">{{ displayGroups.length }} 个权限组</span>
      </div>

      <el-table :data="displayGroups" v-loading="loading" class="dashboard-table">
        <el-table-column label="ID" prop="id" width="70" sortable />
        <el-table-column :label="t('nodeGroupsPage.fields.name')" prop="name" min-width="240" sortable />
        <el-table-column label="关联套餐" min-width="260">
          <template #default="{ row }">
            <div v-if="row.detailsAvailable" class="group-plan-list">
              <div v-for="plan in row.plans.slice(0, 2)" :key="`${plan.id}-${plan.mode}`" class="group-plan-row">
                <el-tag size="small" effect="plain">{{ modeLabels[plan.mode] }}</el-tag>
                <router-link :to="{ name: 'plans', query: { plan_id: plan.id } }">#{{ plan.id }} {{ plan.name }}</router-link>
              </div>
              <el-button v-if="row.plans.length > 2" link type="primary" @click="openDetails(row)">查看全部 {{ row.plans.length }} 个关联</el-button>
              <span v-if="!row.plans.length" class="group-note">无套餐直接关联</span>
              <span v-if="row.pricingPlanCount" class="group-note">{{ row.pricingPlanCount }} 个套餐有历史计价引用（不授权）</span>
            </div>
            <span v-else class="group-note">服务端未提供明细</span>
          </template>
        </el-table-column>
        <el-table-column label="节点" prop="serverCount" width="145" sortable>
          <template #default="{ row }">
            <el-button link type="primary" :aria-label="`查看 #${row.id} 的 ${row.serverCount} 个节点`" @click="openDetails(row)">{{ row.serverCount }} 个节点</el-button>
            <div v-if="row.detailsAvailable" class="group-note">显示 {{ row.visibleServerCount }} / 隐藏 {{ row.serverCount - row.visibleServerCount }}</div>
          </template>
        </el-table-column>
        <el-table-column label="基础组用户" prop="usersCount" width="125" sortable />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="openDetails(row)">查看明细</el-button>
            <el-button link size="small" type="primary" @click="openEditDialog(row)">
              {{ t('nodeGroupsPage.actions.edit') }}
            </el-button>
            <el-button link size="small" type="danger" @click="handleDelete(row)">
              {{ t('nodeGroupsPage.actions.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <p class="group-note">基础组用户数不包含已购增值组和管理员单独授权的用户。组内节点由节点管理中的权限组设置决定。</p>
    </SectionCard>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? t('nodeGroupsPage.createTitle') : t('nodeGroupsPage.editTitle')"
      width="min(480px, calc(100vw - 32px))"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-position="top"
      >
        <el-form-item :label="t('nodeGroupsPage.fields.name')" prop="name">
          <el-input v-model="form.name" placeholder="例如：三网优化线路·美国星链" maxlength="255" show-word-limit />
        </el-form-item>
        <p class="group-note">名称应说明适用套餐或节点范围。套餐中单独填写的用户展示名可保持不变。</p>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
    <NodeGroupDetailsDialog v-model="detailsVisible" :group-id="detailGroupId" :groups="groups" />
  </section>
</template>

<style scoped>
.group-filters { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
.group-search { width: 300px; max-width: 100%; }
.group-note { color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.7; }
.group-plan-list { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; }
.group-plan-row { display: flex; align-items: baseline; gap: 6px; }
.group-plan-row .el-tag { flex-shrink: 0; }
.group-plan-row a { color: var(--el-color-primary); text-decoration: none; overflow-wrap: anywhere; }
.group-plan-row a:hover { text-decoration: underline; }
</style>
