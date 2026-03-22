<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  document.title = '404 Not Found'
})
</script>

<template>
  <div class="not-found">
    <h1>404 Not Found</h1>
    <p>nginx</p>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #f4f5f7;
  color: #333;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  text-align: center;
}
.not-found h1 {
  font-size: 36px;
  font-weight: 500;
  margin-bottom: 16px;
}
.not-found p {
  font-size: 14px;
  color: #666;
}
</style>
