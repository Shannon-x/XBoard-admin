<script setup>
import {
  CheckCircle2,
  FileText,
  Lock,
  Minus,
  Server,
  Settings2,
  Upload,
  X,
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import SectionCard from '../components/common/SectionCard.vue'
import PluginConfigDialog from '../components/plugins/PluginConfigDialog.vue'
import { useAdminStore } from '../stores/admin'

const adminStore = useAdminStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const STATUS_ALL = 'all'
const STATUS_ENABLED = 'enabled'
const STATUS_DISABLED = 'disabled'
const STATUS_NOT_INSTALLED = 'not_installed'
const STATUS_PROTECTED = 'protected'
const STATUS_UNKNOWN = 'unknown'
const TYPE_FEATURE = 'feature'

const pluginsLoadingFallback = ref(false)
const uploadDialogVisible = ref(false)
const uploadRef = ref(null)
const uploadFileList = ref([])
const configDialogVisible = ref(false)
const activePlugin = ref(null)
const readmeDialogVisible = ref(false)
const readmePlugin = ref(null)

const filters = reactive({
  keyword: '',
  status: STATUS_ALL,
  type: STATUS_ALL,
})

const statusStyleMap = new Map([
  [STATUS_ENABLED, { type: 'success', icon: CheckCircle2 }],
  [STATUS_DISABLED, { type: 'info', icon: Minus }],
  [STATUS_NOT_INSTALLED, { type: 'danger', icon: X }],
  [STATUS_PROTECTED, { type: 'primary', icon: Lock }],
  [STATUS_UNKNOWN, { type: 'warning', icon: Server }],
])

// dialog 不可见时 marked 不工作；只有真正打开 README 弹窗才解析。
// 之前 computed 在任何 readmePlugin 变化时都跑一次，包括关闭对话框 readmePlugin=null 的回归。
const renderedReadme = computed(function resolveRenderedReadme() {
  if (!readmeDialogVisible.value) return ''
  const content = readmePlugin.value?.readme || ''
  if (!content) return ''

  // 注意：marked ≥ 7 内置 sanitizer 已被移除；插件 README 来源于插件目录，
  // 在 v-html 注入前必须经 DOMPurify 过滤，否则可能存储型 XSS。
  const html = marked.parse(content, { breaks: true })
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus'],
  })
})

const statusOptions = computed(function resolveStatusOptions() {
  return [
    { label: '全部', value: STATUS_ALL },
    { label: t('plugins.status.enabled'), value: STATUS_ENABLED },
    { label: t('plugins.status.disabled'), value: STATUS_DISABLED },
    { label: t('plugins.status.notInstalled'), value: STATUS_NOT_INSTALLED },
  ]
})

const typeOptions = computed(function resolveTypeOptions() {
  const remoteTypes = adminStore.pluginTypes.map((type) => ({
    label: type.label || type.value,
    value: type.value,
    description: type.description,
    icon: type.icon,
  }))

  return [{ label: '全部', value: STATUS_ALL }, ...remoteTypes]
})

const filteredPlugins = computed(function resolveFilteredPlugins() {
  const keyword = filters.keyword.trim().toLowerCase()

  return adminStore.plugins.filter((plugin) => {
    const matchKeyword = matchesPluginKeyword(plugin, keyword)
    const matchStatus = matchesPluginStatus(plugin, filters.status)
    const matchType = matchesPluginType(plugin, filters.type)

    return matchKeyword && matchStatus && matchType
  })
})

function normalizeQueryValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function normalizeStatusKey(status) {
  const normalized = String(status || '').trim().toLowerCase()

  if (
    normalized === STATUS_ENABLED ||
    normalized === STATUS_DISABLED ||
    normalized === STATUS_NOT_INSTALLED ||
    normalized === STATUS_PROTECTED
  ) {
    return normalized
  }

  return STATUS_UNKNOWN
}

function resolveStatusLabel(status) {
  const normalized = normalizeStatusKey(status)

  if (normalized === STATUS_ENABLED) {
    return t('plugins.status.enabled')
  }

  if (normalized === STATUS_DISABLED) {
    return t('plugins.status.disabled')
  }

  if (normalized === STATUS_NOT_INSTALLED) {
    return t('plugins.status.notInstalled')
  }

  if (normalized === STATUS_PROTECTED) {
    return t('plugins.status.protected')
  }

  return status || '--'
}

