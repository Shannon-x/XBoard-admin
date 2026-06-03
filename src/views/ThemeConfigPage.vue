<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import SectionCard from '../components/common/SectionCard.vue'
import { fetchSiteSettings, saveSiteSettings } from '../services/settings'

const { t } = useI18n()
const loading = ref(false)
const saving = ref(false)
const error = ref('')

function createEmptyForm() {
  return {
    frontendTheme: '',
    frontendBackgroundUrl: '',
    frontendAdminPath: '',
    frontendCustomHtml: '',
    frontendCustomCss: '',
  }
}

const form = ref(createEmptyForm())
// 服务端拉回时的快照，用于判定 dirty 与"重置为服务器值"
const initialSnapshot = ref(JSON.stringify(createEmptyForm()))

const isDirty = computed(() => JSON.stringify(form.value) !== initialSnapshot.value)
const hasCustomHtml = computed(() => Boolean(form.value.frontendCustomHtml?.trim()))

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
    initialSnapshot.value = JSON.stringify(form.value)
  } catch (err) {
    error.value = err.message || t('themeConfigPage.messages.loadFailed')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  // 自定义 HTML 会原样注入到用户端页面 —— 至少在保存前提示一次。
  if (hasCustomHtml.value) {
    try {
      await ElMessageBox.confirm(
        '"自定义 HTML" 会被原样插入到所有用户访问的页面，请确认内容来自可信来源。\n如果包含 <script> 或外部资源，将与所有用户的浏览器同源运行。',
        '⚠️ 自定义 HTML 安全提示',
        { type: 'warning', confirmButtonText: '我已确认', cancelButtonText: '取消' },
      )
    } catch {
      return // 用户取消
    }
  }
  saving.value = true
  try {
    await saveSiteSettings({
      frontend_theme: form.value.frontendTheme,
      frontend_background_url: form.value.frontendBackgroundUrl,
      frontend_admin_path: form.value.frontendAdminPath,
      frontend_custom_html: form.value.frontendCustomHtml,
      frontend_custom_css: form.value.frontendCustomCss,
    })
    initialSnapshot.value = JSON.stringify(form.value)
    ElMessage.success(t('themeConfigPage.messages.saveSuccess'))
  } catch (err) {
    ElMessage.error(err.message || t('themeConfigPage.messages.saveFailed'))
  } finally {
    saving.value = false
  }
}

function handleReset() {
  if (!isDirty.value) return
  try {
    form.value = JSON.parse(initialSnapshot.value)
    ElMessage.info('已重置为服务器当前值')
  } catch {
    loadSettings()
  }
}

// 离开页面前提醒未保存修改
function onBeforeUnload(e) {
  if (isDirty.value) {
    e.preventDefault()
    e.returnValue = ''
    return ''
  }
  return undefined
}

onMounted(() => {
  loadSettings()
  window.addEventListener('beforeunload', onBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
})
</script>

<template>
  <section class="page-stack">
    <SectionCard
      :title="t('themeConfigPage.sectionTitle')"
      :description="t('themeConfigPage.sectionDescription')"
    >
      <template #actions>
        <el-space wrap>
          <el-button :disabled="!isDirty || saving" @click="handleReset">
            重置为服务器值
          </el-button>
          <el-button type="primary" :loading="saving" :disabled="!isDirty" @click="handleSave">
            {{ t('themeConfigPage.saveButton') }}
          </el-button>
        </el-space>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

      <el-alert
        v-if="hasCustomHtml"
        type="warning"
        show-icon
        :closable="false"
        title="安全提示"
        description="自定义 HTML 会原样注入到所有用户访问的页面，请确保内容来自可信来源。"
        class="dashboard-alert"
      />

      <el-form v-loading="loading" label-position="top" style="max-width: 640px">
        <el-form-item :label="t('themeConfigPage.fields.theme')">
          <el-input v-model="form.frontendTheme" :placeholder="t('themeConfigPage.fields.themePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('themeConfigPage.fields.bgUrl')">
          <el-input v-model="form.frontendBackgroundUrl" placeholder="https://example.com/bg.jpg" />
        </el-form-item>
        <el-form-item :label="t('themeConfigPage.fields.adminPath')">
          <el-input v-model="form.frontendAdminPath" placeholder="admin">
            <template #prepend>/</template>
          </el-input>
        </el-form-item>
        <el-form-item :label="t('themeConfigPage.fields.customHtml')">
          <el-input
            v-model="form.frontendCustomHtml"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 10 }"
            :placeholder="t('themeConfigPage.fields.customHtmlPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('themeConfigPage.fields.customCss')">
          <el-input
            v-model="form.frontendCustomCss"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 10 }"
            :placeholder="t('themeConfigPage.fields.customCssPlaceholder')"
          />
        </el-form-item>
      </el-form>
    </SectionCard>
  </section>
</template>
