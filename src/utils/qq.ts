import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import createWindow from './createWindow'
import type {
  NeteaseLyricLine,
  NeteasePlaylist,
  NeteaseProfile,
  NeteaseQuality,
  NeteaseSong
} from './netease'

/**
 * QQ 音乐登录 / 接口桥接
 *
 * 和网易云一样，登录窗口与隐藏桥接窗口都停留在 y.qq.com 同源页面；
 * Cookie 由 WebView2 自动携带，页面内 fetch 后通过 Tauri 事件把 JSON 回传主窗口。
 * 这样既不读取 HttpOnly Cookie，也不需要经过 Rust 侧代理。
 */

const ORIGIN = 'https://y.qq.com'
const LOGIN_LABEL = 'qq-login'
const BRIDGE_LABEL = 'qq-api-bridge'
const ACCOUNT_EVENT = 'mr::qq::account'
const MUSICU_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg'

interface BridgePayload<T = unknown> {
  ok: boolean
  status?: number
  data?: T
  error?: string
  uin?: string
}

let seq = 0
let bridgeWin: WebviewWindow | null = null
let bridgePromise: Promise<void> | null = null
let loginPromise: Promise<NeteaseProfile> | null = null
let qqUin = ''

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

function buildScript(event: string, body: string): string {
  return `(async () => {
    const emit = (name, payload) =>
      window.__TAURI__.event.emitTo('main', name, payload);
    try {
      ${body}
    } catch (error) {
      await emit(${JSON.stringify(event)}, {
        ok: false,
        error: String((error && error.message) || error)
      });
    }
  })();`
}

async function waitBridgeEvent<T>(
  event: string,
  timeoutMs = 20000
): Promise<BridgePayload<T>> {
  let unlisten: UnlistenFn | undefined
  const task = new Promise<BridgePayload<T>>((resolve, reject) => {
    const timer = setTimeout(() => {
      unlisten?.()
      reject(new Error('QQ 音乐接口请求超时'))
    }, timeoutMs)
    void listen<BridgePayload<T>>(event, (e) => {
      clearTimeout(timer)
      unlisten?.()
      resolve(e.payload)
    }).then((fn) => {
      unlisten = fn
    })
  })
  await sleep(0)
  return task
}

async function evalInQQWindow(label: string, script: string): Promise<void> {
  await invoke('eval_in_window', { label, script })
}

const READ_UIN_JS = `const readUin = () => {
  const m = document.cookie.match(/(?:^|;\\s*)(?:uin|p_uin|wxuin)=([^;]+)/i);
  return m ? decodeURIComponent(m[1]).replace(/^o/i, '').replace(/\\D/g, '').replace(/^0+/, '') : '';
};
const uin = readUin();
const nickCookie = (() => {
  const key = 'ptnick_' + uin;
  const padded = '0' + uin;
  for (const name of [key, 'ptnick_' + padded]) {
    const m = document.cookie.match(new RegExp('(?:^|;\\\\s*)' + name + '=([^;]+)'));
    if (m) {
      try { return decodeURIComponent(m[1].replace(/\\+/g, '%20')); } catch (_) { return m[1]; }
    }
  }
  return '';
})();`

/** 读取页面 Cookie 中的 UIN，并请求个人主页接口 */
async function queryQQProfile(label: string): Promise<NeteaseProfile | null> {
  const event = `mr::qq::profile::${Date.now()}_${seq++}`
  const body = `${READ_UIN_JS}
    const url = new URL('https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg');
    url.searchParams.set('cid', '205360838');
    url.searchParams.set('userid', uin || '0');
    url.searchParams.set('reqfrom', '1');
    url.searchParams.set('g_tk', '5381');
    url.searchParams.set('loginUin', uin || '0');
    url.searchParams.set('hostUin', '0');
    url.searchParams.set('format', 'json');
    url.searchParams.set('inCharset', 'utf8');
    url.searchParams.set('outCharset', 'utf-8');
    url.searchParams.set('notice', '0');
    url.searchParams.set('platform', 'yqq.json');
    url.searchParams.set('needNewCode', '0');
    const resp = await fetch(url.toString(), { credentials: 'include', cache: 'no-store' });
    const data = await resp.json();
    await emit(${JSON.stringify(event)}, { ok: true, status: resp.status, data, uin, nickCookie });`

  const payloadPromise = waitBridgeEvent<any>(event)
  await evalInQQWindow(label, buildScript(event, body))
  const payload = await payloadPromise
  if (!payload.ok) throw new Error(payload.error || 'QQ 音乐账号请求失败')
  const profile = normalizeProfile(payload.data, payload.uin || '', (payload as any).nickCookie || '')
  if (profile) qqUin = String(profile.userId)
  return profile
}