function resolveStatusType(status) {
  const normalized = normalizeStatusKey(status)
  return statusStyleMap.get(normalized)?.type || 'info'
}

function resolveStatusIcon(status) {
  const normalized = normalizeStatusKey(status)
  return statusStyleMap.get(normalized)?.icon || Settings2
}

function resolveTypeLabel(type) {
  const normalized = String(type || '').trim().toLowerCase()

  if (normalized === TYPE_FEATURE) {
    return t('plugins.types.feature')
  }

  if (normalized === 'payment') {
    return t('plugins.types.payment')
  }

  if (normalized === 'other') {
    return t('plugins.types.other')
  }

  return type || t('plugins.types.other')
}

function normalizeStatusFromQuery(status) {
  const normalized = normalizeQueryValue(status)

  if (!normalized) {
    return STATUS_ALL
  }

  const hasMatch = statusOptions.value.some((option) => option.value === normalized)
  return hasMatch ? normalized : STATUS_ALL
}

function normalizeTypeFromQuery(type) {
  const normalized = normalizeQueryValue(type)

  if (!normalized) {
    return STATUS_ALL
  }

  const hasMatch = typeOptions.value.some((option) => option.value === normalized)
  return hasMatch ? normalized : STATUS_ALL
}

function syncFiltersToRoute() {
  const nextQuery = { ...route.query }

  if (filters.status && filters.status !== STATUS_ALL) {
    nextQuery.status = filters.status
  } else {
    delete nextQuery.status
  }

  if (filters.type && filters.type !== STATUS_ALL) {
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

function matchesPluginKeyword(plugin, keyword) {
  if (!keyword) {
    return true
  }

  return [plugin.name, plugin.code, plugin.author]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(keyword))
}

function matchesPluginStatus(plugin, status) {
  if (status === STATUS_ALL) {
    return true
  }

  if (status === STATUS_ENABLED) {
    return plugin.enabled
  }

  if (status === STATUS_DISABLED) {
    return plugin.installed && !plugin.enabled
  }

  if (status === STATUS_NOT_INSTALLED) {
    return !plugin.installed
  }

  return true
}

function matchesPluginType(plugin, type) {
  if (type === STATUS_ALL) {
    return true
  }

  return String(plugin.type || '').toLowerCase() === type
}

async function fetchPlugins() {
  pluginsLoadingFallback.value = true

  try {
    // 之前是串行 await，loadPluginTypes 慢就让首屏整体翻倍。
    // 改并行；任一失败都触发 catch 但 Promise.allSettled 仍能保证另一边推进。
    const results = await Promise.allSettled([
      adminStore.loadPluginTypes(),
      adminStore.loadPlugins({
        filters: {
          status: filters.status,
          type: filters.type,
        },
      }),
    ])
    const failed = results.find(r => r.status === 'rejected')
    if (failed) throw failed.reason
  } catch (error) {
    ElMessage.error(error?.message || '插件列表加载失败，请稍后重试')
  } finally {
    pluginsLoadingFallback.value = false
  }
}

// status / type 是服务端筛选（进 loadPlugins 的 filters），需要重新拉列表；
// 打 debounce 避免连点时请求堆积。
let filterDebounceTimer = null
function handleFilterChange() {
  syncFiltersToRoute()
  if (filterDebounceTimer) clearTimeout(filterDebounceTimer)
  filterDebounceTimer = setTimeout(() => {
    filterDebounceTimer = null
    fetchPlugins()
  }, 350)
}

// 关键字是纯客户端过滤（filteredPlugins computed），keyword 根本不在下发的
// filters 里。之前它也走 handleFilterChange，等于每敲一个字就白打一次全量
// 接口 —— 只同步 URL 就够了，列表由 computed 即时重算。
function handleKeywordChange() {
  syncFiltersToRoute()
}

function handleRefresh() {
  fetchPlugins()
}

function openUploadDialog() {
  uploadDialogVisible.value = true
}

function handleUploadFileChange(file, fileList) {
  uploadFileList.value = fileList.slice(-1)
}

function handleUploadRemove(file, fileList) {
  uploadFileList.value = fileList
}

function handleUploadExceed() {
  ElMessage.warning('一次只能上传一个插件包')
}

function resetUploadState() {
  uploadFileList.value = []
  uploadRef.value?.clearFiles()
}

const PLUGIN_MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20MB
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]      // 'PK\x03\x04'

