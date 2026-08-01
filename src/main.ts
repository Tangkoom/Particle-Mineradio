import { createApp } from 'vue'
import App from './App.vue'
import { createI18n } from 'vue-i18n'
import router from './router'
import './styles/theme.scss'
import './styles/index.css'
import './styles/index.scss'

const message: Record<string, any> = {
  en: {
    hello: 'Hello'
  },
  zhCn: {
    hello: '你好'
  }
}

const i18n = createI18n({
  legacy: false,
  locale: 'zh-cn',
  availableLocales: ['en', 'zh-cn'],
  message
})

i18n.global.locale.value = 'zh-cn'

createApp(App).use(i18n).use(router).mount('#app')
