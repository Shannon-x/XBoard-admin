<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import SectionCard from '../components/common/SectionCard.vue'
import {
  fetchManagedNodeGroups,
  saveManagedNodeGroup,
  deleteManagedNodeGroup,
} from '../services/nodes'

const groups = ref([])
const loading = ref(false)
const error = ref('')
const searchWord = ref('')

const dialogVisible = ref(false)
const dialogMode = ref('create')
const form = ref({ id: null, name: '' })
const saving = ref(false)

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

const filteredGroups = ref([])
import { computed } from 'vue'
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
  if (!form.value.name?.trim()) {
    ElMessage.warning('请输入组名称')
    return
  }
  saving.value = true
  try {
    await saveManagedNodeGroup({
      id: form.value.id || undefined,
      name: form.value.name.trim(),
    })
    ElMessage.success(dialogMode.value === 'create' ? '权限组已创建' : '权限组已更新')
    dialogVisible.value = false
    await loadGroups()
  } catch (err) {
    ElMessage.error(err.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(group) {
  try {
    await ElMessageBox.confirm(`确定要删除权限组「${group.name}」吗？`, '删除确认', { type: 'warning' })
    await deleteManagedNodeGroup(group.id)
    ElMessage.success('权限组已删除')
    await loadGroups()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(err.message || '删除失败')
  }
}

onMounted(loadGroups)
</script>

<template>
  <section class="page-stack">
    <SectionCard title="权限组管理" description="管理所有权限组，包括添加、删除、编辑等操作。">
      <template #actions>
        <el-space wrap>
          <el-button :icon="Plus" type="primary" @click="openCreateDialog">添加权限组</el-button>
          <el-input v-model="searchWord" placeholder="搜索权限组" clearable style="width: 180px" />
        </el-space>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

      <el-table :data="displayGroups" v-loading="loading" class="dashboard-table">
        <el-table-column label="ID" prop="id" width="70" sortable />
        <el-table-column label="组名称" prop="name" min-width="160" sortable />
        <el-table-column label="用户数量" prop="usersCount" width="120" sortable />
        <el-table-column label="节点数量" prop="serverCount" width="120" sortable />
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>

    <el-dialog v-model="dialogVisible" :title="dialogMode === 'create' ? '添加权限组' : '编辑权限组'" width="480px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="组名称" required>
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
