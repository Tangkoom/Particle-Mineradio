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
import {
  fetchJamendoProfile,
  getJamendoLyric,
  getJamendoPlaylistSongs,
  getJamendoTrendingSongs,
  getJamendoUserPlaylists,
  loginWithJamendo,
  logoutJamendo,
  searchJamendoSongs
} from './jamendo'

export type { MusicProvider }

export function activeProvider(): MusicProvider {
  return useUserStore().activeProvider
}

export async function ensureActiveBridge(): Promise<void> {
  if (activeProvider() === 'qq') {
    await ensureQQBridge()
  } else if (activeProvider() === 'netease') {
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
      target === 'qq'
        ? await fetchQQProfile()
        : target === 'jamendo'
          ? await fetchJamendoProfile()
          : await fetchProfile()
    if (profile) store.setProfile(profile)
  } catch {
    // 登录态暂不可用时保留已持久化的资料
  }
}

export function loginWithProvider(
  provider: MusicProvider
): Promise<NeteaseProfile> {
  if (provider === 'qq') return loginWithQQ()
  if (provider === 'jamendo') return loginWithJamendo()
  return loginWithNetease()
}

export function logoutProvider(provider: MusicProvider): Promise<void> {
  if (provider === 'qq') return logoutQQ()
  if (provider === 'jamendo') return logoutJamendo()
  return logoutNetease()
}

export function searchActiveSongs(keyword: string): Promise<NeteaseSong[]> {
  const provider = activeProvider()
  if (provider === 'qq') return searchQQSongs(keyword)
  if (provider === 'jamendo') return searchJamendoSongs(keyword)
  return searchSongs(keyword)
}

export function getActiveSongUrl(
  song: NeteaseSong,
  quality: NeteaseQuality
): Promise<string> {
  if (song.provider === 'qq') return getQQSongUrl(song, quality)
  if (song.provider === 'jamendo') {
    return song.url
      ? Promise.resolve(song.url)
      : Promise.reject(new Error('Jamendo 歌曲缺少播放地址'))
  }
  return getSongUrl(song.id, quality)
}

export function getActiveUserPlaylists(
  uid?: number
): Promise<NeteasePlaylist[]> {
  const provider = activeProvider()
  if (provider === 'qq') return getQQUserPlaylists()
  if (provider === 'jamendo') return getJamendoUserPlaylists()
  if (!uid) return Promise.resolve([])
  return getUserPlaylists(uid)
}

export function getActivePlaylistSongs(
  playlist: NeteasePlaylist
): Promise<NeteaseSong[]> {
  if (playlist.provider === 'qq') return getQQPlaylistSongs(playlist)
  if (playlist.provider === 'jamendo') return getJamendoPlaylistSongs(playlist)
  return getPlaylistSongs(playlist.id)
}

export function getActiveDailySongs(): Promise<NeteaseSong[]> {
  const provider = activeProvider()
  if (provider === 'qq') return getQQDailySongs()
  if (provider === 'jamendo') return getJamendoTrendingSongs()
  return getDailySongs()
}

export function getActiveRecentSongs(): Promise<NeteaseSong[]> {
  const provider = activeProvider()
  if (provider === 'qq') return getQQRecentSongs()
  if (provider === 'jamendo') return getJamendoTrendingSongs()
  const uid = useUserStore().profile?.userId
  return uid ? getRecentSongs(uid) : Promise.resolve([])
}

export function getActiveLyric(song: NeteaseSong): Promise<NeteaseLyricLine[]> {
  if (song.provider === 'qq') return getQQLyric(song)
  if (song.provider === 'jamendo') return getJamendoLyric()
  return getLyric(song.id)
}
