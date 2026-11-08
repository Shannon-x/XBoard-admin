<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { RefreshCw, Search, Settings2, Unplug } from 'lucide-vue-next'
import SectionCard from '../components/common/SectionCard.vue'
import {
  createEmptyMcpPagination,
  fetchMcpConnections,
  fetchMcpLogs,
  fetchMcpStats,
  revokeMcpConnection,
} from '../services/mcp'
import { toOrder, toRecharges, toSettings, toUser } from '../utils/crossLink'
import { createSequence } from '../utils/sequence'
import { createPageSizePreference } from '../utils/pageSizePreference'

const route = useRoute()
const router = useRouter()

const TABS = ['log', 'orders', 'connections']
const activeTab = ref('log')

const stats = ref(null)
const keyword = ref('')
// 从用户管理带过来、或在表格里点了某个客户：只看这一位
const userFilter = ref(null) // { id, email }
// 从「已连接的 AI 软件」点「查看记录」：只看这一个连接
const tokenFilter = ref(null) // { id, name }

const okFilter = ref('')
const toolFilter = ref('')
const okOptions = [
  { label: '全部', value: '' },
  { label: '成功', value: 1 },
  { label: '失败', value: 0 },
]

const pageSizePreference = createPageSizePreference('aiAssistant', 20, [20, 50, 100])
function emptyTable() {
  return { list: [], pagination: { ...createEmptyMcpPagination(), pageSize: pageSizePreference.initialSize }, loading: false, error: '' }
}
const tables = ref({ log: emptyTable(), orders: emptyTable(), connections: emptyTable() })
const sequences = { log: createSequence(), orders: createSequence(), connections: createSequence() }
const revokingId = ref(0)

const toolOptions = computed(function toolOptions() {
  const tools = stats.value?.tools || {}
  return Object.keys(tools).sort().map((name) => ({ value: name, label: `${tools[name]}（${name}）` }))
})

const userParams = computed(function userParams() {
  if (userFilter.value?.id) return { userId: userFilter.value.id }
  const text = keyword.value.trim()
  return text ? { email: text } : {}
})

async function loadTable(tab) {
  const table = tables.value[tab]
  const seq = sequences[tab]
  const my = seq.next()
  table.loading = true
  table.error = ''
  try {
    const base = { page: table.pagination.page, pageSize: table.pagination.pageSize, ...userParams.value }
    let result
    if (tab === 'connections') {
      result = await fetchMcpConnections(base)
    } else {
      const extra = tab === 'orders'
        ? { ordersOnly: true }
        : { ok: okFilter.value, tool: toolFilter.value }
      result = await fetchMcpLogs({ ...base, ...extra, tokenId: tokenFilter.value?.id || '' }, stats.value?.tools || {})
    }
    if (!seq.isCurrent(my)) return
    table.list = result.list
    table.pagination = result.pagination
  } catch (err) {
    if (!seq.isCurrent(my)) return
    table.error = err?.message || '加载失败'
  } finally {
    if (seq.isCurrent(my)) table.loading = false
  }
}

async function loadStats() {
  try {
    stats.value = await fetchMcpStats()
  } catch {
    stats.value = null
  }
}

async function reload() {
  await loadStats()
  loadTable(activeTab.value)
}

function search(tab = activeTab.value) {
  tables.value[tab].pagination.page = 1
  loadTable(tab)
}

function searchAll() {
  TABS.forEach((tab) => { tables.value[tab].pagination.page = 1 })
  loadTable(activeTab.value)
}

function handleTabChange(tab) {
  const query = { ...route.query, tab }
  router.replace({ name: 'aiAssistant', query })
  loadTable(tab)
}

function handlePageChange(tab, page) {
  tables.value[tab].pagination.page = page
  loadTable(tab)
}

function handlePageSizeChange(tab, size) {
  pageSizePreference.save(size)
  tables.value[tab].pagination.pageSize = size
  tables.value[tab].pagination.page = 1
  loadTable(tab)
}

