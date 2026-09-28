import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import createWindow from './createWindow'

/**
 * 网易云音乐登录 / 接口桥接
 *
 * 关键点：登录后的 MUSIC_U 是 HttpOnly Cookie，页面 JS（document.cookie）
 * 与主窗口都无法直接读取。因此在网易云同源页面上下文里发起 fetch，
 * Cookie 会由 WebView2 自动携带，再把响应通过 Tauri 事件回传主窗口。
 *
 * 登录窗口关闭后，保留一个不可见的「桥接窗口」(https://music.163.com)，
 * WebView2 的 Cookie 在同一应用的所有窗口间共享并持久化，后续搜索 /
 * 取播放地址都经它完成。
 */

const ORIGIN = 'https://music.163.com'
const LOGIN_LABEL = 'login'
const BRIDGE_LABEL = 'api-bridge'

/** 回传事件名 */
const ACCOUNT_EVENT = 'mr::netease::account'

export interface NeteaseProfile {
  userId: number
  nickname: string
  avatarUrl: string
  vipType: number
}

export interface NeteaseSong {
  id: number
  name: string
  artist: string
  album: string
  duration: number
  coverUrl: string
}

/** 网易云歌单元信息 */
export interface NeteasePlaylist {
  id: number
  name: string
  coverImgUrl: string
  trackCount: number
  playCount: number
}

/** 网易云音质等级：对应 v1 接口的 level 参数 */
export type NeteaseQuality =
  'standard' | 'higher' | 'exhigh' | 'lossless' | 'hires'

export interface NeteaseQualityOption {
  value: NeteaseQuality
  label: string
  desc: string
  /** 旧版接口的 br 参数（bps） */
  br: number
}

/** 音质可选列表，按从低到高排列；getSongUrl 会从所选音质往下降级 */
export const NETEASE_QUALITY_OPTIONS: NeteaseQualityOption[] = [
  { value: 'standard', label: '标准', desc: '128 kbps MP3', br: 128000 },
  { value: 'higher', label: '较高', desc: '192 kbps MP3', br: 192000 },
  { value: 'exhigh', label: '极高', desc: '320 kbps MP3', br: 320000 },
  { value: 'lossless', label: '无损', desc: 'FLAC ~800 kbps', br: 740000 },
  { value: 'hires', label: 'Hi-Res', desc: 'FLAC 高解析度', br: 1500000 }
]

/** 默认音质：极高（与原 fallback 链顶层一致） */
export const DEFAULT_QUALITY: NeteaseQuality = 'exhigh'

interface BridgePayload<T = unknown> {
  ok: boolean
  status?: number
  data?: T
  error?: string
}

let seq = 0
let bridgeWin: WebviewWindow | null = null
let bridgePromise: Promise<void> | null = null
let loginPromise: Promise<NeteaseProfile> | null = null

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const toHttps = (url: string): string => url.replace(/^http:\/\//, 'https://')

/**
 * 生成注入到网易云页面中的脚本：在同源上下文发起 fetch，
 * 再通过 Tauri 事件把结果 emit 回主窗口。
 * 所有动态部分都用 JSON.stringify 转义，避免注入问题。
 */
function buildRemoteScript(
  event: string,
  url: string,
  init: Record<string, unknown>
): string {
  return `(async () => {
    const emit = (name, payload) =>
      window.__TAURI__.event.emitTo('main', name, payload);
    try {
      const resp = await fetch(${JSON.stringify(url)}, ${JSON.stringify(init)});
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch (_) { data = text; }
      await emit(${JSON.stringify(event)}, { ok: true, status: resp.status, data });
    } catch (error) {
      await emit(${JSON.stringify(event)}, {
        ok: false,
        error: String((error && error.message) || error)
      });
    }
  })();`
}

/** 监听一次桥接回传事件（需在 eval 之前完成注册） */
async function waitBridgeEvent<T>(
  event: string,
  timeoutMs = 20000
): Promise<T> {
  let unlisten: UnlistenFn | undefined
  const task = new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      unlisten?.()
      reject(new Error('网易云接口请求超时'))
    }, timeoutMs)

    void listen<BridgePayload<T>>(event, (e) => {
      clearTimeout(timer)
      unlisten?.()
      const payload = e.payload
      if (payload?.ok) resolve(payload.data as T)
      else reject(new Error(payload?.error || '网易云接口请求失败'))
    }).then((fn) => {
      unlisten = fn
    })
  })
  // 等待监听注册完成，避免事件先于监听触发
  await sleep(0)
  return task
}

