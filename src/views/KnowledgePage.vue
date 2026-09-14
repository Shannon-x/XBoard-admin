<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { FileLock2, Globe2, LockKeyhole, Plus, ShieldCheck } from 'lucide-vue-next'
import SectionCard from '../components/common/SectionCard.vue'
import SortDialog from '../components/common/SortDialog.vue'
import {
  deleteKnowledgeArticle,
  fetchKnowledgeArticle,
  fetchKnowledgeArticles,
  fetchKnowledgeCapabilities,
  fetchKnowledgeCategories,
  saveKnowledgeArticle,
  sortKnowledgeArticles,
  toggleKnowledgeShow,
} from '../services/knowledge'
import {
  KNOWLEDGE_VISIBILITIES,
  createKnowledgeForm,
  hasPrivateKnowledgeContent,
  validateKnowledgePublication,
} from '../services/knowledge-publication'

const articles = ref([])
const categories = ref([])
const loading = ref(false)
const error = ref('')
const capabilities = ref(null)
const capabilityError = ref('')
const capabilityLoading = ref(false)
const activeCategory = ref('all')
const activeVisibility = ref('all')
const sortDialogVisible = ref(false)
const dialogVisible = ref(false)
const dialogMode = ref('create')
const detailLoading = ref(false)
const detailError = ref('')
const saving = ref(false)
const togglingId = ref(null)
const formError = ref('')
const visibilityNotice = ref('')
const form = reactive(createKnowledgeForm())
let detailRequest = 0

const languageOptions = [
  { label: '简体中文', value: 'zh-CN' },
  { label: '繁体中文', value: 'zh-TW' },
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
  { label: 'Deutsch', value: 'de' },
]
const visibilityOptions = [
  { value: 'public', title: '公开指南', description: '任何人可读，可作为搜索引擎入口。', icon: Globe2 },
  { value: 'members', title: '会员文章', description: '登录后阅读，可进一步要求有效订阅。', icon: LockKeyhole },
  { value: 'admin', title: '内部文章', description: '仅管理员可读，不出现在会员知识库。', icon: FileLock2 },
]
const visibilityLabels = { public: '公开指南', members: '会员 · 登录可读', subscribers: '会员 · 有效订阅', admin: '内部 · 仅管理员' }
const publicationReady = computed(() => capabilities.value?.publicationVersion === 1 && !capabilityLoading.value)
const isMemberArticle = computed(() => form.visibility === 'members' || form.visibility === 'subscribers')
const formLocked = computed(() => !publicationReady.value || detailLoading.value || Boolean(detailError.value) || saving.value)
const sensitiveContent = computed(() => hasPrivateKnowledgeContent([form.title, form.categoryId, form.slug, form.summary, form.body].join('\n')))
const displayArticles = computed(() => articles.value.filter(article => (
  (activeCategory.value === 'all' || String(article.categoryId) === String(activeCategory.value)) &&
  (activeVisibility.value === 'all' || article.visibility === activeVisibility.value)
)))

// Any content, audience or publishing change invalidates an earlier review.
watch(() => [form.title, form.categoryId, form.body, form.language, form.visibility, form.show, form.slug, form.summary], () => {
  form.publicReviewed = false
  formError.value = ''
}, { flush: 'sync' })

async function checkCapabilities() {
  capabilityLoading.value = true
  capabilityError.value = ''
  capabilities.value = null
  try {
    capabilities.value = await fetchKnowledgeCapabilities()
  } catch (err) {
    capabilityError.value = err.message || '无法确认后端知识库权限版本。'
  } finally {
    capabilityLoading.value = false
  }
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [articleList, categoryList] = await Promise.all([
      fetchKnowledgeArticles(), fetchKnowledgeCategories(), checkCapabilities(),
    ])
    articles.value = articleList
    categories.value = categoryList
  } catch (err) {
    error.value = err.message || '知识库加载失败'
  } finally {
    loading.value = false
  }
}

function resetEditor() {
  detailRequest += 1
  detailLoading.value = false
  detailError.value = ''
  formError.value = ''
  visibilityNotice.value = ''
}

