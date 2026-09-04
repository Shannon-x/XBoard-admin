<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Copy, ExternalLink, RefreshCw, Search } from 'lucide-vue-next'
import SectionCard from '../components/common/SectionCard.vue'
import {
  WITHDRAWAL_STATUS,
  createEmptyWithdrawalsPagination,
  fetchManagedWithdrawals,
  fetchWithdrawalDetail,
  fetchWithdrawalRate,
  fetchWithdrawalStats,
  rejectWithdrawal,
  settleWithdrawal,
} from '../services/withdrawals'
import { copyText } from '../utils/clipboard'
import { formatCents } from '../utils/format'
import { createSequence } from '../utils/sequence'

const router = useRouter()

const list = ref([])
const pagination = ref(createEmptyWithdrawalsPagination())
const loading = ref(false)
const errorMsg = ref('')
const statusFilter = ref('0')
const emailSearch = ref('')
const stats = ref({ pendingCount: 0, pendingAmount: 0 })

const statusOptions = [
  { label: '待处理', value: '0' },
  { label: '已完成', value: '1' },
  { label: '已驳回', value: '2' },
  { label: '已取消', value: '3' },
  { label: '全部', value: '' },
]

const listSeq = createSequence()

async function loadList() {
  const my = listSeq.next()
  loading.value = true
  errorMsg.value = ''
  try {
    const result = await fetchManagedWithdrawals({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      status: statusFilter.value,
      email: emailSearch.value.trim(),
    })
    if (!listSeq.isCurrent(my)) return
    list.value = result.list
    pagination.value = result.pagination
  } catch (err) {
    if (!listSeq.isCurrent(my)) return
    errorMsg.value = err?.message || '加载提现列表失败'
  } finally {
    if (listSeq.isCurrent(my)) loading.value = false
  }
}

async function loadStats() {
  try {
    stats.value = await fetchWithdrawalStats()
  } catch (err) {
    console.warn('[WithdrawalsPage] 加载统计失败', err)
  }
}

function refreshAll() {
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
  pagination.value.pageSize = size
  pagination.value.page = 1
  loadList()
}

// ===== 详情 =====
const detailVisible = ref(false)
const detail = ref(null)
const detailLoading = ref(false)

async function openDetail(row) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await fetchWithdrawalDetail(row.id)
  } catch (err) {
    ElMessage.error(err?.message || '加载详情失败')
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

const detailImages = computed(function detailImages() {
  return (detail.value?.attachments || []).filter(function isImage(item) { return item.isImage })
})

const detailFiles = computed(function detailFiles() {
  return (detail.value?.attachments || []).filter(function notImage(item) { return !item.isImage })
})

async function handleCopy(text, label = '已复制') {
  if (!text) return
  if (await copyText(text)) ElMessage.success(label)
  else ElMessage.error('复制失败，浏览器拒绝访问剪贴板')
}

function openTicket(ticketId) {
  if (!ticketId) return
  const href = router.resolve({ name: 'tickets', query: { ticket_id: ticketId } }).href
  window.open(href, '_blank', 'noopener,noreferrer')
}

function openUser(row) {
  if (!row?.userId) return
  const href = router.resolve({ name: 'users', query: { user_id: row.userId, user_email: row.userEmail } }).href
  window.open(href, '_blank', 'noopener,noreferrer')
}

// ===== 结算 =====
const settleVisible = ref(false)
const settleTarget = ref(null)
const settleSubmitting = ref(false)
const settleForm = reactive({ txid: '', paidUsdt: '', remark: '' })
// 打款那一刻的实时报价：申请可能是几小时前提的，行情早变了
const settleQuote = ref(null)
const settleQuoteLoading = ref(false)

async function loadSettleQuote(force) {
  if (!settleTarget.value) {
    return
  }
  settleQuoteLoading.value = true
  try {
    const snapshot = await fetchWithdrawalRate({ id: settleTarget.value.id, force })
    settleQuote.value = snapshot
    if (snapshot.quote?.net) {
      settleForm.paidUsdt = String(snapshot.quote.net)
    }
  } catch (err) {
    settleQuote.value = null
  } finally {
    settleQuoteLoading.value = false
  }
}

function openSettle(row) {
  settleTarget.value = row
  settleForm.txid = ''
  // 先用申请时的估算兜底，实时报价回来后覆盖
  settleForm.paidUsdt = row?.usdtAmount ? String(row.usdtAmount) : ''
  settleForm.remark = ''
  settleQuote.value = null
  settleVisible.value = true
  loadSettleQuote(false)
}

async function submitSettle() {
  if (!settleTarget.value) return
  settleSubmitting.value = true
  try {
    const updated = await settleWithdrawal(settleTarget.value.id, {
      txid: settleForm.txid,
      paidUsdt: settleForm.paidUsdt === '' ? null : Number(settleForm.paidUsdt),
      remark: settleForm.remark,
    })
    ElMessage.success(`提现 #${updated.id} 已标记完成，已回复工单并邮件通知用户`)
    settleVisible.value = false
    if (detail.value?.id === updated.id) detail.value = { ...detail.value, ...updated }
    refreshAll()
  } catch (err) {
    ElMessage.error(err?.message || '结算失败')
  } finally {
    settleSubmitting.value = false
  }
}

// ===== 驳回 =====
async function handleReject(row) {
  if (!row) return
  try {
    const { value } = await ElMessageBox.prompt(
      `驳回后冻结的 ¥${row.amountText} 佣金会退回用户账户，并把原因回复到工单、邮件通知用户。`,
      `驳回提现 #${row.id}`,
      {
        confirmButtonText: '确认驳回',
        cancelButtonText: '取消',
        inputPlaceholder: '请填写驳回原因（用户可见）',
        inputValidator: function validate(v) { return String(v || '').trim() ? true : '请填写驳回原因' },
        type: 'warning',
      },
    )
    const updated = await rejectWithdrawal(row.id, value)
    ElMessage.success(`提现 #${updated.id} 已驳回，佣金已退回`)
    if (detail.value?.id === updated.id) detail.value = { ...detail.value, ...updated }
    refreshAll()
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error(err?.message || '驳回失败')
    }
  }
}

