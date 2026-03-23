<script setup>
import { onMounted, reactive, ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Refresh } from '@element-plus/icons-vue'
import SectionCard from '../components/common/SectionCard.vue'
import SortDialog from '../components/common/SortDialog.vue'
import {
  fetchKnowledgeArticles,
  fetchKnowledgeCategories,
  saveKnowledgeArticle,
  toggleKnowledgeShow,
  deleteKnowledgeArticle,
  sortKnowledgeArticles,
} from '../services/knowledge'

const articles = ref([])
const categories = ref([])
const loading = ref(false)
const error = ref('')
const activeCategory = ref('all')
const sortDialogVisible = ref(false)

const dialogVisible = ref(false)
const dialogMode = ref('create')
const form = reactive({
  id: null,
  categoryId: null,
  title: '',
  body: '',
  language: 'zh-CN',
  show: true,
  sort: 0,
})

const languageOptions = [
  { label: '简体中文', value: 'zh-CN' },
  { label: '繁体中文', value: 'zh-TW' },
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
]

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [articleList, categoryList] = await Promise.all([
      fetchKnowledgeArticles(),
      fetchKnowledgeCategories(),
    ])
    articles.value = articleList
    categories.value = categoryList
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const displayArticles = computed(() => {
  if (activeCategory.value === 'all') return articles.value
  return articles.value.filter(a => String(a.categoryId) === String(activeCategory.value))
})

function openCreateDialog() {
  dialogMode.value = 'create'
  Object.assign(form, {
    id: null,
    categoryId: categories.value[0]?.id || null,
    title: '',
    body: '',
    language: 'zh-CN',
    show: true,
    sort: 0,
  })
  dialogVisible.value = true
}

function openEditDialog(article) {
  dialogMode.value = 'edit'
  Object.assign(form, {
    id: article.id,
    categoryId: article.categoryId,
    title: article.title,
    body: article.body,
    language: article.language || 'zh-CN',
    show: article.show,
    sort: article.sort,
  })
  dialogVisible.value = true
}

async function handleSave() {
  try {
    await saveKnowledgeArticle(form)
    ElMessage.success(dialogMode.value === 'create' ? '知识已创建' : '知识已更新')
    dialogVisible.value = false
    await loadData()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

async function handleDelete(article) {
  try {
    await ElMessageBox.confirm(`确认删除「${article.title}」？`, '删除文章', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await deleteKnowledgeArticle(article.id)
    ElMessage.success('文章已删除')
    await loadData()
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(err.message || '删除失败')
  }
}

async function handleToggleShow(article) {
  try {
    await toggleKnowledgeShow(article.id)
    ElMessage.success('显示状态已更新')
    await loadData()
  } catch (err) {
    ElMessage.error(err.message)
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
    <SectionCard title="知识库管理" description="管理帮助文档和知识库文章，按分类组织内容。">
      <template #actions>
        <el-space wrap>
          <el-button @click="sortDialogVisible = true" :disabled="articles.length < 2">排序</el-button>
          <el-button type="primary" :icon="Plus" @click="openCreateDialog">添加知识</el-button>
          <el-button :icon="Refresh" plain type="info" @click="loadData">刷新</el-button>
        </el-space>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

      <div style="margin-bottom: 16px;">
        <el-radio-group v-model="activeCategory" size="small">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button
            v-for="cat in categories"
            :key="cat.id"
            :value="String(cat.id)"
          >
            {{ cat.title }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <el-table :data="displayArticles" v-loading="loading" class="dashboard-table">
        <el-table-column label="ID" prop="id" width="70" />
        <el-table-column label="标题" prop="title" min-width="200" />
        <el-table-column label="分类" width="120">
          <template #default="{ row }">{{ row.categoryName || '--' }}</template>
        </el-table-column>
        <el-table-column label="语言" width="80">
          <template #default="{ row }">{{ row.language || '--' }}</template>
        </el-table-column>
        <el-table-column label="排序" prop="sort" width="70" />
        <el-table-column label="显示" width="70">
          <template #default="{ row }">
            <el-switch :model-value="row.show" size="small" @change="handleToggleShow(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>

    <!-- 创建/编辑知识对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '添加知识' : '编辑知识'"
      width="860px"
      destroy-on-close
    >
      <div class="knowledge-form">
        <div class="knowledge-form__field">
          <label>标题</label>
          <el-input v-model="form.title" placeholder="请输入知识标题" />
        </div>

        <div class="knowledge-form__field">
          <label>分类</label>
          <el-select v-model="form.categoryId" style="width: 100%" placeholder="请选择分类，分类将会自动归类">
            <el-option v-for="cat in categories" :key="cat.id" :value="cat.id" :label="cat.title" />
          </el-select>
        </div>

        <div class="knowledge-form__field">
          <label>语言</label>
          <el-select v-model="form.language" style="width: 100%">
            <el-option v-for="opt in languageOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </div>

        <div class="knowledge-form__field">
          <label>内容</label>
          <div class="knowledge-editor">
            <el-input
              v-model="form.body"
              type="textarea"
              :autosize="{ minRows: 16, maxRows: 24 }"
              placeholder="请输入文章内容，支持 Markdown 格式"
              class="knowledge-editor__input"
            />
          </div>
        </div>

        <div class="knowledge-form__field">
          <label>显示</label>
          <el-switch v-model="form.show" />
        </div>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">提交</el-button>
      </template>
    </el-dialog>

    <SortDialog
      v-model:visible="sortDialogVisible"
      :items="articles"
      title="排序知识库"
      @save="handleSortSave"
    />
  </section>
</template>

<style scoped>
.knowledge-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.knowledge-form__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.knowledge-form__field label {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.knowledge-editor {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  overflow: hidden;
}

.knowledge-editor :deep(.el-textarea__inner) {
  border: none;
  box-shadow: none;
  font-family: 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
}
</style>
