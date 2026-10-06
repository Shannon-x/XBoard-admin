<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { RefreshCw } from 'lucide-vue-next'
import {
  adjustBalance,
  createEmptyBalanceLogPagination,
  fetchBalanceLog,
} from '../../services/billing'
import { formatCents } from '../../utils/format'
import { createSequence } from '../../utils/sequence'
import { createPageSizePreference } from '../../utils/pageSizePreference'

/**
 * 用户余额流水 + 手工调账。
 * 用户页与工单页共用：传入 { id, email } 即可，余额以接口返回的为准（不信任列表里的旧值）。
 */
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  user: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue', 'adjusted'])

const visible = computed({
  get() {
    return props.modelValue
  },
  set(value) {
    emit('update:modelValue', value)
  },
})

const list = ref([])
const pageSizePreference = createPageSizePreference('balance-log', 20, [20, 50, 100])
const pagination = ref({ ...createEmptyBalanceLogPagination(), pageSize: pageSizePreference.initialSize })
const loading = ref(false)
const errorMsg = ref('')
const balance = ref(0)
const balanceLoaded = ref(false)
const seq = createSequence()

const adjustAmount = ref(null)
const adjustRemark = ref('')
const adjusting = ref(false)

const balanceText = computed(function balanceText() {
  return formatCents(balance.value)
})

const userEmail = computed(function userEmail() {
  return props.user?.email || '--'
})

const adjustDirection = computed(function adjustDirection() {
  const amount = Number(adjustAmount.value || 0)
  if (amount > 0) return 'add'
  if (amount < 0) return 'sub'
  return ''
})

async function loadLog() {
  const userId = Number(props.user?.id || 0)
  if (!userId) return
  const my = seq.next()
  loading.value = true
  errorMsg.value = ''
  try {
    const result = await fetchBalanceLog(userId, {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    })
    if (!seq.isCurrent(my)) return
    list.value = result.list
    pagination.value = result.pagination
    balance.value = result.balance
    balanceLoaded.value = true
  } catch (err) {
    if (!seq.isCurrent(my)) return
    errorMsg.value = err?.message || '加载余额流水失败'
  } finally {
    if (seq.isCurrent(my)) loading.value = false
  }
}

function handlePageChange(page) {
  pagination.value.page = page
  loadLog()
}

function handlePageSizeChange(size) {
  pageSizePreference.save(size)
  pagination.value.pageSize = size
  pagination.value.page = 1
  loadLog()
}

function resetState() {
  seq.next()
  list.value = []
  pagination.value = { ...createEmptyBalanceLogPagination(), pageSize: pageSizePreference.initialSize }
  balance.value = 0
  balanceLoaded.value = false
  errorMsg.value = ''
  adjustAmount.value = null
  adjustRemark.value = ''
}

async function handleAdjust() {
  const amount = Number(adjustAmount.value || 0)
  if (!amount) {
    ElMessage.warning('请输入要调整的金额，正数入账、负数扣减')
    return
  }
  const absText = Math.abs(amount).toFixed(2)
  const next = balance.value + Math.round(amount * 100)
  if (next < 0) {
    ElMessage.warning(`当前余额 ¥${balanceText.value}，不足以扣减 ¥${absText}`)
    return
  }
  const remark = adjustRemark.value.trim()
  try {
    await ElMessageBox.confirm(
      `将为 ${userEmail.value} ${amount > 0 ? '增加' : '扣减'} ¥${absText}，调整后余额 ¥${formatCents(next)}。这条记录会出现在用户的余额明细里${remark ? `，备注「${remark}」用户可见` : ''}。`,
      amount > 0 ? '确认入账' : '确认扣减',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: amount > 0 ? 'info' : 'warning' },
    )
  } catch {
    return
  }
  adjusting.value = true
  try {
    const nextBalance = await adjustBalance(props.user.id, amount, remark)
    balance.value = nextBalance
    ElMessage.success(`已${amount > 0 ? '入账' : '扣减'} ¥${absText}，当前余额 ¥${formatCents(nextBalance)}`)
    adjustAmount.value = null
    adjustRemark.value = ''
    pagination.value.page = 1
    await loadLog()
    emit('adjusted', { userId: props.user.id, balance: nextBalance })
  } catch (err) {
    ElMessage.error(err?.message || '调整失败')
  } finally {
    adjusting.value = false
  }
}

