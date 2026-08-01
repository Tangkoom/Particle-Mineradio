<template>
  <div class="h-full w-full flex flex-col relative">
    <!-- <video
      src="@src/assets/video/Black-Dress-Princess-4K.mp4"
      autoplay
      loop
      class="w-full h-full absolute top-0 left-0 object-fill z-[-1]"
    ></video> -->
    <NavHeader />
    <div class="w-full h-[calc(100%-48px)]">
      <div
        class="w-full h-[calc(100%-100px)] p-5 pb-0 box-border flex items-center justify-between"
      >
        <div
          class="basis-[35%] grow-0 shrink-0 h-full rounded-2xl relative transform transition-all! duration-300 ease-in-out opacity-100% daily-review-card"
          :class="{
            '-translate-x-full opacity-0': isImmersion
          }"
        >
          <div class="z-1 p-5 flex flex-col justify-end">
            <div class="text-[12px] font-bold text-[#AFACAC]">
              {{ currentData.date }}
            </div>
            <div class="text-white text-[60px] leading-15 font-bold mb-2">
              {{ currentData.time }}
            </div>
            <div class="text-white text-[24px] font-bold mb-2">
              “慢一点没关系，重要的是一直在向喜欢的生活靠近”
            </div>
            <div class="flex items-center text-[12px] text-[#AFACAC] mb-4">
              <Minus color="white" :size="16" />
              每日热评
            </div>
            <div class="flex items-center">
              <div
                class="p-[4px_8px] text-[12px] text-[#AFACAC] border border-solid border-[#171717] rounded-2xl cursor-pointer mr-2"
              >
                换一条
              </div>
              <div
                class="p-[4px_8px] text-[12px] text-[#AFACAC] border border-solid border-[#171717] rounded-2xl cursor-pointer mr-2"
              >
                选择MP4
              </div>
              <div
                class="p-[4px_8px] text-[12px] text-[#AFACAC] border border-solid border-[#171717] rounded-2xl cursor-pointer"
              >
                展开播放器控制台
              </div>
            </div>
          </div>
        </div>
        <div
          class="basis-[calc(65%-16px)] grow-0 shrink-0 h-full ml-4 relative transform transition-all! duration-300 ease-in-out opacity-100%"
          :class="{
            'translate-x-full opacity-0': isImmersion
          }"
        >
          <div class="w-full h-60 grid grid-cols-2 gap-4">
            <div
              v-for="(item, index) in commonlyUsedItem"
              :key="index"
              class="rounded-2xl commonly-used flex items-center justify-between p-5 box-border cursor-pointer"
            >
              <div>
                <div class="text-white text-[12px] font-bold">
                  {{ item.en }}
                </div>
                <div class="text-white text-[20px] font-bold">
                  {{ item.title }}
                </div>
                <div class="text-[#808080] text-[12px]">{{ item.sub }}</div>
              </div>
              <div></div>
            </div>
          </div>
        </div>
      </div>
      <!-- 播放器 -->
      <BottomBar
        :order="currentData.order"
        @openImmersion="openImmersion"
        @playOrder="playOrder"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import NavHeader from './header/index.vue'
import BottomBar from './bottom-bar/index.vue'
import { Minus } from '@lucide/vue'
import { commonlyUsedItem } from './util'
import dayjs from 'dayjs'

let timer: number | null

const isImmersion = ref<boolean>(false)

const currentData = ref<Record<string, any>>({
  date: '',
  time: '',
  order: 'repeat'
})

const updateCurrentTime = (): void => {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  currentData.value.date = `${dayjs().format('YYYY年MM月DD日')} 星期${weekdays[dayjs().day()]}`
  currentData.value.time = dayjs().format('HH:mm')
}

const openImmersion = (): void => {
  isImmersion.value = !isImmersion.value
}

const playOrder = (order: string): void => {
  if (order === 'repeat') {
    currentData.value.order = 'repeat1'
  } else if (order === 'repeat1') {
    currentData.value.order = 'shuffle'
  } else if (order === 'shuffle') {
    currentData.value.order = 'repeat'
  }
}

onMounted(() => {
  updateCurrentTime()
  timer = setInterval(updateCurrentTime, 1000)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<style scoped lang="scss">
.daily-review-card {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  background:
    radial-gradient(
      520px 420px at 20% 12%,
      rgba(var(--fc-accent-rgb), 0.18),
      transparent 64%
    ),
    radial-gradient(
      360px 320px at 96% 4%,
      rgba(76, 100, 255, 0.17),
      transparent 66%
    ),
    linear-gradient(160deg, rgba(26, 31, 41, 0.38), rgba(4, 6, 10, 0.88));
  contain: layout paint style;
  isolation: isolate;
  filter: brightness(1) saturate(1);
  transform: translateZ(0);
  backface-visibility: hidden;
  transition: filter 0.28s ease;
  &:before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(4, 7, 12, 0.02), rgba(3, 5, 9, 0.88) 100%),
      repeating-linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.024) 0 1px,
        transparent 1px 42px
      );
    opacity: 1;
    transform: translateZ(0);
    backface-visibility: hidden;
    transition: opacity 0.28s ease;
  }
  &:hover {
    filter: brightness(1.055) saturate(1.06);
    &::before {
      opacity: 0.56;
    }
  }
}
</style>
