<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import MonacoTemplateEditor from './MonacoTemplateEditor.vue'

const props = defineProps({
  activeGroupKey: {
    type: String,
    default: 'site',
  },
  groups: {
    type: Array,
    required: true,
  },
  dynamicOptions: {
    type: Object,
    default: function createDynamicOptions() {
      return {}
    },
  },
  form: {
    type: Object,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['change-group', 'testMail', 'setupTelegramWebhook'])

const { t, tm } = useI18n()
const activeCodeTab = ref('subscribeTemplateSingbox')

const activeGroup = computed(function resolveActiveGroup() {
  const matchedGroup = props.groups.find(function findGroup(group) {
    return group.key === props.activeGroupKey
  })

  return matchedGroup || props.groups[0] || null
})

const activeGroupIndex = computed(function resolveActiveGroupIndex() {
  return props.groups.findIndex(function findGroup(group) {
    return group.key === activeGroup.value?.key
  })
})

const previousGroup = computed(function resolvePreviousGroup() {
  if (activeGroupIndex.value <= 0) {
    return null
  }

  return props.groups[activeGroupIndex.value - 1] || null
})

const nextGroup = computed(function resolveNextGroup() {
  if (activeGroupIndex.value < 0 || activeGroupIndex.value >= props.groups.length - 1) {
    return null
  }

  return props.groups[activeGroupIndex.value + 1] || null
})

const visibleFields = computed(function resolveVisibleFields() {
  if (!activeGroup.value?.fields) {
    return []
  }

  return activeGroup.value.fields.filter(function filterField(field) {
    return isFieldVisible(field)
  })
})

function resolveFieldValue(field) {
  if (field.type === 'action') {
    return undefined
  }

  if (field.type === 'codeTabs') {
    return undefined
  }

  return props.form[field.key]
}

function updateFieldValue(field, value) {
  props.form[field.key] = value
}

function selectGroup(groupKey) {
  emit('change-group', groupKey)
}

function handleFieldAction(field) {
  if (!field?.actionKey) {
    return
  }

  emit(field.actionKey)
}

function resolveActionLoading(field) {
  if (field.actionKey === 'testMail') {
    return Boolean(props.form?.mailTestSending || props.dynamicOptions.mailTestSending)
  }

  if (field.actionKey === 'setupTelegramWebhook') {
    return Boolean(props.form?.telegramWebhookSetting || props.dynamicOptions.telegramWebhookSetting)
  }

  return false
}

function resolveCodeTabValue(tabKey) {
  return props.form[tabKey] || ''
}

function updateCodeTabValue(tabKey, value) {
  props.form[tabKey] = value
}

function resolveCodeLanguage(tabKey) {
  if (tabKey === 'subscribeTemplateSingbox') {
    return 'json'
  }

  return 'yaml'
}

function isFieldVisible(field) {
  if (!field?.visibleWhen) {
    return true
  }

  if (Array.isArray(field.visibleWhen.all)) {
    return field.visibleWhen.all.every(function everyCondition(condition) {
      return matchesVisibilityCondition(condition)
    })
  }

  return matchesVisibilityCondition(field.visibleWhen)
}

function matchesVisibilityCondition(condition) {
  if (!condition?.key) {
    return true
  }

  const currentValue = props.form[condition.key]

  if (Object.prototype.hasOwnProperty.call(condition, 'equals')) {
    return currentValue === condition.equals
  }

  if (Array.isArray(condition.in)) {
    return condition.in.includes(currentValue)
  }

  return true
}

function resolveSelectOptions(field) {
  if (!field?.optionsKey) {
    return []
  }

  if (field.optionsKey.startsWith('systemSettings.dynamicOptions.')) {
    const optionKey = field.optionsKey.replace('systemSettings.dynamicOptions.', '')
    const options = props.dynamicOptions[optionKey]

    if (!Array.isArray(options)) {
      return []
    }

    return options.map(function mapDynamicOption(option) {
      return {
        value: option,
        label: option,
      }
    })
  }

  const options = tm(field.optionsKey)

  if (!options || typeof options !== 'object') {
    return []
  }

  return Object.entries(options).map(function mapOption([value, label]) {
    return {
      value: field.valueType === 'number' ? Number(value) : value,
      label,
    }
  })
}
</script>

<template>
  <div class="system-settings-layout" v-loading="loading">
    <aside class="settings-sidebar-card">
      <div class="settings-sidebar-card__header">
      </div>

      <button
        v-for="group in groups"
        :key="group.key"
        type="button"
        class="settings-sidebar-item"
        :class="{
          'is-active': activeGroup?.key === group.key,
        }"
        @click="selectGroup(group.key)"
      >
        <div class="settings-sidebar-item__icon">
          <el-icon><component :is="group.icon" /></el-icon>
        </div>

        <div class="settings-sidebar-item__content">
          <div class="settings-sidebar-item__row">
            <div class="settings-sidebar-item__title">{{ t(group.titleKey) }}</div>
          </div>
        </div>
      </button>
    </aside>

    <div v-if="activeGroup" class="settings-content-card">
      <section class="settings-section settings-section--header">
        <div class="settings-section__header">
          <div class="settings-section__header-main">
            <div class="settings-section__header-icon">
              <el-icon><component :is="activeGroup.icon" /></el-icon>
            </div>
            <div>
              <h3>{{ t(activeGroup.titleKey) }}</h3>
              <p>{{ t(activeGroup.descriptionKey) }}</p>
            </div>
          </div>
        </div>
      </section>

      <section v-if="activeGroup.fields?.length" class="settings-section">
        <div class="settings-field-list">
          <div
            v-for="field in visibleFields"
            :key="field.key"
            class="settings-field"
            :class="{
              'settings-field--code-tabs': field.type === 'codeTabs',
              'settings-field--switch': field.type === 'switch',
              'settings-field--compact': field.tone === 'compact',
            }"
          >
            <div v-if="field.type !== 'codeTabs'" class="settings-field__meta">
              <label class="settings-field__label">{{ t(field.labelKey) }}</label>
              <p v-if="field.descriptionKey" class="settings-field__description">
                {{ t(field.descriptionKey) }}
              </p>
            </div>

            <div class="settings-field__control">
              <el-button
                v-if="field.type === 'action'"
                class="settings-inline-action"
                type="primary"
                :loading="resolveActionLoading(field)"
                @click="handleFieldAction(field)"
              >
                {{ t(field.labelKey) }}
              </el-button>

              <el-switch
                v-else-if="field.type === 'switch'"
                class="settings-compact-switch"
                :model-value="resolveFieldValue(field)"
                @update:model-value="updateFieldValue(field, $event)"
              />

              <div v-else-if="field.type === 'codeTabs'" class="settings-code-tabs">
                <el-tabs v-model="activeCodeTab" class="settings-code-tabs__nav">
                  <el-tab-pane
                    v-for="tab in field.tabs"
                    :key="tab.key"
                    :label="t(tab.labelKey)"
                    :name="tab.key"
                  />
                </el-tabs>

                <div
                  v-for="tab in field.tabs"
                  v-show="activeCodeTab === tab.key"
                  :key="`${tab.key}-panel`"
                  class="settings-code-tabs__panel"
                >
                  <h4 class="settings-code-tabs__title">{{ t(tab.labelKey) }}</h4>
                  <MonacoTemplateEditor
                    :language="resolveCodeLanguage(tab.key)"
                    :min-height="520"
                    :model-value="resolveCodeTabValue(tab.key)"
                    @update:model-value="updateCodeTabValue(tab.key, $event)"
                  />
                </div>
              </div>

              <el-select
                v-else-if="field.type === 'select'"
                :model-value="resolveFieldValue(field)"
                class="settings-select"
                @update:model-value="updateFieldValue(field, $event)"
              >
                <el-option
                  v-for="option in resolveSelectOptions(field)"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>

              <el-input-number
                v-else-if="field.type === 'number'"
                :model-value="resolveFieldValue(field)"
                :controls="false"
                :min="field.min ?? 0"
                :max="field.max"
                :step="field.step"
                class="settings-number-input"
                @update:model-value="updateFieldValue(field, $event ?? 0)"
              />

              <el-input
                v-else
                :model-value="resolveFieldValue(field)"
                :autosize="field.autosize"
                :placeholder="field.placeholderKey ? t(field.placeholderKey) : ''"
                :type="field.type === 'textarea' ? 'textarea' : 'text'"
                @update:model-value="updateFieldValue(field, $event)"
              />
            </div>
          </div>
        </div>
      </section>

      <section v-else class="settings-section settings-section--placeholder">
        <div class="settings-placeholder-card">
          <div class="settings-placeholder-card__header">
            <div class="settings-placeholder-card__icon">
              <el-icon><component :is="activeGroup.icon" /></el-icon>
            </div>
            <div>
              <h4>{{ t(activeGroup.titleKey) }}</h4>
              <p>{{ t(activeGroup.descriptionKey) }}</p>
            </div>
          </div>

          <div class="settings-placeholder-grid">
            <div
              v-for="item in activeGroup.previewItems || []"
              :key="item.labelKey"
              class="settings-placeholder-item"
            >
              <span>{{ t(item.labelKey) }}</span>
              <strong>{{ t(item.valueKey) }}</strong>
            </div>
          </div>
        </div>
      </section>

      <footer class="settings-section-footer">
        <button
          type="button"
          class="settings-nav-link"
          :disabled="!previousGroup"
          @click="previousGroup && selectGroup(previousGroup.key)"
        >
          <span>{{ t('systemSettings.panel.previous') }}</span>
          <strong>{{ previousGroup ? t(previousGroup.titleKey) : t('systemSettings.panel.first') }}</strong>
        </button>

        <button
          type="button"
          class="settings-nav-link is-next"
          :disabled="!nextGroup"
          @click="nextGroup && selectGroup(nextGroup.key)"
        >
          <span>{{ t('systemSettings.panel.next') }}</span>
          <strong>{{ nextGroup ? t(nextGroup.titleKey) : t('systemSettings.panel.last') }}</strong>
        </button>
      </footer>
    </div>
  </div>
</template>
