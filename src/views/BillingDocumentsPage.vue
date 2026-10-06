<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, RefreshCw, Search, Send, X } from 'lucide-vue-next'
import SectionCard from '../components/common/SectionCard.vue'
import {
  createEmptyBillingDocumentsPagination,
  fetchBillingDocuments,
  resendBillingDocument,
} from '../services/billing'
import { toMailDelivery, toOrder, toUser } from '../utils/crossLink'
import { createSequence } from '../utils/sequence'
import { createPageSizePreference } from '../utils/pageSizePreference'

const route = useRoute()
const router = useRouter()

const list = ref([])
const pageSizePreference = createPageSizePreference('billing-documents', 20, [20, 50, 100])
const pagination = ref({ ...createEmptyBillingDocumentsPagination(), pageSize: pageSizePreference.initialSize })
const loading = ref(false)
const errorMsg = ref('')
const kindFilter = ref('')
const emailSearch = ref('')
// 从订单详情 / 用户页 / 邮件投递带过来的精确筛选；点掉标签就回到全量
const orderIdFilter = ref('')
const userIdFilter = ref('')
const resendingId = ref(0)

const kindOptions = [
  { label: '全部', value: '' },
  { label: '收据', value: 'receipt' },
  { label: '续费账单', value: 'invoice' },
]

const listSeq = createSequence()

const hasPreciseFilter = computed(function hasPreciseFilter() {
  return Boolean(orderIdFilter.value || userIdFilter.value)
})

