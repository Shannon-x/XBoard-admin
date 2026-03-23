<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Delete,
  Edit,
  Plus,
  Refresh,
  Search,
} from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

import NoticeEditorDialog from '../components/notices/NoticeEditorDialog.vue'
import SectionCard from '../components/common/SectionCard.vue'
import SortDialog from '../components/common/SortDialog.vue'
import { useAdminStore } from '../stores/admin'

const adminStore = useAdminStore()
const { t } = useI18n()

const refreshing = ref(false)
const editorVisible = ref(false)
const editorMode = ref('create')
const activeNotice = ref(null)
const editorSubmitting = ref(false)
const sortDialogVisible = ref(false)
const filters = reactive({
  keyword: '',
})

const filteredNotices = computed(function filteredNotices() {
  const keyword = filters.keyword.trim().toLowerCase()

  return adminStore.managedNotices.filter(function filterNotice(notice) {
    if (!keyword) {
      return true
    }

    return [notice.title, notice.id]
      .filter(Boolean)
      .some(function includesKeyword(value) {
        return String(value).toLowerCase().includes(keyword)
      })
  })
})

async function loadNotices(showSuccess = false) {
  refreshing.value = true

  try {
    await adminStore.loadManagedNotices()

    if (adminStore.managedNoticesError) {
      ElMessage.error(adminStore.managedNoticesError)
      return
    }

    if (showSuccess) {
      ElMessage.success(t('notices.messages.refreshed'))
    }
  } finally {
    refreshing.value = false
  }
}

async function handleShowToggle(notice, nextValue) {
  if (!notice?.id) {
    ElMessage.error(t('notices.messages.showIdMissing'))
    return
  }

  const previousValue = Boolean(notice.show)

  notice.show = Boolean(nextValue)
  notice.showUpdating = true

  try {
    await adminStore.toggleManagedNoticeShow(notice.id)
    ElMessage.success(t('notices.messages.showUpdated'))
  } catch (error) {
    notice.show = previousValue
    ElMessage.error(error?.message || t('notices.messages.showUpdateFailed'))
  } finally {
    notice.showUpdating = false
  }
}

function openCreateDialog() {
  editorMode.value = 'create'
  activeNotice.value = null
  editorVisible.value = true
}

function openEditDialog(notice) {
  editorMode.value = 'edit'
  activeNotice.value = notice
  editorVisible.value = true
}

async function handleEditorSubmit(payload) {
  editorSubmitting.value = true

  try {
    await adminStore.saveManagedNotice(payload)
    await loadNotices()
    editorVisible.value = false
    ElMessage.success(
      editorMode.value === 'edit'
        ? t('notices.messages.editSuccess')
        : t('notices.messages.createSuccess'),
    )
  } catch (error) {
    ElMessage.error(error?.message || t('notices.messages.saveFailed'))
  } finally {
    editorSubmitting.value = false
  }
}

async function handleDelete(notice) {
  try {
    await ElMessageBox.confirm(
      t('notices.messages.deletePending', { title: notice.title }),
      t('notices.messages.deleteConfirmTitle'),
      {
        type: 'warning',
      },
    )
  } catch {
    return
  }
}

async function handleSortSave(ids) {
  try {
    await adminStore.sortManagedNotices(ids)
    ElMessage.success('排序已保存')
    sortDialogVisible.value = false
    await loadNotices()
  } catch (err) {
    ElMessage.error(err.message || '排序保存失败')
  }
}

onMounted(function loadNoticesOnMount() {
  loadNotices().catch(function ignoreLoadError() {
    return undefined
  })
})
</script>

<template>
  <section class="page-stack notice-page notice-page--compact">
    <SectionCard
      :description="t('notices.description')"
      :title="t('notices.title')"
    >
      <template #actions>
        <div class="notice-toolbar notice-toolbar--compact">
          <el-input
            v-model="filters.keyword"
            class="notice-toolbar__search"
            clearable
            :placeholder="t('notices.searchPlaceholder')"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>

          <el-button @click="sortDialogVisible = true" :disabled="adminStore.managedNotices.length < 2">排序</el-button>

          <el-button class="ghost-btn" :loading="refreshing" @click="loadNotices(true)">
            <el-icon><Refresh /></el-icon>
            {{ t('notices.actions.refresh') }}
          </el-button>

          <el-button class="primary-btn" type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            {{ t('notices.actions.create') }}
          </el-button>
        </div>
      </template>

      <el-alert
        v-if="adminStore.managedNoticesError"
        :title="adminStore.managedNoticesError"
        class="notice-page__alert"
        type="error"
        show-icon
        :closable="false"
      />

      <div class="notice-table-shell">
        <el-table
          :data="filteredNotices"
          v-loading="adminStore.managedNoticesLoading"
          class="dashboard-table notice-table"
        >
          <el-table-column :label="t('notices.columns.id')" width="88">
            <template #default="{ row }">
              <span class="notice-id-pill">{{ row.id }}</span>
            </template>
          </el-table-column>

          <el-table-column :label="t('notices.columns.show')" width="110">
            <template #default="{ row }">
              <div class="notice-visibility-cell">
                <el-switch
                  :model-value="row.show"
                  size="small"
                  :loading="row.showUpdating"
                  @change="handleShowToggle(row, $event)"
                />
              </div>
            </template>
          </el-table-column>

          <el-table-column :label="t('notices.columns.title')" min-width="260">
            <template #default="{ row }">
              <div class="notice-title-cell notice-title-cell--compact">
                <strong>{{ row.title }}</strong>
                <div class="notice-title-meta">
                  <span class="notice-sort-badge">{{ row.sort === null ? t('notices.sort.empty') : `#${row.sort}` }}</span>
                  <span>{{ t('notices.columns.createdAtLabel') }} {{ row.createdAt }}</span>
                  <span>{{ t('notices.columns.updatedAtLabel') }} {{ row.updatedAt }}</span>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column :label="t('notices.columns.actions')" width="120" fixed="right">
            <template #default="{ row }">
              <div class="notice-actions-cell">
                <el-button circle text @click="openEditDialog(row)">
                  <el-icon><Edit /></el-icon>
                </el-button>
                <el-button circle text @click="handleDelete(row)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </template>
          </el-table-column>

          <template #empty>
            <div class="notice-empty">
              <strong>{{ t('notices.empty.title') }}</strong>
              <p>{{ t('notices.empty.description') }}</p>
            </div>
          </template>
        </el-table>
      </div>
    </SectionCard>

    <NoticeEditorDialog
      v-model="editorVisible"
      :mode="editorMode"
      :notice="activeNotice"
      :submitting="editorSubmitting"
      @submit="handleEditorSubmit"
    />

    <SortDialog
      v-model:visible="sortDialogVisible"
      :items="adminStore.managedNotices.map(notice => ({ id: notice.id, name: notice.title }))"
      title="排序公告"
      @save="handleSortSave"
    />
  </section>
</template>
