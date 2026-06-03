<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import SectionCard from '../components/common/SectionCard.vue'
import { fetchSiteSettings, saveSiteSettings } from '../services/settings'

const { t } = useI18n()
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
    error.value = err.message || t('themeConfigPage.messages.loadFailed')
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
    ElMessage.success(t('themeConfigPage.messages.saveSuccess'))
  } catch (err) {
    ElMessage.error(err.message || t('themeConfigPage.messages.saveFailed'))
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <section class="page-stack">
    <SectionCard
      :title="t('themeConfigPage.sectionTitle')"
      :description="t('themeConfigPage.sectionDescription')"
    >
      <template #actions>
        <el-button type="primary" :loading="saving" @click="handleSave">
          {{ t('themeConfigPage.saveButton') }}
        </el-button>
      </template>

      <el-alert v-if="error" type="error" :closable="false" :title="error" class="dashboard-alert" />

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
