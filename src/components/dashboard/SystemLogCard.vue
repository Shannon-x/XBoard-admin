<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Refresh, Delete, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { cleanSystemLogs, getLogCleanupStats } from '../../services/dashboard'

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

const emit = defineEmits(['refresh'])
const { t } = useI18n()
const router = useRouter()

const cleanDialogVisible = ref(false)
const cleanForm = ref({
  days: 0,
  level: '',
  limit: 1000,
})
const cleanPreview = ref(null)
const cleanPreviewLoading = ref(false)
const cleanSaving = ref(false)

function goToLogs() {
  router.push({ name: 'logs' })
}

function openCleanDialog() {
  cleanForm.value = { days: 0, level: '', limit: 1000 }
  cleanPreview.value = null
  cleanDialogVisible.value = true
}

async function fetchCleanPreview() {
  cleanPreviewLoading.value = true
  try {
    const result = await getLogCleanupStats({
      days: cleanForm.value.days,
      level: cleanForm.value.level,
    })
    cleanPreview.value = result?.data || result || { count: '未知' }
  } catch (err) {
    cleanPreview.value = { error: err.message || '获取统计失败' }
  } finally {
    cleanPreviewLoading.value = false
  }
}

async function handleClean() {
  cleanSaving.value = true
  try {
    await cleanSystemLogs({
      days: cleanForm.value.days,
      level: cleanForm.value.level,
      limit: cleanForm.value.limit,
    })
    ElMessage.success('日志清理成功')
    cleanDialogVisible.value = false
    emit('refresh')
  } catch (err) {
    ElMessage.error(err.message || '清理失败')
  } finally {
    cleanSaving.value = false
  }
}

function statusTagType(tone) {
  const typeMap = {
    danger: 'danger',
    success: 'success',
  }

  return typeMap[tone] || 'info'
}

const levelOptions = [
  { label: '全部', value: '' },
  { label: 'Info', value: 'info' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' },
]
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
        <el-button :icon="View" size="small" plain type="primary" @click="goToLogs">查看日志</el-button>
        <el-button :icon="Delete" size="small" plain type="danger" @click="openCleanDialog">清理日志</el-button>
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

    <!-- 清理日志对话框 -->
    <el-dialog v-model="cleanDialogVisible" title="清理日志" width="520px" destroy-on-close append-to-body>
      <template #header>
        <div style="display:flex; align-items:center; gap:8px;">
          <el-icon color="var(--el-color-danger)" :size="20"><Delete /></el-icon>
          <span style="font-size:16px; font-weight:600">清理日志</span>
        </div>
      </template>
      <div class="clean-log-form">
        <div class="clean-log-row">
          <div class="clean-log-field">
            <label>清理天数</label>
            <el-input v-model.number="cleanForm.days" type="number" placeholder="0" />
            <span class="clean-log-hint">清理多少天前的日志 (0-365天，0表示今天)</span>
          </div>
          <div class="clean-log-field">
            <label>日志级别</label>
            <el-select v-model="cleanForm.level" style="width:100%">
              <el-option v-for="opt in levelOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </div>
          <div class="clean-log-field">
            <label>单次限制</label>
            <el-input v-model.number="cleanForm.limit" type="number" placeholder="1000" />
            <span class="clean-log-hint">单次清理数量限制 (100-10000条)</span>
          </div>
        </div>

        <div class="clean-log-preview">
          <div class="clean-log-preview__header">
            <span style="display:flex; align-items:center; gap:6px">
              <el-icon><DataLine /></el-icon>
              清理预览
            </span>
            <el-button size="small" plain @click="fetchCleanPreview" :loading="cleanPreviewLoading">
              <el-icon><Calendar /></el-icon>
              获取统计
            </el-button>
          </div>
          <div v-if="cleanPreview" class="clean-log-preview__body">
            <template v-if="cleanPreview.error">
              <span style="color:var(--el-color-danger)">{{ cleanPreview.error }}</span>
            </template>
            <template v-else>
              <span>符合条件的日志: <strong>{{ cleanPreview.count ?? cleanPreview.total ?? JSON.stringify(cleanPreview) }}</strong> 条</span>
            </template>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="cleanDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="cleanSaving" @click="handleClean">
          <el-icon><Delete /></el-icon>
          确认清理
        </el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script>
import { DataLine, Calendar } from '@element-plus/icons-vue'
</script>

<style scoped>
.system-log-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.clean-log-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.clean-log-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.clean-log-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.clean-log-field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.clean-log-hint {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.clean-log-preview {
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 8px;
  background: var(--el-color-warning-light-9);
  overflow: hidden;
}

.clean-log-preview__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  font-weight: 600;
  font-size: 14px;
  color: var(--el-color-warning-dark-2);
}

.clean-log-preview__body {
  padding: 8px 14px 12px;
  font-size: 13px;
}
</style>
