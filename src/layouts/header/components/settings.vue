<template>
  <ComDialog v-model="isShow" width="500px" title="设置">
    <template #content>
      <div class="pb-4 px-5">
        <div class="pb-3.75">
          <div class="text-white text-[14px] text-start py-2">主题</div>
          <div
            ref="themeScrollRef"
            :class="{ dragging: isDragging }"
            class="theme-scroll flex items-center w-full overflow-x-auto"
            @wheel="onThemeWheel"
            @pointerdown="onThemePointerDown"
            @pointermove="onThemePointerMove"
            @pointerup="onThemePointerUp"
            @pointercancel="onThemePointerUp"
            @click.capture="onThemeClickCapture"
          >
            <div
              v-for="theme in themes"
              :key="theme.value"
              @click.stop="updateTheme(theme.value)"
              :class="{
                active: useStore.settings.theme === theme.value
              }"
              class="w-25 h-25 shrink-0 rounded-lg overflow-hidden cursor-pointer mr-2 border border-solid border-[#333] hover:border-[#777]"
            >
              <component :is="theme.component" />
            </div>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <div class="text-white text-[14px] text-start py-2">退出时动作</div>
          <div class="flex items-center">
            <div
              v-for="radio in radioList"
              :key="radio.value"
              class="flex items-center ml-2"
              @click="onRadio(radio.value)"
            >
              <div
                :class="{
                  'active-radio': useStore.settings.exitAction === radio.value
                }"
                class="relative w-5 h-5 rounded-[50%] border border-solid border-[#333]"
              ></div>
              <div class="text-white text-[14px] ml-2">{{ radio.name }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </ComDialog>
</template>

<script setup lang="ts">
import Lines from '@src/layouts/three-bg/components/lines.vue'
import MusicLine from '@src/layouts/three-bg/components/music-line.vue'
import Weather from '@src/layouts/three-bg/components/weather.vue'
import Video from '@src/layouts/three-bg/components/video.vue'
import SkullHead from '@src/layouts/three-bg/components/skull-head.vue'
import { useUserStore } from '@src/stores/user'

const useStore = useUserStore()

const isShow = ref<boolean>(false)

// ============ 主题列表横向滚动（滚轮 + 拖拽） ============
const themeScrollRef = ref<HTMLDivElement | null>(null)
const isDragging = ref<boolean>(false)
let dragStartX = 0
let dragStartScroll = 0
let dragMoved = false
let dragPointerId = -1

/** 纵向滚轮转横向滚动（横向容器默认不响应滚轮） */
const onThemeWheel = (e: WheelEvent): void => {
  const el = themeScrollRef.value
  if (!el || e.deltaY === 0) return
  e.preventDefault()
  el.scrollLeft += e.deltaY
}

const onThemePointerDown = (e: PointerEvent): void => {
  const el = themeScrollRef.value
  if (!el || e.button !== 0) return
  isDragging.value = true
  dragMoved = false
  dragPointerId = e.pointerId
  dragStartX = e.clientX
  dragStartScroll = el.scrollLeft
}

const onThemePointerMove = (e: PointerEvent): void => {
  const el = themeScrollRef.value
  if (!el || !isDragging.value) return
  const dx = e.clientX - dragStartX
  if (!dragMoved && Math.abs(dx) > 4) {
    dragMoved = true
    // 注意：必须在判定为拖拽后才捕获指针。
    // 若在 pointerdown 就捕获，随后的 click 会被重定向到容器，子元素的 @click 将收不到
    el.setPointerCapture(dragPointerId)
  }
  if (dragMoved) el.scrollLeft = dragStartScroll - dx
}

const onThemePointerUp = (): void => {
  const el = themeScrollRef.value
  if (!el || !isDragging.value) return
  isDragging.value = false
  if (dragPointerId !== -1 && el.hasPointerCapture(dragPointerId)) {
    el.releasePointerCapture(dragPointerId)
  }
  dragPointerId = -1
}

/** 拖拽结束后抑制 click，避免误触发主题切换 */
const onThemeClickCapture = (e: MouseEvent): void => {
  if (dragMoved) {
    e.stopPropagation()
    e.preventDefault()
    dragMoved = false
  }
}

const themes = reactive<Record<string, any>[]>([
  { value: 0, component: markRaw(Lines) },
  { value: 1, component: markRaw(MusicLine) },
  { value: 2, component: markRaw(Weather) },
  { value: 3, component: markRaw(Video) },
  { value: 4, component: markRaw(SkullHead) }
])

const radioList = reactive<Record<string, any>[]>([
  { name: '最小化关闭', value: 0 },
  { name: '退出应用', value: 1 }
])

const updateTheme = (val: number): void => {
  useStore.settings.theme = val
}

const onRadio = (val: number): void => {
  useStore.settings.exitAction = val
}
</script>

<style scoped lang="scss">
.theme-scroll {
  cursor: grab;
}

.active {
  border-color: #fff;
}

.active-radio {
  border-color: #fff;
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #fff;
  }
}
</style>
