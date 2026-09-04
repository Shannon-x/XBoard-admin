<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, RefreshCw, MessageCircle, Paperclip, X } from 'lucide-vue-next'
import SectionCard from '../components/common/SectionCard.vue'
import {
  fetchManagedTickets,
  fetchTicketDetail,
  replyTicket,
  closeTicket,
  uploadTicketAttachment,
  deleteTicketAttachment,
  createEmptyManagedTicketsPagination,
} from '../services/tickets'
import { fetchSiteSettingsGroup } from '../services/settings'
import { createSequence } from '../utils/sequence'
import {
  getUserInfoById,
  updateManagedUser,
  resetManagedUserSecret,
  banManagedUsers,
} from '../services/users'
import { fetchManagedPlans } from '../services/plans'

const route = useRoute()
const router = useRouter()

const tickets = ref([])
const pagination = ref(createEmptyManagedTicketsPagination())
const loading = ref(false)
const errorMsg = ref('')
const statusFilter = ref('')
const priorityFilter = ref('')   // '' / '0' / '1' / '2'
const emailSearch = ref('')

const detailDialogVisible = ref(false)
const detailData = ref(null)
const detailLoading = ref(false)
const replyMessage = ref('')
const replySending = ref(false)

// ===== 附件 =====
// 待发送的附件先上传拿 id、随回复一起绑定；关 dialog / 发送成功后清空。
// 配置（开关 / 上限 / 扩展名）从系统设置的 ticket 组取，用于隐藏入口与本地预检。
const attachmentConfig = ref(null)
const pendingAttachments = ref([])
const attachmentUploading = ref(false)
const attachmentInputRef = ref(null)

const attachmentEnabled = computed(function attachmentEnabled() {
  return Boolean(attachmentConfig.value?.ticketAttachmentEnable)
})

const attachmentAccept = computed(function attachmentAccept() {
  return String(attachmentConfig.value?.ticketAttachmentAllowedExtensions || '')
    .split(/[\s,，;]+/)
    .filter(Boolean)
    .map(function toAccept(ext) { return `.${ext.replace(/^\./, '')}` })
    .join(',')
})

async function loadAttachmentConfig() {
  try {
    attachmentConfig.value = await fetchSiteSettingsGroup('ticketAttachment')
  } catch (err) {
    console.warn('[TicketsPage] 加载附件配置失败', err)
    attachmentConfig.value = null
  }
}

async function uploadFiles(fileList) {
  const files = Array.from(fileList || []).filter(Boolean)
  if (!files.length || !attachmentEnabled.value) return
  const maxCount = Number(attachmentConfig.value?.ticketAttachmentMaxCount || 5)
  const maxSizeMb = Number(attachmentConfig.value?.ticketAttachmentMaxSizeMb || 5)
  const maxBytes = maxSizeMb * 1024 * 1024

  attachmentUploading.value = true
  try {
    for (const file of files) {
      if (pendingAttachments.value.length >= maxCount) {
        ElMessage.warning(`每条回复最多 ${maxCount} 个附件`)
        break
      }
      if (file.size > maxBytes) {
        ElMessage.warning(`${file.name || '文件'} 超过 ${maxSizeMb} MB 上限`)
        continue
      }
      try {
        const attachment = await uploadTicketAttachment(file)
        pendingAttachments.value = [
          ...pendingAttachments.value,
          { ...attachment, previewUrl: attachment.isImage ? URL.createObjectURL(file) : '' },
        ]
      } catch (err) {
        ElMessage.error(err?.message || `${file.name || '文件'} 上传失败`)
      }
    }
  } finally {
    attachmentUploading.value = false
  }
}

function handleAttachmentPick(event) {
  uploadFiles(event.target.files)
  event.target.value = ''
}

// 剪贴板里有文件（截图）就走上传，纯文本照常粘贴
function handleReplyPaste(event) {
  const files = Array.from(event.clipboardData?.items || [])
    .filter(function isFile(item) { return item.kind === 'file' })
    .map(function toFile(item) { return item.getAsFile() })
    .filter(Boolean)
  if (!files.length) return
  event.preventDefault()
  uploadFiles(files)
}

function handleReplyDrop(event) {
  const files = event.dataTransfer?.files
  if (files?.length) uploadFiles(files)
}

