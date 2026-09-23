import { defineStore } from 'pinia'
import {
  getSongUrl,
  getRecentSongs,
  type NeteaseSong,
  type NeteaseQuality,
  DEFAULT_QUALITY
} from '@src/utils/netease'
import { useUserStore } from '@src/stores/user'

/** 全局唯一的音频元素（无需挂到组件上） */
let audio: HTMLAudioElement | null = null

/**
 * Web Audio 分析链路（与 audio 同生命周期的模块级单例）
 *
 * 注意：对同一个 HTMLMediaElement 只能调用一次 createMediaElementSource，
 * 调用后音频输出会被改道到 Web Audio graph，因此必须由 store 统一持有，
 * 不能放在可视化组件里（组件卸载/HMR 会导致 graph 失效且无法回退原生输出）。
 */
let audioCtx: AudioContext | null = null
let analyserNode: AnalyserNode | null = null
let mediaSource: MediaElementAudioSourceNode | null = null
/** 已回退到原生播放：无损 FLAC 等端点无 CORS 头，graph 元素无法加载 */
let nativeFallback = false
/** 本次播放失败是否刚触发了原生回退（用于让 playCurrent catch 让位） */
let fallbackPending = false
/** 最近一次赋值的播放地址（CORS 失败时用同一签名 URL 在原生元素上重播） */
let lastUrl = ''

export const formatPlayTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00'
  const total = Math.floor(seconds)
  const minute = Math.floor(total / 60)
  const second = total % 60
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

type PlayOrder = 'repeat' | 'repeat1' | 'shuffle'

