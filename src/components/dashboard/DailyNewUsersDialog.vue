<script setup>
import { computed, ref, watch } from "vue"
import { RefreshCw } from "lucide-vue-next"
import { fetchUserRegisterRecords } from "../../services/dashboard"

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(["update:modelValue"])

const rangeOptions = [
  { label: "近 7 天", value: 7 },
  { label: "近 14 天", value: 14 },
  { label: "近 30 天", value: 30 },
  { label: "近 90 天", value: 90 },
]

const activeRange = ref(30)
const loading = ref(false)
const errorMsg = ref("")
const records = ref([])

const dialogVisible = computed({
  get() {
    return props.modelValue
  },
  set(value) {
    emit("update:modelValue", value)
  },
})

const maxCount = computed(function resolveMax() {
  return records.value.reduce(function pickMax(acc, item) {
    return item.count > acc ? item.count : acc
  }, 0)
})

const totalCount = computed(function resolveTotal() {
  return records.value.reduce(function sum(acc, item) {
    return acc + item.count
  }, 0)
})

const avgCount = computed(function resolveAvg() {
  if (records.value.length === 0) return 0
  return totalCount.value / records.value.length
})

async function loadRecords() {
  loading.value = true
  errorMsg.value = ""
  try {
    const result = await fetchUserRegisterRecords({ days: activeRange.value })
    records.value = result.list
  } catch (err) {
    errorMsg.value = err?.message || "加载失败"
    records.value = []
  } finally {
    loading.value = false
  }
}

function barHeight(count) {
  if (!maxCount.value) return "2%"
  const percent = (count / maxCount.value) * 100
  return `${Math.max(percent, 2)}%`
}

watch(
  function watchVisible() {
    return props.modelValue
  },
  function onVisible(visible) {
    if (visible) {
      loadRecords()
    }
  },
)

function handleRangeChange(value) {
  activeRange.value = value
  loadRecords()
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="每日新增用户"
    width="720px"
    destroy-on-close
  >
    <div class="daily-users-toolbar">
      <el-segmented
        :model-value="activeRange"
        :options="rangeOptions"
        size="small"
        @change="handleRangeChange"
      />
      <el-button :icon="RefreshCw" size="small" plain @click="loadRecords">
        刷新
      </el-button>
    </div>

    <el-alert
      v-if="errorMsg"
      :title="errorMsg"
      type="error"
      :closable="false"
      style="margin-bottom: 12px"
    />

    <div v-loading="loading" class="daily-users-body">
      <div class="daily-users-summary">
        <div class="daily-users-summary-item">
          <span class="daily-users-summary-label">区间合计</span>
          <strong class="daily-users-summary-value">{{ totalCount }}</strong>
        </div>
        <div class="daily-users-summary-item">
          <span class="daily-users-summary-label">日均</span>
          <strong class="daily-users-summary-value">{{ avgCount.toFixed(1) }}</strong>
        </div>
        <div class="daily-users-summary-item">
          <span class="daily-users-summary-label">峰值</span>
          <strong class="daily-users-summary-value">{{ maxCount }}</strong>
        </div>
      </div>

      <div v-if="records.length" class="daily-users-chart">
        <div
          v-for="item in records"
          :key="item.recordAt"
          class="daily-users-bar-wrap"
        >
          <el-tooltip
            :content="`${item.fullDate} · ${item.count} 人`"
            placement="top"
            :show-after="200"
          >
            <div class="daily-users-bar-track">
              <span
                class="daily-users-bar-fill"
                :style="{ height: barHeight(item.count) }"
              ></span>
            </div>
          </el-tooltip>
          <span class="daily-users-bar-label">{{ item.dateLabel }}</span>
        </div>
      </div>
      <el-empty
        v-else-if="!loading"
        :image-size="64"
        description="该区间内无新增用户数据"
      />

      <el-table
        v-if="records.length"
        :data="[...records].reverse()"
        max-height="240"
        size="small"
        class="daily-users-table"
      >
        <el-table-column label="日期" prop="fullDate" min-width="120" />
        <el-table-column label="新增用户" prop="count" min-width="100" sortable />
      </el-table>
    </div>
  </el-dialog>
</template>

<style scoped>
.daily-users-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 8px;
}

.daily-users-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.daily-users-summary {
  display: flex;
  gap: 12px;
}

.daily-users-summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.daily-users-summary-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.daily-users-summary-value {
  font-size: 18px;
  font-family: "Fira Code", monospace;
  color: var(--el-text-color-primary);
}

.daily-users-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 180px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
  overflow-x: auto;
}

.daily-users-bar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1 0 auto;
  min-width: 18px;
  height: 100%;
}

.daily-users-bar-track {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  cursor: pointer;
}

.daily-users-bar-fill {
  width: 70%;
  min-height: 2px;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(
    to top,
    rgba(201, 79, 46, 0.95),
    rgba(201, 79, 46, 0.6)
  );
  transition: filter 0.2s ease;
}

.daily-users-bar-track:hover .daily-users-bar-fill {
  filter: brightness(1.1);
}

.daily-users-bar-label {
  font-size: 10px;
  color: var(--el-text-color-secondary);
  font-family: "Fira Code", monospace;
  white-space: nowrap;
}

.daily-users-table {
  border-radius: 8px;
}
</style>