async function removePendingAttachment(attachment) {
  try {
    await deleteTicketAttachment(attachment.id)
  } catch (err) {
    // 撤回失败也从列表移除：未绑定的附件 24h 后由后端清理任务回收
    console.warn('[TicketsPage] 撤回附件失败', err)
  }
  if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
  pendingAttachments.value = pendingAttachments.value.filter(function keep(item) {
    return item.id !== attachment.id
  })
}

function clearPendingAttachments() {
  for (const item of pendingAttachments.value) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  }
  pendingAttachments.value = []
}

// 删除用户已发出的附件（违规内容处理）
async function handleDeleteMessageAttachment(attachment) {
  try {
    await deleteTicketAttachment(attachment.id)
    ElMessage.success('附件已删除')
    if (detailData.value) {
      detailData.value = await fetchTicketDetail(detailData.value.id)
    }
  } catch (err) {
    ElMessage.error(err?.message || '删除失败')
  }
}

function imageUrlsOf(msg) {
  return (msg.attachments || [])
    .filter(function isImage(item) { return item.isImage })
    .map(function toUrl(item) { return item.url })
}

function imageIndexOf(msg, attachment) {
  const index = imageUrlsOf(msg).indexOf(attachment.url)
  return index < 0 ? 0 : index
}

// 工单作者的用户信息：随 detailData 一起拉取，关 dialog 时清空。
// 用 token 序列号防止快速切换工单时旧请求覆盖新数据。
const ticketUser = ref(null)
const ticketUserLoading = ref(false)
const ticketUserError = ref('')
const ticketUserActionLoading = ref(false)
let ticketUserFetchToken = 0

// user/getUserInfoById 接口只返回 plan_id 等标量字段，不带 plan 关联对象，
// 所以 ticketUser.planName 恒为 '--'。这里单独加载套餐列表，用 planId 解析套餐名。
const userPlans = ref([])
const ticketUserPlanName = computed(function ticketUserPlanName() {
  const u = ticketUser.value
  if (!u) return '--'
  // 接口若已带套餐名（非占位符）则优先用
  if (u.planName && u.planName !== '--') return u.planName
  // 否则按 planId 查套餐列表解析
  if (u.planId) {
    const p = userPlans.value.find(pl => pl.id === u.planId)
    return p ? p.name : `ID:${u.planId}`
  }
  return '--'
})

async function loadTicketUser(userId) {
  ticketUser.value = null
  ticketUserError.value = ''
  if (!userId) {
    return
  }

  const myToken = ++ticketUserFetchToken
  ticketUserLoading.value = true
  try {
    const user = await getUserInfoById(Number(userId))
    if (myToken !== ticketUserFetchToken) return
    ticketUser.value = user
  } catch (err) {
    if (myToken !== ticketUserFetchToken) return
    ticketUserError.value = err?.message || '加载用户信息失败'
  } finally {
    if (myToken === ticketUserFetchToken) {
      ticketUserLoading.value = false
    }
  }
}

function clearTicketUser() {
  ticketUserFetchToken += 1 // invalidate any in-flight fetch
  ticketUser.value = null
  ticketUserLoading.value = false
  ticketUserError.value = ''
}

const statusOptions = [
  { label: '全部', value: '' },
  { label: '待回复', value: 'pending' },
  { label: '已回复', value: 'replied' },
  { label: '已关闭', value: 'closed' },
]

const ticketsSeq = createSequence()

async function loadTickets() {
  const my = ticketsSeq.next()
  loading.value = true
  errorMsg.value = ''
  try {
    const options = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    }
    if (statusFilter.value === 'pending') {
      options.status = 0
      options.replyStatus = [1]
    } else if (statusFilter.value === 'replied') {
      options.status = 0
      options.replyStatus = [0]
    } else if (statusFilter.value === 'closed') {
      options.status = 1
    }
    if (emailSearch.value.trim()) {
      options.email = emailSearch.value.trim()
    }
    // push 而不是整体赋值：直接 `options.filter = [...]` 会静默吃掉之后
    // 任何人再往 filter 里加的条件。这一页目前只有 level 一项，但语义上
    // filter 是可累加的条件数组。
    if (priorityFilter.value !== '') {
      options.filter = [...(options.filter || []), { id: 'level', value: `eq:${priorityFilter.value}` }]
    }
    const result = await fetchManagedTickets(options)
    if (!ticketsSeq.isCurrent(my)) return
    tickets.value = result.list
    pagination.value = result.pagination
  } catch (err) {
    if (!ticketsSeq.isCurrent(my)) return
    errorMsg.value = err.message || '加载工单列表失败'
  } finally {
    if (ticketsSeq.isCurrent(my)) loading.value = false
  }
}

