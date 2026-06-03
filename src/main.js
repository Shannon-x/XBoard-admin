import { createApp } from 'vue'
import ElementPlus, { ElMessage } from 'element-plus'
import { createPinia } from 'pinia'
import App from './App.vue'
import 'element-plus/dist/index.css'
import router from './router'
import { useAuthStore } from './stores/auth'
import { setAuthExpiredHandler } from './services/auth'
import i18n from './i18n'
import './styles.css'

const app = createApp(App)
const pinia = createPinia()

app.use(ElementPlus)
app.use(pinia)
app.use(i18n)

const authStore = useAuthStore()
authStore.initializeAuth()

app.use(router)

// 后端 401/403 时由 services/api.js 派发 signalAuthExpired —— 这里负责真正
// 清会话 + 跳登录页（带回原 URL 作为登录后 redirect）。
setAuthExpiredHandler(() => {
  if (!authStore.isAuthenticated) return
  authStore.logout()
  ElMessage.warning('登录状态已失效，请重新登录')
  const current = router.currentRoute.value
  const redirect = current?.name === 'login' ? undefined : current?.fullPath
  router.push({ name: 'login', query: redirect ? { redirect } : {} })
})

app.mount('#root')
