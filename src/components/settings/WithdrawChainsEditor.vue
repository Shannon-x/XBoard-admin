<script setup>
import { computed } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'

import { slugifyChainCode } from '../../services/settings'

const props = defineProps({
  modelValue: {
    type: Array,
    default: function createDefault() {
      return []
    },
  },
  presets: {
    type: Array,
    default: function createDefaultPresets() {
      return []
    },
  },
})

const emit = defineEmits(['update:modelValue'])

// 后端没给预设时的兜底（与 App\Services\Commission\WithdrawalConfig::PRESETS 一致）
const FALLBACK_PRESETS = [
  { value: 'tron', hint: 'T 开头的 34 位地址' },
  { value: 'evm', hint: '0x 开头的 42 位地址' },
  { value: 'solana', hint: 'Base58 编码，32–44 位' },
  { value: 'ton', hint: 'EQ / UQ 开头的 48 位地址' },
  { value: 'none', hint: '不校验格式' },
]

const PRESET_LABELS = {
  tron: 'TRON（TRC20）',
  evm: 'EVM（ERC20 / BEP20 / Polygon…）',
  solana: 'Solana',
  ton: 'TON',
  none: '不校验',
}

const presetOptions = computed(function presetOptions() {
  const source = props.presets.length ? props.presets : FALLBACK_PRESETS
  return source.map(function mapPreset(preset) {
    return {
      value: preset.value,
      label: PRESET_LABELS[preset.value] || preset.value,
      hint: preset.hint || '',
    }
  })
})

const QUICK_ADD = [
  { name: 'USDT', network: 'TRC20 (Tron)', preset: 'tron', explorerTx: 'https://tronscan.org/#/transaction/{txid}' },
  { name: 'USDT', network: 'BEP20 (BNB Smart Chain)', preset: 'evm', explorerTx: 'https://bscscan.com/tx/{txid}' },
  { name: 'USDT', network: 'ERC20 (Ethereum)', preset: 'evm', explorerTx: 'https://etherscan.io/tx/{txid}' },
  { name: 'USDT', network: 'Polygon', preset: 'evm', explorerTx: 'https://polygonscan.com/tx/{txid}' },
  { name: 'USDT', network: 'Solana (SPL)', preset: 'solana', explorerTx: 'https://solscan.io/tx/{txid}' },
]

const rows = computed(function rows() {
  return Array.isArray(props.modelValue) ? props.modelValue : []
})

function commit(next) {
  emit('update:modelValue', next)
}

function updateRow(index, patch) {
  const next = rows.value.map(function mapRow(row, i) {
    if (i !== index) {
      return row
    }
    const merged = { ...row, ...patch }
    // code 未手填时跟随名称 + 网络自动生成
    if (!merged.codeLocked) {
      merged.code = slugifyChainCode(`${merged.name || ''} ${merged.network || ''}`)
    }
    return merged
  })
  commit(next)
}

function updateCode(index, value) {
  const code = slugifyChainCode(value)
  updateRow(index, { code, codeLocked: Boolean(code) })
}

function addRow(template) {
  const base = template || { name: '', network: '', preset: 'none', explorerTx: '' }
  const code = slugifyChainCode(`${base.name} ${base.network}`)
  if (code && rows.value.some(function sameCode(row) { return row.code === code })) {
    return
  }
  commit([...rows.value, { ...base, code, codeLocked: false }])
}

function removeRow(index) {
  commit(rows.value.filter(function keep(_row, i) { return i !== index }))
}

function moveRow(index, delta) {
  const target = index + delta
  if (target < 0 || target >= rows.value.length) {
    return
  }
  const next = [...rows.value]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  commit(next)
}
</script>

<template>
  <div class="withdraw-chains">
    <div v-if="rows.length" class="withdraw-chains__list">
      <div v-for="(row, index) in rows" :key="index" class="withdraw-chains__row">
        <div class="withdraw-chains__grid">
          <label class="withdraw-chains__cell">
            <span>币种 / 名称</span>
            <el-input :model-value="row.name" placeholder="USDT" @update:model-value="updateRow(index, { name: $event })" />
          </label>
          <label class="withdraw-chains__cell">
            <span>网络</span>
            <el-input :model-value="row.network" placeholder="TRC20 (Tron)" @update:model-value="updateRow(index, { network: $event })" />
          </label>
          <label class="withdraw-chains__cell">
            <span>地址格式</span>
            <el-select :model-value="row.preset" @update:model-value="updateRow(index, { preset: $event })">
              <el-option v-for="preset in presetOptions" :key="preset.value" :label="preset.label" :value="preset.value" />
            </el-select>
          </label>
          <label class="withdraw-chains__cell">
            <span>标识 code</span>
            <el-input :model-value="row.code" placeholder="自动生成" @update:model-value="updateCode(index, $event)" />
          </label>
          <label class="withdraw-chains__cell withdraw-chains__cell--wide">
            <span>区块浏览器交易链接（可选，用英文花括号包住 txid 作为占位）</span>
            <el-input :model-value="row.explorerTx" placeholder="https://tronscan.org/#/transaction/…" @update:model-value="updateRow(index, { explorerTx: $event })" />
          </label>
        </div>
        <div class="withdraw-chains__actions">
          <el-button size="small" text :disabled="index === 0" @click="moveRow(index, -1)">上移</el-button>
          <el-button size="small" text :disabled="index === rows.length - 1" @click="moveRow(index, 1)">下移</el-button>
          <el-button size="small" text type="danger" :icon="Trash2" @click="removeRow(index)">删除</el-button>
        </div>
      </div>
    </div>
    <el-empty v-else description="还没有配置提现链，用户端将无法申请提现" :image-size="60" />

    <div class="withdraw-chains__footer">
      <el-button size="small" :icon="Plus" @click="addRow()">添加一条</el-button>
      <el-dropdown trigger="click" @command="addRow">
        <el-button size="small" plain>快速添加常用链 ▾</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="item in QUICK_ADD" :key="item.network" :command="item">
              {{ item.name }} · {{ item.network }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<style scoped>
.withdraw-chains {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.withdraw-chains__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.withdraw-chains__row {
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.withdraw-chains__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.withdraw-chains__cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.withdraw-chains__cell--wide {
  grid-column: 1 / -1;
}

.withdraw-chains__actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 6px;
}

.withdraw-chains__footer {
  display: flex;
  gap: 8px;
}

@media (max-width: 900px) {
  .withdraw-chains__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
