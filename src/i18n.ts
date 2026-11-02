import { createI18n } from 'vue-i18n'
import messages from '@src/layouts/lang.json'

/**
 * 语言包以「中文原文」作为 key（见 src/layouts/lang.json），
 * 因此 zh 词条既是翻译也是兜底值，缺失时 t() 会原样返回中文 key。
 */
export type AppLocale = 'zh' | 'en'

export const SUPPORTED_LOCALES: AppLocale[] = ['zh', 'en']

const DEFAULT_LOCALE: AppLocale = 'zh'

const isSupportedLocale = (value: string): value is AppLocale =>
  SUPPORTED_LOCALES.includes(value as AppLocale)

const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  globalInjection: true, // 启用模板里的 $t
  messages
})

/** 读取当前语言 */
export const getLocale = (): AppLocale => i18n.global.locale.value as AppLocale

/**
 * 切换语言：同时同步 <html lang>，便于字体与无障碍读取跟随语言变化。
 * 非法值会回落到默认语言，避免持久化数据被手改后界面全空。
 */
export const setLocale = (locale: string): AppLocale => {
  const next = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE
  i18n.global.locale.value = next
  document.documentElement.lang = next
  return next
}

export default i18n
