import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vite 8 + rolldown：manualChunks 必须是函数形式
function chunkFor(id) {
  if (!id.includes('node_modules')) return undefined
  if (id.includes('monaco-editor') || id.includes('@monaco-editor/loader')) return 'vendor-editor'
  if (id.includes('md-editor-v3') || id.includes('/marked/') || id.includes('dompurify')) return 'vendor-editor'
  if (id.includes('element-plus') || id.includes('@element-plus')) return 'vendor-element'
  if (id.includes('/vue-router/') || id.includes('/pinia/') || id.includes('/vue-i18n/')) return 'vendor-vue'
  if (id.includes('/vue/dist/') || id.includes('/@vue/')) return 'vendor-vue'
  if (id.includes('sortablejs') || id.includes('lucide-vue-next') || id.includes('tweetnacl')) return 'vendor-misc'
  return 'vendor'
}

export default defineConfig({
  plugins: [vue()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: chunkFor,
      },
    },
  },
})
