<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Download, RefreshCw, Search } from 'lucide-vue-next'
import SectionCard from '../components/common/SectionCard.vue'
import {
  QUERY_STATUS,
  createAccessLogQuery,
  fetchAccessLogOverview,
  fetchAccessLogQueries,
  fetchAccessLogResult,
  fetchAccessLogSummary,
} from '../services/accessLogs'
import { formatBytes, formatTimestamp } from '../utils/format'
import { toSettings, toUser } from '../utils/crossLink'

const route = useRoute()
const router = useRouter()

const activeTab = ref('user')
const overview = ref(null)
const overviewLoading = ref(false)

function today() {
  const d = new Date()
  return dateString(d)
}
function dateString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dateString(d)
}

// ===== 按用户：日汇总 =====
const userId = ref('')
const summaryRange = ref([daysAgo(6), today()])
const summary = ref(null)
const summaryLoading = ref(false)
const summaryError = ref('')

async function loadSummary() {
  const id = String(userId.value).trim()
  if (!/^\d+$/.test(id)) {
    summaryError.value = '请输入用户 ID'
    return
  }
  summaryLoading.value = true
  summaryError.value = ''
  try {
    summary.value = await fetchAccessLogSummary({ userId: id, from: summaryRange.value?.[0], to: summaryRange.value?.[1] })
    if (!detailRange.value?.length) {
      detailRange.value = [summary.value.to, summary.value.to]
    }
  } catch (error) {
    summary.value = null
    summaryError.value = error?.message || '加载失败'
  } finally {
    summaryLoading.value = false
  }
}

function formatHours(hours) {
  if (!Array.isArray(hours) || !hours.length) return '--'
  return hours.map((h) => `${h} 点`).join('、')
}

function nodeLabel(node) {
  return node.node_name ? `${node.node_name}（${node.node_type}-${node.node_id}）` : `${node.node_type}-${node.node_id}`
}

// ===== 按用户：明细查询 =====
const detailRange = ref([])
const detailHost = ref('')
const detailNetwork = ref('')
const detailRunning = ref(false)
const detailResult = ref(null)
let pollTimer = null

const maxQueryDays = computed(() => overview.value?.maxQueryDays || 7)

function rangeDays(range) {
  if (!range?.[0] || !range?.[1]) return 0
  return Math.round((new Date(range[1]) - new Date(range[0])) / 86400000) + 1
}

async function runDetailQuery() {
  const id = String(userId.value).trim()
  if (!/^\d+$/.test(id)) {
    ElMessage.warning('请输入用户 ID')
    return
  }
  if (!detailRange.value?.length) {
    ElMessage.warning('请选择日期')
    return
  }
  if (rangeDays(detailRange.value) > maxQueryDays.value) {
    ElMessage.warning(`明细一次最多查 ${maxQueryDays.value} 天`)
    return
  }
  detailRunning.value = true
  detailResult.value = null
  try {
    const queryId = await createAccessLogQuery({
      userId: id,
      from: detailRange.value[0],
      to: detailRange.value[1],
      host: detailHost.value,
      network: detailNetwork.value,
    })
    await pollResult(queryId)
  } catch (error) {
    detailRunning.value = false
    ElMessage.error(error?.message || '查询失败')
  }
}

async function pollResult(queryId, attempt = 0) {
  clearTimeout(pollTimer)
  try {
    const result = await fetchAccessLogResult(queryId)
    detailResult.value = result
    if (result && (result.status === 0 || result.status === 1) && attempt < 90) {
      pollTimer = setTimeout(() => pollResult(queryId, attempt + 1), 2000)
      return
    }
  } catch (error) {
    ElMessage.error(error?.message || '读取结果失败')
  }
  detailRunning.value = false
}

const topHosts = computed(() => detailResult.value?.summary?.hosts || [])

function download(result) {
  if (result?.download_url) {
    window.open(result.download_url, '_blank', 'noopener')
  }
}

async function openQuery(row) {
  activeTab.value = 'user'
  userId.value = String(row.user_id)
  detailRange.value = [row.date_from, row.date_to]
  detailHost.value = row.filter?.host || ''
  detailNetwork.value = row.filter?.network || ''
  detailRunning.value = true
  await pollResult(row.id)
}

// ===== 查询记录 =====
const queries = ref([])
const queriesPagination = ref({ page: 1, pageSize: 20, total: 0 })
const queriesLoading = ref(false)
const queriesUserFilter = ref('')

