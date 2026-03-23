<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Search } from '@element-plus/icons-vue'
import SectionCard from '../components/common/SectionCard.vue'
import {
  fetchManagedCoupons,
  generateCoupons,
  deleteCoupon,
  toggleCouponShow,
} from '../services/coupons'

const coupons = ref([])
const loading = ref(false)
const error = ref('')
const pagination = reactive({ page: 1, pageSize: 15, total: 0 })
const filters = reactive({ keyword: '' })
const generateDialogVisible = ref(false)
const generateForm = reactive({
  name: '',
  type: 1,
  value: 0,
  generateCount: 1,
  limitUse: null,
  limitUseWithUser: null,
  limitPlanIds: [],
  limitPeriod: [],
  startedAt: null,
  endedAt: null,
})

async function loadCoupons() {
  loading.value = true
  error.value = ''
  try {
    const result = await fetchManagedCoupons({
      page: pagination.page,
      pageSize: pagination.pageSize,
      filters,
    })
    coupons.value = result.list
    Object.assign(pagination, result.pagination)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function handleGenerate() {
  try {
    await generateCoupons(generateForm)
    ElMessage.success('优惠券已生成')
    generateDialogVisible.value = false
    resetGenerateForm()
    await loadCoupons()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

function resetGenerateForm() {
  generateForm.name = ''
  generateForm.type = 1
  generateForm.value = 0
  generateForm.generateCount = 1
  generateForm.limitUse = null
  generateForm.limitUseWithUser = null
  generateForm.limitPlanIds = []
  generateForm.limitPeriod = []
  generateForm.startedAt = null
  generateForm.endedAt = null
}

async function handleDelete(coupon) {
  try {
    await ElMessageBox.confirm(`确认删除优惠券「${coupon.name}」吗？`, '删除优惠券', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await deleteCoupon(coupon.id)
    ElMessage.success('优惠券已删除')
    await loadCoupons()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '删除失败')
    }
  }
}

async function handleToggleShow(coupon) {
  try {
    await toggleCouponShow(coupon.id)
    ElMessage.success('状态已更新')
    await loadCoupons()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

function handlePageChange(page) {
  pagination.page = page
  loadCoupons()
}

function handleSearch() {
  pagination.page = 1
  loadCoupons()
}

function formatCouponType(type) {
  return type === 1 ? '金额' : type === 2 ? '比例' : '重置流量'
}

function formatCouponValue(coupon) {
  if (coupon.type === 1) return `¥${(coupon.value / 100).toFixed(2)}`
  if (coupon.type === 2) return `${coupon.value}%`
  return '--'
}

function formatTime(ts) {
  if (!ts) return '--'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

onMounted(loadCoupons)
</script>

<template>
  <section class="page-stack">
    <SectionCard title="优惠券管理" description="管理系统优惠券，包括创建、删除和显隐控制。">
      <template #actions>
        <el-button type="primary" @click="generateDialogVisible = true">
          <el-icon><Plus /></el-icon>
          生成优惠券
        </el-button>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

      <div class="coupon-toolbar" style="margin-bottom: 16px;">
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索优惠券名称或代码"
          style="max-width: 320px;"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>

      <el-table :data="coupons" v-loading="loading" class="dashboard-table">
        <el-table-column label="ID" prop="id" width="70" />
        <el-table-column label="名称" prop="name" min-width="120" />
        <el-table-column label="代码" prop="code" min-width="140">
          <template #default="{ row }">
            <code style="font-size: 12px; background: rgba(0,0,0,.04); padding: 2px 6px; border-radius: 4px;">{{ row.code }}</code>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === 1 ? 'primary' : row.type === 2 ? 'success' : 'info'">
              {{ formatCouponType(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="面值" width="100">
          <template #default="{ row }">{{ formatCouponValue(row) }}</template>
        </el-table-column>
        <el-table-column label="使用限制" width="100">
          <template #default="{ row }">{{ row.limitUse ?? '不限' }}</template>
        </el-table-column>
        <el-table-column label="显示" width="70">
          <template #default="{ row }">
            <el-switch :model-value="row.show" size="small" @change="handleToggleShow(row)" />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button type="danger" link size="small" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
        <el-pagination
          :current-page="pagination.page"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          layout="total, prev, pager, next"
          @current-change="handlePageChange"
        />
      </div>
    </SectionCard>

    <el-dialog v-model="generateDialogVisible" title="生成优惠券" width="520px" @close="resetGenerateForm">
      <el-form label-position="top">
        <el-form-item label="名称">
          <el-input v-model="generateForm.name" placeholder="请输入优惠券名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="generateForm.type" style="width: 100%;">
            <el-option :value="1" label="金额" />
            <el-option :value="2" label="比例" />
            <el-option :value="3" label="重置流量" />
          </el-select>
        </el-form-item>
        <el-form-item :label="generateForm.type === 1 ? '金额（分）' : generateForm.type === 2 ? '折扣比例（%）' : '值'">
          <el-input-number v-model="generateForm.value" :min="0" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="生成数量">
          <el-input-number v-model="generateForm.generateCount" :min="1" :max="500" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="每张使用次数限制">
          <el-input-number v-model="generateForm.limitUse" :min="0" placeholder="0 = 不限" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="每用户使用次数限制">
          <el-input-number v-model="generateForm.limitUseWithUser" :min="0" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleGenerate">生成</el-button>
      </template>
    </el-dialog>
  </section>
</template>
