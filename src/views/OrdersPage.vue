<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import SectionCard from '../components/common/SectionCard.vue'
import { useI18n } from 'vue-i18n'
import {
  fetchManagedOrders,
  fetchOrderDetail,
  markOrderPaid,
  cancelOrder,
  updateOrder,
  assignOrder,
  createEmptyManagedOrdersPagination,
  ORDER_STATUS_MAP,
} from '../services/orders'
import { fetchManagedPlans } from '../services/plans'

const { t } = useI18n()

const orders = ref([])
const pagination = ref(createEmptyManagedOrdersPagination())
const loading = ref(false)
const errorMsg = ref('')
const searchKeyword = ref('')
const statusFilter = ref('')
const isCommission = ref(false)
const commissionStatusFilter = ref('')
const plans = ref([])

const detailDialogVisible = ref(false)
const detailData = ref(null)
const detailLoading = ref(false)

const assignDialogVisible = ref(false)
const assignForm = ref({
  email: '',
  planId: null,
  period: 'month_price',
  totalAmount: 0,
})
const assignSaving = ref(false)

const statusOptions = [
  { label: '全部', value: '' },
  { label: '待支付', value: '0' },
  { label: '开通中', value: '1' },
  { label: '已取消', value: '2' },
  { label: '已完成', value: '3' },
  { label: '已折抵', value: '4' },
]

const periodOptions = [
  { label: '月付', value: 'month_price' },
  { label: '季付', value: 'quarter_price' },
  { label: '半年付', value: 'half_year_price' },
  { label: '年付', value: 'year_price' },
  { label: '两年付', value: 'two_year_price' },
  { label: '三年付', value: 'three_year_price' },
  { label: '一次性', value: 'onetime_price' },
  { label: '重置包', value: 'reset_price' },
]

async function loadOrders() {
  loading.value = true
  errorMsg.value = ''
  try {
    const filter = []
    if (searchKeyword.value.trim()) {
      filter.push({ id: 'trade_no', value: searchKeyword.value.trim() })
    }
    if (statusFilter.value !== '') {
      filter.push({ id: 'status', value: `eq:${statusFilter.value}` })
    }
    if (commissionStatusFilter.value !== '') {
      filter.push({ id: 'commission_status', value: `eq:${commissionStatusFilter.value}` })
    }
    const result = await fetchManagedOrders({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      filter,
      isCommission: isCommission.value,
    })
    orders.value = result.list
    pagination.value = result.pagination
  } catch (err) {
    errorMsg.value = err.message || '加载订单列表失败'
  } finally {
    loading.value = false
  }
}

function handlePageChange(page) {
  pagination.value.page = page
  loadOrders()
}

function handlePageSizeChange(size) {
  pagination.value.pageSize = size
  pagination.value.page = 1
  loadOrders()
}

function handleSearch() {
  pagination.value.page = 1
  loadOrders()
}

async function openDetail(order) {
  detailLoading.value = true
  detailDialogVisible.value = true
  try {
    detailData.value = await fetchOrderDetail(order.id)
  } catch (err) {
    ElMessage.error(err.message || '获取订单详情失败')
    detailDialogVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

async function handleMarkPaid(order) {
  try {
    await ElMessageBox.confirm(`确定要标记订单 ${order.tradeNo} 为已支付吗？`, '手动确认支付', {
      type: 'warning',
    })
    await markOrderPaid(order.tradeNo)
    ElMessage.success('订单已标记为已支付')
    loadOrders()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '操作失败')
    }
  }
}

async function handleCancel(order) {
  try {
    await ElMessageBox.confirm(`确定要取消订单 ${order.tradeNo} 吗？`, '取消订单', {
      type: 'warning',
    })
    await cancelOrder(order.tradeNo)
    ElMessage.success('订单已取消')
    loadOrders()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '操作失败')
    }
  }
}

function openAssignDialog() {
  assignForm.value = {
    email: '',
    planId: null,
    period: 'month_price',
    totalAmount: 0,
  }
  assignDialogVisible.value = true
}

async function submitAssign() {
  assignSaving.value = true
  try {
    await assignOrder({
      ...assignForm.value,
      totalAmount: Math.round(Number(assignForm.value.totalAmount) * 100),
    })
    ElMessage.success('订单分配成功')
    assignDialogVisible.value = false
    loadOrders()
  } catch (err) {
    ElMessage.error(err.message || '分配失败')
  } finally {
    assignSaving.value = false
  }
}

onMounted(function onMount() {
  loadOrders()
  fetchManagedPlans().then(list => { plans.value = list }).catch(() => {})
})
</script>