async function loadQueries() {
  queriesLoading.value = true
  try {
    const result = await fetchAccessLogQueries({
      userId: /^\d+$/.test(queriesUserFilter.value.trim()) ? queriesUserFilter.value.trim() : undefined,
      page: queriesPagination.value.page,
      pageSize: queriesPagination.value.pageSize,
    })
    queries.value = result.list
    queriesPagination.value = result.pagination
  } catch (error) {
    ElMessage.error(error?.message || '加载查询记录失败')
  } finally {
    queriesLoading.value = false
  }
}

function handleQueriesPage(page) {
  queriesPagination.value.page = page
  loadQueries()
}

function filterText(filter) {
  const parts = []
  if (filter?.host) parts.push(`目标含 ${filter.host}`)
  if (filter?.network) parts.push(filter.network.toUpperCase())
  return parts.join(' · ') || '--'
}

// ===== 概况 =====
async function loadOverview() {
  overviewLoading.value = true
  try {
    overview.value = await fetchAccessLogOverview()
  } catch (error) {
    ElMessage.error(error?.message || '加载访问记录状态失败')
  } finally {
    overviewLoading.value = false
  }
}

const statusAlert = computed(() => {
  if (!overview.value) return null
  if (!overview.value.enable) return { type: 'info', title: '访问记录未开启：在系统设置 →「用户访问记录」里打开开关并配置存储。' }
  if (!overview.value.storageConfigured) return { type: 'warning', title: '已开启但存储未配置完整，节点不会记录。' }
  return null
})

const nodeTotals = computed(() => {
  const nodes = overview.value?.nodes || []
  return nodes.reduce(
    (acc, n) => ({ files: acc.files + n.files, records: acc.records + n.records, dropped: acc.dropped + n.dropped, bytes: acc.bytes + n.bytes }),
    { files: 0, records: 0, dropped: 0, bytes: 0 }
  )
})

function handleTabChange(name) {
  if (name === 'queries' && !queries.value.length) loadQueries()
}

function refreshAll() {
  loadOverview()
  if (activeTab.value === 'queries') loadQueries()
  if (summary.value) loadSummary()
}

onMounted(() => {
  loadOverview()
  const fromRoute = String(route.query.user_id || '')
  if (/^\d+$/.test(fromRoute)) {
    userId.value = fromRoute
    loadSummary()
  }
})

onBeforeUnmount(() => clearTimeout(pollTimer))
</script>

