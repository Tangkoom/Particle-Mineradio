import { createApp } from 'vue'

import './styles/theme.scss'
import './styles/index.css'
import './styles/index.scss'

const hash = window.location.hash.trim()
const isTray = hash.startsWith('#__tray')
const isSetup = hash.startsWith('#__setup')

if (import.meta.env.PROD) {
  window.addEventListener('contextmenu', (event) => {
    const target = event.target as HTMLElement | null
    if (!target) return
    if (target.closest('input, textarea, [contenteditable="true"]')) return
    event.preventDefault()
  })
}

async function bootstrap(): Promise<void> {
  // 托盘面板与安装界面是独立窗口，不能初始化 router / i18n / pinia。
  if (isTray) {
    document.documentElement.classList.add('app-tray')
    const { default: TrayPanel } = await import('./tray/index.vue')
    createApp(TrayPanel).mount('#app')
    return
  }

  if (isSetup) {
    document.documentElement.classList.add('app-setup')
    const { default: Setup } = await import('./setup/index.vue')
    createApp(Setup).mount('#app')
    return
  }

  const [
    { default: App },
    i18nModule,
    { default: router },
    { default: pinia },
    { useUserStore }
  ] = await Promise.all([
    import('./App.vue'),
    import('./i18n'),
    import('./router'),
    import('./stores'),
    import('./stores/user')
  ])

  const app = createApp(App)
  app.use(i18nModule.default)
  app.use(router)
  app.use(pinia)
  i18nModule.setLocale(useUserStore().settings.lang)
  app.mount('#app')
}

void bootstrap()
