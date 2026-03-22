<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import MonacoTemplateEditor from '../settings/MonacoTemplateEditor.vue'
import { useAdminStore } from '../../stores/admin'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  plugin: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue'])

const adminStore = useAdminStore()
const JSON_FIELD_TYPE = 'json'
const EMPTY_JSON_ERROR_MAP = {}

const visible = computed({
  get() {
    return props.modelValue
  },
  set(value) {
    emit('update:modelValue', value)
  },
})

const configFields = ref([])
const formValues = ref({})
const jsonFieldErrors = ref(EMPTY_JSON_ERROR_MAP)
const saving = ref(false)

function normalizeConfig(config) {
  if (Array.isArray(config)) {
    return config.map((item, index) => ({
      key: item?.key || `FIELD-${index + 1}`,
      ...item,
    }))
  }

  if (config && typeof config === 'object') {
    return Object.entries(config).map(([key, value]) => ({
      key,
      ...value,
    }))
  }

  return []
}

function normalizeBoolean(value) {
  if (value === true || value === false) {
    return value
  }

  if (value === 'true' || value === '1' || value === 1) {
    return true
  }

  if (value === 'false' || value === '0' || value === 0) {
    return false
  }

  return Boolean(value)
}

function normalizeFieldValue(field) {
  const rawValue = field?.value ?? field?.default ?? ''
  const type = String(field?.type || '').toLowerCase()

  if (type === 'number') {
    const numericValue = Number(rawValue)
    return Number.isFinite(numericValue) ? numericValue : null
  }

  if (type === 'boolean') {
    return normalizeBoolean(rawValue)
  }

  if (type === JSON_FIELD_TYPE) {
    if (typeof rawValue === 'string') {
      return rawValue
    }

    if (rawValue && typeof rawValue === 'object') {
      return JSON.stringify(rawValue, null, 2)
    }

    return ''
  }

  return rawValue ?? ''
}

function getFieldComponent(type, options) {
  const normalized = String(type || '').toLowerCase()

  if (normalized === 'boolean') {
    return 'el-switch'
  }

  if (normalized === 'number') {
    return 'el-input-number'
  }

  if (normalized === 'text') {
    return 'el-input'
  }

  if (Array.isArray(options) && options.length > 0) {
    return 'el-select'
  }

  return 'el-input'
}

function getFieldProps(field) {
  const type = String(field?.type || '').toLowerCase()
  const props = {}

  if (type === 'text') {
    props.type = 'textarea'
    props.autosize = { minRows: 3, maxRows: 8 }
  }

  if (type === 'number') {
    props.controlsPosition = 'right'
  }

  if (field?.placeholder) {
    props.placeholder = field.placeholder
  }

  return props
}

function parseJsonFieldValue(value) {
  if (value === '' || value === null || value === undefined) {
    return {
      valid: true,
      error: '',
    }
  }

  try {
    JSON.parse(String(value))
    return {
      valid: true,
      error: '',
    }
  } catch (error) {
    return {
      valid: false,
      error: error?.message || 'JSON 格式无效',
    }
  }
}

function setJsonFieldValue(fieldKey, value) {
  formValues.value[fieldKey] = value

  const result = parseJsonFieldValue(value)
  jsonFieldErrors.value = {
    ...jsonFieldErrors.value,
    [fieldKey]: result.error,
  }
}

function validateJsonFields() {
  const nextErrors = {}
  let hasError = false

  configFields.value.forEach((field) => {
    const type = String(field?.type || '').toLowerCase()

    if (type !== JSON_FIELD_TYPE) {
      return
    }

    const result = parseJsonFieldValue(formValues.value[field.key])
    nextErrors[field.key] = result.error

    if (!result.valid) {
      hasError = true
    }
  })

  jsonFieldErrors.value = nextErrors
  return !hasError
}

function buildConfigPayload() {
  const payload = {}

  configFields.value.forEach((field) => {
    const key = field.key
    const type = String(field?.type || '').toLowerCase()
    const value = formValues.value[key]

    if (type === JSON_FIELD_TYPE) {
      if (value === '' || value === null || value === undefined) {
        payload[key] = null
      } else {
        payload[key] = String(value)
      }
      return
    }

    payload[key] = value
  })

  return payload
}

async function handleSave() {
  if (!props.plugin?.code) {
    ElMessage.error('缺少插件标识')
    return
  }

  if (!validateJsonFields()) {
    ElMessage.error('JSON 配置格式有误，请修正后再保存')
    return
  }

  saving.value = true

  try {
    const configPayload = buildConfigPayload()
    await adminStore.savePluginConfig(props.plugin.code, configPayload)
    ElMessage.success('配置更新成功')
    visible.value = false
  } catch (error) {
    ElMessage.error(error?.message || '配置保存失败')
  } finally {
    saving.value = false
  }
}

