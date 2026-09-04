<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import MonacoTemplateEditor from './MonacoTemplateEditor.vue'
import WithdrawChainsEditor from './WithdrawChainsEditor.vue'

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

const emit = defineEmits(['change-group', 'testMail', 'setupTelegramWebhook', 'testTicketStorage'])

const { t, tm } = useI18n()
const activeCodeTab = ref('subscribeTemplateSingbox')

/**
 * 数据驱动文案的安全取值。
 *
 * 本面板的 label/description/placeholder 全部来自 systemSettingsGroups 里的 key，
 * 由 t() 无参渲染。vue-i18n 在**生产构建**下把消息编译错误包装成 `new SyntaxError(String(错误码))`
 * 并直接抛出（dev 只打一条 console 错误），于是一条写错的文案会冒泡到 App.vue 的全局错误边界，
 * 让整张设置页打不开——2026-09 就因为一句描述里写了 `{地址}`（中文标识符占位符）触发过。
 *
 * 这里兜底：单条文案坏掉就退化成显示 key 本身，其余字段照常可用。
 * 真正的防线是构建期的 scripts/check-i18n.mjs，这只是最后一道。
 */
function safeT(key) {
  if (!key) {
    return ''
  }

  try {
    return t(key)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[systemSettings] i18n 文案编译失败，已降级显示 key：', key, error)
    return key
  }
}

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

  if (field.actionKey === 'testTicketStorage') {
    return Boolean(props.dynamicOptions.ticketStorageTesting)
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
            <div class="settings-sidebar-item__title">{{ safeT(group.titleKey) }}</div>
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
              <h3>{{ safeT(activeGroup.titleKey) }}</h3>
              <p>{{ safeT(activeGroup.descriptionKey) }}</p>
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
              'settings-field--block': field.type === 'withdrawChains',
              'settings-field--switch': field.type === 'switch',
              'settings-field--compact': field.tone === 'compact',
            }"
          >
            <div v-if="field.type !== 'codeTabs'" class="settings-field__meta">
              <label class="settings-field__label">{{ safeT(field.labelKey) }}</label>
              <p v-if="field.descriptionKey" class="settings-field__description">
                {{ safeT(field.descriptionKey) }}
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
                {{ safeT(field.labelKey) }}
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
                    :label="safeT(tab.labelKey)"
                    :name="tab.key"
                  />
                </el-tabs>

                <div
                  v-for="tab in field.tabs"
                  v-show="activeCodeTab === tab.key"
                  :key="`${tab.key}-panel`"
                  class="settings-code-tabs__panel"
                >
                  <h4 class="settings-code-tabs__title">{{ safeT(tab.labelKey) }}</h4>
                  <MonacoTemplateEditor
                    :language="resolveCodeLanguage(tab.key)"
                    :min-height="520"
                    :model-value="resolveCodeTabValue(tab.key)"
                    @update:model-value="updateCodeTabValue(tab.key, $event)"
                  />
                </div>
              </div>

              <WithdrawChainsEditor
                v-else-if="field.type === 'withdrawChains'"
                :model-value="resolveFieldValue(field)"
                :presets="props.form?.commissionWithdrawPresets || []"
                @update:model-value="updateFieldValue(field, $event)"
              />

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
                :placeholder="field.placeholderKey ? safeT(field.placeholderKey) : ''"
                :show-password="field.type === 'password'"
                :type="field.type === 'textarea' ? 'textarea' : field.type === 'password' ? 'password' : 'text'"
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
              <h4>{{ safeT(activeGroup.titleKey) }}</h4>
              <p>{{ safeT(activeGroup.descriptionKey) }}</p>
            </div>
          </div>

          <div class="settings-placeholder-grid">
            <div
              v-for="item in activeGroup.previewItems || []"
              :key="item.labelKey"
              class="settings-placeholder-item"
            >
              <span>{{ safeT(item.labelKey) }}</span>
              <strong>{{ safeT(item.valueKey) }}</strong>
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
          <strong>{{ previousGroup ? safeT(previousGroup.titleKey) : t('systemSettings.panel.first') }}</strong>
        </button>

        <button
          type="button"
          class="settings-nav-link is-next"
          :disabled="!nextGroup"
          @click="nextGroup && selectGroup(nextGroup.key)"
        >
          <span>{{ t('systemSettings.panel.next') }}</span>
          <strong>{{ nextGroup ? safeT(nextGroup.titleKey) : t('systemSettings.panel.last') }}</strong>
        </button>
      </footer>
    </div>
  </div>
</template>
