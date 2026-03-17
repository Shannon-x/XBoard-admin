<script setup>
import DataTableCard from '../components/common/DataTableCard.vue'
import SectionCard from '../components/common/SectionCard.vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '../stores/admin'

const adminStore = useAdminStore()
const { t } = useI18n()

const noticeColumns = [
  { label: t('notices.columns.title'), minWidth: 240, prop: 'title' },
  { label: t('notices.columns.audience'), prop: 'audience' },
  { label: t('notices.columns.publishAt'), minWidth: 180, prop: 'publishAt' },
  { label: t('notices.columns.status'), slot: 'status' },
]
</script>

<template>
  <section class="page-stack">
    <SectionCard :description="t('notices.description')" :title="t('notices.title')">
      <template #actions>
        <el-space wrap>
          <el-button class="ghost-btn small" type="info" plain>
            {{ t('notices.actions.draft') }}
          </el-button>
          <el-button class="primary-btn small" type="success">
            {{ t('notices.actions.publish') }}
          </el-button>
        </el-space>
      </template>

      <DataTableCard :columns="noticeColumns" :data="adminStore.notices">
        <template #status="{ row }">
          <el-tag :type="adminStore.badgeType(row.status)" effect="dark">
            {{ row.status }}
          </el-tag>
        </template>
      </DataTableCard>
    </SectionCard>
  </section>
</template>
