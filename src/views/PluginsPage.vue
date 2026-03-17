<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  CircleCheck,
  Close,
  Loading,
  Monitor,
  SetUp,
} from '@element-plus/icons-vue'

import DataTableCard from '../components/common/DataTableCard.vue'
import SectionCard from '../components/common/SectionCard.vue'
import { useAdminStore } from '../stores/admin'

const adminStore = useAdminStore()
const route = useRoute()
const router = useRouter()

const pluginsLoadingFallback = ref(false)

const filters = reactive({
  keyword: '',
  status: 'all',
  type: 'all',
})

const statusOptions = [
  { label: '全部', value: 'all' },
  { label: '已启用', value: 'enabled' },
  { label: '已停用', value: 'disabled' },
  { label: '未安装', value: 'not_installed' },
]

const typeOptions = [
  { label: '全部', value: 'all' },
  { label: '功能', value: 'feature' },
  { label: '支付', value: 'payment' },
  { label: '其他', value: 'other' },
]

const pluginColumns = [
  { label: '插件名称', minWidth: 220, prop: 'name' },
  { label: '类型', minWidth: 120, prop: 'type' },
  { label: '版本', minWidth: 120, prop: 'version' },
  { label: '作者', minWidth: 140, prop: 'author' },
  { label: '状态', minWidth: 120, slot: 'status' },
  { label: '配置项', minWidth: 100, prop: 'configCount' },
  { label: '操作', minWidth: 220, slot: 'actions' },
]

const statusStyleMap = new Map([
  ['已启用', { type: 'success', icon: CircleCheck }],
  ['已停用', { type: 'info', icon: Close }],
  ['未安装', { type: 'warning', icon: Loading }],
  ['受保护', { type: 'primary', icon: Monitor }],
])

const statusLabelMap = new Map([
  ['1', '已启用'],
  ['0', '已停用'],
  ['enabled', '已启用'],
  ['disabled', '已停用'],
  ['not_installed', '未安装'],
])

function resolveStatusLabel(status) {
  const mapped = statusLabelMap.get(status)
  return mapped || status
}

function resolveStatusType(status) {
  return statusStyleMap.get(status)?.type || 'info'
}

function resolveStatusIcon(status) {
  return statusStyleMap.get(status)?.icon || SetUp
}

function normalizeStatusFromQuery(status) {
  if (!status) {
    return 'all'
  }

  const normalized = Array.isArray(status) ? status[0] : status

  return statusOptions.find((option) => option.value === normalized)
    ? normalized
    : 'all'
}

function normalizeTypeFromQuery(type) {
  if (!type) {
    return 'all'
  }

  const normalized = Array.isArray(type) ? type[0] : type
  const hasMatch = typeOptions.find((option) => option.value === normalized)

  return hasMatch ? normalized : 'all'
}

function syncFiltersToRoute() {
  const nextQuery = { ...route.query }

  if (filters.status && filters.status !== 'all') {
    nextQuery.status = filters.status
  } else {
    delete nextQuery.status
  }

  if (filters.type && filters.type !== 'all') {
    nextQuery.type = filters.type
  } else {
    delete nextQuery.type
  }

  if (filters.keyword) {
    nextQuery.keyword = filters.keyword
  } else {
    delete nextQuery.keyword
  }

  router.replace({ query: nextQuery })
}

const filteredPlugins = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase()

  return adminStore.plugins.filter((plugin) => {
    const matchKeyword = keyword
      ? [plugin.name, plugin.code, plugin.author]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword))
      : true
    const matchStatus =
      filters.status === 'all'
        ? true
        : filters.status === 'enabled'
          ? plugin.enabled
          : filters.status === 'disabled'
            ? plugin.installed && !plugin.enabled
            : filters.status === 'not_installed'
              ? !plugin.installed
              : true
    const matchType =
      filters.type === 'all'
        ? true
        : String(plugin.type || '').toLowerCase() === filters.type

    return matchKeyword && matchStatus && matchType
  })
})

const pluginSummary = computed(() => {
  const total = adminStore.plugins.length
  const enabled = adminStore.plugins.filter((plugin) => plugin.enabled).length
  const installed = adminStore.plugins.filter((plugin) => plugin.installed).length
  const needUpgrade = adminStore.plugins.filter((plugin) => plugin.needUpgrade).length

  return {
    total,
    enabled,
    installed,
    needUpgrade,
  }
})