async function validatePluginFile(file) {
  // 后端 accept=".zip" 只是 hint —— 实际拖拽任意文件都能到这里。
  const name = String(file?.name || '').toLowerCase()
  if (!name.endsWith('.zip')) {
    throw new Error('仅支持 .zip 格式的插件包')
  }
  if (file.size > PLUGIN_MAX_SIZE_BYTES) {
    throw new Error(`插件包过大（${(file.size / 1024 / 1024).toFixed(1)}MB），不能超过 ${PLUGIN_MAX_SIZE_BYTES / 1024 / 1024}MB`)
  }
  // magic number 校验，防止改后缀的非 zip
  try {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    if (head.length < 4 || !ZIP_MAGIC.every((b, i) => head[i] === b)) {
      throw new Error('文件头校验失败：不是合法的 zip 文件')
    }
  } catch (e) {
    // 浏览器不支持 slice().arrayBuffer() 时不阻挡上传
    if (e instanceof Error && e.message?.startsWith('文件头')) throw e
  }
}

async function handleUploadRequest(options) {
  const file = options?.file

  if (!file) {
    const error = new Error('缺少上传文件')
    ElMessage.warning('请选择插件包')
    options?.onError?.(error)
    return
  }

  try {
    await validatePluginFile(file)
  } catch (error) {
    ElMessage.error(error.message)
    options?.onError?.(error)
    return
  }

  try {
    await adminStore.uploadPlugin(file)
    options?.onSuccess?.({}, file)
    ElMessage.success('插件上传成功')
    uploadDialogVisible.value = false
    resetUploadState()
    await fetchPlugins()
  } catch (error) {
    options?.onError?.(error)
    ElMessage.error(error?.message || '插件上传失败')
  }
}

function handleConfigure(plugin) {
  if (!plugin.config || plugin.configCount === 0) {
    ElMessage.info('该插件暂无可配置项')
    return
  }

  activePlugin.value = plugin
  configDialogVisible.value = true
}

function handleReadme(plugin) {
  readmePlugin.value = plugin
  readmeDialogVisible.value = true
}

async function runPluginAction(action, successMessage, errorMessage) {
  try {
    await action()
    ElMessage.success(successMessage)
    await fetchPlugins()
  } catch (error) {
    ElMessage.error(error?.message || errorMessage)
  }
}

async function handleToggle(plugin) {
  if (!plugin.installed) {
    ElMessage.warning('插件尚未安装，暂不可启用')
    return
  }

  const shouldEnable = !plugin.enabled
  const successMessage = shouldEnable ? '插件启用成功' : '插件停用成功'

  await runPluginAction(
    () => adminStore.togglePlugin(plugin.code, shouldEnable),
    successMessage,
    '插件操作失败'
  )
}

async function handleInstall(plugin) {
  await runPluginAction(
    () => adminStore.installPlugin(plugin.code),
    '插件安装成功',
    '插件安装失败'
  )
}

function resolveConfirmButtonText(title) {
  if (title === '删除插件') {
    return '确认删除'
  }

  return '确认卸载'
}

async function confirmPluginAction(message, title, type, action, errorMessage) {
  try {
    await ElMessageBox.confirm(message, title, {
      confirmButtonText: resolveConfirmButtonText(title),
      cancelButtonText: '取消',
      type,
    })
    await action()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error?.message || errorMessage)
    }
  }
}

async function handleUninstall(plugin) {
  if (!plugin.deletable) {
    ElMessage.warning('系统插件不可卸载')
    return
  }

  await confirmPluginAction(
    `确认卸载插件「${plugin.name || plugin.code}」？`,
    '卸载插件',
    'warning',
    () =>
      runPluginAction(
        () => adminStore.uninstallPlugin(plugin.code),
        '插件卸载成功',
        '插件卸载失败'
      ),
    '插件卸载失败'
  )
}

async function handleDelete(plugin) {
  if (!plugin.deletable) {
    ElMessage.warning('系统插件不可删除')
    return
  }

  await confirmPluginAction(
    `确认删除插件「${plugin.name || plugin.code}」？此操作不可恢复。`,
    '删除插件',
    'error',
    () =>
      runPluginAction(
        () => adminStore.deletePlugin(plugin.code),
        '插件删除成功',
        '插件删除失败'
      ),
    '插件删除失败'
  )
}

