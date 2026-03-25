<script setup>
import { onMounted, reactive, ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Trash2, Pencil, Search } from 'lucide-vue-next'
import SectionCard from '../components/common/SectionCard.vue'
import {
  fetchManagedCoupons,
  generateCoupons,
  deleteCoupon,
  toggleCouponShow,
} from '../services/coupons'
import { fetchManagedPlans, PERIOD_LABELS } from '../services/plans'

const coupons = ref([])
const plans = ref([])
const loading = ref(false)
const error = ref('')
const pagination = reactive({ page: 1, pageSize: 15, total: 0 })
const filters = reactive({ keyword: '' })
const dialogVisible = ref(false)
const dialogMode = ref('create')

const PERIOD_OPTIONS = Object.entries(PERIOD_LABELS).map(([value, label]) => ({ value, label }))

const couponTypeOptions = [
  { value: 1, label: '按金额优惠' },
  { value: 2, label: '按比例优惠' },
  { value: 3, label: '重置流量' },
]

const defaultForm = () => ({
  id: null,
  name: '',
  code: '',
  type: 1,
  value: 0,
  generateCount: 1,
  limitUse: null,
  limitUseWithUser: null,
  limitPlanIds: [],
  limitPeriod: [],
  dateRange: null,
})

const form = reactive(defaultForm())

