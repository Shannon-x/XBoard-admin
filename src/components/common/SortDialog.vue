<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: Boolean,
  items: Array, // Array of { id, name }
  title: { type: String, default: '排序' }
})
const emit = defineEmits(['update:visible', 'save'])

const sortList = ref([])

watch(
  () => props.visible,
  (val) => {
    if (val) {
      sortList.value = JSON.parse(JSON.stringify(props.items))
    }
  }
)

function moveUp(index) {
  if (index > 0) {
    const temp = sortList.value[index - 1]
    sortList.value[index - 1] = sortList.value[index]
    sortList.value[index] = temp
  }
}

function moveDown(index) {
  if (index < sortList.value.length - 1) {
    const temp = sortList.value[index + 1]
    sortList.value[index + 1] = sortList.value[index]
    sortList.value[index] = temp
  }
}

function handleSave() {
  const ids = sortList.value.map(item => item.id)
  emit('save', ids)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="480px"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div v-if="sortList.length === 0" style="text-align: center; color: var(--el-text-color-secondary)">暂无数据</div>
    <div v-else class="sort-list">
      <div v-for="(item, index) in sortList" :key="item.id" class="sort-item">
        <div class="sort-item__name">{{ item.name }}</div>
        <div class="sort-item__actions">
          <el-button size="small" :disabled="index === 0" @click="moveUp(index)">
            ↑
          </el-button>
          <el-button size="small" :disabled="index === sortList.length - 1" @click="moveDown(index)">
            ↓
          </el-button>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="handleSave">保存排序</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.sort-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}
.sort-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--panel-strong);
}
.sort-item__name {
  font-size: 14px;
  color: var(--text);
  font-weight: 500;
}
.sort-item__actions {
  display: flex;
  gap: 4px;
}
</style>
