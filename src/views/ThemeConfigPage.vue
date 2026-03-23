<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import SectionCard from '../components/common/SectionCard.vue'
import { fetchSiteSettings, saveSiteSettings } from '../services/settings'

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const form = ref({
  frontendTheme: '',
  frontendBackgroundUrl: '',
  frontendAdminPath: '',
  frontendCustomHtml: '',
  frontendCustomCss: '',
})

async function loadSettings() {
  loading.value = true
  error.value = ''
  try {
    const settings = await fetchSiteSettings()
    form.value = {
      frontendTheme: settings.frontend_theme || '',
      frontendBackgroundUrl: settings.frontend_background_url || '',
      frontendAdminPath: settings.frontend_admin_path || settings.secure_path || '',
      frontendCustomHtml: settings.frontend_custom_html || '',
      frontendCustomCss: settings.frontend_custom_css || '',
    }
  } catch (err) {
    error.value = err.message || '加载主题配置失败'
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    await saveSiteSettings({
      frontend_theme: form.value.frontendTheme,
      frontend_background_url: form.value.frontendBackgroundUrl,
      frontend_admin_path: form.value.frontendAdminPath,
      frontend_custom_html: form.value.frontendCustomHtml,
      frontend_custom_css: form.value.frontendCustomCss,
    })
    ElMessage.success('主题配置已保存')
  } catch (err) {
    ElMessage.error(err.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <section class="page-stack">
    <SectionCard title="主题配置" description="配置前端主题、背景、自定义样式等。">
      <template #actions>
        <el-button type="primary" :loading="saving" @click="handleSave">保存配置</el-button>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

      <el-form v-loading="loading" label-position="top" style="max-width: 640px">
        <el-form-item label="前端主题">
          <el-input v-model="form.frontendTheme" placeholder="主题名称（留空使用默认）" />
        </el-form-item>
        <el-form-item label="背景图片 URL">
          <el-input v-model="form.frontendBackgroundUrl" placeholder="https://example.com/bg.jpg" />
        </el-form-item>
        <el-form-item label="管理员面板路径">
          <el-input v-model="form.frontendAdminPath" placeholder="admin">
            <template #prepend>/</template>
          </el-input>
        </el-form-item>
        <el-form-item label="自定义 HTML">
          <el-input v-model="form.frontendCustomHtml" type="textarea" :autosize="{ minRows: 4, maxRows: 10 }" placeholder="插入到页面中的自定义 HTML" />
        </el-form-item>
        <el-form-item label="自定义 CSS">
          <el-input v-model="form.frontendCustomCss" type="textarea" :autosize="{ minRows: 4, maxRows: 10 }" placeholder="自定义 CSS 样式" />
        </el-form-item>
      </el-form>
    </SectionCard>
  </section>
</template>
