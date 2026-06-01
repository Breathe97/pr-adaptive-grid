import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import vue from '@vitejs/plugin-vue'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

export default defineConfig({
  plugins: [
    vue(),
    dts({ insertTypesEntry: true }),
    // 库模式：将 CSS 注入 JS，使用者 import 组件即可自动生效，无需单独 import css
    cssInjectedByJsPlugin({
      topExecutionPriority: true
    })
  ],
  build: {
    cssCodeSplit: false,
    lib: {
      entry: 'src/index.ts',
      name: 'pr-adaptive-grid',
      fileName: 'index'
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    }
  }
})
