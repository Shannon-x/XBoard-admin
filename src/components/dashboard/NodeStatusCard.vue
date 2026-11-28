<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight } from 'lucide-vue-next'

import { formatAgo, formatCount } from './dashboardFormat'

/** 节点在线情况（原「系统状态」卡的下半截，单独成卡，和「订阅与续费」并排） */
const props = defineProps({
  nodes: { type: Object, required: true },
  loading: { type: Boolean, default: false },
})

const router = useRouter()

const onlineRatio = computed(function onlineRatio() {
  const shown = props.nodes.shown
  return shown ? Math.round((props.nodes.online / shown) * 1000) / 10 : 0
})

function goOffline() {
  router.push({ name: 'nodes', query: { status: '0' } })
}
</script>

<template>
  <el-card v-loading="loading" class="section-card dash-nodes" shadow="never">
    <div class="dash-nodes__head">
      <div>
        <h3>节点</h3>
        <p>
          显示中的节点在线情况<template v-if="nodes.hidden">，另有 {{ formatCount(nodes.hidden) }} 个未显示</template>
        </p>
      </div>
      <el-button size="small" plain @click="router.push({ name: 'nodes' })">
        节点管理 <ArrowRight :size="13" style="margin-left: 2px" />
      </el-button>
    </div>

    <div class="dash-nodes__summary">
      <strong>{{ formatCount(nodes.online) }}<small> / {{ formatCount(nodes.shown) }} 在线</small></strong>
      <span :class="{ 'is-warn': nodes.offline > 0 }">
        {{ nodes.offline > 0 ? `${formatCount(nodes.offline)} 个离线` : '全部在线' }}
      </span>
    </div>
    <div class="dash-nodes__bar" role="presentation">
      <i :style="{ width: `${onlineRatio}%` }" />
    </div>

    <span class="dash-nodes__section-title">离线节点</span>
    <ul v-if="nodes.offlineList.length" class="dash-nodes__offline">
      <li v-for="node in nodes.offlineList" :key="node.id" @click="goOffline">
        <span :title="node.name">{{ node.name }}</span>
        <span>最后上报 {{ formatAgo(node.lastCheckAt) }}</span>
      </li>
      <li v-if="nodes.offline > nodes.offlineList.length" class="dash-nodes__more" @click="goOffline">
        还有 {{ formatCount(nodes.offline - nodes.offlineList.length) }} 个离线节点 <ArrowRight :size="12" />
      </li>
    </ul>
    <p v-else class="dash-nodes__muted">没有离线节点</p>
  </el-card>
</template>

<style scoped>
.dash-nodes :deep(.el-card__body) {
  padding: 18px 20px;
}

.dash-nodes__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.dash-nodes__head h3 {
  margin: 0;
  font-size: 17px;
}

.dash-nodes__head p {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 12.5px;
}

.dash-nodes__summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}

.dash-nodes__summary strong {
  color: var(--text);
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.dash-nodes__summary strong small {
  margin-left: 4px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}

.dash-nodes__summary span {
  color: var(--success);
  font-size: 13px;
  font-weight: 600;
}

.dash-nodes__summary span.is-warn {
  color: var(--primary-strong);
}

.dash-nodes__bar {
  height: 6px;
  margin: 8px 0 16px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--panel-strong);
}

.dash-nodes__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--success);
}

.dash-nodes__section-title {
  display: block;
  margin-bottom: 6px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

.dash-nodes__offline {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dash-nodes__offline li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
}

.dash-nodes__offline li:hover {
  background: var(--panel-strong);
}

.dash-nodes__offline li span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dash-nodes__offline li span:last-child {
  flex: none;
  color: var(--muted);
  font-size: 12px;
}

.dash-nodes__more {
  color: var(--muted);
}

.dash-nodes__muted {
  margin: 0;
  color: var(--muted);
  font-size: 12.5px;
}
</style>
