import { createApp } from 'vue'
import App from './App.vue'
import i18n, { setLocale } from './i18n'
import router from './router'
import { useUserStore } from './stores/user'

import pinia from './stores'
import './styles/theme.scss'
import './styles/index.css'
import './styles/index.scss'

// src/main.js 或 src/main.ts
if (import.meta.env.PROD) {
  document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement

    // 保留输入框、文本域、可编辑区域的右键（粘贴需要）
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.isContentEditable ||
      target.closest('input, textarea, [contenteditable]') !== null
    ) {
      return
    }

    e.preventDefault()
  })
}

const app = createApp(App)

app.use(i18n).use(router).use(pinia)

// 按持久化的语言设置初始化界面语言（需在 pinia 安装之后读取 store）
setLocale(useUserStore().settings.lang)

app.mount('#app')
