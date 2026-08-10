<template>
  <div class="w-full p-[20px_100px] box-border">
    <div
      id="common-transparent"
      class="border border-solid border-[#171717] shadow-lg rounded-4xl p-[8px_15px] flex items-center justify-between"
    >
      <div class="w-45 flex items-center">
        <div class="w-12 h-12 rounded-[50%] bg-[#171717]"></div>
        <div class="ml-1.5">
          <div class="text-white text-[14px] truncate w-31.5">
            下一次爱情来的时候
          </div>
          <div class="text-white text-[12px]">蔡健雅</div>
        </div>
      </div>
      <div class="flex items-center">
        <div class="cursor-pointer p-1 rounded-lg common-transparent mx-2">
          <Repeat
            v-if="order === 'repeat'"
            color="white"
            :size="18"
            @click="playOrder('repeat')"
          />
          <Repeat1
            v-else-if="order === 'repeat1'"
            color="white"
            :size="18"
            @click="playOrder('repeat1')"
          />
          <Shuffle
            v-else-if="order === 'shuffle'"
            color="white"
            :size="18"
            @click="playOrder('shuffle')"
          />
        </div>
        <div class="cursor-pointer p-1 rounded-lg common-transparent mx-2">
          <SkipBack color="white" :size="18" />
        </div>
        <div id="common-transparent" class="cursor-pointer p-3 rounded-4xl">
          <Pause
            v-if="playArea"
            color="white"
            :size="18"
            @click="playArea = false"
          />
          <Play v-else color="white" :size="18" @click="playArea = true" />
        </div>
        <div class="cursor-pointer p-1 rounded-lg common-transparent mx-2">
          <SkipForward color="white" :size="18" />
        </div>
        <div class="cursor-pointer p-1 rounded-lg common-transparent mx-2">
          <ListMusic color="white" :size="18" />
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
        <div class="text-white text-[14px]">00:00 / 00:00</div>
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
  ListMusic
} from '@lucide/vue'

const { order } = defineProps<{
  order: string
}>()

const emits = defineEmits(['openImmersion', 'playOrder'])

const playArea = ref<boolean>(false)

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

const playOrder = (order: string): void => {
  emits('playOrder', order)
}
</script>

<style scoped lang="scss"></style>
