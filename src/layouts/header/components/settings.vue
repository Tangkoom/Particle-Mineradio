<template>
  <ComDialog v-model="isShow" width="500px" :title="t('设置')">
    <template #content>
      <div class="pb-4 px-5">
        <div class="pb-3.75">
          <div class="text-white text-[14px] text-start py-2">
            {{ t('主题') }}
          </div>
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
          <div class="text-white text-[14px] text-start py-2">
            {{ t('选择语言') }}
          </div>
          <SelectRoot
            :model-value="useStore.settings.lang"
            @update:model-value="onLangChange"
          >
            <SelectTrigger
              class="inline-flex min-w-[160px] items-center justify-between rounded-lg px-[15px] text-xs leading-none h-[35px] gap-[5px] bg-[#111] text-white text-grass11 hover:bg-[#222] border shadow-sm focus:shadow-[0_0_0_2px] focus:shadow-black outline-none"
              aria-label="Select language"
            >
              <SelectValue :placeholder="t('选择语言')" />
              <ChevronDown />
            </SelectTrigger>

            <SelectPortal>
              <SelectContent
                class="min-w-[160px] bg-white rounded-lg shadow-sm z-[100]"
                :side-offset="5"
              >
                <SelectViewport class="p-[5px]">
                  <SelectGroup>
                    <SelectItem
                      v-for="option in languageOptions"
                      :key="option.value"
                      class="text-xs leading-none text-grass11 rounded-[3px] flex items-center h-[25px] pr-[35px] pl-[25px] relative select-none data-[disabled]:text-mauve8 data-[disabled]:pointer-events-none data-[highlighted]:outline-none data-[highlighted]:bg-green9 data-[highlighted]:text-green1"
                      :value="option.value"
                    >
                      <SelectItemText>
                        {{ option.name }}
                      </SelectItemText>
                    </SelectItem>
                  </SelectGroup>
                </SelectViewport>
              </SelectContent>
            </SelectPortal>
          </SelectRoot>
        </div>
        <div class="flex items-center justify-between">
          <div class="text-white text-[14px] text-start py-2">
            {{ t('退出时动作') }}
          </div>
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
              <div class="text-white text-[14px] ml-2">{{ t(radio.name) }}</div>
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
import { ChevronDown } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@src/stores/user'
import { setLocale, type AppLocale } from '@src/i18n'

const useStore = useUserStore()

const { t } = useI18n({ useScope: 'global' })

const isShow = ref<boolean>(false)

/** 语言选项固定显示各语言自身的名称，不参与翻译 */
const languageOptions: { name: string; value: AppLocale }[] = [
  { name: '中文', value: 'zh' },
  { name: 'English', value: 'en' }
]

/** 切换界面语言：写入 i18n 并持久化到 store，重启后仍生效 */
const onLangChange = (value: unknown): void => {
  useStore.settings.lang = setLocale(String(value ?? ''))
}

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
