<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, CopyDocument } from '@element-plus/icons-vue'
import SectionCard from '../components/common/SectionCard.vue'
import {
  fetchPayments,
  fetchPaymentMethods,
  fetchPaymentForm,
  savePayment,
  deletePayment,
  togglePaymentShow,
} from '../services/payment'

const payments = ref([])
const paymentMethods = ref([])
const loading = ref(false)
const error = ref('')
const searchKeyword = ref('')

const dialogVisible = ref(false)
const dialogMode = ref('create')
const formFields = ref([])
const formLoading = ref(false)
const form = reactive({
  id: null,
  name: '',
  icon: '',
  payment: '',
  config: {},
  enable: true,
  notifyDomain: '',
  handlingFeePercent: null,
  handlingFeeFixed: null,
})

function getFilteredPayments() {
  if (!searchKeyword.value) return payments.value
  const kw = searchKeyword.value.toLowerCase()
  return payments.value.filter(p =>
    (p.name || '').toLowerCase().includes(kw) ||
    (p.payment || '').toLowerCase().includes(kw)
  )
}

async function loadPayments() {
  loading.value = true
  error.value = ''
  try {
    const [list, methods] = await Promise.all([
      fetchPayments(),
      fetchPaymentMethods(),
    ])
    payments.value = list
    paymentMethods.value = methods
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  dialogMode.value = 'create'
  Object.assign(form, {
    id: null, name: '', icon: '', payment: '', config: {},
    enable: true, notifyDomain: '', handlingFeePercent: null, handlingFeeFixed: null,
  })
  formFields.value = []
  dialogVisible.value = true
}

async function openEditDialog(row) {
  dialogMode.value = 'edit'
  Object.assign(form, {
    id: row.id,
    name: row.name,
    icon: row.icon || '',
    payment: row.payment,
    config: row.config ? JSON.parse(JSON.stringify(row.config)) : {},
    enable: row.enable,
    notifyDomain: row.notifyDomain || '',
    handlingFeePercent: row.handlingFeePercent,
    handlingFeeFixed: row.handlingFeeFixed,
  })
  formLoading.value = true
  dialogVisible.value = true
  try {
    formFields.value = await fetchPaymentForm(row.payment, row.id)
  } catch (err) {
    ElMessage.warning('加载支付配置表单失败: ' + err.message)
    formFields.value = []
  } finally {
    formLoading.value = false
  }
}

async function handlePaymentChange(payment) {
  form.payment = payment
  form.config = {}
  formLoading.value = true
  try {
    formFields.value = await fetchPaymentForm(payment)
  } catch (err) {
    ElMessage.warning('加载支付配置表单失败')
    formFields.value = []
  } finally {
    formLoading.value = false
  }
}

async function handleSave() {
  if (!form.name) {
    ElMessage.warning('请输入显示名称')
    return
  }
  if (!form.payment) {
    ElMessage.warning('请选择支付接口')
    return
  }
  try {
    await savePayment(form)
    ElMessage.success(dialogMode.value === 'create' ? '支付方式已添加' : '支付方式已更新')
    dialogVisible.value = false
    await loadPayments()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认删除「${row.name}」？`, '删除支付方式', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    })
    await deletePayment(row.id)
    ElMessage.success('已删除')
    await loadPayments()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(err.message || '删除失败')
  }
}

async function handleToggleEnable(row) {
  try {
    await togglePaymentShow(row.id)
    ElMessage.success('状态已更新')
    await loadPayments()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

function copyNotifyUrl(url) {
  navigator.clipboard.writeText(url).then(() => {
    ElMessage.success('通知地址已复制')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

onMounted(loadPayments)
</script>

<template>
  <section class="page-stack">
    <SectionCard title="支付配置" description="在这里可以配置支付方式，包括支付宝、微信等。">
      <template #actions>
        <el-space>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            添加支付方式
          </el-button>
          <el-input
            v-model="searchKeyword"
            placeholder="搜索支付方式..."
            style="width: 180px;"
            clearable
          />
        </el-space>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

      <el-table :data="getFilteredPayments()" v-loading="loading" class="dashboard-table">
        <el-table-column label="ID" prop="id" sortable width="70" />
        <el-table-column label="启用" width="70">
          <template #default="{ row }">
            <el-switch :model-value="row.enable" size="small" @change="handleToggleEnable(row)" />
          </template>
        </el-table-column>
        <el-table-column label="显示名称" min-width="120">
          <template #default="{ row }">
            <div style="display:flex;align-items:center;gap:6px;">
              <img v-if="row.icon" :src="row.icon" style="width:18px;height:18px;object-fit:contain;border-radius:3px;" />
              <span>{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="支付接口" min-width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.payment }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="通知地址" min-width="240">
          <template #default="{ row }">
            <div v-if="row.notifyUrl" style="display:flex;align-items:center;gap:4px;">
              <span style="font-size:12px;color:var(--el-text-color-regular);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                {{ row.notifyUrl }}
              </span>
              <el-button link size="small" type="primary" @click="copyNotifyUrl(row.notifyUrl)" style="flex-shrink:0;">
                <el-icon :size="14"><CopyDocument /></el-icon>
              </el-button>
            </div>
            <span v-else style="color:var(--el-text-color-placeholder);">--</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="openEditDialog(row)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button link size="small" type="danger" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="margin-top: 12px; font-size: 12px; color: var(--el-text-color-secondary);">
        共 {{ getFilteredPayments().length }} 项
      </div>
    </SectionCard>

    <!-- Add / Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '添加支付方式' : '编辑支付方式'"
      width="540px"
    >
      <el-form label-position="top" v-loading="formLoading">
        <el-form-item label="显示名称">
          <el-input v-model="form.name" placeholder="支付宝" />
          <div class="form-help-text">用于前端显示</div>
        </el-form-item>

        <el-form-item label="图标URL">
          <el-input v-model="form.icon" placeholder="https://..." />
          <div class="form-help-text">用于前端显示的图标地址</div>
        </el-form-item>

        <el-form-item label="通知域名">
          <el-input v-model="form.notifyDomain" placeholder="https://www.example.com" />
          <div class="form-help-text">网关通知将发送到该域名，包括协议（http或https）</div>
        </el-form-item>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <el-form-item label="百分比手续费(%)">
            <el-input v-model.number="form.handlingFeePercent" placeholder="0.00" />
          </el-form-item>
          <el-form-item label="固定手续费">
            <el-input v-model.number="form.handlingFeeFixed" placeholder="0" />
          </el-form-item>
        </div>

        <el-form-item label="支付接口">
          <el-select
            v-model="form.payment"
            style="width:100%;"
            :disabled="dialogMode === 'edit'"
            placeholder="选择要使用的支付接口"
            filterable
            @change="handlePaymentChange"
          >
            <el-option v-for="m in paymentMethods" :key="m" :value="m" :label="m" />
          </el-select>
          <div class="form-help-text">选择要使用的支付接口</div>
        </el-form-item>

        <template v-if="formFields.length > 0">
          <el-divider content-position="left">支付配置</el-divider>
          <el-form-item
            v-for="field in formFields"
            :key="field.field || field.label"
            :label="field.label || field.field"
          >
            <el-input
              :model-value="form.config[field.field] ?? ''"
              :placeholder="field.placeholder || field.tips || ''"
              @update:model-value="form.config[field.field] = $event"
            />
            <div v-if="field.tips" class="form-help-text" style="color:var(--el-color-primary);">
              {{ field.tips }}
            </div>
          </el-form-item>
        </template>

        <el-form-item label="启用">
          <el-switch v-model="form.enable" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">提交</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.form-help-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.4;
}
</style>
