import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type UserConfigExport } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import eslintPlugin from 'vite-plugin-eslint2'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import RekaResolver from 'reka-ui/resolver'
import vueRouter from 'vue-router/vite'

const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default (): UserConfigExport => {
  return defineConfig({
    plugins: [
      vue(),
      eslintPlugin({
        fix: true
      }),
      tailwindcss(),
      AutoImport({
        dts: 'src/types/auto-imports.d.ts',
        imports: ['vue', 'vue-router'],
        resolvers: [RekaResolver()]
      }),
      Components({
        dts: 'src/types/components.d.ts',
        resolvers: [RekaResolver()]
      }),
      // 自动导入路由组件
      vueRouter({
        dts: 'src/types/route-map.d.ts'
      })
    ],
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: 'ws',
            host,
            port: 1421
          }
        : undefined,
      watch: {
        ignored: ['**/src-tauri/**']
      }
    },
    resolve: {
      alias: {
        '@src': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  })
}