<template>
  <section class="page-stack">
    <SectionCard
      title="用户访问记录"
      description="Rust 节点按连接记录每个用户访问的目标、端口、客户端 IP 和流量，明细存放在 S3。这里按用户看每日汇总、查明细并导出 CSV。每次查看都会记入审计日志。"
    >
      <template #actions>
        <el-button :icon="RefreshCw" class="ghost-btn small" plain type="info" @click="refreshAll">刷新</el-button>
      </template>

      <el-alert
        v-if="statusAlert"
        :type="statusAlert.type"
        :closable="false"
        :title="statusAlert.title"
        class="access-alert"
      >
        <el-button link type="primary" @click="router.push(toSettings('accessLog'))">去设置</el-button>
      </el-alert>

      <div v-loading="overviewLoading" class="access-metrics">
        <el-card class="metric-card metric-card--unified metric-card--compact" shadow="never">
          <span class="metric-label">状态</span>
          <strong class="metric-value">{{ overview?.recording ? '记录中' : '未记录' }}</strong>
          <span class="access-foot">保留 {{ overview?.retentionDays || 30 }} 天</span>
        </el-card>
        <el-card class="metric-card metric-card--unified metric-card--compact" shadow="never">
          <span class="metric-label">近 24 小时记录</span>
          <strong class="metric-value">{{ nodeTotals.records.toLocaleString() }}<small class="access-unit">条</small></strong>
          <span class="access-foot">{{ (overview?.nodes || []).length }} 个节点上传了 {{ nodeTotals.files }} 批</span>
        </el-card>
        <el-card class="metric-card metric-card--unified metric-card--compact" shadow="never">
          <span class="metric-label">近 24 小时写入</span>
          <strong class="metric-value">{{ formatBytes(nodeTotals.bytes) }}</strong>
          <span class="access-foot">压缩后存放在 S3</span>
        </el-card>
        <el-card class="metric-card metric-card--unified metric-card--compact" shadow="never">
          <span class="metric-label">节点丢弃</span>
          <strong class="metric-value" :class="{ 'access-value--warn': nodeTotals.dropped }">{{ nodeTotals.dropped.toLocaleString() }}</strong>
          <span class="access-foot">节点队列满或暂存写不下时丢的条数</span>
        </el-card>
      </div>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane name="user" label="按用户查询">
          <div class="access-form">
            <el-input
              v-model="userId"
              :prefix-icon="Search"
              clearable
              placeholder="用户 ID"
              style="width: 160px"
              @keyup.enter="loadSummary"
            />
            <el-date-picker
              v-model="summaryRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              :clearable="false"
            />
            <el-button type="primary" :loading="summaryLoading" @click="loadSummary">查看汇总</el-button>
            <el-link v-if="summary?.user" type="primary" @click="router.push(toUser(summary.user.id, summary.user.email))">
              {{ summary.user.email }}
            </el-link>
          </div>
          <el-alert v-if="summaryError" type="error" :closable="false" :title="summaryError" class="access-alert" />

          <template v-if="summary">
            <div class="access-total">
              合计 {{ summary.total.records.toLocaleString() }} 条连接 · 上行 {{ formatBytes(summary.total.up) }} · 下行 {{ formatBytes(summary.total.down) }}
            </div>
            <el-table :data="summary.days" row-key="dt" empty-text="这段时间没有记录" size="small">
              <el-table-column type="expand">
                <template #default="{ row }">
                  <el-table :data="row.nodes" size="small" class="access-nested">
                    <el-table-column label="节点" min-width="200">
                      <template #default="{ row: node }">{{ nodeLabel(node) }}</template>
                    </el-table-column>
                    <el-table-column label="连接数" width="110">
                      <template #default="{ row: node }">{{ node.records.toLocaleString() }}</template>
                    </el-table-column>
                    <el-table-column label="上行" width="110">
                      <template #default="{ row: node }">{{ formatBytes(node.up) }}</template>
                    </el-table-column>
                    <el-table-column label="下行" width="110">
                      <template #default="{ row: node }">{{ formatBytes(node.down) }}</template>
                    </el-table-column>
                    <el-table-column label="出现的时段" min-width="220">
                      <template #default="{ row: node }">{{ formatHours(node.hours) }}</template>
                    </el-table-column>
                  </el-table>
                </template>
              </el-table-column>
              <el-table-column prop="dt" label="日期" width="130" />
              <el-table-column label="连接数" width="120">
                <template #default="{ row }">{{ row.records.toLocaleString() }}</template>
              </el-table-column>
              <el-table-column label="上行" width="120">
                <template #default="{ row }">{{ formatBytes(row.up) }}</template>
              </el-table-column>
              <el-table-column label="下行" width="120">
                <template #default="{ row }">{{ formatBytes(row.down) }}</template>
              </el-table-column>
              <el-table-column label="节点" min-width="160">
                <template #default="{ row }">{{ row.nodes.map(nodeLabel).join('、') }}</template>
              </el-table-column>
            </el-table>

            <el-divider content-position="left">明细与导出</el-divider>
            <div class="access-form">
              <el-date-picker
                v-model="detailRange"
                type="daterange"
                value-format="YYYY-MM-DD"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
              />
              <el-input v-model="detailHost" clearable placeholder="目标包含（可选）" style="width: 200px" />
              <el-select v-model="detailNetwork" clearable placeholder="协议" style="width: 110px">
                <el-option label="TCP" value="tcp" />
                <el-option label="UDP" value="udp" />
              </el-select>
              <el-button type="primary" :loading="detailRunning" @click="runDetailQuery">查询明细</el-button>
              <span class="access-hint">一次最多 {{ maxQueryDays }} 天，只读该用户所在的那一段数据。</span>
            </div>

            <div v-if="detailResult" class="access-result">
              <div class="access-result__head">
                <el-tag :type="QUERY_STATUS[detailResult.status]?.type" effect="plain">{{ QUERY_STATUS[detailResult.status]?.text }}</el-tag>
                <span>{{ detailResult.date_from }} 至 {{ detailResult.date_to }}</span>
                <span v-if="detailResult.status === 2">
                  {{ detailResult.rows.toLocaleString() }} 条 · 读取 {{ detailResult.files }} 批（{{ formatBytes(detailResult.bytes) }}）
                  <template v-if="detailResult.missing">· {{ detailResult.missing }} 批读不到</template>
                </span>
                <el-button
                  v-if="detailResult.download_url"
                  :icon="Download"
                  size="small"
                  type="primary"
                  plain
                  @click="download(detailResult)"
                >下载 CSV</el-button>
              </div>
              <el-alert
                v-if="detailResult.truncated"
                type="warning"
                :closable="false"
                title="结果太多或读取超时，只返回了前面的部分。缩短日期或加上目标过滤后再查。"
                class="access-alert"
              />
              <el-alert v-if="detailResult.status === 3" type="error" :closable="false" :title="detailResult.error || '查询失败'" class="access-alert" />
              <el-table v-if="topHosts.length" :data="topHosts" size="small" max-height="420">
                <el-table-column prop="host" label="目标" min-width="240" show-overflow-tooltip />
                <el-table-column label="连接数" width="110">
                  <template #default="{ row }">{{ row.records.toLocaleString() }}</template>
                </el-table-column>
                <el-table-column label="上行" width="110">
                  <template #default="{ row }">{{ formatBytes(row.up) }}</template>
                </el-table-column>
                <el-table-column label="下行" width="110">
                  <template #default="{ row }">{{ formatBytes(row.down) }}</template>
                </el-table-column>
                <el-table-column label="合计" width="110">
                  <template #default="{ row }">{{ formatBytes(row.up + row.down) }}</template>
                </el-table-column>
              </el-table>
              <p v-if="detailResult.summary?.distinct_hosts > topHosts.length" class="access-hint">
                共 {{ detailResult.summary.distinct_hosts }} 个目标，这里列出流量最大的 {{ topHosts.length }} 个，完整明细见 CSV。
              </p>
            </div>
          </template>
        </el-tab-pane>

        <el-tab-pane name="nodes" label="节点上传">
          <el-table :data="overview?.nodes || []" size="small" empty-text="近 24 小时没有节点上传">
            <el-table-column label="节点" min-width="200">
              <template #default="{ row }">{{ nodeLabel(row) }}</template>
            </el-table-column>
            <el-table-column prop="files" label="批次" width="90" />
            <el-table-column label="记录" width="120">
              <template #default="{ row }">{{ row.records.toLocaleString() }}</template>
            </el-table-column>
            <el-table-column label="丢弃" width="100">
              <template #default="{ row }">
                <span :class="{ 'access-value--warn': row.dropped }">{{ row.dropped.toLocaleString() }}</span>
              </template>
            </el-table-column>
            <el-table-column label="大小" width="110">
              <template #default="{ row }">{{ formatBytes(row.bytes) }}</template>
            </el-table-column>
            <el-table-column label="最近上传" width="160">
              <template #default="{ row }">{{ formatTimestamp(row.last_upload_at) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane name="queries" label="查询记录">
          <div class="access-form">
            <el-input
              v-model="queriesUserFilter"
              :prefix-icon="Search"
              clearable
              placeholder="按用户 ID 筛选"
              style="width: 180px"
              @keyup.enter="handleQueriesPage(1)"
              @clear="handleQueriesPage(1)"
            />
            <span class="access-hint">每次明细查询都留一条记录：谁、什么时候、查了哪个用户的哪几天。</span>
          </div>
          <el-table v-loading="queriesLoading" :data="queries" size="small" empty-text="还没有查询">
            <el-table-column label="时间" width="160">
              <template #default="{ row }">{{ formatTimestamp(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="管理员" min-width="180">
              <template #default="{ row }">{{ row.admin?.email || row.admin_id }}</template>
            </el-table-column>
            <el-table-column prop="user_id" label="用户 ID" width="100" />
            <el-table-column label="日期" width="210">
              <template #default="{ row }">{{ row.date_from }} 至 {{ row.date_to }}</template>
            </el-table-column>
            <el-table-column label="过滤" min-width="140">
              <template #default="{ row }">{{ filterText(row.filter) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="QUERY_STATUS[row.status]?.type" size="small" effect="plain">{{ QUERY_STATUS[row.status]?.text }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="条数" width="100">
              <template #default="{ row }">{{ row.rows.toLocaleString() }}</template>
            </el-table-column>
            <el-table-column label="" width="80">
              <template #default="{ row }">
                <el-button link type="primary" @click="openQuery(row)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-if="queriesPagination.total > queriesPagination.pageSize"
            class="access-pagination"
            layout="prev, pager, next, total"
            :current-page="queriesPagination.page"
            :page-size="queriesPagination.pageSize"
            :total="queriesPagination.total"
            @current-change="handleQueriesPage"
          />
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </section>
</template>

<style scoped>
.access-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

@media (max-width: 1100px) {
  .access-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .access-metrics {
    grid-template-columns: 1fr;
  }
}

.access-unit {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.access-foot {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.access-value--warn {
  color: var(--el-color-warning);
}

.access-alert {
  margin-bottom: 12px;
}

.access-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.access-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.access-total {
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.access-nested {
  margin: 4px 0 4px 48px;
  width: calc(100% - 48px);
}

.access-result {
  margin-top: 8px;
}

.access-result__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  font-size: 13px;
}

.access-pagination {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
