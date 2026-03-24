<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Refresh, View } from '@element-plus/icons-vue'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  runtimeStatus: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['refresh'])
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

      <div class="system-log-actions">
        <el-tag :type="statusTagType(runtimeStatus.scheduleStatusTone)" effect="dark" size="small">
          {{ t('system.schedule', { status: runtimeStatus.scheduleStatusText }) }}
        </el-tag>
        <el-tag :type="statusTagType(runtimeStatus.horizonStatusTone)" effect="dark" size="small">
          {{ t('system.horizon', { status: runtimeStatus.horizonStatusText }) }}
        </el-tag>
        <el-button :icon="Refresh" size="small" plain @click="emit('refresh')">刷新</el-button>
        <el-button :icon="View" size="small" plain type="primary" @click="goToLogs">查看审计日志</el-button>
      </div>
    </div>

    <div class="system-log-footer">
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

<style scoped>
.system-log-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
