<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, ChatDotRound, Close } from '@element-plus/icons-vue'
import SectionCard from '../components/common/SectionCard.vue'
import { useI18n } from 'vue-i18n'
import {
  fetchManagedTickets,
  fetchTicketDetail,
  replyTicket,
  closeTicket,
  createEmptyManagedTicketsPagination,
} from '../services/tickets'

const { t } = useI18n()

const tickets = ref([])
const pagination = ref(createEmptyManagedTicketsPagination())
const loading = ref(false)
const errorMsg = ref('')
const statusFilter = ref('')
const emailSearch = ref('')

const detailDialogVisible = ref(false)
const detailData = ref(null)
const detailLoading = ref(false)
const replyMessage = ref('')
const replySending = ref(false)

const statusOptions = [
  { label: '全部', value: '' },
  { label: '待回复', value: '0' },
  { label: '已关闭', value: '1' },
]

async function loadTickets() {
  loading.value = true
  errorMsg.value = ''
  try {
    const options = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    }
    if (statusFilter.value !== '') {
      options.status = statusFilter.value
    }
    if (emailSearch.value.trim()) {
      options.email = emailSearch.value.trim()
    }
    const result = await fetchManagedTickets(options)
    tickets.value = result.list
    pagination.value = result.pagination
  } catch (err) {
    errorMsg.value = err.message || '加载工单列表失败'
  } finally {
    loading.value = false
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
  try {
    detailData.value = await fetchTicketDetail(ticket.id)
    await nextTick()
    scrollToBottom()
  } catch (err) {
    ElMessage.error(err.message || '获取工单详情失败')
    detailDialogVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

async function handleReply() {
  if (!replyMessage.value.trim()) {
    ElMessage.warning('请输入回复内容')
    return
  }

  replySending.value = true
  try {
    await replyTicket(detailData.value.id, replyMessage.value.trim())
    ElMessage.success('回复成功')
    replyMessage.value = ''
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
  loadTickets()
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
            placeholder="搜索工单标题或用户邮箱"
            style="width: 220px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-button :icon="Refresh" class="ghost-btn small" plain type="info" @click="loadTickets">
            刷新
          </el-button>
        </el-space>
      </template>

      <!-- 筛选栏 -->
      <div class="order-filter-bar">
        <el-space wrap :size="6">
          <el-tag
            :effect="statusFilter === '' ? 'dark' : 'plain'"
            class="order-filter-tag"
            @click="statusFilter = ''; handleSearch()"
          >待回复</el-tag>
          <el-tag
            :effect="statusFilter === '1' ? 'dark' : 'plain'"
            class="order-filter-tag"
            @click="statusFilter = '1'; handleSearch()"
          >已关闭</el-tag>
          <el-divider direction="vertical" />
          <el-tag
            v-for="opt in [{label:'高优先', value:'2'},{label:'中优先', value:'1'},{label:'低优先', value:'0'}]"
            :key="opt.value"
            effect="plain"
            class="order-filter-tag"
            size="small"
          >{{ opt.label }}</el-tag>
        </el-space>
      </div>

      <el-alert v-if="errorMsg" :title="errorMsg" closable show-icon type="error" style="margin-bottom: 16px" @close="errorMsg = ''" />

      <el-table v-loading="loading" :data="tickets" stripe style="width: 100%" @row-click="openDetail">
        <el-table-column label="工单号" prop="id" width="80" />
        <el-table-column label="主题" min-width="180" prop="subject" show-overflow-tooltip />
        <el-table-column label="优先级" width="90">
          <template #default="{ row }">
            <el-tag :type="row.levelType" size="small">{{ row.levelText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.replyStatusType" effect="dark" size="small">{{ row.replyStatusText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="160" prop="updatedAt" />
        <el-table-column fixed="right" label="操作" width="100">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click.stop="openDetail(row)">查看</el-button>
            <el-button v-if="row.status === 0" link size="small" type="danger" @click.stop="handleClose(row)">关闭</el-button>
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
      width="720px"
      destroy-on-close
      class="ticket-detail-dialog"
    >
      <template #header>
        <div v-if="detailData" class="ticket-dialog-header">
          <div class="ticket-dialog-title">
            <span class="ticket-subject">{{ detailData.subject }}</span>
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
            <span>{{ detailData.userEmail }}</span>
            <span>·</span>
            <span>创建于 {{ detailData.createdAt }}</span>
            <span>·</span>
            <el-tag :type="getLevelInfo(detailData.level).type" size="small">{{ getLevelInfo(detailData.level).label }}</el-tag>
          </div>
        </div>
        <el-button class="ticket-dialog-close" :icon="Close" text @click="detailDialogVisible = false" />
      </template>

      <div v-loading="detailLoading" class="ticket-chat-wrapper">
        <div class="ticket-chat-body">
          <div
            v-for="msg in sortedMessages"
            :key="msg.id"
            :class="['chat-bubble-wrapper', msg.isAdmin ? 'chat-admin' : 'chat-user']"
          >
            <div class="chat-bubble">
              <div class="chat-bubble__content">{{ msg.message }}</div>
              <div class="chat-bubble__time">{{ msg.createdAt }}</div>
            </div>
          </div>
          <div v-if="sortedMessages.length === 0 && !detailLoading" class="chat-empty">
            暂无消息
          </div>
        </div>

        <!-- 回复输入区 -->
        <div v-if="detailData && detailData.status === 0" class="ticket-reply-bar">
          <el-input
            v-model="replyMessage"
            placeholder="输入回复内容..."
            @keyup.enter.ctrl="handleReply"
          />
          <el-button
            :loading="replySending"
            type="primary"
            @click="handleReply"
          >发送</el-button>
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
  gap: 6px;
  margin-top: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
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

.ticket-reply-bar {
  display: flex;
  gap: 8px;
  padding: 12px 0 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.ticket-closed-bar {
  text-align: center;
  padding: 12px 0 0;
  color: var(--el-text-color-secondary);
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 13px;
}
</style>
