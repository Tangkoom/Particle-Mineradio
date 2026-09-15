<template>
  <div class="h-full w-full flex flex-col relative">
    <!-- <video
      src="@src/assets/video/Black-Dress-Princess-4K.mp4"
      autoplay
      muted
      loop
      playsinline
      class="w-full h-full absolute top-0 left-0 object-fill z-[-1]"
    ></video> -->
    <NavHeader />
    <div class="w-full h-[calc(100%-48px)]">
      <div
        class="w-full h-[calc(100%-100px)] p-5 pb-0 box-border flex items-center justify-between"
      >
        <div
          class="w-[35%] h-full rounded-2xl relative transform transition-all! duration-300 ease-in-out opacity-100% daily-review-card"
          :class="{
            '-translate-x-full opacity-0': isImmersion
          }"
        >
          <div class="z-1 p-5 flex flex-col justify-end">
            <div class="text-[12px] font-bold text-[#AFACAC]">
              {{ currentData.date }}
            </div>
            <div class="text-white text-[70px] leading-17.5 font-bold mb-2">
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
                class="tag p-[4px_8px] text-[12px] text-[#AFACAC] border border-solid border-[#171717] rounded-2xl cursor-pointer mr-2"
              >
                换一条
              </div>
              <div
                class="tag p-[4px_8px] text-[12px] text-[#AFACAC] border border-solid border-[#171717] rounded-2xl cursor-pointer mr-2"
              >
                选择MP4
              </div>
              <div
                class="tag p-[4px_8px] text-[12px] text-[#AFACAC] border border-solid border-[#171717] rounded-2xl cursor-pointer"
              >
                展开播放器控制台
              </div>
            </div>
          </div>
        </div>
        <div
          class="w-[calc(65%-16px)] h-full ml-4 relative transform transition-all! duration-300 ease-in-out opacity-100%"
          :class="{
            'translate-x-full opacity-0': isImmersion
          }"
        >
          <div class="w-full h-60 grid grid-cols-2 gap-4">
            <div
              v-for="(item, index) in commonlyUsedItem"
              :key="index"
              class="rounded-2xl commonly-used flex items-center justify-between p-5 box-border cursor-pointer"
              @click="onClick(item)"
            >
              <div>
                <div class="text-white text-[12px] font-bold">
                  {{ item.en }}
                </div>
                <div class="text-white text-[20px] font-bold">
                  {{ item.title }}
                </div>
                <div class="text-[rgba(255,255,255,0.55)] text-[12px]">
                  {{ item.sub }}
                </div>
              </div>
              <div></div>
            </div>
          </div>
          <ScrollAreaRoot
            class="w-full h-[calc(100%-260px)] mt-5 relative overflow-hidden"
            style="--scrollbar-size: 10px"
          >
            <ScrollAreaViewport class="w-full h-full rounded">
              <div class="w-full flex items-center">
                <div class="w-[55%] commonly-used rounded-2xl p-[12px_20px]">
                  <div class="flex items-center justify-between">
                    <span class="text-[rgba(255,255,255,0.82)] text-[10px]"
                      >LISTENING TODAY · 今日聆听</span
                    >
                    <span
                      class="text-[rgba(255,255,255,0.42)] text-[10px] cursor-pointer hover:text-white"
                      >查看偏好</span
                    >
                  </div>
                  <div class="flex items-center justify-between mt-2">
                    <div class="flex-1 flex flex-col">
                      <span class="text-white text-[20px] font-bold">
                        <a href="https://music.163.com/">0分钟</a>
                      </span>
                      <span class="text-[rgba(255,255,255,0.42)] text-[10px]">
                        聆听时长
                      </span>
                    </div>
                    <div class="flex-1 flex flex-col">
                      <span class="text-white text-[20px] font-bold">2首</span>
                      <span class="text-[rgba(255,255,255,0.42)] text-[10px]">
                        今日听歌
                      </span>
                    </div>
                    <div class="flex-1 flex flex-col">
                      <span class="text-white text-[20px] font-bold"
                        >蔡健雅</span
                      >
                      <span class="text-[rgba(255,255,255,0.42)] text-[10px]">
                        连续聆听1天
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  class="w-[calc(45%-16px)] ml-4 commonly-used rounded-2xl p-[12px_14px] flex items-center justify-between"
                >
                  <div class="flex items-center h-full">
                    <img src="" class="w-17 h-17 rounded-xl bg-[#ccc]" />
                    <div class="flex flex-col h-full justify-between ml-2">
                      <div
                        class="text-[rgba(255,255,255,0.82)] text-[10px] pb-1.75"
                      >
                        NEXT UP · 接下来播放
                      </div>
                      <div
                        class="text-[rgba(255,255,255,0.82)] text-[14px] pb-1.75"
                      >
                        情不自禁
                      </div>
                      <div class="text-[rgba(255,255,255,0.42)] text-[10px]">
                        胡彦斌
                      </div>
                    </div>
                  </div>
                  <div
                    class="p-1 rounded-4xl common-transparent cursor-pointer"
                  >
                    <ChevronRight color="white" :size="18" />
                  </div>
                </div>
              </div>
              <div class="w-full flex items-center mt-4">
                <div
                  class="w-full commonly-used rounded-2xl p-[12px_20px] flex items-center justify-between"
                >
                  <div>
                    <div class="text-[rgba(255,255,255,0.82)] text-[10px] pb-1">
                      FOR YOU · 为你挑选
                    </div>
                    <div class="text-white text-[18px] font-bold">
                      换一首，也许正和心意
                    </div>
                    <div class="text-[rgba(255,255,255,0.42)] text-[10px]">
                      从每日推荐、歌单与本地音乐中挑选
                    </div>
                  </div>
                </div>
              </div>
              <div class="w-full flex items-center mt-4">
                <div
                  class="w-[55%] commonly-used rounded-2xl p-[12px_20px] flex items-center justify-between"
                >
                  <div
                    class="w-[calc(100%-84px)] flex flex-col justify-between h-full"
                  >
                    <div class="text-[rgba(255,255,255,0.82)] text-[10px] pb-1">
                      DISCOVER · 音乐发现
                    </div>
                    <div class="text-white text-[18px] font-bold">
                      平台热歌与个人偏好
                    </div>
                    <div
                      class="text-[rgba(255,255,255,0.42)] text-[10px] truncate"
                    >
                      打开平台推荐中心，没有可信推荐接口时会明确留空
                    </div>
                  </div>
                  <div class="flex items-center">
                    <div class="transparent-btn">
                      <ChartNoAxesColumn color="white" :size="22" />
                    </div>
                    <div
                      class="ml-1 p-1 rounded-4xl common-transparent cursor-pointer box-border"
                    >
                      <ChevronRight color="white" :size="18" />
                    </div>
                  </div>
                </div>
                <div
                  class="w-[calc(45%-16px)] ml-4 commonly-used rounded-2xl p-[12px_14px] flex items-center justify-between"
                >
                  <div
                    class="w-[calc(100%-84px)] flex flex-col justify-between h-full"
                  >
                    <div class="text-[rgba(255,255,255,0.82)] text-[10px] pb-1">
                      PLATFORM PICKS · 平台推荐
                    </div>
                    <div class="text-white text-[18px] font-bold">
                      推荐电台/歌单
                    </div>
                    <div
                      class="text-[rgba(255,255,255,0.42)] text-[10px] truncate"
                    >
                      读取每日歌曲、推荐歌单与推荐 Feed，不用关键词搜索
                    </div>
                  </div>
                  <div class="flex items-center">
                    <div class="transparent-btn">
                      <AudioLines color="white" :size="22" />
                    </div>
                    <div
                      class="ml-1 p-1 rounded-4xl common-transparent cursor-pointer box-border"
                    >
                      <ChevronRight color="white" :size="18" />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar
              class="flex select-none touch-none p-0.5 z-20 transition-colors duration-160 ease-out hover:bg-blackA2 data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:h-2.5"
              orientation="vertical"
            >
              <ScrollAreaThumb
                class="flex-1 rounded-[10px] relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-full before:h-full before:min-w-11 before:min-h-11"
              />
            </ScrollAreaScrollbar>
          </ScrollAreaRoot>
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
import { Minus, ChevronRight, AudioLines, ChartNoAxesColumn } from '@lucide/vue'
import { commonlyUsedItem } from './util'
import dayjs from 'dayjs'
import createWindow from '@src/utils/createWindow'

let timer: any

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

const onClick = (item: Record<string, any>): void => {
  console.log(item)
  createWindow.createWin({
    label: 'settings',
    title: '设置',
    url: '/settings',
    width: 400,
    height: 600,
    decorations: false,
    transparent: true,
    shadow: false
  })
}

onMounted(() => {
  updateCurrentTime()
  timer = setInterval(updateCurrentTime)
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

.tag:hover {
  color: #fff;
  border-color: #fff;
  background: rgba(255, 255, 255, 0.12);
}

.transparent-btn {
  position: relative;
  width: 54px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background:
    radial-gradient(
      circle at 50% 50%,
      rgba(var(--fc-accent-rgb), 0.23),
      transparent 60%
    ),
    rgba(255, 255, 255, 0.035);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.11);
}
</style>
