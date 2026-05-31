<script setup>
import { computed, reactive, watch } from 'vue'
import { MdEditor } from 'md-editor-v3'

import 'md-editor-v3/lib/style.css'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String,
    default: 'create',
  },
  notice: {
    type: Object,
    default: null,
  },
  submitting: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'submit'])

const form = reactive(createEmptyForm())

const dialogTitle = computed(function dialogTitle() {
  return props.mode === 'edit' ? '编辑公告' : '新增公告'
})

const editorToolbars = [
  'bold',
  'underline',
  'italic',
  '-',
  'title',
  'strikeThrough',
  'quote',
  'unorderedList',
  'orderedList',
  '-',
  'link',
  'image',
  'table',
  '=',
  'preview',
  'fullscreen',
]

function createEmptyForm() {
  return {
    id: null,
    title: '',
    content: '',
    sort: null,
    show: true,
    imgUrl: '',
    tagsText: '',
  }
}

function syncFormFromNotice(notice) {
  const nextForm = createEmptyForm()

  if (notice) {
    nextForm.id = notice.id ?? null
    nextForm.title = notice.title || ''
    nextForm.content = notice.content || ''
    nextForm.sort = notice.sort ?? null
    nextForm.show = Boolean(notice.show)
    nextForm.imgUrl = notice.imgUrl || ''
    nextForm.tagsText = Array.isArray(notice.tags) ? notice.tags.join(', ') : ''
  }

  Object.assign(form, nextForm)
}

function closeDialog() {
  emit('update:modelValue', false)
}

function handleClosed() {
  syncFormFromNotice(props.mode === 'edit' ? props.notice : null)
}

function handleSubmit() {
  emit('submit', {
    id: form.id,
    title: form.title.trim(),
    content: form.content.trim(),
    sort: form.sort === null || form.sort === '' ? null : Number(form.sort),
    show: Boolean(form.show),
    imgUrl: form.imgUrl.trim(),
    tags: form.tagsText
      .split(',')
      .map(function mapTag(tag) {
        return tag.trim()
      })
      .filter(Boolean),
  })
}

watch(
  function watchDialogState() {
    return [props.modelValue, props.mode, props.notice]
  },
  function syncWhenOpen([visible]) {
    if (!visible) {
      return
    }

    syncFormFromNotice(props.mode === 'edit' ? props.notice : null)
  },
  {
    immediate: true,
    deep: true,
  },
)
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="min(1380px, calc(100vw - 48px))"
    top="5vh"
    class="notice-editor-dialog"
    destroy-on-close
    append-to-body
    @closed="handleClosed"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-position="top" class="notice-editor-form notice-editor-form--target">
      <el-form-item label="标题" required>
        <el-input v-model="form.title" maxlength="120" show-word-limit placeholder="请输入公告标题" />
      </el-form-item>

      <el-form-item required>
        <template #label>
          <div class="notice-editor-form__label-row">
            <span>公告内容</span>
            <span class="notice-editor-form__hint">使用工具栏 👁 按钮切换预览</span>
          </div>
        </template>
        <div class="notice-editor-form__markdown notice-editor-form__markdown--wide">
          <MdEditor
            v-model="form.content"
            language="zh-CN"
            :toolbars="editorToolbars"
            preview-theme="default"
            code-theme="github"
            placeholder="支持 Markdown / HTML 内容"
            no-upload-img
          />
        </div>
      </el-form-item>

      <div class="notice-editor-form__grid notice-editor-form__grid--meta">
        <el-form-item label="公告背景">
          <el-input v-model="form.imgUrl" placeholder="背景图片 URL" clearable />
        </el-form-item>

        <el-form-item label="公告标签">
          <el-input v-model="form.tagsText" placeholder="逗号分隔，如：活动, 维护" clearable />
        </el-form-item>

        <el-form-item label="显示">
          <div class="notice-editor-form__switch-row">
            <el-switch v-model="form.show" />
            <span class="notice-editor-form__hint">关闭后不再展示</span>
          </div>
        </el-form-item>

        <el-form-item v-if="props.mode === 'edit'" label="排序">
          <el-input-number
            v-model="form.sort"
            :min="0"
            :step="1"
            :controls="false"
            class="notice-editor-form__sort-input"
            placeholder="0"
          />
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <div class="notice-editor-dialog__footer">
        <el-button @click="closeDialog">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </div>
    </template>
  </el-dialog>
</template>
