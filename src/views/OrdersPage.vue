<script setup>
import DataTableCard from '../components/common/DataTableCard.vue'
import SectionCard from '../components/common/SectionCard.vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '../stores/admin'

const adminStore = useAdminStore()
const { t } = useI18n()

const orderColumns = [
  { label: t('orders.columns.orderNo'), minWidth: 180, prop: 'orderNo' },
  { label: t('orders.columns.userEmail'), minWidth: 220, prop: 'userEmail' },
  { label: t('orders.columns.plan'), prop: 'plan' },
  { label: t('orders.columns.amount'), prop: 'amount' },
  { label: t('orders.columns.gateway'), prop: 'gateway' },
  { label: t('orders.columns.status'), slot: 'status' },
]
</script>

<template>
  <section class="page-stack">
    <SectionCard :description="t('orders.description')" :title="t('orders.title')">
      <template #actions>
        <el-space wrap>
          <el-button class="ghost-btn small" type="info" plain>
            {{ t('orders.filter') }}
          </el-button>
          <el-button class="primary-btn small" type="success">
            {{ t('orders.export') }}
          </el-button>
        </el-space>
      </template>

      <DataTableCard :columns="orderColumns" :data="adminStore.orders">
        <template #status="{ row }">
          <el-tag :type="adminStore.badgeType(row.status)" effect="dark">
            {{ row.status }}
          </el-tag>
        </template>
      </DataTableCard>
    </SectionCard>
  </section>
</template>