function getFieldOptions(field) {
  if (!Array.isArray(field?.options)) {
    return []
  }

  return field.options.map((option, index) => {
    if (option && typeof option === 'object') {
      return {
        label: option.label ?? option.value ?? `选项 ${index + 1}`,
        value: option.value ?? option.label ?? option,
      }
    }

    return { label: String(option), value: option }
  })
}

watch(
  () => props.plugin,
  (plugin) => {
    const fields = normalizeConfig(plugin?.config)
    const values = {}
    const nextJsonErrors = {}

    fields.forEach((field) => {
      const fieldValue = normalizeFieldValue(field)
      values[field.key] = fieldValue

      if (String(field?.type || '').toLowerCase() === JSON_FIELD_TYPE) {
        nextJsonErrors[field.key] = parseJsonFieldValue(fieldValue).error
      }
    })

    configFields.value = fields
    formValues.value = values
    jsonFieldErrors.value = nextJsonErrors
  },
  { immediate: true }
)
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="plugin?.name || '插件配置'"
    class="plugin-config__dialog"
    width="520px"
  >
    <el-form label-position="top" class="plugin-config">
      <el-form-item
        v-for="field in configFields"
        :key="field.key"
        :label="String(field.type || '').toLowerCase() === 'boolean'
          ? ''
          : field.label || field.key"
        class="plugin-config__field"
      >
        <template v-if="String(field.type || '').toLowerCase() === 'boolean'">
          <div class="plugin-config__switch-card">
            <div class="plugin-config__switch-content">
              <p class="plugin-config__switch-title">
                {{ field.label || field.key }}
              </p>
              <p v-if="field.description" class="plugin-config__switch-desc">
                {{ field.description }}
              </p>
            </div>
            <el-switch v-model="formValues[field.key]" />
          </div>
        </template>
        <template v-else-if="String(field.type || '').toLowerCase() === JSON_FIELD_TYPE">
          <MonacoTemplateEditor
            :language="JSON_FIELD_TYPE"
            :min-height="220"
            :model-value="String(formValues[field.key] || '')"
            @update:model-value="setJsonFieldValue(field.key, $event)"
          />
          <p v-if="jsonFieldErrors[field.key]" class="plugin-config__json-error">
            JSON 校验失败：{{ jsonFieldErrors[field.key] }}
          </p>
        </template>
        <div v-else class="plugin-config__control-wrap">
          <component
            :is="getFieldComponent(field.type, field.options)"
            v-model="formValues[field.key]"
            v-bind="getFieldProps(field)"
            class="plugin-config__control"
          >
            <el-option
              v-for="option in getFieldOptions(field)"
              v-if="getFieldComponent(field.type, field.options) === 'el-select'"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </component>
        </div>
        <p
          v-if="field.description && String(field.type || '').toLowerCase() !== 'boolean'"
          class="plugin-config__desc"
        >
          {{ field.description }}
        </p>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">
        保存配置
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.plugin-config__dialog :deep(.el-dialog) {
  max-width: 92vw;
}

.plugin-config__dialog :deep(.el-dialog__body) {
  padding: 12px 24px 24px;
}

.plugin-config {
  display: grid;
  gap: 16px;
}

.plugin-config__field {
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
}

.plugin-config__field :deep(.el-form-item__label) {
  margin-bottom: 8px;
  font-size: 12px;
  letter-spacing: 0.4px;
  color: var(--el-text-color-secondary);
}

.plugin-config__control-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.plugin-config__switch-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.plugin-config__switch-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.plugin-config__switch-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.plugin-config__switch-desc {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.plugin-config__control {
  width: 100%;
}

.plugin-config__control :deep(.el-input__wrapper),
.plugin-config__control :deep(.el-textarea__inner) {
  border-radius: 10px;
}

.plugin-config__control :deep(.el-input),
.plugin-config__control :deep(.el-select),
.plugin-config__control :deep(.el-textarea),
.plugin-config__control :deep(.el-input-number) {
  width: 100%;
}

.plugin-config__control :deep(.el-input-number__increase),
.plugin-config__control :deep(.el-input-number__decrease) {
  background: transparent;
  border-left: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-secondary);
}

.plugin-config__control :deep(.el-input-number__increase:hover),
.plugin-config__control :deep(.el-input-number__decrease:hover) {
  color: var(--el-color-primary);
}

.plugin-config__control :deep(.el-textarea__inner) {
  font-family: 'Fira Code', monospace;
}

.plugin-config__desc {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.plugin-config__json-error {
  margin: 8px 0 0;
  color: var(--el-color-danger);
  font-size: 12px;
  line-height: 1.5;
}
</style>