function openCreateDialog() {
  if (!publicationReady.value) return
  resetEditor()
  dialogMode.value = 'create'
  Object.assign(form, createKnowledgeForm(categories.value[0]?.id || null))
  dialogVisible.value = true
}

function applyArticle(article) {
  Object.assign(form, createKnowledgeForm(), article, {
    language: article.language || 'zh-CN', publicReviewed: false,
  })
}

async function openEditDialog(article) {
  resetEditor()
  const request = detailRequest
  dialogMode.value = 'edit'
  applyArticle(article)
  dialogVisible.value = true
  detailLoading.value = true
  try {
    const detail = await fetchKnowledgeArticle(article.id)
    if (request !== detailRequest || !dialogVisible.value) return
    if (!detail) throw new Error('文章不存在，请刷新知识库列表。')
    applyArticle(detail)
  } catch (err) {
    if (request === detailRequest) detailError.value = err.message || '加载文章详情失败，暂不能保存。'
  } finally {
    if (request === detailRequest) detailLoading.value = false
  }
}

function changeVisibility(value) {
  if (formLocked.value || value === form.visibility) return
  form.visibility = value
  form.show = false
  visibilityNotice.value = '访问范围已变更，保存后将处于未发布状态。请核对内容，再手动开启发布；更换分类不会改变访问范围。'
}

function chooseAudience(value) {
  changeVisibility(value === 'members' && isMemberArticle.value ? form.visibility : value)
}

async function handleSave() {
  if (formLocked.value) return
  if (!String(form.title || '').trim()) formError.value = '请输入知识标题。'
  else if (!String(form.categoryId ?? '').trim()) formError.value = '请选择或输入分类。'
  else if (!String(form.body || '').trim()) formError.value = '请输入文章内容。'
  else formError.value = validateKnowledgePublication(form, articles.value)
  if (formError.value) return

  saving.value = true
  try {
    await saveKnowledgeArticle({ ...form })
    ElMessage.success(dialogMode.value === 'create' ? '知识已创建' : '知识已更新')
    dialogVisible.value = false
    await loadData()
  } catch (err) {
    formError.value = err.message || '保存失败，请检查后重试。'
    await checkCapabilities()
  } finally {
    saving.value = false
  }
}

async function handleDelete(article) {
  try {
    await ElMessageBox.confirm('确认删除「' + article.title + '」？公开内容的已有转载或副本不会随之消失。', '删除文章', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    })
    await deleteKnowledgeArticle(article.id)
    ElMessage.success('文章已删除')
    await loadData()
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') ElMessage.error(err.message || '删除失败')
  }
}

async function handleToggleShow(article) {
  if (!publicationReady.value || togglingId.value !== null || !KNOWLEDGE_VISIBILITIES.includes(article.visibility)) return
  if (article.visibility === 'public' && !article.show) {
    await openEditDialog(article)
    ElMessage.info('请在编辑器审核内容，再开启发布并确认公开。')
    return
  }
  togglingId.value = article.id
  try {
    await toggleKnowledgeShow(article.id, !article.show)
    ElMessage.success('发布状态已更新')
    await loadData()
  } catch (err) {
    ElMessage.error(err.message || '发布状态更新失败')
    await checkCapabilities()
  } finally {
    togglingId.value = null
  }
}

async function handleSortSave(ids) {
  try {
    await sortKnowledgeArticles(ids)
    ElMessage.success('排序已保存')
    sortDialogVisible.value = false
    await loadData()
  } catch (err) {
    ElMessage.error(err.message || '排序保存失败')
  }
}

onMounted(loadData)
</script>

