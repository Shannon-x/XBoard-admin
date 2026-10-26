<script setup>
import { computed } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'

/**
 * 充值赠送档位：每档「充值满 X 元，赠送 Y 元」，金额单位元。余额充值与上网按量共用。
 * 后端取满足门槛的档位里赠送最多的一档，并拒绝「赠送超过门槛」的档位（防止把 100:10 手误成 10:100）。
 */
const props = defineProps({
  modelValue: {
    type: Array,
    default: function createDefault() {
      return []
    },
  },
  // 余额充值后端上限 20 档，上网按量 10 档
  maxTiers: {
    type: Number,
    default: 20,
  },
  emptyText: {
    type: String,
    default: '没有赠送档位，充值多少到账多少',
  },
  tip: {
    type: String,
    default: '用户充值时取满足条件的最高一档；改档位只影响之后新下的充值单。',
  },
})

const emit = defineEmits(['update:modelValue'])

const MAX_TIERS = computed(function maxTiers() {
  return props.maxTiers || 20
})

const rows = computed(function rows() {
  return Array.isArray(props.modelValue) ? props.modelValue : []
})

function commit(next) {
  emit('update:modelValue', next)
}

function updateRow(index, patch) {
  commit(rows.value.map(function mapRow(row, i) {
    return i === index ? { ...row, ...patch } : row
  }))
}

function addRow() {
  if (rows.value.length >= MAX_TIERS.value) {
    return
  }
  const last = rows.value[rows.value.length - 1]
  const amount = last ? Number(last.amount || 0) * 2 || 100 : 100
  commit([...rows.value, { amount, bonus: Math.round(amount * 0.1 * 100) / 100 }])
}

function removeRow(index) {
  commit(rows.value.filter(function keep(_row, i) { return i !== index }))
}

function ratioText(row) {
  const amount = Number(row.amount || 0)
  const bonus = Number(row.bonus || 0)
  if (amount <= 0 || bonus <= 0) {
    return ''
  }
  if (bonus > amount) {
    return '赠送超过门槛，保存会被拒绝'
  }
  return `相当于加送 ${Math.round((bonus / amount) * 1000) / 10}%`
}
</script>

<template>
  <div class="recharge-tiers">
    <div v-if="rows.length" class="recharge-tiers__list">
      <div v-for="(row, index) in rows" :key="index" class="recharge-tiers__row">
        <span>充值满</span>
        <el-input-number
          :model-value="Number(row.amount || 0)"
          :min="0.01"
          :step="10"
          :precision="2"
          controls-position="right"
          class="recharge-tiers__number"
          @update:model-value="updateRow(index, { amount: $event ?? 0 })"
        />
        <span>元，赠送</span>
        <el-input-number
          :model-value="Number(row.bonus || 0)"
          :min="0.01"
          :step="1"
          :precision="2"
          controls-position="right"
          class="recharge-tiers__number"
          @update:model-value="updateRow(index, { bonus: $event ?? 0 })"
        />
        <span>元</span>
        <span class="recharge-tiers__ratio" :class="{ 'is-danger': Number(row.bonus) > Number(row.amount) }">{{ ratioText(row) }}</span>
        <el-button size="small" text type="danger" :icon="Trash2" @click="removeRow(index)">删除</el-button>
      </div>
    </div>
    <el-empty v-else :description="props.emptyText" :image-size="60" />
    <div class="recharge-tiers__footer">
      <el-button size="small" :icon="Plus" :disabled="rows.length >= MAX_TIERS" @click="addRow">添加一档</el-button>
      <span class="recharge-tiers__tip">{{ props.tip }}</span>
    </div>
  </div>
</template>

<style scoped>
.recharge-tiers {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.recharge-tiers__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recharge-tiers__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
  font-size: 13px;
}

.recharge-tiers__number {
  width: 140px;
}

.recharge-tiers__ratio {
  flex: 1;
  min-width: 120px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.recharge-tiers__ratio.is-danger {
  color: var(--el-color-danger);
}

.recharge-tiers__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.recharge-tiers__tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