function referenceText(row) {
  if (row.orderId) return `订单 #${row.orderId}`
  if (row.refType === 'admin') return '后台操作'
  if (row.refType && row.refId) return `${row.refType} ${row.refId}`
  if (row.refType) return row.refType
  return '--'
}

watch(
  function watchOpen() {
    return [props.modelValue, props.user?.id]
  },
  function onOpenChange([open, userId]) {
    if (open && userId) {
      resetState()
      loadLog()
    }
    if (!open) {
      resetState()
    }
  },
  { immediate: true },
)
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="`余额流水 · ${userEmail}`"
    width="min(860px, calc(100vw - 32px))"
    class="balance-ledger-dialog"
    destroy-on-close
  >
    <div class="balance-ledger__head">
      <div class="balance-ledger__balance">
        <span class="balance-ledger__balance-label">当前余额</span>
        <strong class="balance-ledger__balance-value">¥{{ balanceLoaded ? balanceText : '--' }}</strong>
        <el-button :icon="RefreshCw" link size="small" :loading="loading" title="刷新" @click="loadLog" />
      </div>

      <div class="balance-ledger__adjust">
        <el-input-number
          v-model="adjustAmount"
          :precision="2"
          :step="10"
          :controls="false"
          placeholder="金额（元），负数为扣减"
          class="balance-ledger__amount"
        />
        <el-input
          v-model="adjustRemark"
          maxlength="255"
          placeholder="备注（用户可见），如：活动补偿"
          class="balance-ledger__remark"
          @keyup.enter="handleAdjust"
        />
        <el-button
          :type="adjustDirection === 'sub' ? 'danger' : 'primary'"
          :loading="adjusting"
          :disabled="!adjustDirection"
          plain
          @click="handleAdjust"
        >
          {{ adjustDirection === 'sub' ? '扣减余额' : '增加余额' }}
        </el-button>
      </div>
    </div>

    <el-alert v-if="errorMsg" :title="errorMsg" closable show-icon type="error" style="margin-bottom: 12px" @close="errorMsg = ''" />

    <el-table v-loading="loading" :data="list" stripe size="small" style="width: 100%">
      <el-table-column label="时间" width="140" prop="createdAtText" />
      <el-table-column label="类型" width="120">
        <template #default="{ row }">
          <el-tag :type="row.typeTag" size="small" effect="plain">{{ row.typeText }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="金额" width="110">
        <template #default="{ row }">
          <strong :class="['balance-ledger__amount-cell', row.amount < 0 ? 'is-sub' : 'is-add']">{{ row.amountText }}</strong>
        </template>
      </el-table-column>
      <el-table-column label="变动后余额" width="120">
        <template #default="{ row }">¥{{ row.balanceAfterText }}</template>
      </el-table-column>
      <el-table-column label="关联" min-width="120">
        <template #default="{ row }">{{ referenceText(row) }}</template>
      </el-table-column>
      <el-table-column label="备注" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.remark">{{ row.remark }}</span>
          <span v-else class="balance-ledger__muted">--</span>
        </template>
      </el-table-column>
      <el-table-column label="操作人" width="90">
        <template #default="{ row }">
          <span v-if="row.operatorId">管理员 #{{ row.operatorId }}</span>
          <span v-else class="balance-ledger__muted">系统</span>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="还没有余额变动记录。余额支付、取消订单退回、礼品卡、佣金划转和后台调账都会记在这里。" :image-size="64" />
      </template>
    </el-table>

    <el-pagination
      :current-page="pagination.page"
      :page-size="pagination.pageSize"
      :page-sizes="pageSizePreference.pageSizes"
      :total="pagination.total"
      background
      small
      layout="total, sizes, prev, pager, next"
      style="margin-top: 12px; justify-content: flex-end"
      @current-change="handlePageChange"
      @size-change="handlePageSizeChange"
    />
  </el-dialog>
</template>

<style scoped>
.balance-ledger__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-light);
}

.balance-ledger__balance {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.balance-ledger__balance-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.balance-ledger__balance-value {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.balance-ledger__adjust {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  flex: 1 1 420px;
  justify-content: flex-end;
}

.balance-ledger__amount {
  width: 170px;
}

.balance-ledger__remark {
  flex: 1 1 200px;
  max-width: 320px;
}

.balance-ledger__amount-cell {
  font-variant-numeric: tabular-nums;
}

.balance-ledger__amount-cell.is-add {
  color: var(--el-color-success);
}

.balance-ledger__amount-cell.is-sub {
  color: var(--el-color-danger);
}

.balance-ledger__muted {
  color: var(--el-text-color-secondary);
}
</style>
