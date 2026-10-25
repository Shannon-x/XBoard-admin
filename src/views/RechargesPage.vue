<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CheckCircle2, RefreshCw, Search, Settings2, XCircle } from 'lucide-vue-next'
import SectionCard from '../components/common/SectionCard.vue'
import {
  cancelRecharge,
  confirmRechargePaid,
  createEmptyRechargePagination,
  fetchRechargeDetail,
  fetchRecharges,
  fetchRechargeStats,
} from '../services/recharges'
import { toSettings, toUser } from '../utils/crossLink'
import { createSequence } from '../utils/sequence'
import { createPageSizePreference } from '../utils/pageSizePreference'

const route = useRoute()
const router = useRouter()

const list = ref([])
const pageSizePreference = createPageSizePreference('recharges', 20, [20, 50, 100])
const pagination = ref({ ...createEmptyRechargePagination(), pageSize: pageSizePreference.initialSize })
const loading = ref(false)
const errorMsg = ref('')
const stats = ref(null)
const statusFilter = ref('')
const keyword = ref('')
// 从用户页 / 余额流水带过来的精确筛选；点掉标签就回到全量
const userIdFilter = ref('')
const actingTradeNo = ref('')

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref(null)

const statusOptions = [
  { label: '全部', value: '' },
  { label: '待支付', value: 0 },
  { label: '已到账', value: 3 },
  { label: '已取消', value: 2 },
]

const listSeq = createSequence()

// 搜索框同时认邮箱与单号：带 @ 的按邮箱，其余按单号
const searchParams = computed(function searchParams() {
  const text = keyword.value.trim()
  if (!text) return {}
  return text.includes('@') ? { email: text } : { tradeNo: text }
})

async function loadList() {
  const my = listSeq.next()
  loading.value = true
  errorMsg.value = ''
  try {
    const result = await fetchRecharges({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      status: statusFilter.value,
      userId: userIdFilter.value,
      ...searchParams.value,
    })
    if (!listSeq.isCurrent(my)) return
    list.value = result.list
    pagination.value = result.pagination
  } catch (err) {
    if (!listSeq.isCurrent(my)) return
    errorMsg.value = err?.message || '加载充值记录失败'
  } finally {
    if (listSeq.isCurrent(my)) loading.value = false
  }
}

async function loadStats() {
  try {
    stats.value = await fetchRechargeStats()
  } catch {
    stats.value = null
  }
}

function reload() {
  loadList()
  loadStats()
}

function handleSearch() {
  pagination.value.page = 1
  loadList()
}

function handlePageChange(page) {
  pagination.value.page = page
  loadList()
}

function handlePageSizeChange(size) {
  pageSizePreference.save(size)
  pagination.value.pageSize = size
  pagination.value.page = 1
  loadList()
}

function clearUserFilter() {
  userIdFilter.value = ''
  router.replace({ name: 'recharges' })
  handleSearch()
}

function openUser(row) {
  const location = toUser(row.userId, row.userEmail)
  if (location) router.push(location)
}