function shortAddress(address) {
  const s = String(address || '')
  return s.length > 18 ? `${s.slice(0, 8)}…${s.slice(-6)}` : s
}

onMounted(function onMount() {
  refreshAll()
})
</script>

<template>
  <section class="page-stack">
    <SectionCard title="佣金提现" description="用户申请提现时佣金已冻结并自动开工单；这里确认打款或驳回，系统会回复工单、关闭工单并邮件通知用户。">
      <template #actions>
        <el-space wrap>
          <el-tag v-if="stats.pendingCount" type="warning" effect="dark">
            待处理 {{ stats.pendingCount }} 笔 · ¥{{ formatCents(stats.pendingAmount) }}
          </el-tag>
          <el-input
            v-model="emailSearch"
            :prefix-icon="Search"
            clearable
            placeholder="搜索用户邮箱"
            style="width: 220px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-button :icon="RefreshCw" class="ghost-btn small" plain type="info" @click="refreshAll">刷新</el-button>
        </el-space>
      </template>

      <div class="order-filter-bar">
        <el-space wrap :size="6">
          <el-tag
            v-for="opt in statusOptions"
            :key="opt.value"
            :effect="statusFilter === opt.value ? 'dark' : 'plain'"
            class="order-filter-tag"
            @click="statusFilter = opt.value; handleSearch()"
          >{{ opt.label }}</el-tag>
        </el-space>
      </div>

      <el-alert v-if="errorMsg" :title="errorMsg" closable show-icon type="error" style="margin-bottom: 16px" @close="errorMsg = ''" />

      <el-table v-loading="loading" :data="list" stripe style="width: 100%" class="withdrawals-table" @row-click="openDetail">
        <el-table-column label="#" prop="id" width="70" />
        <el-table-column label="用户" min-width="200">
          <template #default="{ row }">
            <span class="x-link" @click.stop="openUser(row)">{{ row.userEmail }}</span>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="120">
          <template #default="{ row }">
            <strong>¥{{ row.amountText }}</strong>
          </template>
        </el-table-column>
        <el-table-column label="≈ USDT" width="120">
          <template #default="{ row }">
            <span v-if="row.paidUsdt">{{ row.paidUsdt }} <el-tag size="small" type="success" effect="plain">实付</el-tag></span>
            <span v-else-if="row.usdtAmount" class="muted">{{ row.usdtAmount }}</span>
            <div v-if="Number(row.usdtFee) > 0" class="muted small">含通道费 {{ row.usdtFee }} USDT</div>
            <span v-else class="muted">--</span>
          </template>
        </el-table-column>
        <el-table-column label="链" min-width="160" prop="chainLabel" show-overflow-tooltip />
        <el-table-column label="地址" min-width="180">
          <template #default="{ row }">
            <span class="mono" :title="row.address">{{ shortAddress(row.address) }}</span>
            <el-button link size="small" :icon="Copy" @click.stop="handleCopy(row.address, '地址已复制')" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.statusType" size="small" effect="dark">{{ row.statusText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" width="150" prop="createdAt" />
        <el-table-column fixed="right" label="操作" width="200">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 4px;">
              <el-button link size="small" type="primary" @click.stop="openDetail(row)">详情</el-button>
              <template v-if="row.status === 0">
                <el-button link size="small" type="success" @click.stop="openSettle(row)">标记已打款</el-button>
                <el-button link size="small" type="danger" @click.stop="handleReject(row)">驳回</el-button>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :page-sizes="[15, 30, 50, 100]"
        :total="pagination.total"
        background
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 16px; justify-content: flex-end"
        @current-change="handlePageChange"
        @size-change="handlePageSizeChange"
      />
    </SectionCard>

    <!-- 详情 -->
    <el-dialog v-model="detailVisible" width="min(720px, calc(100vw - 32px))" :title="detail ? `提现 #${detail.id}` : '提现详情'" destroy-on-close>
      <div v-loading="detailLoading" class="withdraw-detail">
        <template v-if="detail">
          <div class="withdraw-detail__grid">
            <span class="withdraw-detail__label">用户</span>
            <span class="withdraw-detail__val x-link" @click="openUser(detail)">{{ detail.userEmail }}</span>
            <span class="withdraw-detail__label">状态</span>
            <span><el-tag :type="detail.statusType" size="small" effect="dark">{{ detail.statusText }}</el-tag></span>
            <span class="withdraw-detail__label">金额</span>
            <span class="withdraw-detail__val"><strong>¥{{ detail.amountText }}</strong>
              <span v-if="detail.usdtAmount" class="muted">（≈ {{ detail.usdtAmount }} USDT，参考汇率 {{ detail.usdtRate }}）</span>
            </span>
            <span class="withdraw-detail__label">链</span>
            <span class="withdraw-detail__val">{{ detail.chainLabel }}</span>
            <span class="withdraw-detail__label">收款地址</span>
            <span class="withdraw-detail__val mono">
              {{ detail.address }}
              <el-button link size="small" :icon="Copy" @click="handleCopy(detail.address, '地址已复制')">复制</el-button>
            </span>
            <span class="withdraw-detail__label">用户当前佣金余额</span>
            <span class="withdraw-detail__val">¥{{ formatCents(detail.userCommissionBalance) }}<span class="muted">（本笔已在申请时冻结扣除）</span></span>
            <span class="withdraw-detail__label">风控参考</span>
            <span class="withdraw-detail__val">
              <el-tag v-if="detail.sameAddressPaidCount > 0" size="small" type="success" effect="plain">此地址已成功打款 {{ detail.sameAddressPaidCount }} 次</el-tag>
              <el-tag v-else size="small" type="warning" effect="plain">首次打款到该地址，请核对二维码与工单</el-tag>
              <span class="muted">该用户历史成功提现 {{ detail.userPaidCount ?? 0 }} 次</span>
            </span>
            <span class="withdraw-detail__label">申请时间</span>
            <span class="withdraw-detail__val">{{ detail.createdAt }}</span>
            <template v-if="detail.status !== 0">
              <span class="withdraw-detail__label">处理时间</span>
              <span class="withdraw-detail__val">{{ detail.settledAt }}</span>
            </template>
            <template v-if="detail.txid">
              <span class="withdraw-detail__label">交易哈希</span>
              <span class="withdraw-detail__val mono">
                {{ detail.txid }}
                <a v-if="detail.explorerUrl" :href="detail.explorerUrl" target="_blank" rel="noopener noreferrer" class="withdraw-detail__link"><el-icon><ExternalLink /></el-icon> 浏览器</a>
              </span>
            </template>
            <template v-if="detail.paidUsdt">
              <span class="withdraw-detail__label">实付</span>
              <span class="withdraw-detail__val">{{ detail.paidUsdt }} USDT</span>
            </template>
            <template v-if="detail.rejectReason">
              <span class="withdraw-detail__label">驳回原因</span>
              <span class="withdraw-detail__val">{{ detail.rejectReason }}</span>
            </template>
            <template v-if="detail.remark">
              <span class="withdraw-detail__label">管理员备注</span>
              <span class="withdraw-detail__val">{{ detail.remark }}</span>
            </template>
          </div>

          <div v-if="detailImages.length || detailFiles.length" class="withdraw-detail__attachments">
            <div class="withdraw-detail__label">用户上传的收款二维码 / 附件</div>
            <div class="withdraw-detail__images">
              <el-image
                v-for="img in detailImages"
                :key="img.id"
                :src="img.url"
                :preview-src-list="detailImages.map(i => i.url)"
                :initial-index="detailImages.indexOf(img)"
                fit="contain"
                preview-teleported
                class="withdraw-detail__image"
              />
              <a v-for="file in detailFiles" :key="file.id" :href="file.url" target="_blank" rel="noopener noreferrer" class="withdraw-detail__file">{{ file.name }}</a>
            </div>
          </div>
          <el-alert v-else type="info" :closable="false" show-icon title="用户未上传收款二维码，请以地址为准" style="margin-top: 12px" />
        </template>
      </div>
      <template #footer>
        <el-button v-if="detail?.ticketId" @click="openTicket(detail.ticketId)">打开工单</el-button>
        <template v-if="detail && detail.status === 0">
          <el-button type="danger" plain @click="handleReject(detail)">驳回</el-button>
          <el-button type="success" @click="openSettle(detail)">标记已打款</el-button>
        </template>
        <el-button v-else @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 结算 -->
    <el-dialog v-model="settleVisible" width="min(520px, calc(100vw - 32px))" :title="settleTarget ? `标记已打款 · 提现 #${settleTarget.id}` : '标记已打款'">
      <div v-if="settleTarget" class="settle-form">
        <el-alert type="info" :closable="false" show-icon style="margin-bottom: 14px">
          <template #title>
            请先在链上完成转账：<strong>¥{{ settleTarget.amountText }}</strong>
            <span v-if="settleTarget.usdtAmount">（≈ {{ settleTarget.usdtAmount }} USDT）</span>
            → {{ settleTarget.chainLabel }}
          </template>
          确认后系统会：把本单标记完成 → 以你的身份回复并关闭工单 → 邮件通知用户。佣金已在申请时扣除，这里不会再扣。
        </el-alert>
        <div class="settle-form__address mono">
          {{ settleTarget.address }}
          <el-button link size="small" :icon="Copy" @click="handleCopy(settleTarget.address, '地址已复制')">复制地址</el-button>
        </div>
        <div class="settle-quote">
          <div class="settle-quote__head">
            <span>按当前实时汇率折算</span>
            <el-button link size="small" :icon="RefreshCw" :loading="settleQuoteLoading" @click="loadSettleQuote(true)">
              刷新行情
            </el-button>
          </div>
          <template v-if="settleQuote && settleQuote.quote && settleQuote.quote.net">
            <div class="settle-quote__row">
              <span>汇率</span>
              <span class="mono">1 USDT ≈ {{ settleQuote.currencySymbol }}{{ settleQuote.quote.rate }}</span>
              <el-tag size="small" type="info" effect="plain">{{ settleQuote.sourceLabel }}</el-tag>
            </div>
            <div class="settle-quote__row">
              <span>折算</span>
              <span class="mono">{{ settleQuote.quote.gross }} USDT</span>
            </div>
            <div class="settle-quote__row">
              <span>通道费</span>
              <span class="mono">- {{ settleQuote.quote.fee }} USDT</span>
            </div>
            <div class="settle-quote__row settle-quote__row--total">
              <span>应打款</span>
              <span class="mono">{{ settleQuote.quote.net }} USDT</span>
            </div>
          </template>
          <p v-else-if="settleQuoteLoading" class="settle-quote__muted">正在获取实时行情…</p>
          <p v-else class="settle-quote__muted">暂时取不到实时行情，请按申请时的估算或自行核算后填写。</p>
        </div>
        <el-form label-position="top">
          <el-form-item label="交易哈希 / TXID（可选，用户可在前端点击查看）">
            <el-input v-model="settleForm.txid" placeholder="0x… 或链上交易 ID" clearable />
          </el-form-item>
          <el-form-item label="实付 USDT 数量（留空则按上面的实时折算自动记录）">
            <el-input v-model="settleForm.paidUsdt" placeholder="如 13.8889" clearable />
          </el-form-item>
          <el-form-item label="管理员备注（仅后台可见）">
            <el-input v-model="settleForm.remark" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" maxlength="500" show-word-limit />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="settleVisible = false">取消</el-button>
        <el-button type="success" :loading="settleSubmitting" @click="submitSettle">确认已打款并通知用户</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.withdrawals-table :deep(.el-table__row) {
  cursor: pointer;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}

.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-left: 4px;
}

.muted.small {
  margin-left: 0;
  font-size: 11px;
}

.settle-quote {
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.settle-quote__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}

.settle-quote__row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.9;
}

.settle-quote__row > span:first-child {
  width: 62px;
  color: var(--el-text-color-secondary);
}

.settle-quote__row--total {
  font-weight: 600;
  border-top: 1px dashed var(--el-border-color);
  margin-top: 4px;
  padding-top: 4px;
}

.settle-quote__muted {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.withdraw-detail {
  min-height: 120px;
}

.withdraw-detail__grid {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 10px 14px;
  font-size: 13px;
  align-items: start;
}

.withdraw-detail__label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  white-space: nowrap;
  padding-top: 2px;
}

.withdraw-detail__val {
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.withdraw-detail__link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: 6px;
  color: var(--el-color-primary);
  text-decoration: none;
}

.withdraw-detail__attachments {
  margin-top: 16px;
}

.withdraw-detail__images {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
}

.withdraw-detail__image {
  width: 200px;
  height: 200px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  cursor: zoom-in;
}

.withdraw-detail__file {
  align-self: center;
  color: var(--el-color-primary);
}

.settle-form__address {
  padding: 8px 10px;
  margin-bottom: 12px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}
</style>
