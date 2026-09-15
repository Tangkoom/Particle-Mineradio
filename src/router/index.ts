import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { routes } from 'vue-router/auto-routes'

const whiteListRouter: string[] = ['/login', '/settings']

const filterRoutes: RouteRecordRaw[] = routes.filter((route) => {
  return !whiteListRouter.includes(route.path)
})

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Layout',
      component: () => import('@src/layouts/index.vue'),
      children: [...filterRoutes]
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@src/pages/settings.vue')
    }
  ]
})

export default router