async function openDetail(row) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await fetchRechargeDetail(row.tradeNo)
  } catch (err) {
    ElMessage.error(err?.message || '加载充值单详情失败')
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

async function handleConfirm(row) {
  const late = row.status === 2
  try {
    await ElMessageBox.confirm(
      `确认已在商户后台核实收到 ¥${row.payText}？将给 ${row.userEmail || `用户 #${row.userId}`} 入账 ¥${row.totalCreditText}`
        + `${row.bonusAmount > 0 ? `（含赠送 ¥${row.bonusText}）` : ''}。${late ? '这张单已取消，确认后会改为已到账。' : ''}只有网关回调确实没进来时才需要手动确认。`,
      '手动确认到账',
      { confirmButtonText: '确认到账', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  actingTradeNo.value = row.tradeNo
  try {
    await confirmRechargePaid(row.tradeNo)
    ElMessage.success('已入账')
    reload()
    if (detailVisible.value && detail.value?.tradeNo === row.tradeNo) openDetail(row)
  } catch (err) {
    ElMessage.error(err?.message || '入账失败')
  } finally {
    actingTradeNo.value = ''
  }
}

async function handleCancel(row) {
  try {
    await ElMessageBox.confirm(
      `取消充值单 ${row.tradeNo}？已发出的收款链接若之后仍被付款，系统会照样入账并通知管理员。`,
      '取消充值单',
      { confirmButtonText: '取消这张单', cancelButtonText: '返回', type: 'info' },
    )
  } catch {
    return
  }
  actingTradeNo.value = row.tradeNo
  try {
    await cancelRecharge(row.tradeNo)
    ElMessage.success('已取消')
    reload()
  } catch (err) {
    ElMessage.error(err?.message || '取消失败')
  } finally {
    actingTradeNo.value = ''
  }
}

onMounted(function onMount() {
  if (route.query.user_id) userIdFilter.value = String(route.query.user_id)
  if (route.query.trade_no) keyword.value = String(route.query.trade_no)
  else if (route.query.email) keyword.value = String(route.query.email)
  reload()
})
</script>

<template>
  <section class="page-stack">
    <SectionCard
      title="充值记录"
      description="用户给余额充值的单据。到账后余额立即可用，赠送额按下单时的档位计算；待支付超过 2 小时自动取消，取消后才付款的照样入账并通知管理员。"
    >
      <template #actions>
        <el-space wrap>
          <el-input
            v-model="keyword"
            :prefix-icon="Search"
            clearable
            placeholder="搜索用户邮箱或充值单号"
            style="width: 240px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-button :icon="RefreshCw" class="ghost-btn small" plain type="info" @click="reload">刷新</el-button>
          <el-button :icon="Settings2" class="ghost-btn small" plain @click="router.push(toSettings('recharge'))">充值设置</el-button>
        </el-space>
      </template>

      <div v-if="stats" class="recharge-stats">
        <div class="recharge-stats__item">
          <span class="recharge-stats__label">今日到账</span>
          <strong>¥{{ stats.today.depositText }}</strong>
          <span class="recharge-stats__sub">{{ stats.today.count }} 笔 · {{ stats.today.users }} 人</span>
        </div>
        <div class="recharge-stats__item">
          <span class="recharge-stats__label">本月到账</span>
          <strong>¥{{ stats.month.depositText }}</strong>
          <span class="recharge-stats__sub">{{ stats.month.count }} 笔 · 赠送 ¥{{ stats.month.bonusText }}</span>
        </div>
        <div class="recharge-stats__item">
          <span class="recharge-stats__label">上月到账</span>
          <strong>¥{{ stats.lastMonth.depositText }}</strong>
          <span class="recharge-stats__sub">{{ stats.lastMonth.count }} 笔 · 赠送 ¥{{ stats.lastMonth.bonusText }}</span>
        </div>
        <div class="recharge-stats__item">
          <span class="recharge-stats__label">待支付</span>
          <strong>{{ stats.pendingCount }}</strong>
          <span class="recharge-stats__sub">张</span>
        </div>
      </div>

      <div class="order-filter-bar">
        <el-space wrap :size="6">
          <el-tag
            v-for="opt in statusOptions"
            :key="String(opt.value)"
            :effect="statusFilter === opt.value ? 'dark' : 'plain'"
            class="order-filter-tag"
            @click="statusFilter = opt.value; handleSearch()"
          >{{ opt.label }}</el-tag>
          <template v-if="userIdFilter">
            <el-divider direction="vertical" />
            <el-tag type="warning" effect="plain" closable @close="clearUserFilter">用户 #{{ userIdFilter }}</el-tag>
          </template>
        </el-space>
      </div>

      <el-alert v-if="errorMsg" :title="errorMsg" closable show-icon type="error" style="margin-bottom: 16px" @close="errorMsg = ''" />

      <el-table v-loading="loading" :data="list" stripe style="width: 100%">
        <el-table-column label="充值单号" min-width="200">
          <template #default="{ row }">
            <span class="x-link recharge-mono" @click="openDetail(row)">{{ row.tradeNo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="200">
          <template #default="{ row }">
            <span class="x-link" title="在用户管理中查看该用户" @click="openUser(row)">{{ row.userEmail || `#${row.userId}` }}</span>
          </template>
        </el-table-column>
        <el-table-column label="充值 / 到账" min-width="150">
          <template #default="{ row }">
            <strong>¥{{ row.depositText }}</strong>
            <div v-if="row.bonusAmount > 0" class="recharge-sub">赠送 ¥{{ row.bonusText }}，到账 ¥{{ row.totalCreditText }}</div>
          </template>
        </el-table-column>
        <el-table-column label="支付方式" min-width="140">
          <template #default="{ row }">
            <span v-if="row.paymentName">{{ row.paymentName }}</span>
            <span v-else class="recharge-muted">未选择</span>
            <div v-if="row.handlingAmount > 0" class="recharge-sub">实付 ¥{{ row.payText }}（含手续费 ¥{{ row.handlingText }}）</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.statusType" size="small" effect="dark">{{ row.statusText }}</el-tag>
            <div v-if="row.manual" class="recharge-sub">手动确认</div>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">
            <div>{{ row.createdAtText }}</div>
            <div v-if="row.paidAt" class="recharge-sub">到账 {{ row.paidAtText }}</div>
          </template>
        </el-table-column>
        <el-table-column fixed="right" label="操作" width="190">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 4px;">
              <el-button link size="small" type="primary" @click="openDetail(row)">详情</el-button>
              <el-button
                v-if="row.status !== 3"
                link
                size="small"
                type="success"
                :icon="CheckCircle2"
                :loading="actingTradeNo === row.tradeNo"
                @click="handleConfirm(row)"
              >确认到账</el-button>
              <el-button
                v-if="row.status === 0"
                link
                size="small"
                type="danger"
                :icon="XCircle"
                :disabled="actingTradeNo === row.tradeNo"
                @click="handleCancel(row)"
              >取消</el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="还没有充值记录" :image-size="72" />
        </template>
      </el-table>

      <el-pagination
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :page-sizes="pageSizePreference.pageSizes"
        :total="pagination.total"
        background
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 16px; justify-content: flex-end"
        @current-change="handlePageChange"
        @size-change="handlePageSizeChange"
      />
    </SectionCard>

    <el-drawer v-model="detailVisible" title="充值单详情" size="480px">
      <div v-loading="detailLoading" class="recharge-detail">
        <template v-if="detail">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="充值单号"><span class="recharge-mono">{{ detail.tradeNo }}</span></el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="detail.statusType" size="small" effect="dark">{{ detail.statusText }}</el-tag>
              <span v-if="detail.manual" class="recharge-muted">（手动确认）</span>
            </el-descriptions-item>
            <el-descriptions-item label="用户">
              <span class="x-link" @click="openUser(detail)">{{ detail.userEmail || `#${detail.userId}` }}</span>
              <span v-if="detail.userBalanceText" class="recharge-muted">，当前余额 ¥{{ detail.userBalanceText }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="充值金额">¥{{ detail.depositText }}</el-descriptions-item>
            <el-descriptions-item label="赠送">¥{{ detail.bonusText }}</el-descriptions-item>
            <el-descriptions-item label="到账">¥{{ detail.totalCreditText }}</el-descriptions-item>
            <el-descriptions-item label="应付">
              ¥{{ detail.payText }}<span v-if="detail.handlingAmount > 0" class="recharge-muted">（含手续费 ¥{{ detail.handlingText }}）</span>
            </el-descriptions-item>
            <el-descriptions-item label="支付方式">{{ detail.paymentName || '未选择' }}<span v-if="detail.paymentMethod" class="recharge-muted"> · {{ detail.paymentMethod }}</span></el-descriptions-item>
            <el-descriptions-item label="网关流水"><span class="recharge-mono">{{ detail.callbackNo || '--' }}</span></el-descriptions-item>
            <el-descriptions-item label="邀请人">{{ detail.inviteUserEmail || (detail.inviteUserId ? `#${detail.inviteUserId}` : '--') }}<span class="recharge-muted">（充值不返佣）</span></el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ detail.createdAtText }}</el-descriptions-item>
            <el-descriptions-item label="到账时间">{{ detail.paidAt ? detail.paidAtText : '--' }}</el-descriptions-item>
          </el-descriptions>

          <h4 class="recharge-detail__title">入账流水</h4>
          <el-empty v-if="!detail.ledger.length" description="没有入账流水" :image-size="48" />
          <div v-for="row in detail.ledger" :key="row.id" class="recharge-ledger">
            <div><strong>+¥{{ row.amountText }}</strong> <span class="recharge-muted">余额 ¥{{ row.balanceBeforeText }} → ¥{{ row.balanceAfterText }}</span></div>
            <div class="recharge-sub">{{ row.createdAtText }}<span v-if="row.remark"> · {{ row.remark }}</span><span v-if="row.operatorId"> · 操作人 #{{ row.operatorId }}</span></div>
          </div>

          <h4 class="recharge-detail__title">付款核验</h4>
          <div v-if="detail.verification" class="recharge-ledger">
            <div>
              <el-tag size="small" :type="detail.verification.verdict === 'ok' ? 'success' : detail.verification.verdict === 'pending' ? 'info' : 'danger'" effect="plain">{{ detail.verification.verdictText }}</el-tag>
              <span v-if="detail.verification.gatewayMoneyText" class="recharge-muted">网关金额 ¥{{ detail.verification.gatewayMoneyText }}</span>
              <el-tag v-if="detail.verification.refunded" size="small" type="danger" style="margin-left: 6px">网关已退款</el-tag>
            </div>
            <div class="recharge-sub">{{ detail.verification.checkedAtText }}<span v-if="detail.verification.lastError"> · {{ detail.verification.lastError }}</span></div>
          </div>
          <p v-else class="recharge-muted">没有核验记录（只有易支付一类网关会在到账后向网关复核）。</p>

          <div class="recharge-detail__actions">
            <el-button v-if="detail.status !== 3" type="success" :icon="CheckCircle2" :loading="actingTradeNo === detail.tradeNo" @click="handleConfirm(detail)">确认到账</el-button>
            <el-button v-if="detail.status === 0" :icon="XCircle" @click="handleCancel(detail)">取消充值单</el-button>
          </div>
        </template>
      </div>
    </el-drawer>
  </section>
</template>

<style scoped>
.recharge-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.recharge-stats__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
}

.recharge-stats__item strong {
  font-size: 18px;
}

.recharge-stats__label,
.recharge-stats__sub,
.recharge-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.recharge-sub {
  margin-top: 2px;
}

.recharge-muted {
  color: var(--el-text-color-secondary);
}

.recharge-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}

.recharge-detail {
  min-height: 200px;
}

.recharge-detail__title {
  margin: 18px 0 8px;
  font-size: 14px;
}

.recharge-ledger {
  padding: 8px 10px;
  margin-bottom: 6px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  font-size: 13px;
}

.recharge-detail__actions {
  display: flex;
  gap: 8px;
  margin-top: 18px;
}
</style>
