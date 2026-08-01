import {
  createRouter,
  createWebHashHistory,
  type RouteRecordRaw
} from 'vue-router'
import { routes } from 'vue-router/auto-routes'

const whiteListRouter: string[] = ['/login', '/404', '/home']

const filterRoutes: RouteRecordRaw[] = routes.filter((route) => {
  return !whiteListRouter.includes(route.path)
})

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'Layout',
      component: () => import('@src/layouts/index.vue'),
      children: [...filterRoutes]
    }
  ]
})

export default router
