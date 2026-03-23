<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import SectionCard from '../components/common/SectionCard.vue'
import {
  fetchManagedNodeRoutes,
  saveManagedNodeRoute,
  deleteManagedNodeRoute,
} from '../services/nodes'

const routes = ref([])
const loading = ref(false)
const error = ref('')
const searchWord = ref('')

const dialogVisible = ref(false)
const dialogMode = ref('create')
const form = ref({ id: null, remarks: '', match: [], action: 'block', action_value: '' })
const saving = ref(false)

const actionLabels = {
  block: '禁止访问',
  dns: '指定DNS服务器进行解析',
}

async function loadRoutes() {
  loading.value = true
  error.value = ''
  try {
    routes.value = await fetchManagedNodeRoutes()
  } catch (err) {
    error.value = err.message || '加载路由失败'
  } finally {
    loading.value = false
  }
}

const displayRoutes = computed(() => {
  if (!searchWord.value.trim()) return routes.value
  const kw = searchWord.value.trim().toLowerCase()
  return routes.value.filter(r => r.remarks.toLowerCase().includes(kw) || String(r.id).includes(kw))
})

function openCreateDialog() {
  dialogMode.value = 'create'
  form.value = { id: null, remarks: '', match: [], action: 'block', action_value: '' }
  dialogVisible.value = true
}

function openEditDialog(route) {
  dialogMode.value = 'edit'
  form.value = {
    id: route.id,
    remarks: route.remarks,
    match: route.matchRaw || [],
    action: route.actionRaw || route.action || 'block',
    action_value: route.actionValue || '',
  }
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.value.remarks?.trim()) {
    ElMessage.warning('请输入备注名称')
    return
  }
  saving.value = true
  try {
    await saveManagedNodeRoute({
      id: form.value.id || undefined,
      remarks: form.value.remarks.trim(),
      match: form.value.match,
      action: form.value.action,
      action_value: form.value.action_value || '',
    })
    ElMessage.success(dialogMode.value === 'create' ? '路由已创建' : '路由已更新')
    dialogVisible.value = false
    await loadRoutes()
  } catch (err) {
    ElMessage.error(err.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(route) {
  try {
    await ElMessageBox.confirm(`确定要删除路由「${route.remarks}」吗？`, '删除确认', { type: 'warning' })
    await deleteManagedNodeRoute(route.id)
    ElMessage.success('路由已删除')
    await loadRoutes()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(err.message || '删除失败')
  }
}

function actionTagType(action) {
  if (action === 'block' || action === '禁止访问') return 'danger'
  if (action === 'dns') return 'primary'
  return 'info'
}

onMounted(loadRoutes)
</script>

<template>
  <section class="page-stack">
    <SectionCard title="路由管理" description="管理所有路由组，包括添加、删除、编辑等操作。">
      <template #actions>
        <el-space wrap>
          <el-button :icon="Plus" type="primary" @click="openCreateDialog">添加路由</el-button>
          <el-input v-model="searchWord" placeholder="搜索路由" clearable style="width: 180px" />
        </el-space>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

      <el-table :data="displayRoutes" v-loading="loading" class="dashboard-table">
        <el-table-column label="ID" prop="id" width="70" sortable />
        <el-table-column label="备注" prop="remarks" min-width="140" />
        <el-table-column label="动作值" width="160">
          <template #default="{ row }">
            <span style="font-size:12px; color:var(--el-text-color-secondary)">{{ row.action === '--' ? '--' : row.action }}</span>
          </template>
        </el-table-column>
        <el-table-column label="动作" width="200">
          <template #default="{ row }">
            <el-tag :type="actionTagType(row.action)" size="small">
              {{ actionLabels[row.action] || row.action }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>

    <el-dialog v-model="dialogVisible" :title="dialogMode === 'create' ? '添加路由' : '编辑路由'" width="560px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="备注" required>
          <el-input v-model="form.remarks" placeholder="输入路由备注" />
        </el-form-item>
        <el-form-item label="动作">
          <el-select v-model="form.action" style="width: 100%">
            <el-option label="禁止访问" value="block" />
            <el-option label="指定DNS服务器进行解析" value="dns" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.action === 'dns'" label="动作值">
          <el-input v-model="form.action_value" placeholder="DNS:IP地址 (如 DNS:1.1.1.1)" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>