/** 在指定窗口的网易云页面上下文中发起请求 */
async function requestFromWindow(
  label: string,
  method: 'GET' | 'POST',
  path: string,
  body?: string
): Promise<any> {
  const event = `mr::netease::api::${Date.now()}_${seq++}`
  const init: Record<string, unknown> = {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    }
  }
  if (method === 'POST' && body !== undefined) init.body = body

  const result = waitBridgeEvent<any>(event)
  await invoke('eval_in_window', {
    label,
    script: buildRemoteScript(event, path, init)
  })
  return result
}

/** 解析账号接口中的用户资料 */
function normalizeProfile(data: any): NeteaseProfile | null {
  const profile = data?.profile
  if (!profile?.userId) return null
  return {
    userId: profile.userId,
    nickname: profile.nickname ?? '网易云用户',
    avatarUrl: toHttps(profile.avatarUrl ?? ''),
    vipType: profile.vipType ?? 0
  }
}

/** 解析搜索结果中的歌曲字段（兼容新旧字段名） */
function normalizeSong(raw: any): NeteaseSong {
  const artists = Array.isArray(raw.artists)
    ? raw.artists
    : Array.isArray(raw.ar)
      ? raw.ar
      : raw.artist
        ? [raw.artist]
        : []
  return {
    id: raw.id,
    name: raw.name ?? '未知歌曲',
    artist: artists
      .map((a: any) => a?.name)
      .filter(Boolean)
      .join(' / '),
    album: raw.album?.name ?? raw.al?.name ?? '',
    duration: raw.duration ?? raw.dt ?? 0,
    coverUrl: toHttps(raw.album?.picUrl ?? raw.al?.picUrl ?? '')
  }
}

/**
 * 打开网易云登录窗口，轮询登录态，成功后建立隐藏桥接窗口并关闭登录窗口。
 * 返回当前登录用户资料。
 */
export function loginWithNetease(): Promise<NeteaseProfile> {
  if (loginPromise) return loginPromise
  loginPromise = doLogin().finally(() => {
    loginPromise = null
  })
  return loginPromise
}

async function doLogin(): Promise<NeteaseProfile> {
  const loginWin = await createWindow.createWin({
    label: LOGIN_LABEL,
    title: '网易云音乐登录',
    url: `${ORIGIN}/#/login`,
    width: 1045,
    height: 600,
    decorations: true,
    resizable: false
  })
  if (!loginWin) throw new Error('网易云登录窗口创建失败')

  return new Promise<NeteaseProfile>((resolve, reject) => {
    let settled = false
    let unlisten: UnlistenFn | undefined
    let pollTimer: ReturnType<typeof setInterval> | undefined = undefined
    const timeoutTimer = setTimeout(
      () => {
        if (settled) return
        settled = true
        cleanup()
        reject(new Error('登录超时，请重试'))
      },
      5 * 60 * 1000
    )

    const cleanup = (): void => {
      if (pollTimer) clearInterval(pollTimer)
      clearTimeout(timeoutTimer)
      unlisten?.()
      void closeListener.then((fn) => fn())
    }

    // 用户手动关闭窗口 => 取消登录
    const closeListener = loginWin.onCloseRequested(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('已取消登录'))
    })

    void listen<BridgePayload<any>>(ACCOUNT_EVENT, async (e) => {
      if (settled) return
      const profile = normalizeProfile(e.payload?.data)
      if (!profile) return
      settled = true
      cleanup()
      try {
        // 先让隐藏桥接窗口接管共享 Cookie，再关闭登录窗口
        await ensureBridge()
        await loginWin.close()
        resolve(profile)
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }).then((fn) => {
      unlisten = fn
    })

    const pollAccount = (): void => {
      void invoke('eval_in_window', {
        label: LOGIN_LABEL,
        script: buildRemoteScript(ACCOUNT_EVENT, '/api/nuser/account/get', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store'
        })
      }).catch(() => {
        /* 页面未加载完成时忽略，下一次轮询继续 */
      })
    }

    pollTimer = setInterval(pollAccount, 2000)
    pollAccount()
  })
}