async function fetchPlugins() {
  pluginsLoadingFallback.value = true

  try {
    await adminStore.loadPlugins({
      filters: {
        status: filters.status,
        type: filters.type,
      },
    })
  } catch (error) {
    ElMessage.error('插件列表加载失败，请稍后重试')
  } finally {
    pluginsLoadingFallback.value = false
  }
}

function handleFilterChange() {
  syncFiltersToRoute()
  fetchPlugins()
}

function handleRefresh() {
  fetchPlugins()
}

function handleConfigure(plugin) {
  if (!plugin.config || plugin.configCount === 0) {
    ElMessage.info('该插件暂无可配置项')
    return
  }

  ElMessage.success('下一步可以接入配置弹窗')
}

function handleToggle(plugin) {
  if (!plugin.installed) {
    ElMessage.warning('插件尚未安装，暂不可启用')
    return
  }

  const shouldEnable = !plugin.enabled

  adminStore
    .togglePlugin(plugin.code, shouldEnable)
    .then(() => {
      ElMessage.success(shouldEnable ? '插件启用成功' : '插件停用成功')
      return fetchPlugins()
    })
    .catch((error) => {
      ElMessage.error(error?.message || '插件操作失败')
    })
}

function handleDelete(plugin) {
  if (!plugin.deletable) {
    ElMessage.warning('系统插件不可删除')
    return
  }

  ElMessage.success('后续可接入删除接口')
}

onMounted(() => {
  filters.status = normalizeStatusFromQuery(route.query.status)
  filters.type = normalizeTypeFromQuery(route.query.type)
  filters.keyword =
    typeof route.query.keyword === 'string' ? route.query.keyword : ''
  fetchPlugins()
})
</script>

<template>
  <section class="page-stack">
    <section class="plugin-overview">
      <div class="plugin-overview__card">
        <span>全部插件</span>
        <strong>{{ pluginSummary.total }}</strong>
      </div>
      <div class="plugin-overview__card">
        <span>已安装</span>
        <strong>{{ pluginSummary.installed }}</strong>
      </div>
      <div class="plugin-overview__card">
        <span>已启用</span>
        <strong>{{ pluginSummary.enabled }}</strong>
      </div>
      <div class="plugin-overview__card">
        <span>待升级</span>
        <strong>{{ pluginSummary.needUpgrade }}</strong>
      </div>
    </section>

    <SectionCard
      description="集中查看插件版本、状态与配置项数量，后续可接入启用/停用与配置弹窗。"
      title="插件列表"
    >
      <template #actions>
        <el-space wrap>
          <el-input
            v-model="filters.keyword"
            class="plugin-filter"
            placeholder="搜索插件名称/标识/作者"
            @input="handleFilterChange"
          />
          <el-select
            v-model="filters.status"
            class="plugin-filter"
            placeholder="状态"
            @change="handleFilterChange"
          >
            <el-option
              v-for="option in statusOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-select
            v-model="filters.type"
            class="plugin-filter"
            placeholder="类型"
            @change="handleFilterChange"
          >
            <el-option
              v-for="option in typeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-button class="ghost-btn small" type="info" plain @click="handleRefresh">
            刷新列表
          </el-button>
        </el-space>
      </template>

      <el-alert
        v-if="adminStore.pluginsError"
        :closable="false"
        class="dashboard-alert"
        show-icon
        title="插件接口加载失败，已显示空数据"
        type="warning"
      >
        <template #default>
          {{ adminStore.pluginsError }}
        </template>
      </el-alert>

      <DataTableCard
        :columns="pluginColumns"
        :data="filteredPlugins"
        :loading="adminStore.pluginsLoading || pluginsLoadingFallback"
      >
        <template #status="{ row }">
          <el-tag
            :type="resolveStatusType(row.status)"
            class="plugin-status"
            effect="dark"
          >
            <el-icon class="plugin-status__icon">
              <component :is="resolveStatusIcon(row.status)" />
            </el-icon>
            {{ resolveStatusLabel(row.status) }}
          </el-tag>
        </template>
        <template #actions="{ row }">
          <el-space wrap>
            <el-button
              class="ghost-btn small"
              type="info"
              plain
              @click="handleConfigure(row)"
            >
              配置
            </el-button>
            <el-button class="primary-btn small" type="success" @click="handleToggle(row)">
              {{ row.enabled ? '停用' : '启用' }}
            </el-button>
            <el-button class="ghost-btn small" type="danger" plain @click="handleDelete(row)">
              删除
            </el-button>
          </el-space>
        </template>
      </DataTableCard>
    </SectionCard>
  </section>
</template>
