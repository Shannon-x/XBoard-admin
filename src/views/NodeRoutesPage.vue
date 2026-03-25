<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from 'lucide-vue-next'
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
const form = ref(createEmptyForm())
const saving = ref(false)

function createEmptyForm() {
  return {
    id: null,
    remarks: '',
    matchText: '',
    action: 'block',
    action_value: '',
  }
}

const actionOptions = [
  { label: '禁止访问(域名目标)', value: 'block' },
  { label: '禁止访问(IP目标)', value: 'block_ip' },
  { label: '禁止访问(端口目标)', value: 'block_port' },
  { label: '禁止访问(协议)', value: 'protocol' },
  { label: '指定DNS服务器进行解析', value: 'dns' },
  { label: '指定出站服务器(域名目标)', value: 'route' },
  { label: '指定出站服务器(IP目标)', value: 'route_ip' },
  { label: '自定义默认出站', value: 'default_out' },
]

const matchTextPlaceholder = computed(() => {
  if (['block_ip', 'route_ip'].includes(form.value.action)) {
    return '127.0.0.1(单一匹配)\n10.0.0.0/8(范围匹配)\ngeoip:cn(预定义列表匹配)'
  }
  if (form.value.action === 'block_port') {
    return '53\n443\n1000-2000'
  }
  if (form.value.action === 'protocol') {
    return 'http\ntls\nquic\nbittorrent'
  }
  return 'example.com(关键字匹配)\ndomain:example.com(子域名匹配)\ngeosite:netflix(预定义域名列表)'
})

function fillDefaultOutboundConfig() {
  form.value.action_value = `{
  "tag": "ss_out",
  "sendThrough": "0.0.0.0",
  "protocol": "shadowsocks",
  "settings": {
    "email": "love@xray.com",
    "address": "8.8.8.8",
    "port": 5555,
    "method": "2022-blake3-aes-128-gcm",
    "password": "your_password"
  }
}`
}

// Actions that need no action_value at all
const NO_VALUE_ACTIONS = ['block', 'block_ip', 'block_port', 'protocol']

// Clear action_value when switching action type to prevent cross-contamination
watch(() => form.value.action, (newAction, oldAction) => {
  if (newAction === oldAction) return
  // Determine category of old and new to decide if we should reset
  const getCategory = (a) => {
    if (NO_VALUE_ACTIONS.includes(a)) return 'none'
    if (a === 'dns') return 'dns'
    if (['route', 'route_ip', 'default_out'].includes(a)) return 'outbound'
    return 'other'
  }
  if (getCategory(newAction) !== getCategory(oldAction)) {
    form.value.action_value = ''
  }
})

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
  form.value = createEmptyForm()
  dialogVisible.value = true
}

function openEditDialog(route) {
  dialogMode.value = 'edit'
  form.value = {
    id: route.id,
    remarks: route.remarks,
    matchText: Array.isArray(route.match) ? route.match.join('\n') : '',
    action: route.action || 'block',
    action_value: route.actionValue || '',
  }
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.value.remarks?.trim()) {
    ElMessage.warning('请输入备注')
    return
  }
  const matchArr = form.value.matchText
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0)
  if (form.value.action !== 'default_out' && matchArr.length === 0) {
    ElMessage.warning('请输入至少一条匹配规则')
    return
  }
  saving.value = true
  try {
    await saveManagedNodeRoute({
      id: form.value.id || undefined,
      remarks: form.value.remarks.trim(),
      match: matchArr,
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
  if (['block', 'block_ip', 'block_port', 'protocol'].includes(action)) return 'danger'
  if (action === 'dns') return 'primary'
  if (['route', 'route_ip'].includes(action)) return 'warning'
  if (action === 'default_out') return 'success'
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
        <el-table-column label="动作值" min-width="200">
          <template #default="{ row }">
            <div>
              <div style="font-size:13px; color:var(--el-text-color-primary)">{{ row.actionDisplayValue }}</div>
              <div style="font-size:11px; color:var(--el-text-color-secondary); margin-top:2px">
                匹配{{ row.matchCount }}条规则
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="动作" width="200">
          <template #default="{ row }">
            <el-tag :type="actionTagType(row.action)" size="small">
              {{ row.actionLabel }}
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

    <!-- 创建/编辑路由对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '创建路由' : '编辑路由'"
      width="520px"
      destroy-on-close
    >
      <div class="route-form">
        <div class="route-form__field">
          <label>备注</label>
          <el-input v-model="form.remarks" placeholder="请输入备注" />
        </div>

        <div v-if="form.action !== 'default_out'" class="route-form__field">
          <label style="display: flex; align-items: center; gap: 12px;">
            匹配值
            <el-link type="primary" :underline="false" href="https://xtls.github.io/config/routing.html" target="_blank" style="font-size: 13px; font-weight: 600;">填写参考</el-link>
          </label>
          <el-input
            v-model="form.matchText"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 10 }"
            :placeholder="matchTextPlaceholder"
          />
        </div>

        <div class="route-form__field">
          <label>动作</label>
          <el-select v-model="form.action" style="width: 100%">
            <el-option
              v-for="opt in actionOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </div>

        <div v-if="form.action === 'dns'" class="route-form__field">
          <label>DNS服务器</label>
          <el-input v-model="form.action_value" placeholder="请输入用于解析的DNS服务器地址" />
        </div>

        <div v-if="['route', 'route_ip', 'default_out'].includes(form.action)" class="route-form__field">
          <label style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 12px;">
              Xray出站配置
              <el-link type="primary" :underline="false" href="https://xtls.github.io/config/outbound.html" target="_blank" style="font-size: 13px; font-weight: 600;">填写参考</el-link>
            </div>
            <el-button link type="primary" size="small" @click="fillDefaultOutboundConfig">使用默认配置</el-button>
          </label>
          <el-input
            v-model="form.action_value"
            type="textarea"
            :autosize="{ minRows: 8, maxRows: 15 }"
            placeholder="{&#10;  &#x22;tag&#x22;: &#x22;ss_out&#x22;,&#10;  &#x22;sendThrough&#x22;: &#x22;0.0.0.0&#x22;,&#10;  ..."
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.route-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.route-form__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.route-form__field label {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.route-form__hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
