import { useUserStore } from '@src/stores/user'
import {
  ensureBridge,
  fetchProfile,
  getDailySongs,
  getLyric,
  getPlaylistSongs,
  getRecentSongs,
  getSongUrl,
  getUserPlaylists,
  loginWithNetease,
  logoutNetease,
  searchSongs,
  type MusicProvider,
  type NeteaseLyricLine,
  type NeteasePlaylist,
  type NeteaseProfile,
  type NeteaseQuality,
  type NeteaseSong
} from './netease'
import {
  ensureQQBridge,
  fetchQQProfile,
  getQQDailySongs,
  getQQPlaylistSongs,
  getQQRecentSongs,
  getQQSongUrl,
  getQQUserPlaylists,
  getQQLyric,
  loginWithQQ,
  logoutQQ,
  searchQQSongs
} from './qq'

export type { MusicProvider }

export function activeProvider(): MusicProvider {
  return useUserStore().activeProvider
}

export async function ensureActiveBridge(): Promise<void> {
  if (activeProvider() === 'qq') {
    await ensureQQBridge()
  } else {
    await ensureBridge()
  }
}

/** 重新拉取当前活动账号资料，失败时保留旧资料 */
export async function refreshActiveProfile(
  provider?: MusicProvider
): Promise<void> {
  const store = useUserStore()
  const target = provider ?? store.activeProvider
  try {
    const profile =
      target === 'qq' ? await fetchQQProfile() : await fetchProfile()
    if (profile) store.setProfile(profile)
  } catch {
    // 登录态暂不可用时保留已持久化的资料
  }
}

export function loginWithProvider(
  provider: MusicProvider
): Promise<NeteaseProfile> {
  return provider === 'qq' ? loginWithQQ() : loginWithNetease()
}

export function logoutProvider(provider: MusicProvider): Promise<void> {
  return provider === 'qq' ? logoutQQ() : logoutNetease()
}

export function searchActiveSongs(keyword: string): Promise<NeteaseSong[]> {
  return activeProvider() === 'qq' ? searchQQSongs(keyword) : searchSongs(keyword)
}

export function getActiveSongUrl(
  song: NeteaseSong,
  quality: NeteaseQuality
): Promise<string> {
  if (song.provider === 'qq') return getQQSongUrl(song, quality)
  return getSongUrl(song.id, quality)
}

export function getActiveUserPlaylists(
  uid?: number
): Promise<NeteasePlaylist[]> {
  if (activeProvider() === 'qq') return getQQUserPlaylists()
  if (!uid) return Promise.resolve([])
  return getUserPlaylists(uid)
}

export function getActivePlaylistSongs(
  playlist: NeteasePlaylist
): Promise<NeteaseSong[]> {
  if (playlist.provider === 'qq') return getQQPlaylistSongs(playlist)
  return getPlaylistSongs(playlist.id)
}

export function getActiveDailySongs(): Promise<NeteaseSong[]> {
  return activeProvider() === 'qq' ? getQQDailySongs() : getDailySongs()
}

export function getActiveRecentSongs(): Promise<NeteaseSong[]> {
  if (activeProvider() === 'qq') return getQQRecentSongs()
  const uid = useUserStore().profile?.userId
  return uid ? getRecentSongs(uid) : Promise.resolve([])
}

export function getActiveLyric(song: NeteaseSong): Promise<NeteaseLyricLine[]> {
  if (song.provider === 'qq') return getQQLyric(song)
  return getLyric(song.id)
}