function handlePageChange(page) {
  pagination.value.page = page
  loadTickets()
}

function handlePageSizeChange(size) {
  pagination.value.pageSize = size
  pagination.value.page = 1
  loadTickets()
}

function handleSearch() {
  pagination.value.page = 1
  loadTickets()
}

async function openDetail(ticket) {
  detailLoading.value = true
  detailDialogVisible.value = true
  replyMessage.value = ''
  clearTicketUser()
  try {
    detailData.value = await fetchTicketDetail(ticket.id)
    await nextTick()
    scrollToBottom()
    // 并行（不等待）拉取作者信息；失败也不影响工单详情显示
    loadTicketUser(detailData.value?.userId)
  } catch (err) {
    ElMessage.error(err.message || '获取工单详情失败')
    detailDialogVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

function handleDetailDialogClosed() {
  clearTicketUser()
  clearPendingAttachments()
  detailData.value = null
}

async function handleReply() {
  const text = replyMessage.value.trim()
  const attachmentIds = pendingAttachments.value.map(function toId(item) { return item.id })
  if (!text && !attachmentIds.length) {
    ElMessage.warning('请输入回复内容或添加附件')
    return
  }
  if (attachmentUploading.value) {
    ElMessage.warning('附件还在上传中，请稍候')
    return
  }

  replySending.value = true
  try {
    await replyTicket(detailData.value.id, text, attachmentIds)
    ElMessage.success('回复成功')
    replyMessage.value = ''
    clearPendingAttachments()
    detailData.value = await fetchTicketDetail(detailData.value.id)
    await nextTick()
    scrollToBottom()
    loadTickets()
  } catch (err) {
    ElMessage.error(err.message || '回复失败')
  } finally {
    replySending.value = false
  }
}

async function handleClose(ticket) {
  const ticketToClose = ticket || detailData.value
  if (!ticketToClose) return

  try {
    await ElMessageBox.confirm(`确定要关闭工单 #${ticketToClose.id} 吗？`, '关闭工单', {
      type: 'warning',
    })
    await closeTicket(ticketToClose.id)
    ElMessage.success('工单已关闭')
    if (detailDialogVisible.value && detailData.value?.id === ticketToClose.id) {
      detailData.value = await fetchTicketDetail(ticketToClose.id)
    }
    loadTickets()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || '关闭失败')
    }
  }
}

// ===== 工单作者快捷操作 =====
// 行为与 UsersPage 行内操作保持一致，确认文案、调用的 service、参数都对齐，
// 这样后续若 UsersPage 改动只需同步这里即可。
async function handleResetUserTraffic() {
  const user = ticketUser.value
  if (!user?.id) return
  try {
    await ElMessageBox.confirm(
      `确定要重置用户 ${user.email} 的已用流量吗？该操作不可恢复。`,
      '重置流量',
      { type: 'warning' },
    )
    ticketUserActionLoading.value = true
    await updateManagedUser({ id: user.id, u: 0, d: 0 })
    ElMessage.success('流量已重置')
    await loadTicketUser(user.id)
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err?.message || '操作失败')
    }
  } finally {
    ticketUserActionLoading.value = false
  }
}

async function handleResetUserSecret() {
  const user = ticketUser.value
  if (!user?.id) return
  try {
    await ElMessageBox.confirm(
      `确定要重置用户 ${user.email} 的订阅链接和 UUID 吗？\n\n该操作不可恢复，老订阅链接将立即失效，用户需要重新导入。`,
      '重置订阅链接 / UUID',
      { type: 'warning', confirmButtonText: '确定重置', cancelButtonText: '取消' },
    )
    ticketUserActionLoading.value = true
    await resetManagedUserSecret(user.id)
    ElMessage.success('订阅链接和 UUID 已重置')
    await loadTicketUser(user.id)
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err?.message || '操作失败')
    }
  } finally {
    ticketUserActionLoading.value = false
  }
}