function valueSuffix() {
  if (form.type === 1) return '¥'
  if (form.type === 2) return '%'
  return ''
}

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const [couponResult, planList] = await Promise.all([
      fetchManagedCoupons({ page: pagination.page, pageSize: pagination.pageSize, filters }),
      fetchManagedPlans(),
    ])
    coupons.value = couponResult.list
    Object.assign(pagination, couponResult.pagination)
    plans.value = planList
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function loadCoupons() {
  loading.value = true
  error.value = ''
  try {
    const result = await fetchManagedCoupons({ page: pagination.page, pageSize: pagination.pageSize, filters })
    coupons.value = result.list
    Object.assign(pagination, result.pagination)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  dialogMode.value = 'create'
  Object.assign(form, defaultForm())
  dialogVisible.value = true
}

function openEditDialog(coupon) {
  dialogMode.value = 'edit'
  form.id = coupon.id
  form.name = coupon.name
  form.code = coupon.code
  form.type = coupon.type
  form.value = coupon.value
  form.generateCount = 1
  form.limitUse = coupon.limitUse
  form.limitUseWithUser = coupon.limitUseWithUser
  form.limitPlanIds = Array.isArray(coupon.limitPlanIds) ? coupon.limitPlanIds.map(Number) : []
  form.limitPeriod = Array.isArray(coupon.limitPeriod) ? coupon.limitPeriod : []
  if (coupon.startedAt && coupon.endedAt) {
    form.dateRange = [new Date(coupon.startedAt * 1000), new Date(coupon.endedAt * 1000)]
  } else {
    form.dateRange = null
  }
  dialogVisible.value = true
}

async function handleSave() {
  const payload = {
    id: form.id || undefined,
    name: form.name,
    type: form.type,
    value: form.value,
    generateCount: (!form.id && form.generateCount > 1) ? form.generateCount : undefined,
    code: form.code || undefined,
    limitUse: form.limitUse || null,
    limitUseWithUser: form.limitUseWithUser || null,
    limitPlanIds: Array.isArray(form.limitPlanIds) ? form.limitPlanIds : [],
    limitPeriod: Array.isArray(form.limitPeriod) ? form.limitPeriod : [],
    startedAt: form.dateRange?.[0] ? Math.floor(new Date(form.dateRange[0]).getTime() / 1000) : null,
    endedAt: form.dateRange?.[1] ? Math.floor(new Date(form.dateRange[1]).getTime() / 1000) : null,
  }
  try {
    await generateCoupons(payload)
    ElMessage.success(form.id ? '优惠券已保存' : '优惠券已生成')
    dialogVisible.value = false
    await loadCoupons()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

async function handleDelete(coupon) {
  try {
    await ElMessageBox.confirm(`确认删除优惠券「${coupon.name}」吗？`, '删除优惠券', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    })
    await deleteCoupon(coupon.id)
    ElMessage.success('优惠券已删除')
    await loadCoupons()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(err.message || '删除失败')
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
  return couponTypeOptions.find(o => o.value === type)?.label || '未知'
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

onMounted(loadAll)
</script>

<template>
  <section class="page-stack">
    <SectionCard title="优惠券管理" description="管理系统优惠券，包括创建、编辑、删除和显隐控制。">
      <template #actions>
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          添加优惠券
        </el-button>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

      <div style="margin-bottom: 16px;">
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
        <el-table-column label="代码" min-width="140">
          <template #default="{ row }">
            <code style="font-size: 12px; background: rgba(0,0,0,.04); padding: 2px 6px; border-radius: 4px;">{{ row.code }}</code>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === 1 ? 'primary' : row.type === 2 ? 'success' : 'info'">
              {{ formatCouponType(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="面值" width="100">
          <template #default="{ row }">{{ formatCouponValue(row) }}</template>
        </el-table-column>
        <el-table-column label="使用限制" width="80">
          <template #default="{ row }">{{ row.limitUse ?? '不限' }}</template>
        </el-table-column>
        <el-table-column label="显示" width="70">
          <template #default="{ row }">
            <el-switch :model-value="row.show" size="small" @change="handleToggleShow(row)" />
          </template>
        </el-table-column>
        <el-table-column label="有效期" min-width="150">
          <template #default="{ row }">
            <span v-if="row.startedAt && row.endedAt" style="font-size: 12px;">
              {{ formatTime(row.startedAt) }}<br/>至 {{ formatTime(row.endedAt) }}
            </span>
            <span v-else style="color:var(--el-text-color-secondary);">永久</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">
              <el-icon><Edit /></el-icon>
            </el-button>
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

    <!-- Add / Edit Coupon Dialog -->
    <el-dialog v-model="dialogVisible" :title="dialogMode === 'create' ? '添加优惠券' : '编辑优惠券'" width="540px">
      <el-form label-position="top">
        <el-form-item label="优惠券名称">
          <el-input v-model="form.name" placeholder="请输入优惠券名称" />
        </el-form-item>

        <el-form-item v-if="dialogMode === 'create'" label="批量生成数量">
          <el-input v-model.number="form.generateCount" type="number" placeholder="批量生成优惠码数量，留空则生成单个" :min="1" />
          <div class="form-help-text">批量生成多个优惠码，留空只生成单个优惠码</div>
        </el-form-item>

        <el-form-item label="自定义优惠码">
          <el-input v-model="form.code" placeholder="自定义优惠码，留空则自动生成" />
          <div class="form-help-text">可以自定义优惠码，留空系统自动生成</div>
        </el-form-item>

        <el-form-item label="优惠券类型和值">
          <div style="display: flex; gap: 8px; width: 100%;">
            <el-select v-model="form.type" style="width: 160px;">
              <el-option v-for="opt in couponTypeOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
            </el-select>
            <el-input v-model.number="form.value" placeholder="0" style="flex: 1;">
              <template #suffix>{{ valueSuffix() }}</template>
            </el-input>
          </div>
        </el-form-item>

        <el-form-item label="优惠券有效期">
          <el-date-picker
            v-model="form.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            style="width: 100%;"
          />
        </el-form-item>

        <el-form-item label="最大使用次数">
          <el-input v-model.number="form.limitUse" type="number" placeholder="限制最大使用次数，留空则不限制" />
          <div class="form-help-text">设置优惠券的总使用次数限制，留空表示不限制使用次数</div>
        </el-form-item>

        <el-form-item label="每个用户可使用次数">
          <el-input v-model.number="form.limitUseWithUser" type="number" placeholder="限制每个用户可使用次数，留空则不限制" />
          <div class="form-help-text">限制每个用户可使用该优惠券的次数，留空表示不限制单用户使用次数</div>
        </el-form-item>

        <el-form-item label="指定周期">
          <el-select
            v-model="form.limitPeriod"
            multiple
            clearable
            collapse-tags
            collapse-tags-tooltip
            placeholder="限制指定周期可以使用优惠，留空则不限制"
            style="width: 100%;"
          >
            <el-option
              v-for="opt in PERIOD_OPTIONS"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            />
          </el-select>
          <div class="form-help-text">选择可以使用优惠券的订阅周期，留空表示不限制使用周期</div>
        </el-form-item>

        <el-form-item label="指定订阅">
          <el-select
            v-model="form.limitPlanIds"
            multiple
            filterable
            clearable
            collapse-tags
            collapse-tags-tooltip
            placeholder="限制指定订阅可以使用优惠，留空则不限制"
            style="width: 100%;"
          >
            <el-option
              v-for="plan in plans"
              :key="plan.id"
              :value="plan.id"
              :label="plan.name"
            />
          </el-select>
          <div class="form-help-text">限制可使用优惠券的套餐，留空表示不限制</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
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
