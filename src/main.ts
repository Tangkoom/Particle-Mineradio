import { createApp } from 'vue'
import App from './App.vue'
import i18n, { setLocale } from './i18n'
import router from './router'
import { useUserStore } from './stores/user'

import pinia from './stores'
import './styles/theme.scss'
import './styles/index.css'
import './styles/index.scss'

const app = createApp(App)

app.use(i18n).use(router).use(pinia)

// 按持久化的语言设置初始化界面语言（需在 pinia 安装之后读取 store）
setLocale(useUserStore().settings.lang)

app.mount('#app')
