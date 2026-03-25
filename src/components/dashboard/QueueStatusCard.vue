<script setup>
import { RefreshCw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  queueStatus: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['refresh'])
const { t } = useI18n()

function statusTagType(tone) {
  const typeMap = {
    danger: 'danger',
    success: 'success',
  }

  return typeMap[tone] || 'info'
}
</script>

<template>
  <el-card v-loading="loading" class="section-card queue-card" shadow="never">
    <div class="section-head queue-card__head">
      <div>
        <h3>{{ t('queue.statusTitle') }}</h3>
        <p>{{ t('queue.statusDescription') }}</p>
      </div>

      <div style="display:flex; align-items:center; gap:8px">
        <el-tag :type="statusTagType(queueStatus.statusTone)" effect="dark">
          {{ queueStatus.statusText }}
        </el-tag>
        <el-button :icon="RefreshCw" size="small" plain @click="emit('refresh')">刷新</el-button>
      </div>
    </div>

    <div class="queue-card__metrics">
      <article>
        <span>{{ t('queue.jobsPerMinute') }}</span>
        <strong>{{ queueStatus.jobsPerMinute }}</strong>
      </article>
      <article>
        <span>{{ t('queue.recentJobs') }}</span>
        <strong>{{ queueStatus.recentJobs }}</strong>
      </article>
      <article>
        <span>{{ t('queue.failedJobs') }}</span>
        <strong>{{ queueStatus.failedJobs }}</strong>
      </article>
      <article>
        <span>{{ t('queue.failedPeriodJobs') }}</span>
        <strong>{{ queueStatus.failedPeriodJobs }}</strong>
      </article>
    </div>

    <div class="queue-card__footer">
      <div>
        <span>{{ t('queue.pausedMaster') }}</span>
        <strong>{{ queueStatus.pausedMasters }}</strong>
      </div>
      <div>
        <span>{{ t('queue.activeProcesses') }}</span>
        <strong>{{ queueStatus.processes }}</strong>
      </div>
    </div>
  </el-card>
</template>
