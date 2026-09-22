import { defineStore } from 'pinia'
import {
  getSongUrl,
  type NeteaseSong,
  type NeteaseQuality,
  DEFAULT_QUALITY
} from '@src/utils/netease'

/** 全局唯一的音频元素（无需挂到组件上） */
let audio: HTMLAudioElement | null = null

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
    ensureAudio(): HTMLAudioElement {
      if (audio) return audio
      audio = new Audio()
      audio.preload = 'auto'
      audio.volume = this.volume / 100
      audio.muted = this.muted
      audio.addEventListener('play', () => {
        this.isPlaying = true
      })
      audio.addEventListener('pause', () => {
        this.isPlaying = false
      })
      audio.addEventListener('ended', () => {
        this.isPlaying = false
        this.currentTime = 0
        void this.playNext()
      })
      audio.addEventListener('timeupdate', () => {
        this.currentTime = audio?.currentTime ?? 0
      })
      audio.addEventListener('loadedmetadata', () => {
        this.duration = audio?.duration ?? 0
      })
      audio.addEventListener('error', () => {
        if (this.loading) return
        this.isPlaying = false
        this.error = '播放失败，请重试'
      })
      return audio
    },

    /** 播放队列中 queueIndex 处的歌曲 */
    async playCurrent(): Promise<void> {
      const song = this.queue[this.queueIndex]
      if (!song) return
      this.error = ''
      const el = this.ensureAudio()
      this.loading = true
      try {
        const url = await getSongUrl(song.id, this.quality)
        this.current = song
        el.src = url
        await el.play()
      } catch (error) {
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
      this.queue = songs
      this.queueIndex = Math.min(startIndex, songs.length - 1)
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
      if (!el.src) return
      if (el.paused) {
        void el.play().catch(() => undefined)
      } else {
        el.pause()
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