function normalizeProfile(
  body: any,
  cookieUin: string,
  cookieNick: string
): NeteaseProfile | null {
  if (!body || typeof body !== 'object') return null
  const data = body.data ?? body.profile ?? body.creator ?? body.result ?? {}
  const creator = data.creator ?? data.user ?? data.profile ?? data
  const nickCandidates = [
    creator?.nick,
    creator?.nickname,
    creator?.name,
    creator?.hostname,
    data?.nick,
    data?.nickname,
    cookieNick
  ]
  const nick =
    nickCandidates
      .map((value) => String(value ?? '').trim())
      .find((value) => value.length > 0) ?? ''
  const avatar =
    creator?.headpic ??
    creator?.avatar ??
    creator?.avatarUrl ??
    creator?.logo ??
    data?.headpic ??
    data?.avatar ??
    ''
  const rawId =
    cookieUin ||
    creator?.uin ||
    creator?.encrypt_uin ||
    data?.uin ||
    data?.encrypt_uin ||
    ''
  const userId = Number(String(rawId).replace(/^o/i, '').replace(/\D/g, '')) || 0
  if (!userId) return null
  const vipRaw =
    data?.vipType ??
    data?.vip_type ??
    data?.music_vip_level ??
    data?.green_vip_level ??
    creator?.vipType ??
    creator?.vip_type ??
    0
  return {
    provider: 'qq',
    userId,
    nickname: String(nick).trim() || `QQ用户${String(userId).slice(-4)}`,
    avatarUrl:
      avatar ||
      (userId ? `https://q1.qlogo.cn/g?b=qq&nk=${userId}&s=100` : ''),
    vipType: Number(vipRaw) || 0,
    playbackKeyReady: false
  }
}

async function requestQQ(
  label: string,
  url: string,
  init: Record<string, unknown>
): Promise<any> {
  const event = `mr::qq::api::${Date.now()}_${seq++}`
  const body = `const resp = await fetch(${JSON.stringify(url)}, ${JSON.stringify(
    init
  )});
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = text; }
    await emit(${JSON.stringify(event)}, { ok: true, status: resp.status, data });`
  const payloadPromise = waitBridgeEvent<any>(event)
  await evalInQQWindow(label, buildScript(event, body))
  const payload = await payloadPromise
  if (!payload.ok) throw new Error(payload.error || 'QQ 音乐接口请求失败')
  return payload.data
}

async function requestMusicu(payload: unknown): Promise<any> {
  await ensureQQBridge()
  return requestQQ(BRIDGE_LABEL, MUSICU_URL, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body: JSON.stringify(payload)
  })
}

async function requestQQGet(url: string): Promise<any> {
  await ensureQQBridge()
  return requestQQ(BRIDGE_LABEL, url, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store'
  })
}

/** 确保隐藏桥接窗口已加载，QQ 接口由它发起 */
export function ensureQQBridge(): Promise<void> {
  if (bridgePromise) return bridgePromise
  bridgePromise = createQQBridge().catch((error) => {
    bridgePromise = null
    bridgeWin = null
    throw error
  })
  return bridgePromise
}

/** 重新读取当前 QQ 登录账号的资料，用于刷新昵称/头像 */
export async function fetchQQProfile(): Promise<NeteaseProfile | null> {
  await ensureQQBridge()
  return queryQQProfile(BRIDGE_LABEL)
}

async function createQQBridge(): Promise<void> {
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
  if (!win) throw new Error('QQ 音乐桥接窗口创建失败')
  bridgeWin = win

  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    try {
      // 匿名访问也会成功返回 code 1000，只要 fetch 走得通就认为桥接就绪
      await queryQQProfile(BRIDGE_LABEL)
      return
    } catch {
      await sleep(1200)
    }
  }
  throw new Error('QQ 音乐桥接窗口启动超时')
}

