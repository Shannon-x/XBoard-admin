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
let editorInstance = null
let resizeObserver = null

const editorStyle = computed(function resolveEditorStyle() {
  return {
    minHeight: `${props.minHeight}px`,
  }
})

onMounted(async function createEditor() {
  if (!containerRef.value) {
    return
  }

  const monaco = await loader.init()

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

    const monaco = await loader.init()
    const model = editorInstance.getModel()

    if (model) {
      monaco.editor.setModelLanguage(model, nextLanguage)
    }
  }
)

onBeforeUnmount(function destroyEditor() {
  resizeObserver?.disconnect()
  resizeObserver = null
  editorInstance?.dispose()
  editorInstance = null
})
</script>

<template>
  <div ref="containerRef" class="monaco-template-editor" :style="editorStyle"></div>
</template>

<style scoped>
.monaco-template-editor {
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 14px;
}
</style>