function focusUser(row) {
  userFilter.value = { id: row.userId, email: row.email }
  tokenFilter.value = null
  keyword.value = ''
  router.replace({ name: 'aiAssistant', query: { tab: activeTab.value, user_id: String(row.userId), user_email: row.email || undefined } })
  searchAll()
}

function clearUserFilter() {
  userFilter.value = null
  tokenFilter.value = null
  router.replace({ name: 'aiAssistant', query: { tab: activeTab.value } })
  searchAll()
}

function clearTokenFilter() {
  tokenFilter.value = null
  search('log')
}

function showConnectionLog(row) {
  userFilter.value = { id: row.userId, email: row.email }
  tokenFilter.value = { id: row.id, name: row.name }
  activeTab.value = 'log'
  okFilter.value = ''
  toolFilter.value = ''
  router.replace({ name: 'aiAssistant', query: { tab: 'log', user_id: String(row.userId), user_email: row.email || undefined } })
  search('log')
}

function openUserPage(id, email) {
  const location = toUser(id, email)
  if (location) router.push(location)
}

function refLocation(row) {
  if (!row.order) return null
  return row.order.kind === 'recharge' ? toRecharges({ tradeNo: row.order.tradeNo }) : toOrder(row.order.tradeNo)
}

function openRef(row) {
  const location = refLocation(row)
  if (location) router.push(location)
}

