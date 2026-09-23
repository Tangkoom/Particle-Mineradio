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
// 默认 dev 不启用 ESLint（避免每次保存都跑 lint + fix 触发二次 HMR 拖累 CPU）；
// 显式设置 VITE_ESLINT=true 时才挂载，按需 lint 走 `pnpm lint` 脚本
const enableEslint = process.env.VITE_ESLINT === 'true'

// https://vite.dev/config/
export default (): UserConfigExport => {
  return defineConfig({
    plugins: [
      vue(),
      enableEslint
        ? eslintPlugin({
            fix: true,
            cache: true
          })
        : false,
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
      port: 1421,
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
      // proxy: {
      //   '/openapi': {
      //     // target: 'http://192.168.1.41:8080/api',
      //     target: 'http://openapi.music.163.com/openapi',
      //     changeOrigin: true,
      //     secure: false,
      //     rewrite: (path) => path.replace(/^\/api/, '')
      //   }
      // }
    },
    resolve: {
      alias: {
        '@src': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    build: {
      // 关闭 sourcemap 减小产物体积
      sourcemap: false,
      rollupOptions: {
        output: {
          // 手动分包：three.js 体积大，单独拆分以便浏览器缓存
          manualChunks: {
            three: ['three'],
            vendor: [
              'vue',
              'vue-router',
              'pinia',
              'pinia-plugin-persistedstate'
            ]
          }
        }
      },
      // 产物 chunk 大小警告阈值（默认 500KB），three 单独分包后提升阈值
      chunkSizeWarningLimit: 800
    }
  })
}
