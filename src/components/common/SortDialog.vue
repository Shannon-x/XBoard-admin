<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import Sortable from 'sortablejs'
import { GripVertical, ArrowUp, ArrowDown } from 'lucide-vue-next'

const props = defineProps({
  visible: Boolean,
  items: Array, // Array of { id, name }
  title: { type: String, default: '排序' },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['update:visible', 'save'])

const sortList = ref([])
const listRef = ref(null)
let sortableInstance = null

watch(
  () => props.visible,
  async (val) => {
    if (val) {
      sortList.value = JSON.parse(JSON.stringify(props.items))
      await nextTick()
      initSortable()
    } else {
      destroySortable()
    }
  }
)

function initSortable() {
  destroySortable()
  if (!listRef.value) return
  sortableInstance = Sortable.create(listRef.value, {
    animation: 200,
    handle: '.sort-item__handle',
    ghostClass: 'sort-item--ghost',
    chosenClass: 'sort-item--chosen',
    dragClass: 'sort-item--drag',
    onEnd(evt) {
      const item = sortList.value.splice(evt.oldIndex, 1)[0]
      sortList.value.splice(evt.newIndex, 0, item)
    },
  })
}

function destroySortable() {
  if (sortableInstance) {
    sortableInstance.destroy()
    sortableInstance = null
  }
}

onBeforeUnmount(destroySortable)

function handleSave() {
  const ids = sortList.value.map(item => item.id)
  emit('save', ids)
}

// 键盘 / 触屏兜底：直接上移下移
function moveUp(index) {
  if (index <= 0) return
  const item = sortList.value.splice(index, 1)[0]
  sortList.value.splice(index - 1, 0, item)
}

function moveDown(index) {
  if (index >= sortList.value.length - 1) return
  const item = sortList.value.splice(index, 1)[0]
  sortList.value.splice(index + 1, 0, item)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="min(480px, calc(100vw - 32px))"
    @update:model-value="$emit('update:visible', $event)"
    destroy-on-close
  >
    <p class="sort-hint">拖动左侧手柄或使用上下箭头按钮调整顺序</p>
    <div v-if="sortList.length === 0" style="text-align: center; color: var(--el-text-color-secondary); padding: 24px 0">暂无数据</div>
    <div v-else ref="listRef" class="sort-list">
      <div v-for="(item, index) in sortList" :key="item.id" class="sort-item">
        <span class="sort-item__handle" title="拖动调整顺序" aria-label="拖动手柄">
          <el-icon><GripVertical /></el-icon>
        </span>
        <span class="sort-item__index">{{ index + 1 }}</span>
        <span class="sort-item__name">{{ item.name }}</span>
        <div class="sort-item__actions">
          <el-button
            link
            size="small"
            :disabled="index === 0"
            aria-label="上移"
            title="上移"
            @click="moveUp(index)"
          >
            <el-icon><ArrowUp /></el-icon>
          </el-button>
          <el-button
            link
            size="small"
            :disabled="index === sortList.length - 1"
            aria-label="下移"
            title="下移"
            @click="moveDown(index)"
          >
            <el-icon><ArrowDown /></el-icon>
          </el-button>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="props.saving" @click="handleSave">保存排序</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.sort-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.sort-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 420px;
  overflow-y: auto;
}
.sort-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  transition: box-shadow 0.15s;
}
.sort-item:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.sort-item__handle {
  cursor: grab;
  display: inline-flex;
  align-items: center;
  font-size: 18px;
  color: var(--el-text-color-placeholder);
  user-select: none;
  line-height: 1;
}
.sort-item__handle:active {
  cursor: grabbing;
}
.sort-item__index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 600;
}
.sort-item__name {
  flex: 1;
  font-size: 14px;
  color: var(--el-text-color-regular);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sort-item__actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.sort-item--ghost {
  opacity: 0.4;
  border-style: dashed;
}
.sort-item--chosen {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.sort-item--drag {
  opacity: 0.9;
}
</style>
