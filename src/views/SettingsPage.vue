<script setup>
import SectionCard from '../components/common/SectionCard.vue'
import SettingsForm from '../components/settings/SettingsForm.vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '../stores/admin'

const adminStore = useAdminStore()
const { t } = useI18n()
</script>

<template>
  <section class="page-stack">
    <SectionCard :description="t('settings.description')" :title="t('settings.title')">
      <template #actions>
        <el-button class="primary-btn small" type="success">
          {{ t('settings.save') }}
        </el-button>
      </template>

      <SettingsForm
        :config-fields="adminStore.configFields"
        :form="adminStore.configForm"
        :switch-fields="adminStore.switchFields"
      />
    </SectionCard>
  </section>
</template>