/** 确保隐藏的 API 桥接窗口就绪（Cookie 由 WebView2 共享 / 持久化） */
export function ensureBridge(): Promise<void> {
  if (bridgePromise) return bridgePromise
  bridgePromise = createBridge().catch((error) => {
    bridgePromise = null
    bridgeWin = null
    throw error
  })
  return bridgePromise
}

async function createBridge(): Promise<void> {
  // 已存在则直接复用，避免 createWin 将隐藏窗口 show 出来
  const existed = await createWindow.getWin(BRIDGE_LABEL)
  const win =
    existed ??
    (await createWindow.createWin({
      label: BRIDGE_LABEL,
      title: '',
      url: `${ORIGIN}/`,
      width: 900,
      height: 600,
      decorations: false,
      resizable: false,
      visible: false,
      skipTaskbar: true,
      shadow: false
    }))
  if (!win) throw new Error('网易云桥接窗口创建失败')
  bridgeWin = win

  // 等待页面加载完成：账号接口能返回响应即认为桥接就绪。
  // 不要求登录态——二维码登录接口本身就需要在未登录态下调用，
  // 桥接窗口的作用是同源 fetch + WebView2 Cookie 共享，登录与否都能用。
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    try {
      const data = await requestFromWindow(
        BRIDGE_LABEL,
        'GET',
        '/api/nuser/account/get'
      )
      // 已登录（profile 存在）或页面已加载但未登录，都视为就绪
      if (data && typeof data === 'object') return
    } catch {
      // 页面尚未加载完成（网络错误/eval 未就绪），继续等待
    }
    await sleep(1200)
  }
  throw new Error('网易云桥接窗口启动超时')
}

/** 二维码登录：生成扫码 key */
export async function getQrCodeKey(): Promise<string> {
  await ensureBridge()
  const data: any = await requestFromWindow(
    BRIDGE_LABEL,
    'POST',
    '/api/login/qrcode/unikey?type=1'
  )
  if (data?.code !== 200 || !data?.unikey) {
    throw new Error(data?.message || data?.msg || '获取二维码 key 失败')
  }
  return data.unikey as string
}

/** 二维码扫码状态码 */
export type QrCodeState = 800 | 801 | 802 | 803

export interface QrCodeStatus {
  code: QrCodeState
  message: string
}

/**
 * 二维码扫码状态查询。
 * - 800 已过期 / 801 等待扫码 / 802 待确认 / 803 授权成功（已登录）
 * 授权成功后 Cookie 会被桥接窗口自动持久化，可调用 fetchProfile 取资料。
 */
export async function getQrCodeStatus(unikey: string): Promise<QrCodeStatus> {
  await ensureBridge()
  const data: any = await requestFromWindow(
    BRIDGE_LABEL,
    'POST',
    `/api/login/qrcode/client/login?key=${encodeURIComponent(unikey)}&type=1`
  )
  return {
    code: (data?.code ?? 0) as QrCodeState,
    message: data?.message ?? data?.msg ?? ''
  }
}

/**
 * 用桥接窗口当前 Cookie 拉取登录用户资料。
 * 通常在二维码扫码返回 803、或启动时检测已登录态后调用。
 * 未登录时返回 null，不抛错。
 */
export async function fetchProfile(): Promise<NeteaseProfile | null> {
  await ensureBridge()
  const data: any = await requestFromWindow(
    BRIDGE_LABEL,
    'GET',
    '/api/nuser/account/get'
  )
  return normalizeProfile(data)
}

/** 拼接二维码图片地址（无需接口，codekey 参数即扫码 key） */
export function buildQrCodeImageUrl(unikey: string): string {
  return `${ORIGIN}/login?codekey=${encodeURIComponent(unikey)}`
}

