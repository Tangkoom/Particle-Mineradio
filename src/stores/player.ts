import { defineStore } from 'pinia'
import { getSongUrl, type NeteaseSong } from '@src/utils/netease'

/** 全局唯一的音频元素（无需挂到组件上） */
let audio: HTMLAudioElement | null = null

export const formatPlayTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00'
  const total = Math.floor(seconds)
  const minute = Math.floor(total / 60)
  const second = total % 60
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

export const usePlayerStore = defineStore('player', {
  state: () => ({
    current: null as NeteaseSong | null,
    isPlaying: false,
    loading: false,
    currentTime: 0,
    duration: 0,
    error: ''
  }),
  actions: {
    ensureAudio(): HTMLAudioElement {
      if (audio) return audio
      audio = new Audio()
      audio.preload = 'auto'
      audio.addEventListener('play', () => {
        this.isPlaying = true
      })
      audio.addEventListener('pause', () => {
        this.isPlaying = false
      })
      audio.addEventListener('ended', () => {
        this.isPlaying = false
        this.currentTime = 0
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

    /** 播放指定歌曲（已在播放同一首时则直接续播） */
    async playSong(song: NeteaseSong): Promise<void> {
      this.error = ''
      const el = this.ensureAudio()
      if (this.current?.id === song.id && el.src) {
        await el.play().catch(() => undefined)
        return
      }
      this.loading = true
      try {
        const url = await getSongUrl(song.id)
        this.current = song
        el.src = url
        await el.play()
      } catch (error) {
        this.current = this.current?.id === song.id ? null : this.current
        this.isPlaying = false
        this.error = error instanceof Error ? error.message : '播放失败'
      } finally {
        this.loading = false
      }
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
    }
  }
})