onMounted(function initializePluginsPage() {
  filters.status = normalizeStatusFromQuery(route.query.status)

  const initialType = normalizeTypeFromQuery(route.query.type)
  filters.type = initialType
  filters.keyword = typeof route.query.keyword === 'string' ? route.query.keyword : ''

  fetchPlugins()
})

onUnmounted(function cleanupPluginsPage() {
  if (filterDebounceTimer) {
    clearTimeout(filterDebounceTimer)
    filterDebounceTimer = null
  }
})
</script>

<template>
    <section class="page-stack">
        <SectionCard>
            <template #actions>
                <el-space wrap>
                    <el-input
                        v-model="filters.keyword"
                        class="plugin-filter"
                        clearable
                        placeholder="搜索插件名称/标识/作者"
                        @input="handleKeywordChange"
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
                    <el-button
                        class="primary-btn small"
                        type="primary"
                        @click="openUploadDialog"
                    >
                        <el-icon>
                            <Upload />
                        </el-icon>
                        上传插件
                    </el-button>
                    <el-button
                        class="ghost-btn small"
                        type="info"
                        plain
                        @click="handleRefresh"
                    >
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

            <div
                v-loading="adminStore.pluginsLoading || pluginsLoadingFallback"
                class="plugin-card-grid"
            >
                <div v-if="filteredPlugins.length === 0" class="plugin-empty">
                    <el-empty description="暂无符合条件的插件" />
                </div>
                <article
                    v-for="plugin in filteredPlugins"
                    :key="plugin.code"
                    class="plugin-card"
                >
                    <header class="plugin-card__header">
                        <div class="plugin-card__title">
                            <h3>{{ plugin.name || "--" }}</h3>
                            <el-tag class="plugin-card__tag" effect="plain">
                                {{ resolveTypeLabel(plugin.type) }}
                            </el-tag>
                            <el-tag
                                :type="resolveStatusType(plugin.status)"
                                class="plugin-card__tag"
                                effect="dark"
                            >
                                <el-icon class="plugin-status__icon">
                                    <component
                                        :is="resolveStatusIcon(plugin.status)"
                                    />
                                </el-icon>
                                {{ resolveStatusLabel(plugin.status) }}
                            </el-tag>
                        </div>
                        <el-button
                            class="plugin-card__readme"
                            text
                            circle
                            v-if="plugin.readme"
                            @click="handleReadme(plugin)"
                        >
                            <el-icon>
                                <FileText />
                            </el-icon>
                        </el-button>
                    </header>
                    <div class="plugin-card__meta">
                        <span class="plugin-card__code">{{ plugin.code }}</span>
                        <span>v{{ plugin.version || "--" }}</span>
                        <span>作者: {{ plugin.author || "--" }}</span>
                    </div>
                    <p class="plugin-card__desc">
                        {{ plugin.description || "暂无描述" }}
                    </p>
                    <footer class="plugin-card__actions">
                        <el-space wrap>
                            <el-button
                                v-if="plugin.installed && plugin.enabled"
                                class="ghost-btn small"
                                type="info"
                                plain
                                @click="handleConfigure(plugin)"
                            >
                                配置
                            </el-button>
                            <el-button
                                v-if="!plugin.installed"
                                class="primary-btn small"
                                type="success"
                                @click="handleInstall(plugin)"
                            >
                                安装
                            </el-button>
                            <el-button
                                v-else
                                class="primary-btn small"
                                type="success"
                                @click="handleToggle(plugin)"
                            >
                                {{ plugin.enabled ? "停用" : "启用" }}
                            </el-button>
                            <el-button
                                v-if="plugin.installed"
                                class="ghost-btn small"
                                type="warning"
                                plain
                                @click="handleUninstall(plugin)"
                            >
                                卸载
                            </el-button>
                            <el-button
                                v-if="!plugin.installed"
                                class="ghost-btn small"
                                type="danger"
                                plain
                                @click="handleDelete(plugin)"
                            >
                                删除
                            </el-button>
                        </el-space>
                    </footer>
                </article>
            </div>
        </SectionCard>
    </section>
    <PluginConfigDialog v-model="configDialogVisible" :plugin="activePlugin" />
    <el-dialog
        v-model="uploadDialogVisible"
        class="plugin-upload-dialog"
        title="上传插件"
        width="min(560px, calc(100vw - 32px))"
        @close="resetUploadState"
    >
        <el-upload
            ref="uploadRef"
            :auto-upload="true"
            :file-list="uploadFileList"
            :limit="1"
            accept=".zip"
            drag
            class="plugin-upload"
            :http-request="handleUploadRequest"
            @change="handleUploadFileChange"
            @remove="handleUploadRemove"
            @exceed="handleUploadExceed"
        >
            <div class="plugin-upload__hint">
                <el-icon class="plugin-upload__icon">
                    <Upload />
                </el-icon>
                <p class="plugin-upload__title">拖拽插件包到此处，或 浏览</p>
                <p class="plugin-upload__subtitle">仅支持 .zip 格式文件</p>
            </div>
        </el-upload>
    </el-dialog>
    <el-dialog
        v-model="readmeDialogVisible"
        :title="readmePlugin?.name || '插件说明'"
        width="min(640px, calc(100vw - 32px))"
    >
        <div class="plugin-readme">
            <el-scrollbar max-height="60vh">
                <div v-if="readmePlugin?.readme" v-html="renderedReadme"></div>
                <el-empty v-else description="暂无 README" />
            </el-scrollbar>
        </div>
    </el-dialog>