async function handleRevoke(row) {
  try {
    await ElMessageBox.confirm(
      `断开 ${row.email || `用户 #${row.userId}`} 的「${row.name}」？这个 AI 软件马上不能再查账户、下单，`
        + `${row.via === 'oauth' ? '要客户在 AI 软件里重新授权' : '要客户在面板重新生成令牌'}才能再用。调用记录会保留。`,
      '替客户断开 AI 连接',
      { confirmButtonText: '断开', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  revokingId.value = row.id
  try {
    await revokeMcpConnection(row.userId, row.id)
    ElMessage.success('已断开')
    loadStats()
    loadTable('connections')
  } catch (err) {
    ElMessage.error(err?.message || '断开失败')
  } finally {
    revokingId.value = 0
  }
}

onMounted(function onMount() {
  if (TABS.includes(String(route.query.tab))) activeTab.value = String(route.query.tab)
  if (route.query.user_id) {
    userFilter.value = { id: Number(route.query.user_id), email: route.query.user_email ? String(route.query.user_email) : '' }
  } else if (route.query.email) {
    keyword.value = String(route.query.email)
  }
  reload()
})
</script>

<template>
  <section class="page-stack">
    <SectionCard
      title="AI 助手"
      description="客户通过 ChatGPT、Claude 等 AI 软件调用面板的记录。可以按客户查每次调用、AI 替客户建的单，以及客户连着哪些 AI 软件；需要时可替客户断开。"
    >
      <template #actions>
        <el-space wrap>
          <el-input
            v-model="keyword"
            :prefix-icon="Search"
            :disabled="Boolean(userFilter)"
            clearable
            placeholder="搜索客户邮箱"
            style="width: 220px"
            @keyup.enter="searchAll"
            @clear="searchAll"
          />
          <el-button :icon="RefreshCw" class="ghost-btn small" plain type="info" @click="reload">刷新</el-button>
          <el-button :icon="Settings2" class="ghost-btn small" plain @click="router.push(toSettings('mcp'))">AI 助手设置</el-button>
        </el-space>
      </template>

      <div v-if="stats" class="ai-stats">
        <div class="ai-stats__item">
          <span class="ai-stats__label">今日调用</span>
          <strong>{{ stats.callsToday }}</strong>
          <span class="ai-stats__sub">失败 {{ stats.failedToday }} 次</span>
        </div>
        <div class="ai-stats__item">
          <span class="ai-stats__label">今日 AI 下单</span>
          <strong>{{ stats.ordersToday }}</strong>
          <span class="ai-stats__sub">近 7 天 {{ stats.orders7d }} 单</span>
        </div>
        <div class="ai-stats__item">
          <span class="ai-stats__label">近 7 天调用</span>
          <strong>{{ stats.calls7d }}</strong>
          <span class="ai-stats__sub">{{ stats.users7d }} 位客户 · 失败 {{ stats.failed7d }} 次</span>
        </div>
        <div class="ai-stats__item">
          <span class="ai-stats__label">连着的 AI 软件</span>
          <strong>{{ stats.connections }}</strong>
          <span class="ai-stats__sub">{{ stats.connectedUsers }} 位客户</span>
        </div>
      </div>
      <div v-if="stats && stats.topTools.length" class="ai-top-tools">
        <span class="ai-muted">近 7 天常用：</span>
        <el-tag
          v-for="item in stats.topTools.slice(0, 6)"
          :key="item.tool"
          size="small"
          effect="plain"
          :type="item.failed > 0 ? 'warning' : 'info'"
        >{{ item.title }} {{ item.calls }}<span v-if="item.failed"> · 失败 {{ item.failed }}</span></el-tag>
      </div>

      <div v-if="userFilter" class="ai-user-filter">
        <el-tag type="warning" effect="plain" closable @close="clearUserFilter">只看客户 {{ userFilter.email || `#${userFilter.id}` }}</el-tag>
        <el-button link size="small" type="primary" @click="openUserPage(userFilter.id, userFilter.email)">在用户管理中打开</el-button>
      </div>

      <el-tabs v-model="activeTab" class="ai-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="调用记录" name="log">
          <div class="order-filter-bar">
            <el-space wrap :size="6">
              <el-tag
                v-for="opt in okOptions"
                :key="String(opt.value)"
                :effect="okFilter === opt.value ? 'dark' : 'plain'"
                class="order-filter-tag"
                @click="okFilter = opt.value; search('log')"
              >{{ opt.label }}</el-tag>
              <el-divider direction="vertical" />
              <el-select v-model="toolFilter" clearable filterable placeholder="全部工具" size="small" style="width: 220px" @change="search('log')">
                <el-option v-for="opt in toolOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
              <template v-if="tokenFilter">
                <el-divider direction="vertical" />
                <el-tag type="warning" effect="plain" closable @close="clearTokenFilter">只看「{{ tokenFilter.name }}」</el-tag>
              </template>
            </el-space>
          </div>

          <el-alert v-if="tables.log.error" :title="tables.log.error" closable show-icon type="error" style="margin-bottom: 12px" @close="tables.log.error = ''" />

          <el-table v-loading="tables.log.loading" :data="tables.log.list" stripe style="width: 100%">
            <el-table-column label="时间" width="150">
              <template #default="{ row }">{{ row.createdAtText }}</template>
            </el-table-column>
            <el-table-column label="客户" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="x-link" title="只看这位客户" @click="focusUser(row)">{{ row.email || `#${row.userId}` }}</span>
              </template>
            </el-table-column>
            <el-table-column label="AI 软件" min-width="90">
              <template #default="{ row }">
                <span v-if="row.tokenName">{{ row.tokenName }}</span>
                <span v-else class="ai-muted" title="这个连接已断开或已过期">已断开 #{{ row.tokenId }}</span>
              </template>
            </el-table-column>
            <el-table-column label="做了什么" min-width="160">
              <template #default="{ row }">
                <div>{{ row.toolTitle }}</div>
                <div class="ai-sub ai-mono">{{ row.tool }}</div>
              </template>
            </el-table-column>
            <el-table-column label="结果" min-width="180">
              <template #default="{ row }">
                <el-tag :type="row.ok ? 'success' : 'danger'" size="small" effect="plain">{{ row.ok ? '成功' : '失败' }}</el-tag>
                <div v-if="row.message" class="ai-sub ai-message">{{ row.message }}</div>
              </template>
            </el-table-column>
            <el-table-column label="单号 / 编号" min-width="170">
              <template #default="{ row }">
                <template v-if="row.ref">
                  <span v-if="refLocation(row)" class="x-link ai-mono" @click="openRef(row)">{{ row.ref }}</span>
                  <span v-else class="ai-mono">{{ row.ref }}</span>
                  <div v-if="row.order" class="ai-sub">
                    {{ row.order.kindText }} ¥{{ row.order.amountText }} · {{ row.order.statusText }}
                  </div>
                </template>
                <span v-else class="ai-muted">--</span>
              </template>
            </el-table-column>
            <el-table-column label="IP" min-width="120">
              <template #default="{ row }"><span class="ai-mono">{{ row.ip || '--' }}</span></template>
            </el-table-column>
            <template #empty>
              <el-empty description="还没有 AI 调用记录" :image-size="72" />
            </template>
          </el-table>

          <el-pagination
            :current-page="tables.log.pagination.page"
            :page-size="tables.log.pagination.pageSize"
            :page-sizes="pageSizePreference.pageSizes"
            :total="tables.log.pagination.total"
            background
            layout="total, sizes, prev, pager, next, jumper"
            style="margin-top: 16px; justify-content: flex-end"
            @current-change="(p) => handlePageChange('log', p)"
            @size-change="(s) => handlePageSizeChange('log', s)"
          />
        </el-tab-pane>

        <el-tab-pane label="AI 下单" name="orders">
          <p class="ai-hint">AI 替客户建的订单和充值单。钱由客户本人在付款链接里付，这里能看到每一单现在付了没有。</p>

          <el-alert v-if="tables.orders.error" :title="tables.orders.error" closable show-icon type="error" style="margin-bottom: 12px" @close="tables.orders.error = ''" />

          <el-table v-loading="tables.orders.loading" :data="tables.orders.list" stripe style="width: 100%">
            <el-table-column label="下单时间" width="150">
              <template #default="{ row }">{{ row.createdAtText }}</template>
            </el-table-column>
            <el-table-column label="客户" min-width="190">
              <template #default="{ row }">
                <span class="x-link" title="只看这位客户" @click="focusUser(row)">{{ row.email || `#${row.userId}` }}</span>
              </template>
            </el-table-column>
            <el-table-column label="AI 软件" min-width="110">
              <template #default="{ row }">
                <span v-if="row.tokenName">{{ row.tokenName }}</span>
                <span v-else class="ai-muted">已断开 #{{ row.tokenId }}</span>
              </template>
            </el-table-column>
            <el-table-column label="单号" min-width="190">
              <template #default="{ row }">
                <span v-if="refLocation(row)" class="x-link ai-mono" @click="openRef(row)">{{ row.ref }}</span>
                <span v-else class="ai-mono">{{ row.ref }}</span>
              </template>
            </el-table-column>
            <el-table-column label="内容" min-width="150">
              <template #default="{ row }">
                <template v-if="row.order">
                  <div>{{ row.order.kind === 'recharge' ? '余额充值' : (row.order.planName || '订单') }}</div>
                  <div class="ai-sub">¥{{ row.order.amountText }}</div>
                </template>
                <span v-else class="ai-muted">单据已删除</span>
              </template>
            </el-table-column>
            <el-table-column label="现在的状态" width="130">
              <template #default="{ row }">
                <template v-if="row.order">
                  <el-tag :type="row.order.statusType" size="small" effect="dark">{{ row.order.statusText }}</el-tag>
                  <div v-if="row.order.paidAt" class="ai-sub">付款 {{ row.order.paidAtText }}</div>
                </template>
                <span v-else class="ai-muted">--</span>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="AI 还没有替客户建过单" :image-size="72" />
            </template>
          </el-table>

          <el-pagination
            :current-page="tables.orders.pagination.page"
            :page-size="tables.orders.pagination.pageSize"
            :page-sizes="pageSizePreference.pageSizes"
            :total="tables.orders.pagination.total"
            background
            layout="total, sizes, prev, pager, next, jumper"
            style="margin-top: 16px; justify-content: flex-end"
            @current-change="(p) => handlePageChange('orders', p)"
            @size-change="(s) => handlePageSizeChange('orders', s)"
          />
        </el-tab-pane>

        <el-tab-pane label="已连接的 AI 软件" name="connections">
          <p class="ai-hint">客户现在连着的 AI 软件和令牌（不显示令牌本身）。闲置太久的会自动失效，不在这里列出。</p>

          <el-alert v-if="tables.connections.error" :title="tables.connections.error" closable show-icon type="error" style="margin-bottom: 12px" @close="tables.connections.error = ''" />

          <el-table v-loading="tables.connections.loading" :data="tables.connections.list" stripe style="width: 100%">
            <el-table-column label="客户" min-width="190">
              <template #default="{ row }">
                <span class="x-link" title="只看这位客户" @click="focusUser(row)">{{ row.email || `#${row.userId}` }}</span>
              </template>
            </el-table-column>
            <el-table-column label="AI 软件" min-width="160">
              <template #default="{ row }">
                <div>{{ row.name }}</div>
                <div class="ai-sub">{{ row.viaText }}<span v-if="row.appHost"> · {{ row.appHost }}</span></div>
              </template>
            </el-table-column>
            <el-table-column label="权限" width="90">
              <template #default="{ row }">
                <el-tag :type="row.canOrder ? 'warning' : 'info'" size="small" effect="plain">{{ row.canOrder ? '可下单' : '只读' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="最近使用" width="150">
              <template #default="{ row }">
                <div>{{ row.lastUsedAt ? row.lastUsedAtText : '还没用过' }}</div>
                <div v-if="row.lastIp" class="ai-sub ai-mono">{{ row.lastIp }}</div>
              </template>
            </el-table-column>
            <el-table-column label="近 7 天调用" width="96" align="right">
              <template #default="{ row }">{{ row.calls7d }}</template>
            </el-table-column>
            <el-table-column label="AI 下单" width="80" align="right">
              <template #default="{ row }">{{ row.ordersTotal }}</template>
            </el-table-column>
            <el-table-column label="连上时间" width="170">
              <template #default="{ row }">
                <div>{{ row.createdAtText }}</div>
                <div class="ai-sub" title="每次使用都会顺延，闲置到这天自动失效">闲置到 {{ row.expiresAtText.slice(0, 10) }}</div>
              </template>
            </el-table-column>
            <el-table-column fixed="right" label="操作" width="150">
              <template #default="{ row }">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <el-button link size="small" type="primary" @click="showConnectionLog(row)">查看记录</el-button>
                  <el-button
                    link
                    size="small"
                    type="danger"
                    :icon="Unplug"
                    :loading="revokingId === row.id"
                    @click="handleRevoke(row)"
                  >断开</el-button>
                </div>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="没有客户连着 AI 软件" :image-size="72" />
            </template>
          </el-table>

          <el-pagination
            :current-page="tables.connections.pagination.page"
            :page-size="tables.connections.pagination.pageSize"
            :page-sizes="pageSizePreference.pageSizes"
            :total="tables.connections.pagination.total"
            background
            layout="total, sizes, prev, pager, next, jumper"
            style="margin-top: 16px; justify-content: flex-end"
            @current-change="(p) => handlePageChange('connections', p)"
            @size-change="(s) => handlePageSizeChange('connections', s)"
          />
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </section>
</template>

<style scoped>
.ai-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.ai-stats__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
}

.ai-stats__item strong {
  font-size: 18px;
}

.ai-stats__label,
.ai-stats__sub,
.ai-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.ai-sub {
  margin-top: 2px;
}

.ai-top-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 12px;
}

.ai-user-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.ai-tabs {
  margin-top: 4px;
}

.ai-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.ai-muted {
  color: var(--el-text-color-secondary);
}

.ai-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}

.ai-message {
  white-space: normal;
  line-height: 1.4;
}
</style>