/** 搜索单曲（网易云旧版 /api 接口，同源 + 登录 Cookie） */
export async function searchSongs(keyword: string): Promise<NeteaseSong[]> {
  const kw = keyword.trim()
  if (!kw) return []
  await ensureBridge()
  const body = `s=${encodeURIComponent(kw)}&type=1&limit=20&offset=0&total=true`
  const data: any = await requestFromWindow(
    BRIDGE_LABEL,
    'POST',
    '/api/search/get/web',
    body
  )
  if (data?.code !== 200) {
    throw new Error(data?.msg || '搜索失败')
  }
  const songs: any[] = data?.result?.songs ?? []
  return songs.map(normalizeSong).filter((song) => song.id)
}

/** 获取歌曲可播放地址。
 *  按所选音质优先 v1 level 接口，失败时按 br 降级到更低码率，
 *  最后兜底 v1 standard，确保尽量返回一个可用 URL。 */
export async function getSongUrl(
  id: number,
  quality: NeteaseQuality = DEFAULT_QUALITY
): Promise<string> {
  await ensureBridge()
  const legacyIds = encodeURIComponent(JSON.stringify([id]))
  const v1Ids = encodeURIComponent(JSON.stringify([String(id)]))

  // 从所选音质索引往下降级到 standard，得到 br 候选链
  const chosenIdx = NETEASE_QUALITY_OPTIONS.findIndex(
    (o) => o.value === quality
  )
  const startIdx = chosenIdx >= 0 ? chosenIdx : 2 // 默认 exhigh
  const downgradeChain = NETEASE_QUALITY_OPTIONS.slice(
    0,
    startIdx + 1
  ).reverse()

  // 候选请求：先 v1 level（与所选音质一致），再按 br 从所选降到最低，最后 v1 standard 兜底
  const candidates: Array<{
    method: 'GET' | 'POST'
    path: string
    body?: string
  }> = [
    {
      method: 'POST',
      path: '/api/song/enhance/player/url/v1',
      body: `ids=${v1Ids}&level=${quality}`
    },
    ...downgradeChain.map((opt) => ({
      method: 'GET' as const,
      path: `/api/song/enhance/player/url?ids=${legacyIds}&br=${opt.br}`
    })),
    {
      method: 'POST',
      path: '/api/song/enhance/player/url/v1',
      body: `ids=${v1Ids}&level=standard`
    }
  ]

  let lastData: any
  for (const candidate of candidates) {
    const data: any = await requestFromWindow(
      BRIDGE_LABEL,
      candidate.method,
      candidate.path,
      candidate.body
    )
    lastData = data
    const url = data?.data?.[0]?.url
    if (url) return toHttps(url)
  }
  throw new Error(
    lastData?.data?.[0]?.message || '该歌曲暂无播放版权，换一首试试吧'
  )
}

/** 获取当前登录用户的歌单列表（含「我喜欢的音乐」等） */
export async function getUserPlaylists(
  uid: number
): Promise<NeteasePlaylist[]> {
  await ensureBridge()
  const data: any = await requestFromWindow(
    BRIDGE_LABEL,
    'GET',
    `/api/user/playlist?uid=${uid}&limit=30&offset=0`
  )
  if (data?.code !== 200) {
    throw new Error(data?.msg || '获取歌单列表失败')
  }
  const list: any[] = data?.playlist ?? []
  return list.map((p) => ({
    id: p.id,
    name: p.name ?? '未知歌单',
    coverImgUrl: toHttps(p.coverImgUrl ?? ''),
    trackCount: p.trackCount ?? 0,
    playCount: p.playCount ?? 0
  }))
}

/** 获取歌单内全部歌曲 ID（优先 trackIds，兼容 tracks） */
export async function getPlaylistTrackIds(
  playlistId: number
): Promise<number[]> {
  await ensureBridge()
  const data: any = await requestFromWindow(
    BRIDGE_LABEL,
    'GET',
    `/api/v6/playlist/detail?id=${playlistId}&n=1000`
  )
  if (data?.code !== 200) {
    throw new Error(data?.msg || '获取歌单详情失败')
  }
  const playlist = data?.playlist ?? {}
  const trackIds: any[] = playlist.trackIds ?? playlist.tracks ?? []
  return trackIds
    .map((t: any) => (typeof t === 'number' ? t : t?.id))
    .filter((id: any): id is number => typeof id === 'number')
}