async function handleToggleUserBan() {
  const user = ticketUser.value
  if (!user?.id) return
  const willBan = !user.isBanned
  const action = willBan ? '封禁' : '解封'
  try {
    await ElMessageBox.confirm(
      `确定要${action}用户 ${user.email} 吗？`,
      `${action}用户`,
      { type: 'warning' },
    )
    ticketUserActionLoading.value = true
    if (willBan) {
      // 复用 UsersPage 的 banManagedUsers 参数格式
      await banManagedUsers({ scope: 'selected', user_ids: [user.id] })
    } else {
      await updateManagedUser({ id: user.id, banned: 0 })
    }
    ElMessage.success(`已${action}`)
    await loadTicketUser(user.id)
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err?.message || '操作失败')
    }
  } finally {
    ticketUserActionLoading.value = false
  }
}

async function handleCopyUserSubscribe() {
  const url = ticketUser.value?.subscribeUrl
  if (!url) {
    ElMessage.warning('该用户暂无订阅链接')
    return
  }
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('订阅链接已复制')
  } catch (err) {
    ElMessage.error('复制失败：' + (err?.message || '浏览器拒绝访问剪贴板'))
  }
}

function handleOpenUserOrders() {
  const user = ticketUser.value
  if (!user?.id) return
  // 用 route name 解析，自动带上 frontendSecurePath 前缀
  const href = router.resolve({
    name: 'orders',
    query: { user_id: user.id, user_email: user.email },
  }).href
  window.open(href, '_blank', 'noopener,noreferrer')
}

function handleOpenUserManage() {
  const user = ticketUser.value
  if (!user?.id) return
  const href = router.resolve({
    name: 'users',
    query: { user_id: user.id, user_email: user.email },
  }).href
  window.open(href, '_blank', 'noopener,noreferrer')
}

const ticketUserSummary = computed(function ticketUserSummary() {
  const user = ticketUser.value
  if (!user) return null
  return {
    plan: ticketUserPlanName.value,
    balance: user.balance,
    used: user.totalUsed,
    total: user.transferEnable,
    expire: user.expiredAt,
    status: user.statusText,
    statusType: user.statusType,
  }
})

const sortedMessages = computed(function getSortedMessages() {
  if (!detailData.value?.messages) return []
  return [...detailData.value.messages].sort(function compareTime(a, b) {
    return a.id - b.id
  })
})

function scrollToBottom() {
  const container = document.querySelector('.ticket-chat-body')
  if (container) {
    container.scrollTop = container.scrollHeight
  }
}

const levelTagMap = {
  0: { label: '低优先', type: 'info' },
  1: { label: '中优先', type: 'warning' },
  2: { label: '高优先', type: 'danger' },
}

function getLevelInfo(level) {
  return levelTagMap[level] || levelTagMap[0]
}

onMounted(function onMount() {
  if (route.query.user_email) {
    emailSearch.value = String(route.query.user_email)
  }
  loadTickets()
  loadAttachmentConfig()
  fetchManagedPlans()
    .then(list => { userPlans.value = list })
    .catch(err => { console.warn('[TicketsPage] 加载套餐列表失败', err) })
})
</script>