/** 打开 QQ 音乐登录窗口并轮询登录态 */
export function loginWithQQ(): Promise<NeteaseProfile> {
  if (loginPromise) return loginPromise
  loginPromise = doLogin().finally(() => {
    loginPromise = null
  })
  return loginPromise
}

async function doLogin(): Promise<NeteaseProfile> {
  const loginWin = await createWindow.createWin({
    label: LOGIN_LABEL,
    title: 'QQ 音乐登录',
    // QQ 音乐的登录入口在首页右上角，旧的 /n/ryqq/login 路由已 404。
    url: ORIGIN,
    width: 1045,
    height: 620,
    decorations: true,
    resizable: false
  })
  if (!loginWin) throw new Error('QQ 音乐登录窗口创建失败')

  return new Promise<NeteaseProfile>((resolve, reject) => {
    let settled = false
    let unlisten: UnlistenFn | undefined
    let pollTimer: ReturnType<typeof setInterval> | undefined
    let polling = false
    const timeoutTimer = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('登录超时，请重试'))
    }, 5 * 60 * 1000)

    const cleanup = (): void => {
      if (pollTimer) clearInterval(pollTimer)
      clearTimeout(timeoutTimer)
      unlisten?.()
      void closeListener.then((fn) => fn())
    }

    const closeListener = loginWin.onCloseRequested(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('已取消登录'))
    })

    // 登录窗口内的页面也可能主动触发账号事件（例如登录后刷新）
    void listen<BridgePayload<any>>(ACCOUNT_EVENT, async (e) => {
      if (settled) return
      const profile = normalizeProfile(
        e.payload?.data,
        e.payload?.uin || '',
        (e.payload as any)?.nickCookie || ''
      )
      if (!profile) return
      settled = true
      cleanup()
      try {
        await ensureQQBridge()
        await loginWin.close()
        resolve(profile)
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }).then((fn) => {
      unlisten = fn
    })

    const poll = async (): Promise<void> => {
      if (settled || polling) return
      polling = true
      try {
        const profile = await queryQQProfile(LOGIN_LABEL)
        if (profile && !settled) {
          settled = true
          cleanup()
          await ensureQQBridge()
          await loginWin.close()
          resolve(profile)
        }
      } catch {
        // 页面尚未加载完成，继续轮询
      } finally {
        polling = false
      }
    }

    pollTimer = setInterval(() => void poll(), 2000)
    void poll()
  })
}

function qualityCandidates(quality: NeteaseQuality): Array<[string, string]> {
  const all: Array<[NeteaseQuality, string, string]> = [
    ['hires', 'RS01', '.flac'],
    ['lossless', 'F000', '.flac'],
    ['exhigh', 'M800', '.mp3'],
    ['higher', 'M500', '.mp3'],
    ['standard', 'M500', '.mp3']
  ]
  const idx = all.findIndex(([level]) => level === quality)
  return all.slice(idx >= 0 ? idx : 2).map(([, prefix, ext]) => [prefix, ext])
}

