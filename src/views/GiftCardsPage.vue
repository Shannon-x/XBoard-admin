<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Download } from '@element-plus/icons-vue'
import SectionCard from '../components/common/SectionCard.vue'
import {
  fetchGiftCardTemplates,
  createGiftCardTemplate,
  generateGiftCardCodes,
  fetchGiftCardCodes,
  toggleGiftCardCode,
  exportGiftCardCodes,
} from '../services/giftcards'

const templates = ref([])
const loading = ref(false)
const error = ref('')
const templateDialogVisible = ref(false)
const templateForm = reactive({ name: '', planId: null, period: '', price: 0 })

const codesDialogVisible = ref(false)
const activeTemplate = ref(null)
const codes = ref([])
const codesLoading = ref(false)
const codesPagination = reactive({ page: 1, pageSize: 15, total: 0 })

const generateDialogVisible = ref(false)
const generateCount = ref(1)
const generateTemplateId = ref(null)

async function loadTemplates() {
  loading.value = true
  error.value = ''
  try {
    templates.value = await fetchGiftCardTemplates()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function handleCreateTemplate() {
  try {
    await createGiftCardTemplate(templateForm)
    ElMessage.success('模板已创建')
    templateDialogVisible.value = false
    Object.assign(templateForm, { name: '', planId: null, period: '', price: 0 })
    await loadTemplates()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

function openCodesDialog(template) {
  activeTemplate.value = template
  codesPagination.page = 1
  codesDialogVisible.value = true
  loadCodes()
}

async function loadCodes() {
  if (!activeTemplate.value) return
  codesLoading.value = true
  try {
    const result = await fetchGiftCardCodes(activeTemplate.value.id, {
      page: codesPagination.page,
      pageSize: codesPagination.pageSize,
    })
    codes.value = result.list
    Object.assign(codesPagination, result.pagination)
  } catch (err) {
    ElMessage.error(err.message)
  } finally {
    codesLoading.value = false
  }
}

function openGenerateDialog(template) {
  generateTemplateId.value = template.id
  generateCount.value = 1
  generateDialogVisible.value = true
}

async function handleGenerate() {
  try {
    await generateGiftCardCodes(generateTemplateId.value, generateCount.value)
    ElMessage.success(`已生成 ${generateCount.value} 个兑换码`)
    generateDialogVisible.value = false
    await loadTemplates()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

async function handleToggleCode(code) {
  try {
    await toggleGiftCardCode(code.id)
    ElMessage.success('状态已更新')
    await loadCodes()
  } catch (err) {
    ElMessage.error(err.message)
  }
}

async function handleExport(template) {
  try {
    const blob = await exportGiftCardCodes(template.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `giftcards_${template.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('已开始下载')
  } catch (err) {
    ElMessage.error(err.message)
  }
}

function formatTime(ts) {
  if (!ts) return '--'
  return new Date(ts * 1000).toLocaleString('zh-CN')
}

onMounted(loadTemplates)
</script>

<template>
  <section class="page-stack">
    <SectionCard title="礼品卡管理" description="管理礼品卡模板和兑换码，支持批量生成和导出。">
      <template #actions>
        <el-button type="primary" @click="templateDialogVisible = true">
          <el-icon><Plus /></el-icon>
          创建模板
        </el-button>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

      <el-table :data="templates" v-loading="loading" class="dashboard-table">
        <el-table-column label="ID" prop="id" width="70" />
        <el-table-column label="模板名称" prop="name" min-width="140" />
        <el-table-column label="绑定套餐" min-width="100">
          <template #default="{ row }">{{ row.planName || `ID: ${row.planId}` }}</template>
        </el-table-column>
        <el-table-column label="周期" prop="period" width="100" />
        <el-table-column label="价格" width="100">
          <template #default="{ row }">¥{{ (row.price / 100).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="码数/已用" width="100">
          <template #default="{ row }">{{ row.codesCount }} / {{ row.usedCount }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link size="small" type="primary" @click="openCodesDialog(row)">查看码</el-button>
            <el-button link size="small" type="success" @click="openGenerateDialog(row)">生成码</el-button>
            <el-button link size="small" type="warning" @click="handleExport(row)">
              <el-icon><Download /></el-icon> 导出
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>

    <!-- Create Template Dialog -->
    <el-dialog v-model="templateDialogVisible" title="创建礼品卡模板" width="480px">
      <el-form label-position="top">
        <el-form-item label="模板名称">
          <el-input v-model="templateForm.name" placeholder="请输入模板名称" />
        </el-form-item>
        <el-form-item label="绑定套餐 ID">
          <el-input-number v-model="templateForm.planId" :min="1" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="周期">
          <el-select v-model="templateForm.period" style="width: 100%;">
            <el-option value="month_price" label="月付" />
            <el-option value="quarter_price" label="季付" />
            <el-option value="half_year_price" label="半年付" />
            <el-option value="year_price" label="年付" />
          </el-select>
        </el-form-item>
        <el-form-item label="价格（分）">
          <el-input-number v-model="templateForm.price" :min="0" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="templateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateTemplate">创建</el-button>
      </template>
    </el-dialog>

    <!-- Generate Codes Dialog -->
    <el-dialog v-model="generateDialogVisible" title="生成兑换码" width="360px">
      <el-form label-position="top">
        <el-form-item label="生成数量">
          <el-input-number v-model="generateCount" :min="1" :max="500" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleGenerate">生成</el-button>
      </template>
    </el-dialog>

    <!-- View Codes Dialog -->
    <el-dialog v-model="codesDialogVisible" :title="`兑换码列表 - ${activeTemplate?.name || ''}`" width="680px">
      <el-table :data="codes" v-loading="codesLoading" class="dashboard-table">
        <el-table-column label="兑换码" prop="code" min-width="200">
          <template #default="{ row }">
            <code style="font-size: 12px;">{{ row.code }}</code>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 0 ? 'success' : 'info'" size="small">
              {{ row.status === 0 ? '可用' : '已使用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="70">
          <template #default="{ row }">
            <el-switch :model-value="row.status === 0" size="small" @change="handleToggleCode(row)" />
          </template>
        </el-table-column>
        <el-table-column label="使用时间" width="170">
          <template #default="{ row }">{{ formatTime(row.usedAt) }}</template>
        </el-table-column>
      </el-table>
      <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
        <el-pagination
          :current-page="codesPagination.page"
          :page-size="codesPagination.pageSize"
          :total="codesPagination.total"
          layout="total, prev, pager, next"
          @current-change="(p) => { codesPagination.page = p; loadCodes() }"
        />
      </div>
    </el-dialog>
  </section>
</template>
