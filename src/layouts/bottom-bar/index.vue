<template>
  <div class="w-full p-[20px_100px] box-border">
    <!-- style="background: linear-gradient(90deg, #72749a 0%, #fff5df 100%)" -->
    <div
      id="common-transparent"
      class="border border-solid border-[#171717] shadow-lg rounded-4xl p-[8px_15px] flex items-center justify-between"
    >
      <div class="w-45 flex items-center">
        <div class="w-12 h-12 rounded-[50%] bg-[#171717]"></div>
        <div class="ml-1.5">
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
        <div id="common-transparent" class="cursor-pointer p-3 rounded-4xl">
          <LoaderCircle
            v-if="playerStore.loading"
            color="white"
            :size="18"
            class="animate-spin"
          />
          <Pause
            v-else-if="playerStore.isPlaying"
            color="white"
            :size="18"
            @click="playerStore.togglePlay()"
          />
          <Play
            v-else
            color="white"
            :size="18"
            @click="playerStore.togglePlay()"
          />
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
          class="text-white text-[18px] font-500 cursor-pointer p-1 rounded-lg common-transparent"
        >
          词
        </div>
        <div class="cursor-pointer p-1 rounded-lg common-transparent">
          <component :is="isMuted" color="white" :size="18" />
        </div>
        <div class="cursor-pointer p-1 rounded-lg common-transparent">
          <Sparkles color="white" :size="18" @click="openImmersion" />
        </div>
        <div class="text-white text-[14px]">
          {{ formatPlayTime(playerStore.currentTime) }} /
          {{ formatPlayTime(playerStore.duration) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Volume2,
  Volume1,
  Volume,
  // VolumeX,
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

const emits = defineEmits(['openImmersion', 'openMusicList'])

const playerStore = usePlayerStore()

const isMuted = computed(() => {
  const volume: number = 100
  if (volume >= 90) {
    return markRaw(Volume2)
  } else if (volume >= 50) {
    return markRaw(Volume1)
  } else if (volume >= 0) {
    return markRaw(Volume)
  } else {
    return markRaw(VolumeOff)
  }
})

const openImmersion = (): void => {
  emits('openImmersion')
}

const openMusicList = (): void => {
  emits('openMusicList')
}
</script>

<style scoped lang="scss">
.liquid-glass {
  /* 公式：模糊 + 提饱和 + 微调亮度 */
  -webkit-backdrop-filter: blur(14px) saturate(1.7) brightness(1.05);
  backdrop-filter: blur(14px) saturate(1.7) brightness(1.05);

  /* 半透明底色：不要纯白，留一点通透 */
  background: rgba(255, 255, 255, 0.35);
  /* 边缘高光：双层 box-shadow 模拟玻璃切面 */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.65),
    inset 0 -1px 0 rgba(255, 255, 255, 0.25),
    0 8px 32px rgba(0, 0, 0, 0.12);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.45);
}
</style>
