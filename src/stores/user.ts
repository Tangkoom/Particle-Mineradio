import { defineStore } from 'pinia'
import type {
  MusicProvider,
  NeteasePlaylist,
  NeteaseProfile
} from '@src/utils/netease'

interface ProviderAccount {
  profile: NeteaseProfile | null
  playlists: NeteasePlaylist[]
}

const emptyAccount = (): ProviderAccount => ({
  profile: null,
  playlists: []
})

export const useUserStore = defineStore('user', {
  state: () => ({
    borderRadius: '15px' as string,
    activeProvider: 'netease' as MusicProvider,
    accounts: {
      netease: emptyAccount(),
      qq: emptyAccount(),
      jamendo: emptyAccount()
    } as Record<MusicProvider, ProviderAccount>,
    settings: {
      theme: 1 as number,
      exitAction: 0 as number,
      lang: 'zh' as string
    }
  }),
  getters: {
    profile: (state): NeteaseProfile | null =>
      state.accounts[state.activeProvider]?.profile ?? null,
    playlists: (state): NeteasePlaylist[] =>
      state.accounts[state.activeProvider]?.playlists ?? [],
    isLoggedIn(): boolean {
      return this.profile !== null
    },
    accountFor: (state) => {
      return (provider: MusicProvider): ProviderAccount =>
        state.accounts[provider] ?? emptyAccount()
    }
  },
  actions: {
    setActiveProvider(provider: MusicProvider): void {
      this.activeProvider = provider
    },
    setProfile(profile: NeteaseProfile): void {
      const account =
        this.accounts[profile.provider] ??
        (this.accounts[profile.provider] = emptyAccount())
      account.profile = profile
      this.activeProvider = profile.provider
    },
    setPlaylists(playlists: NeteasePlaylist[], provider?: MusicProvider): void {
      const target = provider ?? this.activeProvider
      const account = this.accounts[target] ?? (this.accounts[target] = emptyAccount())
      account.playlists = playlists
    },
    clearProfile(provider?: MusicProvider): void {
      const target = provider ?? this.activeProvider
      const account = this.accounts[target] ?? (this.accounts[target] = emptyAccount())
      account.profile = null
      account.playlists = []
    },
    logout(): void {
      this.clearProfile()
    }
  },
  persist: {
    pick: ['activeProvider', 'accounts', 'settings'],
    storage: localStorage
  }
})
