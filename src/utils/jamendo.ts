import type {
  NeteaseLyricLine,
  NeteasePlaylist,
  NeteaseProfile,
  NeteaseSong
} from './netease'

const API_BASE = 'https://api.jamendo.com/v3.0'
const CLIENT_ID_STORAGE_KEY = 'jamendo.clientId'
const TRENDING_PLAYLIST_ID = 0

interface JamendoTrack {
  id?: string
  name?: string
  duration?: number
  artist_name?: string
  album_name?: string
  image?: string
  audio?: string
  audiodownload?: string
}

interface JamendoResponse {
  headers?: { status?: string; code?: number; error_message?: string }
  results?: JamendoTrack[]
}

export const JAMENDO_PROFILE: NeteaseProfile = {
  provider: 'jamendo',
  userId: 0,
  nickname: 'Jamendo',
  avatarUrl: '',
  vipType: 0
}

export const JAMENDO_TRENDING_PLAYLIST: NeteasePlaylist = {
  provider: 'jamendo',
  id: TRENDING_PLAYLIST_ID,
  name: 'Jamendo 热门',
  coverImgUrl: '',
  trackCount: 20,
  playCount: 0
}

/** Jamendo 的 client_id 是公开的应用标识，不是账号密钥 */
export function getJamendoClientId(): string {
  return (
    localStorage.getItem(CLIENT_ID_STORAGE_KEY) ||
    (import.meta.env.VITE_JAMENDO_CLIENT_ID as string | undefined) ||
    ''
  ).trim()
}

export function hasJamendoClientId(): boolean {
  return getJamendoClientId().length > 0
}

export function setJamendoClientId(clientId: string): void {
  const next = clientId.trim()
  if (next) localStorage.setItem(CLIENT_ID_STORAGE_KEY, next)
  else localStorage.removeItem(CLIENT_ID_STORAGE_KEY)
}

function mapTrack(track: JamendoTrack): NeteaseSong | null {
  const id = Number(track.id)
  const audio = track.audio || track.audiodownload || ''
  if (!Number.isFinite(id) || !track.name || !audio) return null
  return {
    provider: 'jamendo',
    id,
    name: track.name,
    artist: track.artist_name || 'Jamendo',
    album: track.album_name || '',
    duration: Math.max(0, Math.round((track.duration ?? 0) * 1000)),
    coverUrl: track.image || '',
    url: audio
  }
}

async function requestTracks(params: Record<string, string>): Promise<NeteaseSong[]> {
  const clientId = getJamendoClientId()
  if (!clientId) throw new Error('JAMENDO_CLIENT_ID_MISSING')

  const query = new URLSearchParams({
    client_id: clientId,
    format: 'json',
    audioformat: 'mp32',
    imagesize: '300',
    include: 'musicinfo',
    ...params
  })
  const response = await fetch(`${API_BASE}/tracks/?${query.toString()}`)
  if (!response.ok) throw new Error(`Jamendo 请求失败（${response.status}）`)

  const body = (await response.json()) as JamendoResponse
  if (body.headers?.status === 'failed') {
    throw new Error(body.headers.error_message || 'Jamendo 请求失败')
  }
  return (body.results ?? [])
    .map(mapTrack)
    .filter((song): song is NeteaseSong => song !== null)
}

export async function loginWithJamendo(): Promise<NeteaseProfile> {
  if (!hasJamendoClientId()) throw new Error('JAMENDO_CLIENT_ID_MISSING')
  return { ...JAMENDO_PROFILE }
}

export async function logoutJamendo(): Promise<void> {
  // Jamendo 是免登录源，没有需要清理的网页登录态
}

export async function fetchJamendoProfile(): Promise<NeteaseProfile> {
  return { ...JAMENDO_PROFILE }
}

export async function searchJamendoSongs(keyword: string): Promise<NeteaseSong[]> {
  const songs = await requestTracks({
    search: keyword,
    limit: '20',
    order: 'popularity_total'
  })
  if (songs.length) return songs
  return requestTracks({
    search: keyword,
    limit: '20'
  })
}

export async function getJamendoTrendingSongs(): Promise<NeteaseSong[]> {
  const songs = await requestTracks({
    limit: '20',
    order: 'popularity_total',
    featured: '1'
  })
  if (songs.length) return songs
  return requestTracks({
    limit: '20',
    order: 'popularity_total'
  })
}

export async function getJamendoUserPlaylists(): Promise<NeteasePlaylist[]> {
  return [{ ...JAMENDO_TRENDING_PLAYLIST }]
}

export async function getJamendoPlaylistSongs(
  playlist: NeteasePlaylist
): Promise<NeteaseSong[]> {
  if (playlist.id === TRENDING_PLAYLIST_ID) return getJamendoTrendingSongs()
  return []
}

export async function getJamendoLyric(): Promise<NeteaseLyricLine[]> {
  return []
}
