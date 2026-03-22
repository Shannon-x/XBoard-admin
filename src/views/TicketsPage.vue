<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, ChatDotRound } from '@element-plus/icons-vue'
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

const detailDrawerVisible = ref(false)
const detailData = ref(null)
const detailLoading = ref(false)
const replyMessage = ref('')
const replySending = ref(false)

const statusOptions = [
  { label: '全部', value: '' },
  { label: '已开启', value: '0' },
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
  detailDrawerVisible.value = true
  replyMessage.value = ''
  try {
    detailData.value = await fetchTicketDetail(ticket.id)
  } catch (err) {
    ElMessage.error(err.message || '获取工单详情失败')
    detailDrawerVisible.value = false
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
    if (detailDrawerVisible.value && detailData.value?.id === ticketToClose.id) {
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

onMounted(function onMount() {
  loadTickets()
})
</script>

<template>
  <section class="page-stack">
    <SectionCard description="管理用户工单，支持查看详情、回复和关闭" title="工单管理">
      <template #actions>
        <el-space wrap>
          <el-input
            v-model="emailSearch"
            :prefix-icon="Search"
            clearable
            placeholder="搜索用户邮箱..."
            style="width: 220px"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-select v-model="statusFilter" placeholder="工单状态" style="width: 130px" @change="handleSearch">
            <el-option
              v-for="opt in statusOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <el-button :icon="Refresh" class="ghost-btn small" plain type="info" @click="loadTickets">
            刷新
          </el-button>
        </el-space>
      </template>

      <el-alert v-if="errorMsg" :title="errorMsg" closable show-icon type="error" style="margin-bottom: 16px" @close="errorMsg = ''" />

      <el-table v-loading="loading" :data="tickets" stripe style="width: 100%">
        <el-table-column label="ID" prop="id" width="70" />
        <el-table-column label="主题" min-width="200" prop="subject" />
        <el-table-column label="用户" width="180" prop="userEmail" />
        <el-table-column label="优先级" width="90">
          <template #default="{ row }">
            <el-tag :type="row.levelType" effect="dark" size="small">
              {{ row.levelText }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="回复状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.replyStatusType" size="small">
              {{ row.replyStatusText }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.statusType" size="small">
              {{ row.statusText }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="160" prop="updatedAt" />
        <el-table-column fixed="right" label="操作" width="140">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="openDetail(row)">详情</el-button>
            <el-button v-if="row.status === 0" link size="small" type="danger" @click="handleClose(row)">关闭</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="pagination.total > 0"
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

    <!-- 工单详情抽屉 -->
    <el-drawer
      v-model="detailDrawerVisible"
      title="工单详情"
      size="500px"
      destroy-on-close
    >
      <div v-loading="detailLoading">
        <template v-if="detailData">
          <el-descriptions :column="1" border size="small" style="margin-bottom: 16px">
            <el-descriptions-item label="ID">#{{ detailData.id }}</el-descriptions-item>
            <el-descriptions-item label="主题">{{ detailData.subject }}</el-descriptions-item>
            <el-descriptions-item label="用户">{{ detailData.userEmail }}</el-descriptions-item>
            <el-descriptions-item label="优先级">
              <el-tag :type="detailData.levelType" effect="dark" size="small">{{ detailData.levelText }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="detailData.statusType" size="small">{{ detailData.statusText }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ detailData.createdAt }}</el-descriptions-item>
          </el-descriptions>

          <!-- 消息时间线 -->
          <div class="ticket-messages">
            <div
              v-for="msg in sortedMessages"
              :key="msg.id"
              :class="['ticket-message', msg.isAdmin ? 'admin-msg' : 'user-msg']"
            >
              <div class="msg-header">
                <el-tag :type="msg.isAdmin ? 'success' : 'info'" size="small" effect="plain">
                  {{ msg.isAdmin ? '管理员' : '用户' }}
                </el-tag>
                <span class="msg-time">{{ msg.createdAt }}</span>
              </div>
              <div class="msg-content">{{ msg.message }}</div>
            </div>
          </div>

          <!-- 回复区域 -->
          <div v-if="detailData.status === 0" class="ticket-reply" style="margin-top: 16px">
            <el-input
              v-model="replyMessage"
              type="textarea"
              :rows="3"
              placeholder="输入回复内容..."
            />
            <el-space style="margin-top: 8px; justify-content: flex-end; width: 100%">
              <el-button type="danger" plain @click="handleClose()">关闭工单</el-button>
              <el-button :loading="replySending" type="primary" @click="handleReply">
                发送回复
              </el-button>
            </el-space>
          </div>

          <el-alert
            v-else
            title="此工单已关闭"
            type="info"
            :closable="false"
            show-icon
            style="margin-top: 16px"
          />
        </template>
      </div>
    </el-drawer>
  </section>
</template>

<style scoped>
.ticket-messages {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
  padding: 8px 0;
}

.ticket-message {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.admin-msg {
  background: color-mix(in srgb, var(--el-color-success-light-9) 50%, transparent);
  margin-left: 20px;
}

.user-msg {
  background: var(--el-bg-color);
  margin-right: 20px;
}

.msg-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.msg-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.msg-content {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
