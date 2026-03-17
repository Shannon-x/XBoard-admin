<script setup>
import DataTableCard from '../components/common/DataTableCard.vue'
import SectionCard from '../components/common/SectionCard.vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '../stores/admin'

const adminStore = useAdminStore()
const { t } = useI18n()

const ticketColumns = [
  { label: t('tickets.columns.id'), prop: 'id' },
  { label: t('tickets.columns.subject'), minWidth: 220, prop: 'subject' },
  { label: t('tickets.columns.userEmail'), minWidth: 220, prop: 'userEmail' },
  { label: t('tickets.columns.priority'), slot: 'priority' },
  { label: t('tickets.columns.updatedAt'), prop: 'updatedAt' },
  { label: t('tickets.columns.status'), slot: 'status' },
]
</script>

<template>
  <section class="page-stack">
    <SectionCard :description="t('tickets.description')" :title="t('tickets.title')">
      <template #actions>
        <el-space wrap>
          <el-button class="ghost-btn small" type="info" plain>
            {{ t('tickets.actions.pendingOnly') }}
          </el-button>
          <el-button class="primary-btn small" type="success">
            {{ t('tickets.actions.assign') }}
          </el-button>
        </el-space>
      </template>

      <DataTableCard :columns="ticketColumns" :data="adminStore.tickets">
        <template #priority="{ row }">
          <el-tag :type="adminStore.badgeType(row.priority)" effect="dark">
            {{ row.priority }}
          </el-tag>
        </template>

        <template #status="{ row }">
          <el-tag :type="adminStore.badgeType(row.status)" effect="dark">
            {{ row.status }}
          </el-tag>
        </template>
      </DataTableCard>
    </SectionCard>
  </section>
</template>
