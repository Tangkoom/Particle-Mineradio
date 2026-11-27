<script setup lang="ts">
import { computed, markRaw, onMounted, onUnmounted, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event'
import {
  LoaderCircle,
  LogOut,
  Monitor,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume,
  Volume1,
  Volume2,
  VolumeOff
} from '@lucide/vue'

import type { TrayState } from './bridge'

const EMPTY: TrayState = {
  name: '',
  artist: '',
  cover: '',
  isPlaying: false,
  loading: false,
  currentTime: 0,
  duration: 0,
  playOrder: 'repeat',
  volume: 100,
  muted: false,
  hasSong: false
}

const state = ref<TrayState>({ ...EMPTY })
const coverFailed = ref(false)

const isTauri = (): boolean => '__TAURI_INTERNALS__' in window

const fmt = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00'
  const total = Math.floor(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const progress = computed(() => {
  const duration = state.value.duration
  if (!Number.isFinite(duration) || duration <= 0) return 0
  return Math.min(100, Math.max(0, (state.value.currentTime / duration) * 100))
})

const effectiveVolume = computed(() =>
  state.value.muted ? 0 : state.value.volume
)

const canControl = computed(() => state.value.hasSong)

const orderIcon = computed(() => {
  if (state.value.playOrder === 'repeat1') return markRaw(Repeat1)
  if (state.value.playOrder === 'shuffle') return markRaw(Shuffle)
  return markRaw(Repeat)
})

const orderLabel = computed(() => {
  if (state.value.playOrder === 'repeat1') return '单曲循环'
  if (state.value.playOrder === 'shuffle') return '随机播放'
  return '顺序播放'
})

const volumeIcon = computed(() => {
  if (effectiveVolume.value === 0) return markRaw(VolumeOff)
  if (effectiveVolume.value < 40) return markRaw(Volume)
  if (effectiveVolume.value < 75) return markRaw(Volume1)
  return markRaw(Volume2)
})

const requestState = (): void => {
  if (!isTauri()) return
  void emitTo('main', 'tray:request').catch(() => undefined)
}

const send = (action: string, value?: number): void => {
  if (!isTauri()) return
  void emitTo('main', 'tray:command', { action, value }).catch(() => undefined)
}

const runTrayAction = (action: string): void => {
  if (!isTauri()) return
  void invoke('tray_action', { action }).catch(() => undefined)
}

const onSeekInput = (event: Event): void => {
  const input = event.target as HTMLInputElement
  const value = Number(input.value)
  if (!Number.isFinite(value) || state.value.duration <= 0) return
  state.value.currentTime = value
  send('seek', value)
}

const onVolumeInput = (event: Event): void => {
  const input = event.target as HTMLInputElement
  const value = Number(input.value)
  if (!Number.isFinite(value)) return
  state.value.volume = value
  state.value.muted = value === 0
  send('volume', value)
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') runTrayAction('dismiss')
}

let unlisten: UnlistenFn | undefined
let retryA = 0
let retryB = 0

onMounted(async () => {
  if (!isTauri()) return

  try {
    unlisten = await listen<TrayState>('tray:state', (event) => {
      state.value = event.payload
    })
    requestState()
  } catch (error) {
    console.warn('[tray] 订阅播放状态失败', error)
  }

  // 面板窗口可能比主窗口后加载，补两次请求避免第一条事件丢失。
  retryA = window.setTimeout(requestState, 500)
  retryB = window.setTimeout(requestState, 1500)

  window.addEventListener('keydown', onKeydown)
  window.addEventListener('focus', requestState)
})

onUnmounted(() => {
  window.clearTimeout(retryA)
  window.clearTimeout(retryB)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('focus', requestState)
  unlisten?.()
})

watch(
  () => state.value.cover,
  () => {
    coverFailed.value = false
  }
)
</script>

<template>
  <div class="box-border w-full h-full select-none p-5">
    <div
      class="flex w-full h-full flex-col rounded-[18px] border border-white/10 bg-[#0b0c0f] p-3.5 shadow-[0_6px_12px_rgba(0,0,0,0.55)]"
    >
      <!-- 标题 -->
      <div class="flex h-7 shrink-0 items-center justify-between">
        <div class="flex min-w-0 items-center gap-2">
          <img
            src="/icon.png"
            alt=""
            draggable="false"
            class="h-4 w-4 rounded-[4px]"
          />
          <span
            class="truncate text-[11px] font-medium tracking-wide text-white/45"
          >
            Particle-Mineradio
          </span>
        </div>
      </div>

      <!-- 当前歌曲 -->
      <div class="mt-3 flex items-center gap-3">
        <div
          class="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/[0.06]"
        >
          <img
            v-if="state.cover && !coverFailed"
            :src="state.cover"
            alt=""
            draggable="false"
            class="h-full w-full object-cover"
            @error="coverFailed = true"
          />
          <div v-else class="grid h-full w-full place-items-center">
            <Music :size="18" class="text-white/30" />
          </div>

          <div
            v-if="state.isPlaying"
            class="absolute inset-x-0 bottom-0 flex h-4 items-end justify-center gap-0.5 bg-linear-to-t from-black/60 to-transparent px-1 pb-1"
          >
            <span class="eq-bar h-2" />
            <span class="eq-bar h-2" />
            <span class="eq-bar h-2" />
          </div>
        </div>

        <div class="min-w-0 flex-1">
          <div class="truncate text-[13px] font-medium text-white/90">
            {{ state.name || '未在播放' }}
          </div>
          <div class="mt-0.5 truncate text-[11px] text-white/40">
            {{ state.artist || (state.hasSong ? '—' : '打开主界面选择歌曲') }}
          </div>
        </div>

        <LoaderCircle
          v-if="state.loading"
          :size="15"
          class="shrink-0 animate-spin text-white/45"
        />
      </div>

      <!-- 进度 -->
      <div class="mt-3.5">
        <div class="relative h-1 w-full rounded-full bg-white/10">
          <div
            class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#00f5d4] to-[#9dfff1]"
            :style="{ width: `${progress}%` }"
          />
          <div
            class="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.45)]"
            :style="{ left: `calc(${progress}% - 4px)` }"
          />
          <input
            type="range"
            min="0"
            :max="state.duration || 0"
            step="0.1"
            :value="state.currentTime"
            :disabled="state.duration <= 0"
            class="absolute inset-0 -my-2 h-5 w-full cursor-pointer opacity-0 disabled:cursor-default"
            @input="onSeekInput"
          />
        </div>
        <div
          class="mt-1.5 flex items-center justify-between text-[10px] tabular-nums text-white/35"
        >
          <span>{{ fmt(state.currentTime) }}</span>
          <span>{{ fmt(state.duration) }}</span>
        </div>
      </div>

      <!-- 播放控制 -->
      <div class="mt-2.5 flex items-center justify-center gap-2.5">
        <button
          type="button"
          class="ctrl"
          :title="orderLabel"
          @click="send('order')"
        >
          <component :is="orderIcon" :size="16" />
        </button>

        <button
          type="button"
          class="ctrl"
          title="上一首"
          :disabled="!canControl"
          @click="send('prev')"
        >
          <SkipBack :size="17" />
        </button>

        <button
          type="button"
          title="播放 / 暂停"
          class="grid h-10 w-10 place-items-center rounded-full bg-white text-black shadow-[0_4px_16px_rgba(255,255,255,0.16)] transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          :disabled="!canControl"
          @click="send('toggle')"
        >
          <LoaderCircle v-if="state.loading" :size="18" class="animate-spin" />
          <Pause v-else-if="state.isPlaying" :size="18" fill="currentColor" />
          <Play v-else :size="18" fill="currentColor" class="ml-0.5" />
        </button>

        <button
          type="button"
          class="ctrl"
          title="下一首"
          :disabled="!canControl"
          @click="send('next')"
        >
          <SkipForward :size="17" />
        </button>
      </div>

      <!-- 音量 -->
      <div class="mt-2 flex items-center gap-2">
        <button
          type="button"
          title="静音"
          class="grid h-7 w-7 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white/85"
          @click="send('mute')"
        >
          <component :is="volumeIcon" :size="15" />
        </button>

        <div class="relative h-1 flex-1 rounded-full bg-white/10">
          <div
            class="absolute inset-y-0 left-0 rounded-full bg-white/65"
            :style="{ width: `${effectiveVolume}%` }"
          />
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            :value="effectiveVolume"
            class="absolute inset-0 -my-2 h-5 w-full cursor-pointer opacity-0"
            @input="onVolumeInput"
          />
        </div>

        <span class="w-6 text-right text-[10px] tabular-nums text-white/30">
          {{ effectiveVolume }}
        </span>
      </div>

      <div class="mt-3 h-px bg-white/10" />

      <!-- 底部操作 -->
      <div class="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          class="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] text-[11px] text-white/65 transition hover:bg-white/10 hover:text-white/90"
          @click="runTrayAction('show')"
        >
          <Monitor :size="14" />
          打开主界面
        </button>
        <button
          type="button"
          class="flex h-8 items-center justify-center gap-1.5 rounded-xl px-3 text-[11px] text-white/40 transition hover:bg-white/10 hover:text-white/80"
          @click="runTrayAction('quit')"
        >
          <LogOut :size="14" />
          退出
        </button>
      </div>
    </div>
  </div>
</template>

<style>
html,
body,
#app {
  height: 100%;
  width: 100%;
  margin: 0;
  overflow: hidden;
  background: transparent;
}

body {
  color: #fff;
  font-family: 'harmonyos', 'Microsoft YaHei UI', 'Segoe UI', sans-serif;
  user-select: none;
}
</style>

<style scoped>
.ctrl {
  display: grid;
  height: 30px;
  width: 30px;
  place-items: center;
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.72);
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
}

.ctrl:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.ctrl:active {
  transform: scale(0.94);
}

.ctrl:disabled {
  cursor: default;
  opacity: 0.35;
}

.ctrl:disabled:hover {
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
}

.eq-bar {
  width: 2px;
  border-radius: 999px;
  background: #00f5d4;
  animation: eq 0.9s ease-in-out infinite;
}

.eq-bar:nth-child(2) {
  animation-delay: 0.15s;
}

.eq-bar:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes eq {
  0%,
  100% {
    height: 3px;
  }
  50% {
    height: 10px;
  }
}
</style>
