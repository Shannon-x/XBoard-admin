<script setup>
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  runtimeStatus: {
    type: Object,
    required: true,
  },
  systemLogs: {
    type: Object,
    required: true,
  },
})

const { t } = useI18n()
const router = useRouter()

function goToLogs() {
  router.push({ name: 'logs' })
}

function statusTagType(tone) {
  const typeMap = {
    danger: 'danger',
    success: 'success',
  }

  return typeMap[tone] || 'info'
}
</script>

<template>
  <el-card v-loading="loading" class="section-card system-log-card" shadow="never">
    <div class="section-head queue-card__head">
      <div>
        <h3>{{ t('system.logTitle') }}</h3>
        <p>{{ t('system.logDescription') }}</p>
      </div>

      <div class="system-log-statuses">
        <el-tag :type="statusTagType(runtimeStatus.scheduleStatusTone)" effect="dark">
          {{ t('system.schedule', { status: runtimeStatus.scheduleStatusText }) }}
        </el-tag>
        <el-tag :type="statusTagType(runtimeStatus.horizonStatusTone)" effect="dark">
          {{ t('system.horizon', { status: runtimeStatus.horizonStatusText }) }}
        </el-tag>
      </div>
    </div>

    <div class="system-log-grid">
      <article class="system-log-item system-log-item--info">
        <span>{{ t('system.info') }}</span>
        <strong>{{ systemLogs.info }}</strong>
      </article>

      <article class="system-log-item system-log-item--warning">
        <span>{{ t('system.warning') }}</span>
        <strong>{{ systemLogs.warning }}</strong>
      </article>

      <article class="system-log-item system-log-item--error">
        <span>{{ t('system.error') }}</span>
        <strong>{{ systemLogs.error }}</strong>
      </article>
    </div>

    <div class="system-log-footer">
      <div>
        <span>{{ t('system.totalLogs') }}</span>
        <strong>{{ systemLogs.total }}</strong>
      </div>

      <div>
        <span>{{ t('system.lastSchedule') }}</span>
        <strong>{{ runtimeStatus.scheduleLastRuntime }}</strong>
      </div>

      <el-button type="primary" link size="small" @click="goToLogs">
        查看全部 →
      </el-button>
    </div>
  </el-card>
</template>