async function loadList() {
  const my = listSeq.next()
  loading.value = true
  errorMsg.value = ''
  try {
    const result = await fetchBillingDocuments({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      kind: kindFilter.value,
      email: emailSearch.value.trim(),
      orderId: orderIdFilter.value,
      userId: userIdFilter.value,
    })
    if (!listSeq.isCurrent(my)) return
    list.value = result.list
    pagination.value = result.pagination
  } catch (err) {
    if (!listSeq.isCurrent(my)) return
    errorMsg.value = err?.message || '加载归档文档失败'
  } finally {
    if (listSeq.isCurrent(my)) loading.value = false
  }
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

function clearPreciseFilter() {
  orderIdFilter.value = ''
  userIdFilter.value = ''
  // 把地址栏里的精确筛选一并去掉，刷新页面不会又回到筛选态
  router.replace({ name: 'billingDocuments', query: emailSearch.value ? { email: emailSearch.value } : {} })
  handleSearch()
}

// 收据随时可以按订单重新渲染后重发；账单只有仍是当前到期周期（待付款）时后端才接受
function canResend(row) {
  if (row.kind === 'receipt') return Boolean(row.orderId)
  return row.status === 'open'
}

function resendHint(row) {
  if (canResend(row)) return row.sendCount ? '重新寄送到用户邮箱' : '尚未投递，寄送到用户邮箱'
  if (row.kind === 'receipt') return '收据对应的订单已不存在'
  return row.status === 'settled' ? '该周期已续费，账单无需重发' : '该周期已过期，账单已失效'
}

async function handleResend(row) {
  if (!canResend(row)) return
  try {
    await ElMessageBox.confirm(
      `${row.kindText} ${row.docNo} 将${row.mailSuppressed ? '尝试' : ''}重新寄送到 ${row.email}${row.mailSuppressed ? '；该用户当前处于暂停投递状态，邮件发不出时会改走 Telegram 或留在面板里' : ''}。`,
      `重发${row.kindText}`,
      { confirmButtonText: '重发', cancelButtonText: '取消', type: 'info' },
    )
  } catch {
    return
  }
  resendingId.value = row.id
  try {
    await resendBillingDocument(row.id)
    ElMessage.success('已加入发送队列，投递结果稍后会更新在列表里')
    loadList()
  } catch (err) {
    ElMessage.error(err?.message || '重发失败')
  } finally {
    resendingId.value = 0
  }
}

function openUser(row) {
  const location = toUser(row.userId, row.email)
  if (location) router.push(location)
}

function openOrder(row) {
  const location = toOrder(row.orderTradeNo)
  if (location) router.push(location)
}

function openMailDelivery(row) {
  router.push(toMailDelivery(row.email))
}

onMounted(function onMount() {
  if (route.query.order_id) orderIdFilter.value = String(route.query.order_id)
  if (route.query.user_id) userIdFilter.value = String(route.query.user_id)
  if (route.query.email) emailSearch.value = String(route.query.email)
  if (route.query.kind === 'receipt' || route.query.kind === 'invoice') kindFilter.value = String(route.query.kind)
  loadList()
})
</script>

<template>
  <section class="page-stack">
    <SectionCard
      title="账单与收据"
      description="付款后寄出的收据与到期前寄出的续费账单都会归档在这里；用户在面板里也能自行下载。投递失败的文档会标出，可以手动重发。"
    >
      <template #actions>
        <el-space wrap>
          <el-input
            v-model="emailSearch"
            :prefix-icon="Search"
            clearable
            placeholder="搜索用户邮箱"
            style="width: 220px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-button :icon="RefreshCw" class="ghost-btn small" plain type="info" @click="loadList">刷新</el-button>
        </el-space>
      </template>

      <div class="order-filter-bar">
        <el-space wrap :size="6">
          <el-tag
            v-for="opt in kindOptions"
            :key="opt.value"
            :effect="kindFilter === opt.value ? 'dark' : 'plain'"
            class="order-filter-tag"
            @click="kindFilter = opt.value; handleSearch()"
          >{{ opt.label }}</el-tag>
          <template v-if="hasPreciseFilter">
            <el-divider direction="vertical" />
            <el-tag v-if="orderIdFilter" type="warning" effect="plain" closable @close="clearPreciseFilter">
              订单 #{{ orderIdFilter }}
            </el-tag>
            <el-tag v-if="userIdFilter" type="warning" effect="plain" closable @close="clearPreciseFilter">
              用户 #{{ userIdFilter }}
            </el-tag>
          </template>
        </el-space>
      </div>

      <el-alert v-if="errorMsg" :title="errorMsg" closable show-icon type="error" style="margin-bottom: 16px" @close="errorMsg = ''" />

      <el-table v-loading="loading" :data="list" stripe style="width: 100%">
        <el-table-column label="编号" min-width="200">
          <template #default="{ row }">
            <span class="billing-doc-no">{{ row.docNo }}</span>
            <div class="billing-doc-sub">{{ row.sizeText }}</div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="130">
          <template #default="{ row }">
            <el-tag :type="row.kindType" size="small" effect="plain">{{ row.kindText }}</el-tag>
            <div v-if="row.stageText" class="billing-doc-sub">{{ row.stageText }}</div>
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="220">
          <template #default="{ row }">
            <span class="x-link" title="在用户管理中查看该用户" @click="openUser(row)">{{ row.email }}</span>
            <div class="billing-doc-badges">
              <el-tag
                v-if="row.mailSuppressed"
                size="small"
                type="danger"
                effect="plain"
                class="billing-doc-badge"
                title="该邮箱已暂停投递，点击查看原因"
                @click="openMailDelivery(row)"
              >已暂停投递</el-tag>
              <el-tag v-if="row.telegramBound" size="small" type="success" effect="plain">Telegram</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="110">
          <template #default="{ row }">
            <strong>¥{{ row.amountText }}</strong>
          </template>
        </el-table-column>
        <el-table-column label="订单 / 周期" min-width="190">
          <template #default="{ row }">
            <span v-if="row.orderTradeNo" class="x-link billing-doc-mono" title="在订单管理中查看该订单" @click="openOrder(row)">{{ row.orderTradeNo }}</span>
            <span v-else-if="row.orderId" class="billing-doc-mono">#{{ row.orderId }}</span>
            <span v-else class="billing-doc-muted">--</span>
            <div v-if="row.kind === 'invoice' && row.expiredAt" class="billing-doc-sub">到期 {{ row.expiredAtText }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.statusType" size="small" effect="dark">{{ row.statusText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="投递" min-width="170">
          <template #default="{ row }">
            <template v-if="row.sentAt">
              <span>{{ row.channelText || '邮件' }}</span>
              <span v-if="row.sendCount > 1" class="billing-doc-muted"> · 共 {{ row.sendCount }} 次</span>
              <div class="billing-doc-sub">{{ row.sentAtText }}</div>
            </template>
            <el-tag v-else size="small" type="warning" effect="plain">未投递</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="150" prop="createdAtText" />
        <el-table-column fixed="right" label="操作" width="150">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 4px;">
              <el-button
                v-if="row.downloadUrl"
                link
                size="small"
                type="primary"
                :icon="Download"
                tag="a"
                :href="row.downloadUrl"
                target="_blank"
                rel="noopener noreferrer"
              >下载</el-button>
              <el-tooltip :content="resendHint(row)" placement="top" :show-after="300">
                <span>
                  <el-button
                    link
                    size="small"
                    type="warning"
                    :icon="Send"
                    :disabled="!canResend(row)"
                    :loading="resendingId === row.id"
                    @click="handleResend(row)"
                  >重发</el-button>
                </span>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="还没有归档文档。付款开通后的收据与到期前的续费账单寄出后会出现在这里。" :image-size="72" />
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
  </section>
</template>

<style scoped>
.billing-doc-no,
.billing-doc-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.billing-doc-no {
  white-space: nowrap;
}

.billing-doc-mono {
  word-break: break-all;
}

.billing-doc-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.billing-doc-muted {
  color: var(--el-text-color-secondary);
}

.billing-doc-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.billing-doc-badges:empty {
  display: none;
}

.billing-doc-badge {
  cursor: pointer;
}
</style>