function albumCover(albumMid: string): string {
  return albumMid
    ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg?max_age=2592000`
    : ''
}

function mapTrack(raw: any): NeteaseSong {
  const t = raw?.songInfo ?? raw?.track_info ?? raw?.track ?? raw ?? {}
  const album = t.album ?? {}
  const singers = Array.isArray(t.singer) ? t.singer : []
  const mid = String(t.mid ?? t.songmid ?? raw?.mid ?? '')
  return {
    provider: 'qq',
    id: Number(t.id ?? raw?.id ?? 0) || 0,
    name: t.name ?? t.title ?? '未知歌曲',
    artist:
      singers
        .map((s: any) => s?.name)
        .filter(Boolean)
        .join(' / ') || t.singername || '',
    album: album.name ?? t.albumname ?? '',
    duration: (Number(t.interval) || 0) * 1000,
    coverUrl: albumCover(String(album.mid ?? t.albummid ?? '')),
    mid,
    mediaMid: String(t.file?.media_mid ?? t.strMediaMid ?? mid)
  }
}

function playlistCover(raw: any): string {
  const candidates = [
    raw?.diss_cover,
    raw?.logo,
    raw?.picurl,
    raw?.cover,
    raw?.coverUrl
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) {
      return c.startsWith('//') ? `https:${c}` : c
    }
  }
  return ''
}

function mapPlaylist(raw: any): NeteasePlaylist {
  const dirid = Number(raw?.dirid ?? raw?.dirId ?? 0) || undefined
  const dissid = Number(raw?.dissid ?? raw?.tid ?? raw?.id ?? 0) || 0
  const liked = dirid === 201
  return {
    provider: 'qq',
    id: liked ? 201 : dissid || dirid || 0,
    dirid,
    name: raw?.diss_name ?? raw?.dissname ?? raw?.name ?? 'QQ 音乐歌单',
    coverImgUrl: playlistCover(raw),
    trackCount: Number(raw?.song_cnt ?? raw?.songnum ?? 0) || 0,
    playCount: Number(raw?.listen_num ?? raw?.listennum ?? 0) || 0
  }
}

export async function getQQUserPlaylists(): Promise<NeteasePlaylist[]> {
  const uin = qqUin
  if (!uin) return []
  const base =
    'https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss?hostuin=' +
    uin +
    '&sin=0&size=200&g_tk=5381&loginUin=' +
    uin +
    '&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0'
  const result: NeteasePlaylist[] = []
  try {
    const data = await requestQQGet(base)
    const list: any[] = data?.data?.disslist ?? data?.disslist ?? []
    result.push(...list.map((p) => mapPlaylist(p)))
  } catch {
    /* 创建歌单接口失败时仍尝试收藏歌单 */
  }

  try {
    const collected = await requestQQGet(
      'https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_order_asset.fcg?hostuin=' +
        uin +
        '&sin=0&size=200&ct=20&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0'
    )
    const list: any[] =
      collected?.data?.list ??
      collected?.data?.disslist ??
      collected?.list ??
      []
    result.push(...list.map((p) => mapPlaylist(p)))
  } catch {
    /* 收藏接口失败不阻断登录 */
  }

  const seen = new Set<number>()
  return result.filter((p) => {
    if (!p.id || seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })
}

export async function getQQPlaylistSongs(
  playlist: NeteasePlaylist
): Promise<NeteaseSong[]> {
  const data = await requestMusicu({
    comm: { ct: 24, cv: 0, format: 'json', uin: qqUin || '0' },
    req_0: {
      module: 'music.srfDissInfo.DissInfo',
      method: 'CgiGetDiss',
      param: {
        disstid: playlist.dirid === 201 ? 0 : playlist.id,
        dirid: playlist.dirid ?? 0,
        song_begin: 0,
        song_num: 1000,
        userinfo: true,
        orderlist: true
      }
    }
  })
  const info = data?.req_0?.data ?? data?.data ?? {}
  const list: any[] = info.songlist ?? info.songList ?? []
  return list.map(mapTrack).filter((song) => song.mid)
}

export async function searchQQSongs(keyword: string): Promise<NeteaseSong[]> {
  const kw = keyword.trim()
  if (!kw) return []
  const module = 'music.search.SearchCgiService'
  const payload = {
    [module]: {
      module,
      method: 'DoSearchForQQMusicDesktop',
      param: { search_type: 0, query: kw, page_num: 1, num_per_page: 20 }
    }
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const data = await requestMusicu(payload)
    const block = data?.[module]
    const code = Number(data?.code ?? block?.code ?? 0)
    if (code === 2001 && attempt < 4) {
      await sleep(300)
      continue
    }
    if (code !== 0) throw new Error(block?.msg || 'QQ 音乐搜索失败')
    const list: any[] =
      block?.data?.body?.song?.list ?? block?.data?.song?.list ?? []
    return list.map(mapTrack).filter((song) => song.mid)
  }
  return []
}

export async function getQQSongUrl(
  song: NeteaseSong,
  quality: NeteaseQuality
): Promise<string> {
  if (!song.mid) throw new Error('QQ 音乐缺少歌曲 MID')
  const mediaId = song.mediaMid || song.mid
  const candidates = qualityCandidates(quality).flatMap(([prefix, ext]) => {
    const names = [`${prefix}${mediaId}${ext}`]
    if (mediaId !== song.mid) names.push(`${prefix}${song.mid}${ext}`)
    return names
  })
  const data = await requestMusicu({
    comm: {
      ct: 24,
      cv: 0,
      format: 'json',
      uin: qqUin || '0'
    },
    req_0: {
      module: 'vkey.GetVkeyServer',
      method: 'CgiGetVkey',
      param: {
        guid: '10000',
        songmid: candidates.map(() => song.mid),
        songtype: candidates.map(() => 0),
        uin: qqUin || '0',
        loginflag: 1,
        platform: '20',
        filename: candidates
      }
    }
  })
  const payload = data?.req_0?.data ?? data?.data ?? {}
  const infos: any[] = payload.midurlinfo ?? []
  const playable = infos.find((info) => info?.purl)
  if (!playable) {
    const info = infos[0] ?? {}
    throw new Error(
      info.msg ||
        (Number(info.result) === 104003
          ? 'QQ 音乐暂未返回播放地址（版权或会员限制）'
          : 'QQ 音乐暂不可播放，换一首试试')
    )
  }
  const purl = String(playable.purl)
  if (/^https?:\/\//.test(purl)) return purl
  const sip = String(payload.sip?.[0] ?? 'https://ws.stream.qqmusic.qq.com/')
  return sip + purl
}

export async function getQQRecentSongs(): Promise<NeteaseSong[]> {
  const data = await requestMusicu({
    comm: { ct: 24, cv: 0, format: 'json', uin: qqUin || '0' },
    req_0: {
      module: 'music.musicasset.PlayRecentlyRead',
      method: 'GetPlayRecentlyInfo',
      param: { requestCnt: 200, type: 2, updateTime: 0, lastTime: 0 }
    }
  })
  const payload = data?.req_0?.data ?? data?.data ?? {}
  const list: any[] = payload?.data?.songList ?? payload?.songList ?? []
  return list
    .map((item) => mapTrack(item?.track ?? item))
    .filter((song) => song.mid)
}

export async function getQQDailySongs(): Promise<NeteaseSong[]> {
  try {
    const data = await requestMusicu({
      comm: { ct: 24, cv: 0, format: 'json', uin: qqUin || '0' },
      req_0: {
        module: 'music.recommend.RecommendFeed',
        method: 'get_recommend_feed',
        param: { direction: 0, page: 1, v_cache: [], v_uniq: [], s_num: 0 }
      }
    })
    const feed = data?.req_0?.data ?? data?.data ?? {}
    const list: any[] =
      feed?.vecRecommendFeed ?? feed?.recommendFeed ?? feed?.feeds ?? []
    for (const item of list) {
      const subtype = Number(item?.subtype ?? item?.type ?? 0)
      if (subtype !== 510) continue
      const dissid = Number(
        item?.dissid ??
          item?.content?.dissid ??
          item?.base?.dissid ??
          item?.playlist?.dissid ??
          0
      )
      if (!dissid) continue
      return getQQPlaylistSongs({
        provider: 'qq',
        id: dissid,
        name: '每日推荐',
        coverImgUrl: '',
        trackCount: 0,
        playCount: 0
      })
    }
  } catch {
    /* 每日推荐接口不可用时返回空 */
  }
  return []
}

export async function getQQLyric(
  song: NeteaseSong
): Promise<NeteaseLyricLine[]> {
  if (!song.mid) return []
  const data = await requestMusicu({
    comm: { ct: 24, cv: 0, format: 'json', uin: qqUin || '0' },
    req_0: {
      module: 'music.musichallSong.PlayLyricInfo',
      method: 'GetPlayLyricInfo',
      param: { songMID: song.mid }
    }
  })
  const payload = data?.req_0?.data ?? data?.data ?? {}
  let raw = String(payload.lyric ?? '')
  if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length % 4 === 0) {
    try {
      const decoded = atob(raw)
      if (decoded.includes('[')) raw = decoded
    } catch {
      /* 保留原始文本 */
    }
  }
  const lines: NeteaseLyricLine[] = []
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
    for (const t of stamps) lines.push({ time: t, text })
  }
  lines.sort((a, b) => a.time - b.time)
  return lines
}

/** 只关闭 QQ 自己的窗口；不清理全量浏览数据，避免影响网易云登录 */
export async function logoutQQ(): Promise<void> {
  bridgePromise = null
  try {
    await bridgeWin?.close()
  } catch {
    /* ignore */
  }
  bridgeWin = null
  qqUin = ''
  const loginWin = await createWindow.getWin(LOGIN_LABEL)
  try {
    await loginWin?.close()
  } catch {
    /* ignore */
  }
}
