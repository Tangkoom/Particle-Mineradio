<template>
  <div class="w-full p-[20px_100px] box-border">
    <div
      id="common-transparent"
      class="relative border border-solid border-[#171717] shadow-lg rounded-4xl p-[8px_15px] flex items-center justify-between overflow-visible"
    >
      <div class="w-60 flex items-center">
        <!-- 圆环进度 + 居中旋转封面：点击圆环按角度跳转 -->
        <div
          class="relative w-12 h-12 flex items-center justify-center shrink-0"
        >
          <svg
            class="absolute inset-0 -rotate-90 cursor-pointer cover-ring"
            viewBox="0 0 48 48"
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
      <div class="flex items-center justify-between w-60">
        <div
          @click.stop="toggleQualityMenu"
          class="relative text-white text-[14px] font-500 cursor-pointer p-1 rounded-lg common-transparent"
          :class="{ 'bg-white/10': showQualityMenu }"
        >
          {{ currentQualityLabel }}
          <Transition name="quality-menu">
            <div
              v-if="showQualityMenu"
              class="absolute bottom-full mb-2 right-0 w-52 rounded-xl border border-white/10 bg-[rgba(12,14,18,0.94)] backdrop-blur-xl shadow-2xl z-50 p-1"
              @click.stop
            >
              <div
                v-for="opt in qualityOptions"
                :key="opt.value"
                class="flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-white text-[12px] hover:bg-white/8 transition"
                :class="{ 'bg-white/12': playerStore.quality === opt.value }"
                @click.stop="onSelectQuality(opt.value)"
              >
                <span class="font-500">{{ opt.label }}</span>
                <span class="text-[10px] text-white/40">{{ opt.desc }}</span>
              </div>
            </div>
          </Transition>
        </div>
        <div
          class="text-white text-[14px] font-500 cursor-pointer p-1 rounded-lg common-transparent"
          :class="{ 'text-[rgba(255,255,255,0.4)]!': !lyricsActive }"
          @click="toggleLyrics"
        >
          词
        </div>
        <!-- 音量：图标点击静音，hover 出垂直滑条 -->
        <div
          class="group relative cursor-pointer p-1 rounded-lg common-transparent"
          @wheel.prevent="onVolumeWheel"
        >
          <component
            :is="volumeIcon"
            color="white"
            :size="18"
            @click="playerStore.toggleMute()"
          />
          <div
            class="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 scale-[0.92] origin-bottom flex flex-col items-center gap-1.5 pt-2.5 px-2 pb-2 rounded-xl bg-[rgba(12,14,18,0.94)] border border-[rgba(255,255,255,0.08)] shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-[20px] backdrop-saturate-[1.4] opacity-0 pointer-events-none transition duration-180 ease z-30 group-hover:scale-100 group-hover:opacity-100 group-hover:pointer-events-auto"
          >
            <div
              class="relative w-1.5 h-20 rounded bg-[rgba(255,255,255,0.12)] overflow-hidden"
              @click.stop
            >
              <div
                class="absolute inset-x-0 bottom-0 rounded bg-linear-to-b from-white to-[rgba(255,255,255,0.7)] transition-[height] duration-80 ease"
                :style="{ height: `${effectiveVolume}%` }"
              />
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                :value="effectiveVolume"
                class="absolute inset-0 w-full h-full m-0 p-0 opacity-0 cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
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
          {{ currentTimeText }} / {{ durationText }}
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
import {
  NETEASE_QUALITY_OPTIONS,
  type NeteaseQuality
} from '@src/utils/netease'

const emits = defineEmits(['openImmersion', 'openMusicList', 'openLyrics'])

const playerStore = usePlayerStore()

/** 歌词面板开关：父级通过 openLyrics 事件控制显示 */
const lyricsActive = ref<boolean>(false)
const showQualityMenu = ref<boolean>(false)

const qualityOptions = NETEASE_QUALITY_OPTIONS
const currentQualityLabel = computed(
  () =>
    qualityOptions.find((o) => o.value === playerStore.quality)?.label ?? '极高'
)

const toggleLyrics = (): void => {
  lyricsActive.value = !lyricsActive.value
  emits('openLyrics', lyricsActive.value)
}

const toggleQualityMenu = (): void => {
  showQualityMenu.value = !showQualityMenu.value
}

const onSelectQuality = (q: NeteaseQuality): void => {
  playerStore.setQuality(q)
  showQualityMenu.value = false
}

/** 点击 bottom-bar 外部时关闭下拉：bottom-bar 容器内的事件不会冒泡到 document */
const onDocClick = (): void => {
  showQualityMenu.value = false
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

// 缓存时间格式化结果，避免每次渲染重复调用 formatPlayTime
const currentTimeText = computed(() => formatPlayTime(playerStore.currentTime))
const durationText = computed(() => formatPlayTime(playerStore.duration))

const openImmersion = (): void => {
  emits('openImmersion')
}

const openMusicList = (): void => {
  emits('openMusicList')
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped lang="scss">
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

/* 音质下拉框进出动画 */
.quality-menu-enter-active,
.quality-menu-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.quality-menu-enter-from,
.quality-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
