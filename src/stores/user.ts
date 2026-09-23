import { defineStore } from 'pinia'
import type { NeteaseProfile, NeteasePlaylist } from '@src/utils/netease'

export const useUserStore = defineStore('user', {
  state: () => ({
    borderRadius: '15px' as string,
    profile: null as NeteaseProfile | null,
    playlists: [] as NeteasePlaylist[],
    theme: 1 as number
  }),
  getters: {
    isLoggedIn: (state): boolean => state.profile !== null
  },
  actions: {
    setProfile(profile: NeteaseProfile): void {
      this.profile = profile
    },
    setPlaylists(playlists: NeteasePlaylist[]): void {
      this.playlists = playlists
    },
    clearProfile(): void {
      this.profile = null
      this.playlists = []
    },
    logout(): void {
      this.profile = null
      this.playlists = []
    }
  },
  persist: {
    pick: ['profile', 'playlists', 'theme'],
    storage: localStorage
  }
})