<template>
  <section class="page-stack">
    <SectionCard description="在这里可以查看用户订单。包括分配、查看、删除等操作。" title="订单管理">
      <template #actions>
        <el-space wrap>
          <el-input
            v-model="searchKeyword"
            :prefix-icon="Search"
            clearable
            placeholder="搜索订单号..."
            style="width: 160px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-button class="primary-btn small" type="success" @click="openAssignDialog">
            分配订单
          </el-button>
        </el-space>
      </template>

      <!-- 筛选栏 -->
      <div class="order-filter-bar">
        <el-space wrap :size="6">
          <el-tag
            :effect="statusFilter === '' && !isCommission ? 'dark' : 'plain'"
            class="order-filter-tag"
            @click="statusFilter = ''; isCommission = false; commissionStatusFilter = ''; handleSearch()"
          >全部</el-tag>
          <el-tag
            v-for="opt in statusOptions.slice(1)"
            :key="opt.value"
            :effect="statusFilter === opt.value ? 'dark' : 'plain'"
            class="order-filter-tag"
            @click="statusFilter = opt.value; handleSearch()"
          >{{ opt.label }}</el-tag>
          <el-divider direction="vertical" />
          <el-tag
            :effect="isCommission ? 'dark' : 'plain'"
            class="order-filter-tag"
            @click="isCommission = !isCommission; handleSearch()"
          >仅佣金</el-tag>
          <el-select
            v-model="commissionStatusFilter"
            placeholder="佣金状态"
            style="width: 110px"
            @change="handleSearch"
            clearable
          >
            <el-option label="全部" value="" />
            <el-option label="待确认" value="0" />
            <el-option label="发放中" value="1" />
            <el-option label="已发放" value="2" />
            <el-option label="无效" value="3" />
          </el-select>
        </el-space>
      </div>

      <el-alert v-if="errorMsg" :title="errorMsg" closable show-icon type="error" style="margin-bottom: 16px" @close="errorMsg = ''" />

      <el-table v-loading="loading" :data="orders" stripe style="width: 100%">
        <el-table-column label="订单号" width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span style="font-family: monospace; font-size: 12px">{{ row.tradeNo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="60" prop="typeText" />
        <el-table-column label="订阅计划" min-width="140" prop="planName" show-overflow-tooltip />
        <el-table-column label="周期" width="80" prop="period" />
        <el-table-column label="支付金额" width="90">
          <template #default="{ row }">{{ row.totalAmountText }}</template>
        </el-table-column>
        <el-table-column label="订单状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.statusType" effect="dark" size="small">{{ row.statusText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="佣金金额" width="90">
          <template #default="{ row }">
            <span v-if="row.commissionBalance">¥{{ row.commissionBalance.toFixed(2) }}</span>
            <span v-else>--</span>
          </template>
        </el-table-column>
        <el-table-column label="佣金状态" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.commissionStatus !== null" :type="row.commissionStatusType" size="small">{{ row.commissionStatusText }}</el-tag>
            <span v-else>--</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="150" prop="createdAt" />
        <el-table-column fixed="right" label="操作" width="80">
          <template #default="{ row }">
            <el-dropdown trigger="click">
              <el-button link size="small" type="primary">操作</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="openDetail(row)">详情</el-dropdown-item>
                  <el-dropdown-item v-if="row.status === 0" @click="handleMarkPaid(row)">确认付款</el-dropdown-item>
                  <el-dropdown-item v-if="row.status === 0" divided @click="handleCancel(row)" style="color:var(--el-color-danger)">取消</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        background
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 16px; justify-content: flex-end"
        @current-change="handlePageChange"
        @size-change="handlePageSizeChange"
      />
    </SectionCard>

    <!-- 订单详情对话框 -->
    <el-dialog v-model="detailDialogVisible" title="订单详情" width="600px" destroy-on-close>
      <div v-loading="detailLoading">
        <template v-if="detailData">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="订单号">{{ detailData.tradeNo }}</el-descriptions-item>
            <el-descriptions-item label="类型">{{ detailData.typeText }}</el-descriptions-item>
            <el-descriptions-item label="套餐">{{ detailData.planName }}</el-descriptions-item>
            <el-descriptions-item label="周期">{{ detailData.period }}</el-descriptions-item>
            <el-descriptions-item label="金额">{{ detailData.totalAmountText }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="detailData.statusType" effect="dark" size="small">{{ detailData.statusText }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="佣金">¥{{ detailData.commissionBalance.toFixed(2) }}</el-descriptions-item>
            <el-descriptions-item label="佣金状态">{{ detailData.commissionStatusText }}</el-descriptions-item>
            <el-descriptions-item label="支付时间">{{ detailData.paidAt }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ detailData.createdAt }}</el-descriptions-item>
            <el-descriptions-item label="回调单号" :span="2">{{ detailData.callbackNo || '--' }}</el-descriptions-item>
          </el-descriptions>
        </template>
      </div>
    </el-dialog>

    <!-- 订单分配对话框 -->
    <el-dialog v-model="assignDialogVisible" title="订单分配" width="440px" destroy-on-close>
      <el-form :model="assignForm" label-position="top">
        <el-form-item label="用户邮箱">
          <el-input v-model="assignForm.email" placeholder="请输入用户邮箱" />
        </el-form-item>
        <el-form-item label="订阅计划">
          <el-select v-model="assignForm.planId" placeholder="请选择订阅计划" style="width: 100%">
            <el-option
              v-for="plan in plans"
              :key="plan.id"
              :label="plan.name"
              :value="plan.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="订单周期">
          <el-select v-model="assignForm.period" placeholder="请选择购买时长" style="width: 100%">
            <el-option
              v-for="opt in periodOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="支付金额">
          <el-input v-model.number="assignForm.totalAmount" placeholder="0" type="number" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button :loading="assignSaving" type="primary" @click="submitAssign">确定</el-button>
      </template>
    </el-dialog>
  </section>
</template>
