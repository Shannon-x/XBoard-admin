<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import SectionCard from '../components/common/SectionCard.vue'
import {
  fetchKnowledgeArticles,
  fetchKnowledgeCategories,
  saveKnowledgeArticle,
  toggleKnowledgeShow,
  deleteKnowledgeArticle,
} from '../services/knowledge'

const articles = ref([])
const categories = ref([])
const loading = ref(false)
const error = ref('')
const activeCategory = ref('all')

const dialogVisible = ref(false)
const dialogMode = ref('create')
const form = reactive({
  id: null,
  categoryId: null,
  title: '',
  body: '',
  language: '',
  show: true,
  sort: 0,
})

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

const filteredArticles = ref([])
import { watch, computed } from 'vue'

const displayArticles = computed(() => {
  if (activeCategory.value === 'all') return articles.value
  return articles.value.filter(a => String(a.categoryId) === String(activeCategory.value))
})

function openCreateDialog() {
  dialogMode.value = 'create'
  Object.assign(form, { id: null, categoryId: categories.value[0]?.id || null, title: '', body: '', language: '', show: true, sort: 0 })
  dialogVisible.value = true
}

function openEditDialog(article) {
  dialogMode.value = 'edit'
  Object.assign(form, {
    id: article.id,
    categoryId: article.categoryId,
    title: article.title,
    body: article.body,
    language: article.language,
    show: article.show,
    sort: article.sort,
  })
  dialogVisible.value = true
}

async function handleSave() {
  try {
    await saveKnowledgeArticle(form)
    ElMessage.success(dialogMode.value === 'create' ? '文章已创建' : '文章已更新')
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

onMounted(loadData)
</script>

<template>
  <section class="page-stack">
    <SectionCard title="知识库管理" description="管理帮助文档和知识库文章，按分类组织内容。">
      <template #actions>
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          添加文章
        </el-button>
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
        <el-table-column label="排序" prop="sort" width="70" />
        <el-table-column label="显示" width="70">
          <template #default="{ row }">
            <el-switch :model-value="row.show" size="small" @change="handleToggleShow(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="openEditDialog(row)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button link size="small" type="danger" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>

    <el-dialog v-model="dialogVisible" :title="dialogMode === 'create' ? '添加文章' : '编辑文章'" width="640px">
      <el-form label-position="top">
        <el-form-item label="分类">
          <el-select v-model="form.categoryId" style="width: 100%;">
            <el-option v-for="cat in categories" :key="cat.id" :value="cat.id" :label="cat.title" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="语言标识">
          <el-input v-model="form.language" placeholder="例如 zh-CN" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="显示">
          <el-switch v-model="form.show" />
        </el-form-item>
        <el-form-item label="内容（支持 Markdown）">
          <el-input v-model="form.body" type="textarea" :autosize="{ minRows: 8, maxRows: 20 }" placeholder="请输入文章内容" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>