<template>
  <section class="page-stack">
    <SectionCard title="知识库管理" description="分类决定文章讲什么；访问范围决定谁能看；发布状态决定何时展示。">
      <template #actions>
        <el-space wrap>
          <el-button :loading="loading" @click="loadData">刷新</el-button>
          <el-button :disabled="articles.length < 2" @click="sortDialogVisible = true">排序</el-button>
          <el-button type="primary" :icon="Plus" :disabled="!publicationReady" @click="openCreateDialog">添加知识</el-button>
        </el-space>
      </template>
      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />
      <el-alert
        v-if="capabilityError"
        type="warning"
        :closable="false"
        title="权限能力尚未确认，已暂停文章保存与发布"
        :description="capabilityError + ' 现有文章仍可查看；请勿通过旧后台绕过此保护。'"
        class="dashboard-alert"
      />
      <el-alert
        v-else-if="publicationReady && !capabilities.publicEnabled"
        type="info"
        :closable="false"
        title="后端权限已就绪，公开阅读入口尚未开启"
        description="可以逐篇审核并保存公开指南，但后端公共入口开启前，游客仍无法访问这些文章。"
        class="dashboard-alert"
      />
      <div class="knowledge-filters">
        <el-select v-model="activeCategory" aria-label="按分类筛选">
          <el-option label="全部分类" value="all" />
          <el-option v-for="cat in categories" :key="cat.id" :value="String(cat.id)" :label="cat.title" />
        </el-select>
        <el-select v-model="activeVisibility" aria-label="按访问范围筛选">
          <el-option label="全部访问范围" value="all" />
          <el-option v-for="(label, value) in visibilityLabels" :key="value" :value="value" :label="label" />
        </el-select>
        <span>已有文章默认保留会员范围，不会因升级而公开。</span>
      </div>
      <el-table :data="displayArticles" v-loading="loading" class="dashboard-table">
        <el-table-column label="ID" prop="id" width="65" />
        <el-table-column label="标题" prop="title" min-width="220" />
        <el-table-column label="分类" min-width="120"><template #default="{ row }">{{ row.categoryName || '--' }}</template></el-table-column>
        <el-table-column label="访问范围" min-width="170">
          <template #default="{ row }"><el-tag :type="row.visibility === 'public' ? 'success' : row.visibility === 'admin' ? 'warning' : 'info'">{{ visibilityLabels[row.visibility] || '未知范围 · 请检查' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="语言" width="90"><template #default="{ row }">{{ row.language || '--' }}</template></el-table-column>
        <el-table-column label="发布" width="95">
          <template #default="{ row }">
            <el-switch
              :model-value="row.show"
              :aria-label="row.title + '的发布状态'"
              :disabled="!publicationReady || togglingId !== null || !KNOWLEDGE_VISIBILITIES.includes(row.visibility)"
              :loading="togglingId === row.id"
              @change="handleToggleShow(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }"><el-space :size="4"><el-button link size="small" type="primary" @click="openEditDialog(row)">编辑</el-button><el-button link size="small" type="danger" @click="handleDelete(row)">删除</el-button></el-space></template>
        </el-table-column>
      </el-table>
    </SectionCard>
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '添加知识' : '编辑知识'"
      width="min(920px, calc(100vw - 24px))"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
      destroy-on-close
      @closed="resetEditor"
    >
      <el-alert v-if="detailError" type="error" :closable="false" :title="detailError" class="dashboard-alert" />
      <el-alert v-if="!publicationReady" type="warning" :closable="false" title="未确认后端权限能力，当前只可查看，不能修改或保存。" class="dashboard-alert" />
      <fieldset v-loading="detailLoading" :disabled="formLocked" class="knowledge-form">
        <div class="knowledge-form__field">
          <label for="knowledge-title">标题</label>
          <el-input id="knowledge-title" v-model="form.title" :disabled="formLocked" maxlength="200" placeholder="请输入知识标题" />
        </div>
        <div class="knowledge-form__columns">
          <div class="knowledge-form__field">
            <label for="knowledge-category">分类</label>
            <el-select id="knowledge-category" v-model="form.categoryId" :disabled="formLocked" allow-create default-first-option filterable placeholder="请选择或输入分类">
              <el-option v-for="cat in categories" :key="cat.id" :value="cat.id" :label="cat.title" />
            </el-select>
            <small>同一分类可以包含公开、会员与内部文章。</small>
          </div>
          <div class="knowledge-form__field">
            <label for="knowledge-language">语言</label>
            <el-select id="knowledge-language" v-model="form.language" :disabled="formLocked"><el-option v-for="opt in languageOptions" :key="opt.value" :label="opt.label" :value="opt.value" /></el-select>
          </div>
        </div>
        <fieldset class="knowledge-audience" :disabled="formLocked">
          <legend>访问范围</legend>
          <div class="knowledge-audience__options">
            <button
              v-for="option in visibilityOptions"
              :key="option.value"
              type="button"
              :disabled="formLocked"
              :aria-pressed="option.value === form.visibility || (option.value === 'members' && isMemberArticle)"
              @click="chooseAudience(option.value)"
            >
              <component :is="option.icon" :size="22" :stroke-width="1.6" aria-hidden="true" />
              <strong>{{ option.title }}</strong><span>{{ option.description }}</span>
            </button>
          </div>
          <el-checkbox v-if="isMemberArticle" :model-value="form.visibility === 'subscribers'" :disabled="formLocked" @change="value => changeVisibility(value ? 'subscribers' : 'members')">仅有效订阅会员可读</el-checkbox>
          <p v-if="isMemberArticle" class="knowledge-hint">有效订阅由后端现有规则判断，不简单等同于剩余流量大于零。会员正文仍保留原有订阅变量与 access 块处理。</p>
          <p v-if="form.visibility === 'admin'" class="knowledge-hint">仅管理员能在管理端查看；不会对普通会员展示标题、摘要或正文。</p>
        </fieldset>
        <el-alert v-if="visibilityNotice" type="info" :closable="false" :title="visibilityNotice" />
        <div class="knowledge-publish">
          <div><strong>发布状态</strong><p>访问范围与发布状态独立。未发布的文章不会进入公开或会员阅读列表。</p></div>
          <el-switch v-model="form.show" :disabled="formLocked" active-text="已发布" inactive-text="未发布" aria-label="发布这篇文章" />
        </div>
        <div class="knowledge-form__field">
          <label for="knowledge-summary">摘要{{ form.visibility === 'public' ? ' · 公开必填' : ' · 可选' }}</label>
          <el-input id="knowledge-summary" v-model="form.summary" :disabled="formLocked" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="用一两句话概括这篇文章，不要复制私人凭证或订阅链接。" />
          <small>摘要是独立编辑的内容，不会自动从正文截取。</small>
        </div>
        <div v-if="form.visibility === 'public'" class="knowledge-form__field">
          <label for="knowledge-slug">稳定网址 · 公开必填</label>
          <el-input id="knowledge-slug" v-model="form.slug" :disabled="formLocked" maxlength="120" placeholder="例如 first-connection" spellcheck="false" autocapitalize="none"><template #prepend>/help/</template></el-input>
          <small>小写英文字母、数字、单个连字符；同一语言不可重复。正式链接由主题生成，更改网址会影响已有外部链接。</small>
        </div>
        <div class="knowledge-form__field">
          <label for="knowledge-body">文章内容</label>
          <div class="knowledge-editor"><el-input id="knowledge-body" v-model="form.body" :disabled="formLocked" type="textarea" :autosize="{ minRows: 12, maxRows: 24 }" placeholder="请输入文章内容，支持 Markdown 格式" /></div>
        </div>
        <el-alert
          v-if="sensitiveContent"
          :type="form.visibility === 'public' ? 'error' : 'info'"
          :closable="false"
          title="内容中包含模板变量或 access 保护标记"
          :description="form.visibility === 'public' ? '请先改写为通用说明。个人订阅变量、未知模板变量和受保护片段不能发布为公开指南。' : '这些内容只能保留在受权限保护的文章中，切换公开前必须重新审核。'"
        />
        <div v-if="form.visibility === 'public'" class="knowledge-review">
          <h3><ShieldCheck :size="19" aria-hidden="true" />公开前，请再检查一次</h3>
          <p>检查正文、摘要、图片、二维码和外链中是否含个人凭证、真实订阅链接或私有内容。系统扫描不能代替人工审核。</p>
          <el-checkbox v-if="form.show" v-model="form.publicReviewed" :disabled="formLocked">我已审核以上全部内容，同意任何人阅读、保存和转载。</el-checkbox>
          <p>{{ form.show ? '已经公开的文章每次保存也需要重新确认；再次编辑内容会清空确认。' : '当前为公开草稿；发布前还需要确认内容。' }}</p>
          <p>公开后再改为私有或删除，无法保证搜索引擎缓存、第三方转载与已下载副本立即消失。私人图片和附件也必须单独保护。</p>
          <p v-if="capabilities && !capabilities.publicEnabled">当前部署尚未开启公共阅读接口，保存后游客仍暂时无法阅读。</p>
        </div>
      </fieldset>
      <el-alert v-if="formError" type="error" :closable="false" :title="formError" role="alert" class="knowledge-form-error" />
      <template #footer>
        <el-button :disabled="saving" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="formLocked" @click="handleSave">{{ form.show ? '保存并发布' : '保存为未发布' }}</el-button>
      </template>
    </el-dialog>
    <SortDialog v-model:visible="sortDialogVisible" :items="articles.map(article => ({ id: article.id, name: article.title }))" title="排序知识库" @save="handleSortSave" />
  </section>
