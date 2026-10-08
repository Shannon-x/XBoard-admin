<script setup>
import loader from '@monaco-editor/loader'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  language: {
    type: String,
    default: 'yaml',
  },
  minHeight: {
    type: Number,
    default: 520,
  },
})

const emit = defineEmits(['update:modelValue'])

const containerRef = ref(null)
// Monaco 从 jsDelivr 异步加载：拿不到（被墙 / 断网）就退化成普通文本域，模板照样能改能存，
// 不能让一个 CDN 把整张设置页拖崩。
const fallbackActive = ref(false)
let editorInstance = null
let resizeObserver = null
// 组件已卸载的标记。loader.init() 是跨路由的异步等待，用户在它返回前切走分组时
// containerRef 已经是 null，再 monaco.editor.create(null) 就会抛
// 「null is not an object (evaluating 'o.parentNode')」并经 mounted hook 冒泡到 App.vue
// 的全局错误边界 —— 2026-10 线上从「订阅模板」切到「工单附件」崩页面就是这条路。
let disposed = false

const editorStyle = computed(function resolveEditorStyle() {
  return {
    minHeight: `${props.minHeight}px`,
  }
})

async function loadMonaco() {
  try {
    return await loader.init()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[MonacoTemplateEditor] Monaco 加载失败，退化为纯文本编辑：', error)
    return null
  }
}

onMounted(async function createEditor() {
  if (!containerRef.value) {
    return
  }

  const monaco = await loadMonaco()

  // 等待期间组件已卸载（用户切到别的设置分组），什么都不做；
  // 否则会把编辑器挂到一个已经不在文档里的节点上。
  if (disposed || !containerRef.value) {
    return
  }

  if (!monaco) {
    fallbackActive.value = true
    return
  }

  editorInstance = monaco.editor.create(containerRef.value, {
    value: props.modelValue,
    language: props.language,
    theme: 'vs',
    automaticLayout: true,
    minimap: {
      enabled: false,
    },
    scrollBeyondLastLine: false,
    fontFamily: 'Fira Code, monospace',
    fontSize: 13,
    lineHeight: 22,
    roundedSelection: false,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'off',
  })

  editorInstance.onDidChangeModelContent(function onEditorChange() {
    emit('update:modelValue', editorInstance.getValue())
  })

  resizeObserver = new ResizeObserver(function handleResize() {
    editorInstance?.layout()
  })

  resizeObserver.observe(containerRef.value)
})

watch(
  function watchValue() {
    return props.modelValue
  },
  function syncEditorValue(nextValue) {
    if (!editorInstance) {
      return
    }

    const currentValue = editorInstance.getValue()

    if (currentValue !== nextValue) {
      editorInstance.setValue(nextValue)
    }
  }
)

watch(
  function watchLanguage() {
    return props.language
  },
  async function syncEditorLanguage(nextLanguage) {
    if (!editorInstance) {
      return
    }

    const monaco = await loadMonaco()

    if (disposed || !monaco || !editorInstance) {
      return
    }

    const model = editorInstance.getModel()

    if (model) {
      monaco.editor.setModelLanguage(model, nextLanguage)
    }
  }
)

function handleFallbackInput(event) {
  emit('update:modelValue', event.target.value)
}

onBeforeUnmount(function destroyEditor() {
  disposed = true
  resizeObserver?.disconnect()
  resizeObserver = null
  editorInstance?.dispose()
  editorInstance = null
})
</script>

<template>
  <div class="monaco-template-editor" :style="editorStyle">
    <div v-show="!fallbackActive" ref="containerRef" class="monaco-template-editor__host"></div>

    <div v-if="fallbackActive" class="monaco-template-editor__fallback">
      <p class="monaco-template-editor__fallback-note">
        代码编辑器加载失败（无法访问 jsDelivr CDN），已切换为纯文本编辑，内容仍可正常保存。
      </p>
      <textarea
        class="monaco-template-editor__textarea"
        spellcheck="false"
        :value="modelValue"
        @input="handleFallbackInput"
      ></textarea>
    </div>
  </div>
</template>

<style scoped>
.monaco-template-editor {
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
}

.monaco-template-editor__host {
  flex: 1;
  min-height: inherit;
}

.monaco-template-editor__fallback {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: inherit;
}

.monaco-template-editor__fallback-note {
  margin: 0;
  padding: 10px 14px;
  font-size: 12px;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
  background: var(--panel-strong);
}

.monaco-template-editor__textarea {
  flex: 1;
  width: 100%;
  min-height: 420px;
  padding: 14px;
  border: 0;
  outline: none;
  resize: vertical;
  background: transparent;
  color: inherit;
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  line-height: 22px;
  tab-size: 2;
  white-space: pre;
}
</style>
