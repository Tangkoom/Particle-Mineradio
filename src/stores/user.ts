import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    borderRadius: '15px' as string
  }),
  actions: {
    logout() {}
  },
  persist: {
    pick: undefined,
    storage: localStorage
  }
})
