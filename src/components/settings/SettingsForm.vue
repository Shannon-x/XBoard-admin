<script setup>
import { useI18n } from 'vue-i18n'

defineProps({
  configFields: {
    type: Array,
    required: true,
  },
  form: {
    type: Object,
    required: true,
  },
  switchFields: {
    type: Array,
    required: true,
  },
})

const { t } = useI18n()
</script>

<template>
  <el-form :model="form" label-position="top" class="config-form">
    <div class="form-grid">
      <el-form-item
        v-for="field in configFields"
        :key="field.label"
        :label="field.labelKey ? t(field.labelKey) : field.label"
      >
        <el-input v-model="form[field.key]" />
      </el-form-item>

      <div
        v-for="item in switchFields"
        :key="item.label"
        class="switch-row"
      >
        <span>{{ item.labelKey ? t(item.labelKey) : item.label }}</span>
        <el-switch v-model="form[item.key]" />
      </div>
    </div>
  </el-form>
</template>