<template>
  <section class="page-stack">
    <SectionCard description="在这里可以查看用户工单。包括查看、回复、关闭等操作。" title="工单管理">
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
          <el-button :icon="RefreshCw" class="ghost-btn small" plain type="info" @click="loadTickets">
            刷新
          </el-button>
        </el-space>
      </template>

      <!-- 筛选栏 -->
      <div class="order-filter-bar">
        <el-space wrap :size="6">
          <el-tag
            v-for="opt in statusOptions"
            :key="opt.value"
            :effect="statusFilter === opt.value ? 'dark' : 'plain'"
            class="order-filter-tag"
            @click="statusFilter = opt.value; handleSearch()"
          >{{ opt.label }}</el-tag>
          <el-divider direction="vertical" />
          <el-tag
            v-for="opt in [{label:'全部优先', value:''},{label:'高优先', value:'2'},{label:'中优先', value:'1'},{label:'低优先', value:'0'}]"
            :key="opt.value"
            :effect="priorityFilter === opt.value ? 'dark' : 'plain'"
            class="order-filter-tag"
            size="small"
            @click="priorityFilter = opt.value; handleSearch()"
          >{{ opt.label }}</el-tag>
        </el-space>
      </div>

      <el-alert v-if="errorMsg" :title="errorMsg" closable show-icon type="error" style="margin-bottom: 16px" @close="errorMsg = ''" />

      <el-table
        v-loading="loading"
        :data="tickets"
        stripe
        style="width: 100%"
        class="tickets-table--clickable"
        @row-click="openDetail"
      >
        <el-table-column label="工单号" prop="id" width="80" />
        <el-table-column label="主题" min-width="180" prop="subject" show-overflow-tooltip />
        <el-table-column label="优先级" width="90">
          <template #default="{ row }">
            <el-tag :type="row.levelType" size="small">{{ row.levelText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 1" type="info" effect="dark" size="small">已关闭</el-tag>
            <el-tag v-else :type="row.replyStatusType" effect="dark" size="small">{{ row.replyStatusText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="160" prop="updatedAt" />
        <el-table-column fixed="right" label="操作" width="120">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 4px;">
              <el-button link size="small" type="primary" @click.stop="openDetail(row)">查看</el-button>
              <el-button v-if="row.status === 0" link size="small" type="danger" @click.stop="handleClose(row)">关闭</el-button>
            </div>
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

    <!-- 工单详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      :show-close="false"
      width="min(780px, calc(100vw - 32px))"
      destroy-on-close
      class="ticket-detail-dialog"
      @closed="handleDetailDialogClosed"
    >
      <template #header>
        <div v-if="detailData" class="ticket-dialog-header">
          <div class="ticket-dialog-title">
            <el-tooltip :content="detailData.subject" placement="bottom-start" :show-after="400">
              <span class="ticket-subject">{{ detailData.subject }}</span>
            </el-tooltip>
            <el-tag :type="detailData.statusType" size="small" effect="dark">{{ detailData.statusText }}</el-tag>
            <el-button
              v-if="detailData.status === 0"
              size="small"
              type="danger"
              plain
              @click="handleClose()"
            >关闭工单</el-button>
          </div>
          <div class="ticket-dialog-meta">
            <span class="ticket-dialog-meta__email">{{ detailData.userEmail }}</span>
            <span class="ticket-dialog-meta__sep">·</span>
            <span>创建于 {{ detailData.createdAt }}</span>
            <span class="ticket-dialog-meta__sep">·</span>
            <el-tag :type="getLevelInfo(detailData.level).type" size="small">{{ getLevelInfo(detailData.level).label }}</el-tag>

            <!-- 用户摘要 + 操作（右对齐） -->
            <span class="ticket-dialog-meta__spacer" />

            <span v-if="ticketUserLoading" class="ticket-dialog-meta__loading">加载用户信息...</span>
            <template v-else-if="ticketUserSummary">
              <el-tag :type="ticketUserSummary.statusType" size="small" effect="plain">{{ ticketUserSummary.status }}</el-tag>
              <span class="ticket-user-chip" :title="`套餐：${ticketUserSummary.plan}`">📋 {{ ticketUserSummary.plan }}</span>
              <span class="ticket-user-chip" :title="`已用 ${ticketUserSummary.used} / 总 ${ticketUserSummary.total}`">📊 {{ ticketUserSummary.used }} / {{ ticketUserSummary.total }}</span>
              <span class="ticket-user-chip" :title="`到期：${ticketUserSummary.expire}`">⏰ {{ ticketUserSummary.expire }}</span>
            </template>
            <span v-else-if="ticketUserError" class="ticket-user-chip ticket-user-chip--error" :title="ticketUserError">⚠ 用户信息加载失败</span>

            <!-- 操作下拉 -->
            <el-dropdown
              v-if="ticketUser"
              trigger="click"
              :disabled="ticketUserActionLoading"
              class="ticket-user-actions"
              @command="(cmd) => {
                if (cmd === 'detail') return // 详情走 popover
                if (cmd === 'resetTraffic') return handleResetUserTraffic()
                if (cmd === 'resetSecret') return handleResetUserSecret()
                if (cmd === 'copySubscribe') return handleCopyUserSubscribe()
                if (cmd === 'toggleBan') return handleToggleUserBan()
                if (cmd === 'openOrders') return handleOpenUserOrders()
                if (cmd === 'openManage') return handleOpenUserManage()
              }"
            >
              <el-button size="small" type="primary" plain :loading="ticketUserActionLoading">
                管理用户 ▾
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="resetTraffic">重置流量</el-dropdown-item>
                  <el-dropdown-item command="resetSecret">重置订阅链接 / UUID</el-dropdown-item>
                  <el-dropdown-item command="copySubscribe" :disabled="!ticketUser.subscribeUrl">复制订阅 URL</el-dropdown-item>
                  <el-dropdown-item command="toggleBan" divided>
                    {{ ticketUser.isBanned ? '解封用户' : '封禁用户' }}
                  </el-dropdown-item>
                  <el-dropdown-item command="openOrders" divided>查看 TA 的订单（新页）</el-dropdown-item>
                  <el-dropdown-item command="openManage">前往用户管理（新页）</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>

            <!-- 详细信息浮层 -->
            <el-popover
              v-if="ticketUser"
              :width="320"
              placement="bottom-end"
              trigger="click"
            >
              <template #reference>
                <el-button size="small" text class="ticket-user-detail-btn">用户详情</el-button>
              </template>
              <div class="ticket-user-detail">
                <div class="ticket-user-detail__row">
                  <span class="ticket-user-detail__label">邮箱</span>
                  <span
                    v-if="ticketUser.id"
                    class="ticket-user-detail__val x-link"
                    title="前往用户管理查看该用户（新页）"
                    @click="handleOpenUserManage"
                  >{{ ticketUser.email }}</span>
                  <span v-else class="ticket-user-detail__val">{{ ticketUser.email }}</span>
                </div>
                <div class="ticket-user-detail__row">
                  <span class="ticket-user-detail__label">套餐</span>
                  <span class="ticket-user-detail__val">{{ ticketUserPlanName }}</span>
                </div>
                <div class="ticket-user-detail__row">
                  <span class="ticket-user-detail__label">账户状态</span>
                  <el-tag :type="ticketUser.statusType" size="small">{{ ticketUser.statusText }}</el-tag>
                </div>
                <div class="ticket-user-detail__row">
                  <span class="ticket-user-detail__label">余额 / 佣金</span>
                  <span class="ticket-user-detail__val">¥{{ ticketUser.balance }} / ¥{{ ticketUser.commissionBalance }}</span>
                </div>
                <div class="ticket-user-detail__row">
                  <span class="ticket-user-detail__label">流量</span>
                  <span class="ticket-user-detail__val">{{ ticketUser.totalUsed }} / {{ ticketUser.transferEnable }}</span>
                </div>
                <div class="ticket-user-detail__row">
                  <span class="ticket-user-detail__label">上行 / 下行</span>
                  <span class="ticket-user-detail__val">{{ ticketUser.upload }} / {{ ticketUser.download }}</span>
                </div>
                <div class="ticket-user-detail__row">
                  <span class="ticket-user-detail__label">在线设备</span>
                  <span class="ticket-user-detail__val">{{ ticketUser.onlineCount }}{{ ticketUser.deviceLimit ? ` / ${ticketUser.deviceLimit}` : '' }}</span>
                </div>
                <div class="ticket-user-detail__row">
                  <span class="ticket-user-detail__label">到期时间</span>
                  <span class="ticket-user-detail__val">{{ ticketUser.expiredAt }}</span>
                </div>
                <div class="ticket-user-detail__row">
                  <span class="ticket-user-detail__label">下次重置</span>
                  <span class="ticket-user-detail__val">{{ ticketUser.nextResetAt }}</span>
                </div>
                <div class="ticket-user-detail__row">
                  <span class="ticket-user-detail__label">注册时间</span>
                  <span class="ticket-user-detail__val">{{ ticketUser.createdAt }}</span>
                </div>
                <div class="ticket-user-detail__row">
                  <span class="ticket-user-detail__label">上次登录</span>
                  <span class="ticket-user-detail__val">{{ ticketUser.lastLoginAt }}</span>
                </div>
                <div class="ticket-user-detail__row">
                  <span class="ticket-user-detail__label">邀请人</span>
                  <span class="ticket-user-detail__val">{{ ticketUser.inviteUserEmail }}</span>
                </div>
                <div v-if="ticketUser.remarks" class="ticket-user-detail__row ticket-user-detail__row--full">
                  <span class="ticket-user-detail__label">备注</span>
                  <span class="ticket-user-detail__val ticket-user-detail__val--multiline">{{ ticketUser.remarks }}</span>
                </div>
              </div>
            </el-popover>
          </div>
        </div>
        <el-button class="ticket-dialog-close" :icon="X" text @click="detailDialogVisible = false" />
      </template>

      <div v-loading="detailLoading" class="ticket-chat-wrapper">
        <div class="ticket-chat-body">
          <div
            v-for="msg in sortedMessages"
            :key="msg.id"
            :class="['chat-bubble-wrapper', msg.isAdmin ? 'chat-admin' : 'chat-user']"
          >
            <div class="chat-bubble">
              <div v-if="msg.message" class="chat-bubble__content">{{ msg.message }}</div>
              <div v-if="msg.attachments?.length" class="chat-attachments">
                <div
                  v-for="att in msg.attachments"
                  :key="att.id"
                  :class="['chat-attachment', att.isImage ? 'chat-attachment--image' : 'chat-attachment--file']"
                >
                  <el-image
                    v-if="att.isImage"
                    class="chat-attachment__image"
                    :src="att.url"
                    :alt="att.name"
                    :preview-src-list="imageUrlsOf(msg)"
                    :initial-index="imageIndexOf(msg, att)"
                    fit="cover"
                    loading="lazy"
                    preview-teleported
                  />
                  <a
                    v-else
                    class="chat-attachment__file"
                    :href="att.url"
                    :title="att.name"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <el-icon><Paperclip /></el-icon>
                    <span class="chat-attachment__name">{{ att.name }}</span>
                    <span class="chat-attachment__size">{{ att.sizeText }}</span>
                  </a>
                  <el-popconfirm
                    title="删除该附件？文件将从存储中移除。"
                    confirm-button-text="删除"
                    cancel-button-text="取消"
                    width="240"
                    @confirm="handleDeleteMessageAttachment(att)"
                  >
                    <template #reference>
                      <button type="button" class="chat-attachment__remove" title="删除附件">×</button>
                    </template>
                  </el-popconfirm>
                </div>
              </div>
              <div class="chat-bubble__time">{{ msg.createdAt }}</div>
            </div>
          </div>
          <div v-if="sortedMessages.length === 0 && !detailLoading" class="chat-empty">
            暂无消息
          </div>
        </div>

        <!-- 回复输入区 -->
        <div
          v-if="detailData && detailData.status === 0"
          class="ticket-reply-area"
          @dragover.prevent
          @drop.prevent="handleReplyDrop"
        >
          <div v-if="pendingAttachments.length" class="ticket-pending-attachments">
            <div
              v-for="att in pendingAttachments"
              :key="att.id"
              class="ticket-pending-attachment"
              :title="att.name"
            >
              <img v-if="att.previewUrl" class="ticket-pending-attachment__thumb" :src="att.previewUrl" :alt="att.name" />
              <el-icon v-else class="ticket-pending-attachment__icon"><Paperclip /></el-icon>
              <span class="ticket-pending-attachment__name">{{ att.name }}</span>
              <span class="ticket-pending-attachment__size">{{ att.sizeText }}</span>
              <button
                type="button"
                class="ticket-pending-attachment__remove"
                title="移除"
                @click="removePendingAttachment(att)"
              >×</button>
            </div>
          </div>
          <div class="ticket-reply-bar">
            <template v-if="attachmentEnabled">
              <el-tooltip content="添加附件（也可直接粘贴截图或拖入文件）" placement="top">
                <el-button
                  class="ticket-reply-attach"
                  :icon="Paperclip"
                  :loading="attachmentUploading"
                  text
                  @click="attachmentInputRef?.click()"
                />
              </el-tooltip>
              <input
                ref="attachmentInputRef"
                type="file"
                multiple
                hidden
                :accept="attachmentAccept"
                @change="handleAttachmentPick"
              />
            </template>
            <el-input
              v-model="replyMessage"
              class="ticket-reply-input"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 8 }"
              resize="none"
              :placeholder="attachmentEnabled ? '输入回复内容，可直接粘贴截图；Ctrl/⌘ + Enter 发送' : '输入回复内容，按 Enter 换行，Ctrl/⌘ + Enter 发送'"
              @keydown.enter.ctrl.exact.prevent="handleReply"
              @keydown.enter.meta.exact.prevent="handleReply"
              @paste="handleReplyPaste"
            />
            <el-button
              :loading="replySending"
              type="primary"
              class="ticket-reply-send"
              @click="handleReply"
            >发送</el-button>
          </div>
        </div>
        <div v-else-if="detailData" class="ticket-closed-bar">
          此工单已关闭
        </div>
      </div>
    </el-dialog>
  </section>
</template>

<style scoped>
.ticket-detail-dialog .el-dialog__header {
  padding-bottom: 0;
}

.ticket-dialog-header {
  flex: 1;
}

.ticket-dialog-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
}

.ticket-subject {
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket-dialog-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-top: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.ticket-dialog-meta__email {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.ticket-dialog-meta__sep {
  color: var(--el-text-color-placeholder);
}

.ticket-dialog-meta__spacer {
  flex: 1 1 auto;
  min-width: 8px;
}

.ticket-dialog-meta__loading {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.ticket-user-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--el-fill-color-light);
  border-radius: 10px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ticket-user-chip--error {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.ticket-user-actions {
  margin-left: 4px;
}

.ticket-user-detail-btn {
  padding: 0 6px;
  height: 24px;
}

.ticket-user-detail {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 12px;
  font-size: 13px;
}

.ticket-user-detail__row {
  display: contents;
}

.ticket-user-detail__row--full > .ticket-user-detail__val {
  white-space: pre-wrap;
}

.ticket-user-detail__label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.ticket-user-detail__val {
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.ticket-user-detail__val--multiline {
  white-space: pre-wrap;
}

.ticket-dialog-close {
  position: absolute;
  top: 16px;
  right: 16px;
}

.ticket-chat-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 300px;
  max-height: 500px;
}

.ticket-chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-bubble-wrapper {
  display: flex;
}

.chat-user {
  justify-content: flex-start;
}

.chat-admin {
  justify-content: flex-end;
}

.chat-bubble {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}

.chat-user .chat-bubble {
  background: var(--el-fill-color);
  border-bottom-left-radius: 4px;
}

.chat-admin .chat-bubble {
  background: var(--el-color-primary-light-9);
  color: var(--el-text-color-primary);
  border-bottom-right-radius: 4px;
}

.chat-bubble__time {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.chat-admin .chat-bubble__time {
  text-align: right;
}

.chat-empty {
  text-align: center;
  color: var(--el-text-color-placeholder);
  padding: 60px 0;
}

.ticket-reply-area {
  padding: 12px 0 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.ticket-reply-bar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.ticket-reply-attach {
  flex: 0 0 auto;
  height: 40px;
  padding: 0 8px;
}

.ticket-pending-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.ticket-pending-attachment {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 260px;
  padding: 4px 6px 4px 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-light);
  font-size: 12px;
}

.ticket-pending-attachment__thumb {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  object-fit: cover;
}

.ticket-pending-attachment__icon {
  width: 32px;
  height: 32px;
  color: var(--el-text-color-secondary);
}

.ticket-pending-attachment__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 150px;
}

.ticket-pending-attachment__size,
.chat-attachment__size {
  color: var(--el-text-color-placeholder);
  white-space: nowrap;
}

.ticket-pending-attachment__remove,
.chat-attachment__remove {
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}

.ticket-pending-attachment__remove:hover,
.chat-attachment__remove:hover {
  color: var(--el-color-danger);
}

.chat-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}

.chat-bubble__content + .chat-attachments {
  margin-top: 8px;
}

.chat-attachment {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.chat-attachment__image {
  width: 160px;
  height: 120px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  cursor: zoom-in;
}

.chat-attachment__file {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 280px;
  padding: 6px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  color: var(--el-color-primary);
  font-size: 13px;
  text-decoration: none;
}

.chat-attachment__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-attachment__remove {
  position: absolute;
  top: -6px;
  right: -6px;
  display: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--el-bg-color);
  box-shadow: var(--el-box-shadow-lighter);
  font-size: 13px;
}

.chat-attachment:hover .chat-attachment__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ticket-reply-input {
  flex: 1;
}

.ticket-reply-send {
  flex: 0 0 auto;
}

.ticket-closed-bar {
  text-align: center;
  padding: 12px 0 0;
  color: var(--el-text-color-secondary);
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 13px;
}

/* 整行可点击：让 cursor 提示 + hover 高亮 */
.tickets-table--clickable :deep(.el-table__row) {
  cursor: pointer;
}
</style>
