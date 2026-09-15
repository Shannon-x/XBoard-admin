<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { fetchManagedNodeGroups } from '../../services/nodes'

const props = defineProps({
  modelValue: Boolean,
  groupId: { type: [String, Number], default: null },
  groups: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])
const inventory = ref([])
const selectedId = ref('')
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const visibility = ref('all')
const activeTab = ref('nodes')
const page = ref(1)
let requestId = 0
const modeLabels = { base: '基础权限组', included: '随套餐包含', optional: '可选购增值组' }
const selected = computed(() => inventory.value.find(group => group.id === selectedId.value))
const filteredNodes = computed(() => {
  const word = keyword.value.trim().toLowerCase()
  return (selected.value?.nodes || []).filter(node =>
    (visibility.value === 'all' || node.show === (visibility.value === 'visible')) &&
    (!word || `${node.id} ${node.name} ${node.type}`.toLowerCase().includes(word)))
})
const pageNodes = computed(() => filteredNodes.value.slice((page.value - 1) * 10, page.value * 10))

async function loadDetails() {
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  inventory.value = []
  try {
    const result = await fetchManagedNodeGroups({ includeDetails: true })
    if (currentRequest !== requestId) return
    inventory.value = result
    if (result.some(group => !group.detailsAvailable)) {
      error.value = '当前服务端未提供权限组明细，请更新后端后重试。'
    }
  } catch {
    if (currentRequest === requestId) error.value = '加载权限组明细失败，请刷新重试。'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

watch(() => [props.modelValue, props.groupId], ([visible, id]) => {
  if (!visible) { requestId++; loading.value = false; return }
  selectedId.value = String(id ?? '')
  activeTab.value = 'nodes'
  error.value = ''
  if (props.groups.length && props.groups.every(group => group.detailsAvailable)) {
    inventory.value = props.groups
  } else {
    loadDetails()
  }
}, { immediate: true })
watch(selectedId, () => { keyword.value = ''; visibility.value = 'all'; page.value = 1 })
watch([keyword, visibility], () => { page.value = 1 })
onBeforeUnmount(() => { requestId++ })
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="权限组节点与关联套餐"
    width="min(1080px, calc(100vw - 24px))"
    append-to-body
    destroy-on-close
    class="group-details-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading" class="group-details">
      <div class="group-details-toolbar">
        <el-select
          v-model="selectedId"
          filterable
          aria-label="选择查看的权限组"
          placeholder="选择查看的权限组"
          class="group-details-selector"
        >
          <el-option
            v-for="group in inventory"
            :key="group.id"
            :label="`#${group.id} ${group.name}`"
            :value="group.id"
          />
        </el-select>
        <el-button :loading="loading" @click="loadDetails">刷新明细</el-button>
      </div>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <template v-else-if="selected?.detailsAvailable">
        <div class="group-details-summary">
          <strong>#{{ selected.id }} {{ selected.name }}</strong>
          <span>共 {{ selected.serverCount }} 个节点 · 显示 {{ selected.visibleServerCount }} · 隐藏 {{ selected.serverCount - selected.visibleServerCount }}</span>
          <router-link
            :to="{ name: 'nodes', query: { group_id: selected.id } }"
            target="_blank"
            rel="noopener"
          >管理本组节点 ↗</router-link>
        </div>
        <el-tabs v-model="activeTab">
          <el-tab-pane :label="`节点明细（${selected.serverCount}）`" name="nodes">
            <div class="group-details-toolbar">
              <el-input
                v-model="keyword"
                placeholder="搜索节点名称、ID 或协议"
                aria-label="搜索组内节点"
                clearable
                class="group-node-search"
              />
              <el-radio-group v-model="visibility" aria-label="节点显示状态">
                <el-radio-button value="all">全部</el-radio-button>
                <el-radio-button value="visible">显示</el-radio-button>
                <el-radio-button value="hidden">隐藏</el-radio-button>
              </el-radio-group>
            </div>
            <el-table :data="pageNodes" empty-text="没有符合条件的节点" class="group-node-table">
              <el-table-column label="ID" prop="id" width="70" />
              <el-table-column label="节点名称" min-width="220">
                <template #default="{ row }">
                  <router-link :to="{ name: 'nodes', query: { node_id: row.id } }" target="_blank" rel="noopener">{{ row.name }} ↗</router-link>
                </template>
              </el-table-column>
              <el-table-column label="协议" prop="type" width="110" />
              <el-table-column label="倍率" prop="rate" width="75" />
              <el-table-column label="显示状态" width="95">
                <template #default="{ row }">
                  <el-tag :type="row.show ? 'success' : 'info'" size="small">{{ row.show ? '显示' : '隐藏' }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
            <div class="group-detail-cards">
              <article v-for="node in pageNodes" :key="node.id" class="group-detail-card">
                <router-link :to="{ name: 'nodes', query: { node_id: node.id } }" target="_blank" rel="noopener">{{ node.name }} ↗</router-link>
                <div class="group-card-meta">
                  <span>#{{ node.id }}</span><span>{{ node.type }}</span><span>{{ node.rate }}</span>
                  <el-tag :type="node.show ? 'success' : 'info'" size="small">{{ node.show ? '显示' : '隐藏' }}</el-tag>
                </div>
              </article>
              <el-empty v-if="!pageNodes.length" description="没有符合条件的节点" :image-size="60" />
            </div>
            <el-pagination
              v-if="filteredNodes.length > 10"
              v-model:current-page="page"
              :page-size="10"
              :total="filteredNodes.length"
              layout="prev, pager, next"
              :pager-count="5"
              class="group-details-pagination"
            />
            <p class="group-details-note">隐藏节点仍属于本组，但不会出现在用户订阅列表中。这里的筛选只影响当前列表展示。</p>
          </el-tab-pane>
          <el-tab-pane :label="`关联套餐（${selected.plans.length}）`" name="plans">
            <el-table :data="selected.plans" empty-text="没有套餐将本组设为基础组、包含组或可选购增值组" class="group-plan-table">
              <el-table-column label="套餐" min-width="200">
                <template #default="{ row }">
                  <router-link :to="{ name: 'plans', query: { plan_id: row.id } }" target="_blank" rel="noopener">#{{ row.id }} {{ row.name }} ↗</router-link>
                </template>
              </el-table-column>
              <el-table-column label="关联方式" min-width="135">
                <template #default="{ row }"><el-tag size="small">{{ modeLabels[row.mode] || row.mode }}</el-tag></template>
              </el-table-column>
              <el-table-column label="用户看到的增值组名" min-width="180">
                <template #default="{ row }">{{ row.mode === 'base' ? '—' : row.label || selected.name }}</template>
              </el-table-column>
              <el-table-column label="线路月费" width="105">
                <template #default="{ row }">{{ row.mode === 'optional' ? `¥${(row.price / 100).toFixed(2)}` : '已包含' }}</template>
              </el-table-column>
              <el-table-column label="套餐状态" width="100">
                <template #default="{ row }">{{ !row.show ? '隐藏' : !row.sell ? '停售' : '显示 / 可售' }}</template>
              </el-table-column>
            </el-table>
            <div class="group-detail-cards">
              <article v-for="plan in selected.plans" :key="`${plan.id}-${plan.mode}`" class="group-detail-card">
                <router-link :to="{ name: 'plans', query: { plan_id: plan.id } }" target="_blank" rel="noopener">#{{ plan.id }} {{ plan.name }} ↗</router-link>
                <div class="group-card-meta">
                  <el-tag size="small">{{ modeLabels[plan.mode] }}</el-tag>
                  <span>{{ plan.mode === 'optional' ? `¥${(plan.price / 100).toFixed(2)} / 月` : '已包含' }}</span>
                  <span>{{ !plan.show ? '隐藏' : !plan.sell ? '停售' : '显示 / 可售' }}</span>
                </div>
                <p v-if="plan.mode !== 'base'" class="group-details-note">用户展示名：{{ plan.label || selected.name }}</p>
              </article>
              <el-empty v-if="!selected.plans.length" description="无套餐直接关联" :image-size="60" />
            </div>
            <p v-if="selected.pricingPlanCount" class="group-details-note">另有 {{ selected.pricingPlanCount }} 个套餐引用本组的历史授权流量计价规则。仅计价不会授予节点权限，也不代表该套餐可选购本组。</p>
            <p class="group-details-note">管理员单独授予和历史已购权限仍按用户原有授权生效，不计入上述套餐关联。</p>
          </el-tab-pane>
        </el-tabs>
      </template>
      <el-empty v-else-if="!loading && !error" description="该权限组不存在，请重新选择或刷新" />
    </div>
    <template #footer><el-button @click="emit('update:modelValue', false)">关闭</el-button></template>
  </el-dialog>
</template>

<style scoped>
.group-details { min-height: 180px; }
.group-details-toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px; }
.group-details-selector { flex: 1; min-width: 180px; }
.group-node-search { width: 300px; max-width: 100%; }
.group-details-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; margin: 16px 0; }
.group-details-summary strong { color: var(--el-text-color-primary); overflow-wrap: anywhere; }
.group-details-summary span, .group-details-note { color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.7; }
.group-details a { color: var(--el-color-primary); text-decoration: none; overflow-wrap: anywhere; }
.group-details a:hover { text-decoration: underline; }
.group-details-pagination { margin-top: 12px; justify-content: flex-end; }
.group-detail-cards { display: none; }
@media (max-width: 600px) {
  .group-details-selector, .group-node-search { width: 100%; flex-basis: 100%; }
  .group-details-pagination { justify-content: center; }
  .group-node-table, .group-plan-table { display: none; }
  .group-detail-cards { display: grid; gap: 10px; }
  .group-detail-card { border: 1px solid var(--el-border-color-lighter); border-radius: 8px; padding: 12px; line-height: 1.7; }
  .group-card-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 8px; color: var(--el-text-color-secondary); font-size: 12px; }
  .group-card-meta span { white-space: nowrap; }
}
</style>
