<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, RefreshCw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import SectionCard from '../components/common/SectionCard.vue'
import {
  fetchManagedNodeGroups,
  saveManagedNodeGroup,
  deleteManagedNodeGroup,
} from '../services/nodes'

const { t } = useI18n()

const groups = ref([])
const loading = ref(false)
const error = ref('')
const searchWord = ref('')

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
    const result = await fetchManagedNodeGroups()
    groups.value = Array.isArray(result) ? result : (result?.groups || [])
  } catch (err) {
    error.value = err.message || '加载权限组失败'
  } finally {
    loading.value = false
  }
}

const displayGroups = computed(() => {
  if (!searchWord.value.trim()) return groups.value
  const kw = searchWord.value.trim().toLowerCase()
  return groups.value.filter(g => g.name.toLowerCase().includes(kw) || String(g.id).includes(kw))
})

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
      :description="t('nodeGroupsPage.sectionDescription')"
    >
      <template #actions>
        <el-space wrap>
          <el-button :icon="Plus" type="primary" @click="openCreateDialog">{{ t('nodeGroupsPage.addButton') }}</el-button>
          <el-button :icon="RefreshCw" plain type="info" @click="loadGroups" />
          <el-input v-model="searchWord" :placeholder="t('app.search') || '搜索'" clearable style="width: 180px" />
        </el-space>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

      <el-table :data="displayGroups" v-loading="loading" class="dashboard-table">
        <el-table-column label="ID" prop="id" width="70" sortable />
        <el-table-column :label="t('nodeGroupsPage.fields.name')" prop="name" min-width="160" sortable />
        <el-table-column label="用户数量" prop="usersCount" width="120" sortable />
        <el-table-column :label="t('nodeGroupsPage.fields.memberCount')" prop="serverCount" width="120" sortable />
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="openEditDialog(row)">
              {{ t('nodeGroupsPage.actions.edit') }}
            </el-button>
            <el-button link size="small" type="danger" @click="handleDelete(row)">
              {{ t('nodeGroupsPage.actions.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? t('nodeGroupsPage.createTitle') : t('nodeGroupsPage.editTitle')"
      width="480px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-position="top"
      >
        <el-form-item :label="t('nodeGroupsPage.fields.name')" prop="name">
          <el-input v-model="form.name" placeholder="请输入权限组名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>
