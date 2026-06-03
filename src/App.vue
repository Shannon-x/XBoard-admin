<script setup>
import { onErrorCaptured, ref } from 'vue'
import { ElButton, ElMessage } from 'element-plus'

// 全局错误边界：捕获子组件渲染/setup 抛错，避免整张管理后台白屏。
// 业务异常（fetch 失败等）应被各自 try/catch 处理，到这里说明是漏网之鱼。
const fatalError = ref(null)

onErrorCaptured(function captureRenderError(err, _instance, info) {
  // 不让 401 之类的业务 throw 把整页打挂；只截『渲染期 / 生命周期』未捕获错误。
  // eslint-disable-next-line no-console
  console.error('[App] unhandled error', err, info)
  fatalError.value = {
    message: err?.message || String(err) || '未知错误',
    info,
  }
  return false // 阻止继续向上冒泡
})

function reload() {
  window.location.reload()
}

function dismiss() {
  fatalError.value = null
  ElMessage.warning('已忽略错误，部分功能可能不可用，建议刷新页面')
}
</script>

<template>
  <div v-if="fatalError" class="app-fatal-error">
    <div class="app-fatal-error__panel">
      <h2 class="app-fatal-error__title">页面遇到了错误</h2>
      <p class="app-fatal-error__msg">{{ fatalError.message }}</p>
      <p v-if="fatalError.info" class="app-fatal-error__info">位置：{{ fatalError.info }}</p>
      <div class="app-fatal-error__actions">
        <ElButton type="primary" @click="reload">刷新页面</ElButton>
        <ElButton @click="dismiss">忽略并继续</ElButton>
      </div>
    </div>
  </div>
  <router-view v-else />
</template>

<style scoped>
.app-fatal-error {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  z-index: 9999;
}

.app-fatal-error__panel {
  background: var(--el-bg-color, #fff);
  padding: 32px 36px;
  border-radius: 12px;
  max-width: 520px;
  width: calc(100% - 32px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
}

.app-fatal-error__title {
  margin: 0 0 12px;
  font-size: 18px;
  color: var(--el-color-danger, #f56c6c);
}

.app-fatal-error__msg {
  font-size: 14px;
  color: var(--el-text-color-primary, #303133);
  word-break: break-word;
  margin: 0 0 8px;
}

.app-fatal-error__info {
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  margin: 0 0 20px;
}

.app-fatal-error__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
