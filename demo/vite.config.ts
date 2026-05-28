import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

import { name } from '../package.json'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: `/${name}`,
  server: {
    // port: 1234,
    host: '0.0.0.0'
  },
  build: {
    outDir: `dist_${name}`
  }
})
