<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
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

const dialogVisible = ref(false)
const dialogMode = ref('create')
const formFields = ref([])
const formLoading = ref(false)
const form = reactive({
  id: null,
  name: '',
  payment: '',
  config: {},
  enable: true,
  notifyDomain: '',
  handlingFeePercent: null,
  handlingFeeFixed: null,
})

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

async function openCreateDialog() {
  dialogMode.value = 'create'
  Object.assign(form, {
    id: null, name: '', payment: '', config: {},
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
    payment: row.payment,
    config: { ...row.config },
    enable: row.enable,
    notifyDomain: row.notifyDomain,
    handlingFeePercent: row.handlingFeePercent,
    handlingFeeFixed: row.handlingFeeFixed,
  })
  formLoading.value = true
  try {
    formFields.value = await fetchPaymentForm(row.payment, row.id)
  } catch (err) {
    ElMessage.error(err.message)
    formFields.value = []
  } finally {
    formLoading.value = false
  }
  dialogVisible.value = true
}

async function handlePaymentChange(payment) {
  form.payment = payment
  formLoading.value = true
  try {
    formFields.value = await fetchPaymentForm(payment)
  } catch (err) {
    formFields.value = []
  } finally {
    formLoading.value = false
  }
}

async function handleSave() {
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

async function handleToggleShow(row) {
  try {
    await togglePaymentShow(row.id)
    ElMessage.success('状态已更新')
    await loadPayments()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

onMounted(loadPayments)
</script>

<template>
  <section class="page-stack">
    <SectionCard title="支付管理" description="配置和管理系统支付方式，包括支付驱动、手续费和状态控制。">
      <template #actions>
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          添加支付方式
        </el-button>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

      <el-table :data="payments" v-loading="loading" class="dashboard-table">
        <el-table-column label="ID" prop="id" width="60" />
        <el-table-column label="名称" prop="name" min-width="120" />
        <el-table-column label="支付驱动" prop="payment" min-width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ row.payment }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="手续费" width="140">
          <template #default="{ row }">
            <span v-if="row.handlingFeePercent">{{ row.handlingFeePercent }}%</span>
            <span v-if="row.handlingFeePercent && row.handlingFeeFixed"> + </span>
            <span v-if="row.handlingFeeFixed">¥{{ (row.handlingFeeFixed / 100).toFixed(2) }}</span>
            <span v-if="!row.handlingFeePercent && !row.handlingFeeFixed">--</span>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="70">
          <template #default="{ row }">
            <el-switch :model-value="row.enable" size="small" @change="handleToggleShow(row)" />
          </template>
        </el-table-column>
        <el-table-column label="排序" prop="sort" width="70" />
        <el-table-column label="操作" width="120" fixed="right">
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
    </SectionCard>

    <el-dialog v-model="dialogVisible" :title="dialogMode === 'create' ? '添加支付方式' : '编辑支付方式'" width="580px">
      <el-form label-position="top" v-loading="formLoading">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="例如：支付宝" />
        </el-form-item>
        <el-form-item label="支付驱动">
          <el-select
            v-model="form.payment"
            style="width: 100%;"
            :disabled="dialogMode === 'edit'"
            @change="handlePaymentChange"
          >
            <el-option v-for="m in paymentMethods" :key="m" :value="m" :label="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="回调域名">
          <el-input v-model="form.notifyDomain" placeholder="https://example.com" />
        </el-form-item>
        <el-form-item label="手续费率（%）">
          <el-input-number v-model="form.handlingFeePercent" :min="0" :max="100" :precision="2" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="固定手续费（分）">
          <el-input-number v-model="form.handlingFeeFixed" :min="0" style="width: 100%;" />
        </el-form-item>

        <template v-if="formFields.length > 0">
          <el-divider>支付驱动配置</el-divider>
          <el-form-item v-for="field in formFields" :key="field.field || field.label" :label="field.label || field.field">
            <el-input
              :model-value="form.config[field.field] || ''"
              :placeholder="field.tips || field.placeholder || ''"
              @update:model-value="form.config[field.field] = $event"
            />
          </el-form-item>
        </template>

        <el-form-item label="启用">
          <el-switch v-model="form.enable" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>
