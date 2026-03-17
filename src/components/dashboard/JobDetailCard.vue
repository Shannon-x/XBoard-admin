<script setup>
import { useI18n } from 'vue-i18n'
defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  jobDetail: {
    type: Object,
    required: true,
  },
})

const { t } = useI18n()
</script>

<template>
  <el-card v-loading="loading" class="section-card queue-card" shadow="never">
    <div class="section-head queue-card__head">
      <div>
        <h3>{{ t('queue.jobDetailTitle') }}</h3>
        <p>{{ t('queue.jobDetailDescription') }}</p>
      </div>
    </div>

    <div class="queue-detail-grid">
      <article class="queue-detail-item queue-detail-item--wide">
        <span>{{ t('queue.maxRuntimeQueue') }}</span>
        <strong>{{ jobDetail.queueWithMaxRuntime }}</strong>
      </article>

      <article class="queue-detail-item queue-detail-item--wide">
        <span>{{ t('queue.maxThroughputQueue') }}</span>
        <strong>{{ jobDetail.queueWithMaxThroughput }}</strong>
      </article>

      <article class="queue-detail-item">
        <span>{{ t('queue.onlineSyncWait') }}</span>
        <strong>{{ jobDetail.redisOnlineSyncWait }}</strong>
      </article>

      <article class="queue-detail-item">
        <span>{{ t('queue.recentPeriodJobs') }}</span>
        <strong>{{ jobDetail.recentPeriodJobs }}</strong>
      </article>
    </div>
  </el-card>
</template>
