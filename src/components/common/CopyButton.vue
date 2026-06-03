<script setup>
/**
 * 统一的复制按钮组件。
 *
 * 用法（推荐显式带文字以提升可见性）：
 *   <CopyButton :value="row.notifyUrl" label="复制" />
 *
 * 只要图标也行（仍带 tooltip + hover 背景，比纯 link icon-only 更易发现）：
 *   <CopyButton :value="row.host + ':' + row.port" />
 *
 * 关键点：
 * - 用 lucide-vue-next 的 Copy 图标（项目已用，避免再引入新依赖）
 * - secure context 走 navigator.clipboard，否则用 execCommand 兜底
 * - 复制成功后 1.5s 内图标变 ✓ 提供即时反馈
 * - 默认 link 样式，但加了 hover 背景与最小内边距，不再"看不见"
 */
import { ref, computed, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { Copy, Check } from 'lucide-vue-next'

const props = defineProps({
  /** 要复制的文本（必填，可为空时按钮自动 warning） */
  value: { type: [String, Number, null], default: '' },
  /** 按钮文字；为空时只显示图标 */
  label: { type: String, default: '' },
  /** el-button size 透传 */
  size: { type: String, default: 'small' },
  /** el-button type 透传 */
  type: { type: String, default: 'primary' },
  /** 'link' | 'plain' | 'solid'（solid = 默认填充按钮） */
  variant: { type: String, default: 'link' },
  /** 复制成功后 ElMessage 文案 */
  successMessage: { type: String, default: '已复制到剪贴板' },
  /** 复制失败后 ElMessage 文案前缀（追加 error.message） */
  errorMessage: { type: String, default: '复制失败' },
  /** 是否启用 tooltip */
  showTooltip: { type: Boolean, default: true },
  /** tooltip 位置 */
  tooltipPlacement: { type: String, default: 'top' },
  /** 自定义 tooltip 文案；为空时自动生成 "复制：<值预览>" */
  tooltipContent: { type: String, default: '' },
})

const emit = defineEmits(['copy', 'error'])

const copied = ref(false)
let resetTimer = null

onBeforeUnmount(() => {
  if (resetTimer) clearTimeout(resetTimer)
})

async function handleCopy() {
  const text = props.value === null || props.value === undefined ? '' : String(props.value)
  if (!text) {
    ElMessage.warning('没有可复制的内容')
    return
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      // 兼容非 https / 老浏览器
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      if (!ok) throw new Error('execCommand copy returned false')
    }

    copied.value = true
    if (resetTimer) clearTimeout(resetTimer)
    resetTimer = setTimeout(() => {
      copied.value = false
      resetTimer = null
    }, 1500)
    ElMessage.success(props.successMessage)
    emit('copy', text)
  } catch (err) {
    ElMessage.error(`${props.errorMessage}：${err?.message || '浏览器拒绝剪贴板访问'}`)
    emit('error', err)
  }
}

const buttonBindings = computed(() => {
  const base = { size: props.size, type: props.type }
  if (props.variant === 'link') base.link = true
  if (props.variant === 'plain') base.plain = true
  return base
})

const resolvedTooltip = computed(() => {
  if (copied.value) return '已复制'
  if (props.tooltipContent) return props.tooltipContent
  if (!props.value) return '复制'
  const text = String(props.value)
  return text.length > 80 ? `复制：${text.slice(0, 80)}…` : `复制：${text}`
})
</script>

<template>
  <el-tooltip
    v-if="showTooltip"
    :content="resolvedTooltip"
    :placement="tooltipPlacement"
    :show-after="200"
  >
    <el-button
      v-bind="buttonBindings"
      class="copy-button"
      :class="{ 'is-copied': copied }"
      @click.stop="handleCopy"
    >
      <el-icon class="copy-button__icon">
        <Check v-if="copied" />
        <Copy v-else />
      </el-icon>
      <span v-if="label" class="copy-button__label">{{ copied ? '已复制' : label }}</span>
    </el-button>
  </el-tooltip>
  <el-button
    v-else
    v-bind="buttonBindings"
    class="copy-button"
    :class="{ 'is-copied': copied }"
    @click.stop="handleCopy"
  >
    <el-icon class="copy-button__icon">
      <Check v-if="copied" />
      <Copy v-else />
    </el-icon>
    <span v-if="label" class="copy-button__label">{{ copied ? '已复制' : label }}</span>
  </el-button>
</template>

<style scoped>
.copy-button {
  padding: 4px 8px;
  min-height: 26px;
  border-radius: 6px;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.copy-button__icon {
  font-size: 14px;
  vertical-align: middle;
}

.copy-button__label {
  margin-left: 4px;
  font-size: 12px;
  line-height: 1;
}

/* link 模式：默认显式可见，hover 给浅色背景区分热区 */
.copy-button.is-link {
  color: var(--el-color-primary);
  background: transparent;
}

.copy-button.is-link:hover:not(.is-disabled) {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

/* 复制成功瞬态：图标和文字变绿 */
.copy-button.is-copied,
.copy-button.is-copied:hover {
  color: var(--el-color-success) !important;
  background: var(--el-color-success-light-9) !important;
}
</style>
