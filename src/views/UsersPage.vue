<script setup>
import DataTableCard from '../components/common/DataTableCard.vue'
import SectionCard from '../components/common/SectionCard.vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '../stores/admin'

const adminStore = useAdminStore()
const { t } = useI18n()

const userColumns = [
  { label: t('users.columns.email'), minWidth: 220, prop: 'email' },
  { label: t('users.columns.plan'), prop: 'plan' },
  { label: t('users.columns.balance'), prop: 'balance' },
  { label: t('users.columns.status'), slot: 'status' },
]
</script>

<template>
  <section class="page-stack">
    <SectionCard :description="t('users.description')" :title="t('users.title')">
      <template #actions>
        <el-button class="ghost-btn small" type="info" plain>
          {{ t('users.export') }}
        </el-button>
      </template>

      <DataTableCard :columns="userColumns" :data="adminStore.users">
        <template #status="{ row }">
          <el-tag :type="adminStore.badgeType(row.status)" effect="dark">
            {{ row.status }}
          </el-tag>
        </template>
      </DataTableCard>
    </SectionCard>
  </section>
</template>
