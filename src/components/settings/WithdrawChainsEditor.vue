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
  // 后端下发的网络目录：选中一个网络就自动带出地址格式 / 区块浏览器 / 通道费
  networks: {
    type: Array,
    default: function createDefaultNetworks() {
      return []
    },
  },
})

const emit = defineEmits(['update:modelValue'])

// 后端没给目录时的兜底（与 App\Services\Commission\WithdrawalConfig::NETWORKS 一致）
const FALLBACK_NETWORKS = [
  { value: 'trc20', label: 'TRC20 (Tron)', preset: 'tron', explorer_tx: 'https://tronscan.org/#/transaction/{txid}', fee: 1 },
  { value: 'bep20', label: 'BEP20 (BNB Smart Chain)', preset: 'evm', explorer_tx: 'https://bscscan.com/tx/{txid}', fee: 0.5 },
  { value: 'erc20', label: 'ERC20 (Ethereum)', preset: 'evm', explorer_tx: 'https://etherscan.io/tx/{txid}', fee: 5 },
  { value: 'custom', label: '', preset: 'none', explorer_tx: '', fee: 0 },
]

const FALLBACK_PRESETS = [
  { value: 'tron', hint: 'T 开头的 34 位地址' },
  { value: 'evm', hint: '0x 开头的 42 位地址' },
  { value: 'solana', hint: 'Base58 编码，32–44 位' },
  { value: 'ton', hint: 'EQ / UQ 开头的 48 位地址' },
  { value: 'aptos', hint: '0x 开头的十六进制地址' },
  { value: 'none', hint: '不校验格式' },
]

const PRESET_LABELS = {
  tron: 'TRON（TRC20）',
  evm: 'EVM（ERC20 / BEP20 / Polygon…）',
  solana: 'Solana',
  ton: 'TON',
  aptos: 'Aptos',
  none: '不校验',
}

const networkOptions = computed(function networkOptions() {
  const source = props.networks.length ? props.networks : FALLBACK_NETWORKS
  return source.map(function mapNetwork(item) {
    return {
      value: item.value,
      label: item.value === 'custom' ? '自定义…' : item.label || item.value,
      preset: item.preset || 'none',
      explorerTx: item.explorer_tx ?? item.explorerTx ?? '',
      fee: Number(item.fee ?? 0),
    }
  })
})

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

const rows = computed(function rows() {
  return Array.isArray(props.modelValue) ? props.modelValue : []
})

function findNetwork(key) {
  return networkOptions.value.find(function match(option) {
    return option.value === key
  })
}

function presetHint(preset) {
  const found = presetOptions.value.find(function match(option) {
    return option.value === preset
  })
  return found && found.hint ? found.hint : '不校验格式'
}

function commit(next) {
  emit('update:modelValue', next)
}

/** code 跟随「名称 + 网络 key」自动生成，与后端 WithdrawalConfig::defaultCode 保持一致 */
function autoCode(row) {
  if (row.networkKey && row.networkKey !== 'custom') {
    return slugifyChainCode(`${row.name || ''}_${row.networkKey}`)
  }
  return slugifyChainCode(`${row.name || ''} ${row.network || ''}`)
}

function updateRow(index, patch) {
  const next = rows.value.map(function mapRow(row, i) {
    if (i !== index) {
      return row
    }
    const merged = { ...row, ...patch }
    if (!merged.codeLocked) {
      merged.code = autoCode(merged)
    }
    return merged
  })
  commit(next)
}

/**
 * 换网络时把地址格式 / 区块浏览器 / 通道费一并换成该网络的标准值。
 * 这三样和网络是死绑定的——分开手填只会填错，而填错地址格式的后果是用户的地址永远过不了校验。
 * 想微调的话，换完网络再改这几格即可。
 */
function updateNetwork(index, key) {
  const meta = findNetwork(key)
  if (!meta) {
    updateRow(index, { networkKey: key })
    return
  }
  updateRow(index, {
    networkKey: key,
    network: key === 'custom' ? (rows.value[index] && rows.value[index].network) || '' : meta.label,
    preset: meta.preset,
    explorerTx: meta.explorerTx,
    fee: meta.fee,
  })
}

function updateCode(index, value) {
  const code = slugifyChainCode(value)
  updateRow(index, { code, codeLocked: Boolean(code) })
}

function addRow(networkKey) {
  const key = typeof networkKey === 'string' && networkKey ? networkKey : 'trc20'
  const meta = findNetwork(key) || { label: '', preset: 'none', explorerTx: '', fee: 0 }
  const row = {
    name: 'USDT',
    networkKey: key,
    network: meta.label,
    preset: meta.preset,
    explorerTx: meta.explorerTx,
    fee: meta.fee,
    codeLocked: false,
  }
  row.code = autoCode(row)
  if (row.code && rows.value.some(function sameCode(item) { return item.code === row.code })) {
    return
  }
  commit([...rows.value, row])
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
            <span>网络</span>
            <el-select :model-value="row.networkKey || 'custom'" @update:model-value="updateNetwork(index, $event)">
              <el-option v-for="item in networkOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </label>
          <label class="withdraw-chains__cell">
            <span>币种 / 名称</span>
            <el-input :model-value="row.name" placeholder="USDT" @update:model-value="updateRow(index, { name: $event })" />
          </label>
          <label class="withdraw-chains__cell">
            <span>通道费（USDT，从到账金额中扣除）</span>
            <el-input-number
              :model-value="Number(row.fee || 0)"
              :min="0"
              :step="0.1"
              :precision="4"
              controls-position="right"
              class="withdraw-chains__number"
              @update:model-value="updateRow(index, { fee: $event })"
            />
          </label>
          <label class="withdraw-chains__cell">
            <span>标识 code</span>
            <el-input :model-value="row.code" placeholder="自动生成" @update:model-value="updateCode(index, $event)" />
          </label>
          <label v-if="(row.networkKey || 'custom') === 'custom'" class="withdraw-chains__cell">
            <span>网络显示名</span>
            <el-input :model-value="row.network" placeholder="如 TRC20 (Tron)" @update:model-value="updateRow(index, { network: $event })" />
          </label>
          <label class="withdraw-chains__cell">
            <span>地址格式</span>
            <el-select :model-value="row.preset" @update:model-value="updateRow(index, { preset: $event })">
              <el-option v-for="preset in presetOptions" :key="preset.value" :label="preset.label" :value="preset.value" />
            </el-select>
          </label>
          <label class="withdraw-chains__cell withdraw-chains__cell--wide">
            <span>区块浏览器交易链接（用英文花括号包住 txid 作为占位）</span>
            <el-input :model-value="row.explorerTx" placeholder="https://tronscan.org/#/transaction/…" @update:model-value="updateRow(index, { explorerTx: $event })" />
          </label>
        </div>
        <div class="withdraw-chains__meta">地址校验：{{ presetHint(row.preset) }}</div>
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
        <el-button size="small" plain>按网络快速添加 ▾</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="item in networkOptions" :key="item.value" :command="item.value">
              {{ item.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <span class="withdraw-chains__tip">选好网络后，地址格式、区块浏览器链接、通道费会自动填好，可再手动微调。</span>
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

.withdraw-chains__number {
  width: 100%;
}

.withdraw-chains__meta {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.withdraw-chains__actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 6px;
}

.withdraw-chains__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.withdraw-chains__tip {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

@media (max-width: 900px) {
  .withdraw-chains__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
