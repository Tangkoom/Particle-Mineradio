import { createPinia } from 'pinia'
import piniaPlugin from 'pinia-plugin-persistedstate'

const pinia = createPinia()
pinia.use(piniaPlugin)

export default pinia