/** 批量获取歌曲详情（每次最多 100 首） */
export async function getSongDetails(ids: number[]): Promise<NeteaseSong[]> {
  if (!ids.length) return []
  await ensureBridge()
  const result: NeteaseSong[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const idsParam = encodeURIComponent(JSON.stringify(chunk))
    const data: any = await requestFromWindow(
      BRIDGE_LABEL,
      'GET',
      `/api/song/detail?ids=${idsParam}`
    )
    if (data?.code !== 200) continue
    const songs: any[] = data?.songs ?? []
    result.push(...songs.map(normalizeSong).filter((s) => s.id))
  }
  return result
}

/** 一次性加载歌单的全部可播放歌曲 */
export async function getPlaylistSongs(
  playlistId: number
): Promise<NeteaseSong[]> {
  const ids = await getPlaylistTrackIds(playlistId)
  return getSongDetails(ids)
}

/** 获取每日推荐歌曲 */
export async function getDailySongs(): Promise<NeteaseSong[]> {
  await ensureBridge()
  const data: any = await requestFromWindow(
    BRIDGE_LABEL,
    'GET',
    '/api/v3/discovery/recommend/songs'
  )
  if (data?.code !== 200) {
    throw new Error(data?.msg || '获取每日推荐失败')
  }
  const songs: any[] = data?.data?.dailySongs ?? data?.data?.songs ?? []
  return songs.map(normalizeSong).filter((s) => s.id)
}

/** 获取最近播放歌曲（去重，按播放时间倒序） */
export async function getRecentSongs(uid: number): Promise<NeteaseSong[]> {
  await ensureBridge()
  const data: any = await requestFromWindow(
    BRIDGE_LABEL,
    'GET',
    `/api/v1/play/record?uid=${uid}&type=0`
  )
  if (data?.code !== 200) {
    throw new Error(data?.msg || '获取最近播放失败')
  }
  const all: any[] = data?.allData ?? data?.weekData ?? []
  const seen = new Set<number>()
  const result: NeteaseSong[] = []
  for (const r of all) {
    const song = r?.song
    if (!song?.id || seen.has(song.id)) continue
    seen.add(song.id)
    result.push(normalizeSong(song))
  }
  return result
}

/** 网易云歌词行：[时间ms, 文本] */
export interface NeteaseLyricLine {
  time: number
  text: string
}

/** 拉取歌词，返回按时间排序的行数组（无歌词时返回空） */
export async function getLyric(songId: number): Promise<NeteaseLyricLine[]> {
  await ensureBridge()
  const data: any = await requestFromWindow(
    BRIDGE_LABEL,
    'GET',
    `/api/song/lyric?id=${songId}&lv=1&tv=-1&kv=-1`
  )
  if (data?.code !== 200) return []
  const raw: string = data?.lrc?.lyric ?? ''
  const lines: NeteaseLyricLine[] = []
  // 行格式：[mm:ss.xxx]文本，可能多个时间戳共用一行
  const re = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
  for (const seg of raw.split('\n')) {
    const stamps: number[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(seg)) !== null) {
      const min = parseInt(m[1], 10)
      const sec = parseInt(m[2], 10)
      const ms = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0
      stamps.push(min * 60 + sec + ms / 1000)
    }
    const text = seg.replace(re, '').trim()
    for (const t of stamps) {
      lines.push({ time: t, text })
    }
  }
  lines.sort((a, b) => a.time - b.time)
  return lines
}

/** 退出登录：关闭桥接 / 登录窗口并清空 WebView2 浏览数据（含 HttpOnly MUSIC_U） */
export async function logoutNetease(): Promise<void> {
  bridgePromise = null
  try {
    await bridgeWin?.close()
  } catch {
    /* 窗口可能已关闭 */
  }
  bridgeWin = null

  const loginWin = await createWindow.getWin(LOGIN_LABEL)
  try {
    await loginWin?.close()
  } catch {
    /* ignore */
  }

  await invoke('plugin:webview|clear_all_browsing_data')
}
