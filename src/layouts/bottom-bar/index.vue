<template>
  <div class="w-full p-[20px_100px] box-border">
    <div
      id="common-transparent"
      class="relative border border-solid border-[#171717] shadow-lg rounded-4xl p-[8px_15px] flex items-center justify-between overflow-visible"
    >
      <div class="w-45 flex items-center">
        <!-- 圆环进度 + 居中旋转封面：点击圆环按角度跳转 -->
        <div
          class="relative w-12 h-12 flex items-center justify-center shrink-0"
        >
          <svg
            class="absolute inset-0 -rotate-90 cursor-pointer cover-ring"
            viewBox="0 0 48 48"
            @click="onRingSeek"
          >
            <circle
              cx="24"
              cy="24"
              r="22"
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              stroke-width="2"
            />
            <circle
              cx="24"
              cy="24"
              r="22"
              fill="none"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
              :stroke-dasharray="CIRCUMFERENCE"
              :stroke-dashoffset="CIRCUMFERENCE * (1 - progressPct / 100)"
              class="cover-ring-progress"
            />
          </svg>
          <img
            v-if="playerStore.current?.coverUrl"
            :src="playerStore.current.coverUrl"
            :alt="playerStore.current.name"
            class="w-10 h-10 rounded-full object-cover bg-[#171717] cover-img"
            :class="{ 'is-playing': playerStore.isPlaying }"
          />
          <div
            v-else
            class="w-10 h-10 rounded-full bg-[#171717] flex items-center justify-center"
          >
            <Music color="rgba(255,255,255,0.4)" :size="18" />
          </div>
        </div>
        <div class="ml-1.5 min-w-0">
          <div class="text-white text-[14px] truncate w-31.5">
            {{ playerStore.current?.name || '未在播放' }}
          </div>
          <div class="text-white text-[12px] truncate w-31.5">
            {{ playerStore.current?.artist || '--' }}
          </div>
        </div>
      </div>
      <div class="flex items-center">
        <div
          class="cursor-pointer p-1 rounded-lg common-transparent mx-2"
          @click="playerStore.cyclePlayOrder()"
        >
          <Repeat
            v-if="playerStore.playOrder === 'repeat'"
            color="white"
            :size="18"
          />
          <Repeat1
            v-else-if="playerStore.playOrder === 'repeat1'"
            color="white"
            :size="18"
          />
          <Shuffle
            v-else-if="playerStore.playOrder === 'shuffle'"
            color="white"
            :size="18"
          />
        </div>
        <div
          class="cursor-pointer p-1 rounded-lg common-transparent mx-2"
          @click="playerStore.playPrev()"
        >
          <SkipBack color="white" :size="18" />
        </div>
        <div
          id="common-transparent"
          class="cursor-pointer p-3 rounded-4xl"
          @click="playerStore.togglePlay()"
        >
          <LoaderCircle
            v-if="playerStore.loading"
            color="white"
            :size="18"
            class="animate-spin"
          />
          <Pause v-else-if="playerStore.isPlaying" color="white" :size="18" />
          <Play v-else color="white" :size="18" />
        </div>
        <div
          class="cursor-pointer p-1 rounded-lg common-transparent mx-2"
          @click="playerStore.playNext()"
        >
          <SkipForward color="white" :size="18" />
        </div>
        <div class="cursor-pointer p-1 rounded-lg common-transparent mx-2">
          <ListMusic color="white" :size="18" @click.stop="openMusicList" />
        </div>
      </div>
      <div class="flex items-center justify-between w-45">
        <div
          class="text-white text-[14px] font-500 cursor-pointer p-1 rounded-lg common-transparent"
          :class="{ 'text-[rgba(255,255,255,0.4)]!': !lyricsActive }"
          @click="toggleLyrics"
        >
          词
        </div>
        <!-- 音量：图标点击静音，hover 出垂直滑条 -->
        <div
          class="relative cursor-pointer p-1 rounded-lg common-transparent volume-wrap"
          @wheel.prevent="onVolumeWheel"
        >
          <component
            :is="volumeIcon"
            color="white"
            :size="18"
            @click="playerStore.toggleMute()"
          />
          <div class="volume-popover">
            <div class="volume-track" @click.stop>
              <div
                class="volume-fill"
                :style="{ height: `${effectiveVolume}%` }"
              />
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                :value="effectiveVolume"
                class="volume-range"
                @input="onVolumeInput"
              />
            </div>
            <div class="text-white text-[10px] text-center tabular-nums">
              {{ effectiveVolume }}
            </div>
          </div>
        </div>
        <div
          class="cursor-pointer p-1 rounded-lg common-transparent"
          @click="openImmersion"
        >
          <Sparkles color="white" :size="18" />
        </div>
        <div class="text-white text-[14px] tabular-nums">
          {{ formatPlayTime(playerStore.currentTime) }} /
          {{ formatPlayTime(playerStore.duration) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Music,
  Volume2,
  Volume1,
  Volume,
  VolumeOff,
  Sparkles,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  Pause,
  Play,
  SkipForward,
  ListMusic,
  LoaderCircle
} from '@lucide/vue'
import { usePlayerStore, formatPlayTime } from '@src/stores/player'
import { markRaw } from 'vue'

const emits = defineEmits(['openImmersion', 'openMusicList', 'openLyrics'])

const playerStore = usePlayerStore()

/** 歌词面板开关：父级通过 openLyrics 事件控制显示 */
const lyricsActive = ref(false)
const toggleLyrics = (): void => {
  lyricsActive.value = !lyricsActive.value
  emits('openLyrics', lyricsActive.value)
}

/** 实际生效的音量：静音时按 0 处理 */
const effectiveVolume = computed(() =>
  playerStore.muted ? 0 : playerStore.volume
)

const volumeIcon = computed(() => {
  const v = effectiveVolume.value
  if (v === 0) return markRaw(VolumeOff)
  if (v >= 90) return markRaw(Volume2)
  if (v >= 50) return markRaw(Volume1)
  return markRaw(Volume)
})

const onVolumeInput = (e: Event): void => {
  const target = e.target as HTMLInputElement
  playerStore.setVolume(Number(target.value))
}

/** 鼠标滚轮在音量图标上微调音量 */
const onVolumeWheel = (e: WheelEvent): void => {
  const delta = e.deltaY < 0 ? 5 : -5
  playerStore.setVolume(playerStore.volume + delta)
}

// ============ 圆环进度 / 跳转 ============
const RING_RADIUS = 22
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const progressPct = computed(() => {
  const d = playerStore.duration
  if (!d || !Number.isFinite(d)) return 0
  return Math.min(100, (playerStore.currentTime / d) * 100)
})

/** 点击圆环按角度跳转：把点击位置换算成相对圆心的角度（顺时针从 12 点起） */
const onRingSeek = (e: MouseEvent): void => {
  if (!playerStore.duration) return
  const svg = e.currentTarget as SVGElement
  const rect = svg.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = e.clientX - cx
  const dy = e.clientY - cy
  // atan2 返回从 3 点方向起的弧度，+π/2 让 12 点方向为 0；负值规范化到 [0,2π)
  let angle = Math.atan2(dy, dx) + Math.PI / 2
  if (angle < 0) angle += Math.PI * 2
  const ratio = angle / (Math.PI * 2)
  playerStore.seek(ratio * playerStore.duration)
}

const openImmersion = (): void => {
  emits('openImmersion')
}

const openMusicList = (): void => {
  emits('openMusicList')
}
</script>

<style scoped lang="scss">
.volume-wrap {
  position: relative;

  .volume-popover {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%) scale(0.92);
    transform-origin: bottom center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 8px 8px;
    border-radius: 12px;
    background: rgba(12, 14, 18, 0.94);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(20px) saturate(1.4);
    opacity: 0;
    pointer-events: none;
    transition:
      opacity 0.18s ease,
      transform 0.18s ease;
    z-index: 30;
  }

  &:hover .volume-popover {
    transform: translateX(-50%) scale(1);
    opacity: 1;
    pointer-events: auto;
  }
}

.volume-track {
  position: relative;
  width: 6px;
  height: 80px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.volume-fill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, #fff, rgba(255, 255, 255, 0.7));
  border-radius: 4px;
  transition: height 0.08s ease;
}

.volume-range {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  opacity: 0;
  cursor: pointer;
  /* 旋转滑条为垂直方向 */
  writing-mode: vertical-lr;
  direction: rtl;
}

.cover-ring {
  /* hover 时圆环增粗，方便点击 */
  &:hover circle {
    stroke-width: 2.6;
  }
}

.cover-ring-progress {
  /* 进度变化时平滑过渡，避免每秒抖动 */
  transition: stroke-dashoffset 0.1s linear;
}

/* 封面旋转：默认暂停，加 .is-playing 后开始旋转；暂停时停在当前角度 */
.cover-img {
  animation: cover-spin 12s linear infinite;
  animation-play-state: paused;
  will-change: transform;

  &.is-playing {
    animation-play-state: running;
  }
}

@keyframes cover-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
