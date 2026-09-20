import { defineStore } from 'pinia'
import type { NeteaseProfile } from '@src/utils/netease'

export const useUserStore = defineStore('user', {
  state: () => ({
    borderRadius: '15px' as string,
    profile: null as NeteaseProfile | null
  }),
  getters: {
    isLoggedIn: (state): boolean => state.profile !== null
  },
  actions: {
    setProfile(profile: NeteaseProfile): void {
      this.profile = profile
    },
    clearProfile(): void {
      this.profile = null
    },
    logout() {
      this.profile = null
    }
  },
  persist: {
    pick: ['profile'],
    storage: localStorage
  }
})