</template>

<style scoped>
.plugin-card-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
}


.plugin-upload :deep(.el-upload-dragger) {
    padding: 32px 20px;
    border-radius: 16px;
    border: 1px dashed var(--el-border-color-light);
    background: var(--el-fill-color-lighter);
}

.plugin-upload__hint {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: var(--el-text-color-regular);
}

.plugin-upload__icon {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    color: var(--el-color-primary);
    background: rgba(64, 158, 255, 0.12);
}

.plugin-upload__title {
    margin: 0;
    font-size: 14px;
    color: var(--el-text-color-primary);
}

.plugin-upload__subtitle {
    margin: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
}

.plugin-empty {
    padding: 32px 0;
}

.plugin-card {
    padding: 18px 20px;
    border-radius: 16px;
    border: 1px solid var(--el-border-color-lighter);
    background: var(--el-bg-color);
    box-shadow: 0 10px 24px rgba(42, 37, 32, 0.06);
    display: grid;
    gap: 12px;
}

.plugin-card__header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
}

.plugin-card__title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
}

.plugin-card__title h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
}

.plugin-card__readme {
    align-self: flex-start;
    color: var(--el-text-color-secondary);
}

.plugin-card__readme:hover {
    color: var(--el-color-primary);
}

.plugin-card__tag {
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
}

.plugin-card__tag :deep(.el-tag__content) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.plugin-card__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
}

.plugin-card__code {
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--el-fill-color-lighter);
    font-family: "Fira Code", monospace;
    color: var(--el-text-color-regular);
}

.plugin-card__desc {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--el-text-color-regular);
}

.plugin-card__actions {
    display: flex;
    justify-content: flex-end;
}

.plugin-readme {
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
}

.plugin-readme :deep(h1),
.plugin-readme :deep(h2),
.plugin-readme :deep(h3) {
    margin: 16px 0 8px;
    font-weight: 600;
    color: var(--el-text-color-primary);
}

.plugin-readme :deep(p) {
    margin: 0 0 10px;
}

.plugin-readme :deep(ul),
.plugin-readme :deep(ol) {
    margin: 0 0 10px 18px;
    padding: 0;
}

.plugin-readme :deep(code) {
    padding: 2px 6px;
    border-radius: 6px;
    background: var(--el-fill-color-lighter);
    font-family: "Fira Code", monospace;
    font-size: 12px;
}

.plugin-readme :deep(pre) {
    margin: 10px 0 14px;
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--el-fill-color-lighter);
    overflow: auto;
}

.plugin-readme :deep(pre code) {
    padding: 0;
    background: transparent;
}

.plugin-status__icon {
    margin-right: 0;
    display: inline-flex;
    align-items: center;
}

@media (max-width: 720px) {
    .plugin-card {
        padding: 16px;
    }

    .plugin-card__actions {
        justify-content: flex-start;
    }
}
</style>