export const usePlayerStore = defineStore('player', {
  state: () => ({
    current: null as NeteaseSong | null,
    isPlaying: false,
    loading: false,
    currentTime: 0,
    duration: 0,
    error: '',
    queue: [] as NeteaseSong[],
    queueIndex: -1,
    playOrder: 'repeat' as PlayOrder,
    volume: 100,
    muted: false,
    lastVolume: 100,
    quality: DEFAULT_QUALITY as NeteaseQuality
  }),
  actions: {
    /**
     * 创建 audio 元素并绑定事件。
     * @param withGraph true=以 CORS 模式加载（供 Web Audio 频谱分析）；
     *                  false=原生直连模式（跨域媒体可正常出声，不做可视化）
     */
    createAudioElement(withGraph: boolean): HTMLAudioElement {
      const el = new Audio()
      el.preload = 'auto'
      // 必须在首次赋 src 前设置：接入 MediaElementSource 后跨域音频必须
      // 以 CORS 模式加载才能通过 graph 出声；但无损 FLAC 端点无 CORS 头，
      // 那种情况下会走 fallbackToNative 换成 withGraph=false 的元素
      if (withGraph) el.crossOrigin = 'anonymous'
      el.volume = this.volume / 100
      el.muted = this.muted
      el.addEventListener('play', () => {
        this.isPlaying = true
        // 兜底：任何原因导致的 suspended 都在播放时尝试恢复
        if (audioCtx && audioCtx.state !== 'running') {
          void audioCtx.resume()
        }
      })
      el.addEventListener('pause', () => {
        this.isPlaying = false
      })
      el.addEventListener('ended', () => {
        this.isPlaying = false
        this.currentTime = 0
        void this.playNext()
      })
      el.addEventListener('timeupdate', () => {
        this.currentTime = audio?.currentTime ?? 0
      })
      el.addEventListener('loadedmetadata', () => {
        this.duration = audio?.duration ?? 0
      })
      el.addEventListener('error', () => {
        // CORS 阻断（如无损 FLAC 端点不返回 Access-Control-Allow-Origin）
        // → 换永不接 graph 的原生元素重播同一 URL，保证先能出声
        if (!nativeFallback && lastUrl) {
          fallbackPending = true
          void this.fallbackToNative()
          return
        }
        if (this.loading) return
        this.isPlaying = false
        this.error = '播放失败，请重试'
      })
      return el
    },

    ensureAudio(): HTMLAudioElement {
      if (audio) return audio
      // 默认创建 CORS 模式元素（可接 Web Audio 做频谱可视化）
      audio = this.createAudioElement(true)
      return audio
    },

    /**
     * CORS 失败回退：关闭 Web Audio graph，丢弃 CORS 模式元素，
     * 换成原生直连元素重播当前 URL。回退后本会话不再做频谱可视化。
     */
    async fallbackToNative(): Promise<void> {
      const url = lastUrl
      nativeFallback = true
      const oldEl = audio
      audio = null
      // 关闭 AudioContext 并解除引用（新元素永不接 graph）
      if (audioCtx) {
        try {
          await audioCtx.close()
        } catch {
          // ignore
        }
      }
      audioCtx = null
      mediaSource = null
      analyserNode = null
      oldEl?.pause()
      oldEl?.removeAttribute('src')
      oldEl?.load()

      const el = this.createAudioElement(false)
      audio = el
      el.src = url
      try {
        await el.play()
        // play 成功后才解除 pending，期间任何 error 都不会让
        // playCurrent catch 错误清空 current
        fallbackPending = false
      } catch {
        fallbackPending = false
        this.isPlaying = false
        this.error = '播放失败，请重试'
      }
    },

    /** 暴露内部 audio 元素（用于音频可视化等只读场景） */
    getAudioElement(): HTMLAudioElement | null {
      return audio
    },

    /**
     * 获取 AnalyserNode（幂等单例）。
     *
     * 必须在用户手势的同步调用链中首次调用（如点击播放），
     * 这样 AudioContext 才能以 running 状态创建，避免被自动播放策略挂起。
     * 链路：mediaSource → analyser → destination，analyser 仅旁路分析不影响出声。
     * 创建失败时返回 null，且不影响原生 audio 播放（仅可视化不可用）。
     */
    getAnalyser(): AnalyserNode | null {
      // CORS 回退后使用原生元素，永不接 graph，可视化不可用
      if (nativeFallback) return null
      const el = this.ensureAudio()
      if (analyserNode) {
        if (audioCtx && audioCtx.state === 'suspended') void audioCtx.resume()
        return analyserNode
      }
      try {
        audioCtx = new AudioContext()
        mediaSource = audioCtx.createMediaElementSource(el)
        analyserNode = audioCtx.createAnalyser()
        analyserNode.fftSize = 128
        analyserNode.smoothingTimeConstant = 0.82
        mediaSource.connect(analyserNode)
        analyserNode.connect(audioCtx.destination)
        if (audioCtx.state === 'suspended') void audioCtx.resume()
        return analyserNode
      } catch {
        // 同一元素重复创建等异常：放弃可视化，保持原生播放链路
        audioCtx = null
        mediaSource = null
        analyserNode = null
        return null
      }
    },

    /** 播放队列中 queueIndex 处的歌曲 */
    async playCurrent(): Promise<void> {
      const song = this.queue[this.queueIndex]
      if (!song) return
      this.error = ''
      // 先把歌曲信息赋给 current，让 UI（封面/标题/艺人）立即显示，
      // 拉取 URL 期间用户就能看到正在切换的歌曲
      this.current = song
      const el = this.ensureAudio()
      this.loading = true
      try {
        const url = await getSongUrl(song.id, this.quality)
        lastUrl = url
        el.src = url
        // 在用户手势调用链中同步确保分析链路（幂等），
        // 这样 AudioContext 创建即 running，避免接管输出后 suspended 导致无声
        this.getAnalyser()
        await el.play()
      } catch (error) {
        // error 事件已先于 play() reject 触发并启动原生回退，
        // 状态由 fallbackToNative 接管，这里不能清空 current
        if (fallbackPending) return
        this.current = null
        this.isPlaying = false
        this.error = error instanceof Error ? error.message : '播放失败'
      } finally {
        this.loading = false
      }
    },

    /** 切换音质；若当前正在播放，会以新音质重新加载当前歌曲 */
    setQuality(quality: NeteaseQuality): void {
      if (this.quality === quality) return
      this.quality = quality
      // 若当前有歌曲在播放或暂停，按新音质重新拉一次 URL
      if (this.current) {
        const resumePlay = this.isPlaying
        const currentTime = this.currentTime
        void this.playCurrent().then(() => {
          // 恢复到原进度
          if (audio) {
            audio.currentTime = currentTime
            this.currentTime = currentTime
            if (!resumePlay) audio.pause()
          }
        })
      }
    },

    /** 播放指定歌曲（来自搜索等单首场景，设置单首队列） */
    async playSong(song: NeteaseSong): Promise<void> {
      this.error = ''
      const el = this.ensureAudio()
      if (this.current?.id === song.id && el.src) {
        await el.play().catch(() => undefined)
        return
      }
      this.queue = [song]
      this.queueIndex = 0
      await this.playCurrent()
    },

    /** 播放整个歌单：设置队列并从指定索引开始 */
    async playPlaylist(songs: NeteaseSong[], startIndex = 0): Promise<void> {
      if (!songs.length) {
        this.error = '歌单暂无可播放歌曲'
        return
      }
      const startIdx = Math.min(startIndex, songs.length - 1)
      // 正在播放的歌曲与点击的歌曲为同一首时，不做任何处理
      if (
        this.current?.id === songs[startIdx].id &&
        this.queueIndex === startIdx &&
        this.queue === songs
      ) {
        return
      }
      this.queue = songs
      this.queueIndex = startIdx
      await this.playCurrent()
    },

    /** 下一首：按当前播放顺序决定 */
    async playNext(): Promise<void> {
      if (!this.queue.length) return
      if (this.playOrder === 'repeat1') {
        await this.playCurrent()
        return
      }
      if (this.playOrder === 'shuffle') {
        this.queueIndex = Math.floor(Math.random() * this.queue.length)
      } else {
        this.queueIndex = (this.queueIndex + 1) % this.queue.length
      }
      await this.playCurrent()
    },

    /** 上一首 */
    async playPrev(): Promise<void> {
      if (!this.queue.length) return
      this.queueIndex =
        (this.queueIndex - 1 + this.queue.length) % this.queue.length
      await this.playCurrent()
    },

    /** 循环切换播放顺序：repeat -> repeat1 -> shuffle -> repeat */
    cyclePlayOrder(): void {
      const next: PlayOrder =
        this.playOrder === 'repeat'
          ? 'repeat1'
          : this.playOrder === 'repeat1'
            ? 'shuffle'
            : 'repeat'
      this.playOrder = next
    },

    togglePlay(): void {
      const el = this.ensureAudio()
      if (!el.src) {
        // 队列已就绪但尚未加载 URL（如启动后从最近播放同步）：
        // 由用户点击手势触发实际加载与播放
        if (this.current && this.queueIndex >= 0) {
          void this.playCurrent()
        }
        return
      }
      if (el.paused) {
        // 用户手势中恢复 AudioContext，防止 suspended 时无声
        this.getAnalyser()
        void el.play().catch(() => undefined)
      } else {
        el.pause()
      }
    },

    /**
     * 同步当前登录账号的「正在播放」状态。
     *
     * 网易云 Web 端没有真正的实时"正在播放"接口，这里用最近播放记录
     * 的第一首作为近似，把整个最近播放列表设为播放队列、queueIndex=0、
     * current=列表首曲，让 bottom-bar 立即显示歌曲信息，
     * 用户点击 ▶ 按钮即可直接播放（不自动播放，遵守浏览器自动播放策略）。
     * 未登录或拉取失败时静默失败，不影响主流程。
     */
    async loadAccountPlaying(): Promise<void> {
      const userStore = useUserStore()
      const profile = userStore.profile
      if (!profile) return
      try {
        const songs = await getRecentSongs(profile.userId)
        if (!songs.length) return
        this.queue = songs
        this.queueIndex = 0
        this.current = songs[0]
      } catch (error) {
        // 拉取失败时静默，错误信息暂存到 error 便于排查
        this.error = error instanceof Error ? error.message : '同步正在播放失败'
      }
    },

    /** 设置音量 0-100，0 时自动静音，>0 时取消静音 */
    setVolume(v: number): void {
      const next = Math.max(0, Math.min(100, Math.round(v)))
      this.volume = next
      if (next > 0) {
        this.lastVolume = next
        this.muted = false
      } else {
        this.muted = true
      }
      const el = audio
      if (el) {
        el.volume = next / 100
        el.muted = this.muted
      }
    },

    /** 切换静音；从静音恢复时回到 lastVolume */
    toggleMute(): void {
      if (this.muted || this.volume === 0) {
        this.muted = false
        const restore = this.lastVolume > 0 ? this.lastVolume : 100
        this.volume = restore
      } else {
        this.muted = true
      }
      const el = audio
      if (el) {
        el.volume = this.volume / 100
        el.muted = this.muted
      }
    },

    /** 跳转到指定时间（秒） */
    seek(time: number): void {
      const el = audio
      if (!el || !Number.isFinite(el.duration)) return
      const next = Math.max(0, Math.min(el.duration, time))
      el.currentTime = next
      this.currentTime = next
    },

    stop(): void {
      if (audio) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
      if (audioCtx) void audioCtx.close()
      audio = null
      audioCtx = null
      mediaSource = null
      analyserNode = null
      nativeFallback = false
      fallbackPending = false
      lastUrl = ''
      this.current = null
      this.isPlaying = false
      this.currentTime = 0
      this.duration = 0
      this.error = ''
      this.queue = []
      this.queueIndex = -1
    }
  },
  persist: {
    pick: ['volume', 'muted', 'lastVolume', 'playOrder', 'quality'],
    storage: localStorage
  }
})