</template>

<style scoped>
.knowledge-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 16px 0; }
.knowledge-filters :deep(.el-select) { width: 180px; }
.knowledge-filters > span, .knowledge-hint, .knowledge-form small { color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.8; }
.knowledge-form { display: flex; flex-direction: column; gap: 22px; min-width: 0; margin: 0; padding: 0; border: 0; }
.knowledge-form__field { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.knowledge-form__field > label, .knowledge-audience > legend { font-size: 14px; font-weight: 600; color: var(--el-text-color-primary); }
.knowledge-form__columns { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.knowledge-form__field :deep(.el-select) { width: 100%; }
.knowledge-audience { margin: 0; padding: 0; border: 0; min-width: 0; }
.knowledge-audience > legend { padding: 0; margin-bottom: 12px; }
.knowledge-audience__options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.knowledge-audience__options > button { display: flex; flex-direction: column; gap: 9px; text-align: left; padding: 18px; min-height: 144px; border: 1px solid var(--el-border-color); border-radius: 12px; background: var(--el-fill-color-blank); color: var(--el-text-color-primary); font: inherit; cursor: pointer; transition: background-color .18s, border-color .18s; }
.knowledge-audience__options > button > strong { font-size: 15px; font-weight: 600; }
.knowledge-audience__options > button > span { font-size: 13px; line-height: 1.65; color: var(--el-text-color-secondary); }
.knowledge-audience__options > button[aria-pressed='true'] { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.knowledge-audience__options > button:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 3px; }
.knowledge-audience__options > button:disabled { cursor: not-allowed; opacity: .7; }
.knowledge-hint { margin: 7px 0 0; }
.knowledge-publish { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 18px; background: var(--el-fill-color-light); border-radius: 10px; }
.knowledge-publish strong { font-size: 14px; }
.knowledge-publish p { margin: 6px 0 0; color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.7; }
.knowledge-publish :deep(.el-switch) { flex-shrink: 0; }
.knowledge-editor { border: 1px solid var(--el-border-color); border-radius: 6px; overflow: hidden; }
.knowledge-editor :deep(.el-textarea__inner) { border: none; box-shadow: none; font-family: Menlo, Monaco, Consolas, monospace; font-size: 13px; line-height: 1.7; resize: vertical; }
.knowledge-review { padding: 20px; border: 1px solid var(--el-color-warning-light-5); border-radius: 12px; background: var(--el-color-warning-light-9); }
.knowledge-review h3 { display: flex; align-items: center; gap: 9px; margin: 0 0 12px; font-size: 15px; }
.knowledge-review p { margin: 9px 0; font-size: 13px; line-height: 1.85; color: var(--el-text-color-secondary); }
.knowledge-review :deep(.el-checkbox), .knowledge-audience :deep(.el-checkbox) { height: auto; align-items: flex-start; white-space: normal; }
.knowledge-review :deep(.el-checkbox__label), .knowledge-audience :deep(.el-checkbox__label) { white-space: normal; line-height: 1.7; }
.knowledge-review :deep(.el-checkbox__input), .knowledge-audience :deep(.el-checkbox__input) { margin-top: 5px; }
.knowledge-form-error { margin-top: 18px; }
@media (max-width: 680px) {
  .knowledge-form__columns, .knowledge-audience__options { grid-template-columns: 1fr; }
  .knowledge-audience__options > button { min-height: 0; padding: 14px 16px; gap: 6px; }
  .knowledge-publish { align-items: flex-start; flex-direction: column; }
  .knowledge-filters :deep(.el-select) { width: min(100%, 220px); }
  .knowledge-review { padding: 16px; }
}
</style>
