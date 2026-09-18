<template>
  <div
    class="titlebar h-12 w-full flex items-center justify-between px-2"
    data-tauri-drag-region
  >
    <div class="w-35"></div>
    <ComDialog customClose width="520px">
      <template #trigger>
        <DialogTrigger
          id="common-transparent"
          class="fixed top-2 left-2 w-38 h-12 flex items-center px-2 rounded-4xl cursor-pointer"
        >
          <AvatarRoot
            class="bg-black inline-flex h-9 w-9 select-none items-center justify-center overflow-hidden rounded-full align-middle"
          >
            <AvatarImage
              class="h-full w-full rounded-[inherit] object-cover"
              src="avatarUrl"
              alt="用户头像"
            />
          </AvatarRoot>
          <div class="text-white text-[12px] pl-1 truncate w-[calc(100%-40px)]">
            nickname
          </div>
        </DialogTrigger>
      </template>
      <template #close>
        <div
          id="common-transparent"
          class="text-[rgba(255,226,226,.78)] px-2.75 flex items-center justify-center bg-[rgb(92,25,31)]! rounded-lg text-[14px]"
        >
          退出登录
        </div>
        <DialogClose
          aria-label="Close"
          id="common-transparent"
          class="ml-2.75 cursor-pointer commmon-shadow hover:bg-red-500 w-7 h-7 rounded-lg flex items-center justify-center"
        >
          <X color="white" :size="16" />
        </DialogClose>
      </template>
      <template #content>
        <div ref="flowContainerRef" class="pt-5 flex justify-around relative">
          <div>
            <div class="login-platform-tabs relative flex items-center px-2.75">
              <div
                class="w-4 h-8 border border-solid border-[rgba(255,226,225,.1)] rounded-full flex items-center justify-center"
              >
                <Menu :size="16" color="rgba(255,226,225,.9)" />
              </div>
              <div class="flex items-center justify-center pl-2.75">
                <span class="provider-logo">NE</span>
                <b class="text-white pl-2.75">网易云</b>
                <small class="text-yellow-500 font-bold pl-2.75">VIP</small>
                <SwitchRoot
                  id="airplane-mode"
                  v-model="switchState"
                  class="ml-2.75 w-8 h-5 shadow-sm flex data-[state=unchecked]:bg-stone-300 data-[state=checked]:bg-stone-800 dark:data-[state=unchecked]:bg-stone-800 dark:data-[state=checked]:bg-stone-700 border border-stone-300 data-[state=checked]:border-stone-700 dark:border-stone-700 rounded-full relative transition-[background] focus-within:outline-none focus-within:shadow-[0_0_0_1px] focus-within:border-stone-800 focus-within:shadow-stone-800"
                >
                  <SwitchThumb
                    class="w-3.5 h-3.5 my-auto bg-white text-xs flex items-center justify-center shadow-xl rounded-full transition-transform translate-x-0.5 will-change-transform data-[state=checked]:translate-x-full"
                  />
                </SwitchRoot>
                <span
                  ref="sourcePortRef"
                  class="flow-port -right-1.5"
                  title="拖到 MR 接入口"
                  @mousedown.stop.prevent="startConnect"
                ></span>
              </div>
            </div>
          </div>
          <div class="login-platform-tabs w-50 relative p-4 box-border">
            <span
              ref="targetPortRef"
              class="flow-port -left-1.5"
              :class="{
                'flow-port-active': isConnecting,
                'flow-port-connected': isConnected
              }"
              title="MR 接入口"
            ></span>
            <div class="flex items-center pb-2.75">
              <div class="login-node-orb w-10! h-10!">MR</div>
              <div class="pl-2.75">
                <div
                  class="text-[rgba(255,255,255,.92)] text-[13px] font-bold text-start"
                >
                  MR
                </div>
                <div class="text-[rgba(255,255,255,.43)] text-[10px]">
                  等待接入
                </div>
              </div>
            </div>
            <div class="login-mode-nodes">
              <div
                style="box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05)"
                class="flex items-center p-1.5 mb-2.75 relative rounded-xl border border-solid border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.028)]"
              >
                <div class="provider-logo">QR</div>
                <b
                  class="font-bold text-white text-[13px] pl-2.75"
                  @click="handleAvatarClick"
                  >扫码</b
                >
              </div>
              <div
                class="flex items-center p-1.5 mb-2.75 relative rounded-xl border border-solid border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.028)]"
              >
                <div class="provider-logo">CK</div>
                <b class="font-bold text-white text-[13px] pl-2.75">Cookie</b>
              </div>
            </div>
          </div>
          <svg
            ref="flowSvgRef"
            class="flow-svg"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              v-if="tempLine"
              :d="tempLinePath"
              class="flow-temp-path"
              fill="none"
            />
            <path
              v-for="c in connections"
              :key="c.id"
              :d="c.path"
              class="flow-path"
              fill="none"
            />
          </svg>
        </div>
      </template>
    </ComDialog>
    <AutocompleteRoot class="relative w-[calc(100%-600px)]">
      <AutocompleteAnchor
        id="common-transparent"
        class="window-controls relative rounded-4xl min-w-85 w-full inline-flex items-center justify-between px-3.75 text-xs h-8.75 gap-1.25 transform transition-all duration-300 ease-in-out"
        :class="{
          'translate-y-2 z-999': isFocus
        }"
      >
        <AutocompleteTrigger>
          <Search color="white" :size="16" />
        </AutocompleteTrigger>
        <AutocompleteInput
          class="w-full outline-none h-full placeholder-[rgba(255,255,255,0.22)] text-white"
          placeholder="请输入要搜索的歌词、歌手、专辑"
          @focus="search"
          @blur="onBlur"
        />
      </AutocompleteAnchor>
      <AutocompleteContent
        id="common-transparent"
        class="absolute z-999 w-full mt-3 bg-white overflow-hidden rounded-lg"
      >
        <AutocompleteViewport class="p-1.25">
          <AutocompleteEmpty
            class="text-mauve8 text-xs font-medium text-center py-2"
          />

          <template v-for="(group, index) in options" :key="group.name">
            <AutocompleteGroup>
              <AutocompleteSeparator
                v-if="index !== 0"
                class="h-px bg-grass6 m-1.25"
              />

              <AutocompleteLabel
                class="px-6.25 text-xs leading-6.25 text-mauve11"
              >
                {{ group.name }}
              </AutocompleteLabel>

              <AutocompleteItem
                v-for="option in group.children"
                :key="option.name"
                :value="option.name"
                class="text-xs leading-none text-grass11 rounded-[3px] flex items-center h-6.25 pr-8.75 pl-6.25 relative select-none data-disabled:text-mauve8 data-disabled:pointer-events-none data-highlighted:outline-none data-highlighted:bg-grass9 data-highlighted:text-grass1"
              >
                <span>
                  {{ option.name }}
                </span>
              </AutocompleteItem>
            </AutocompleteGroup>
          </template>
        </AutocompleteViewport>
      </AutocompleteContent>
    </AutocompleteRoot>
    <div class="window-controls w-35 h-full flex items-center justify-around">
      <div
        @click="minimize"
        class="common-transparent cursor-pointer w-7 h-7 rounded-lg flex items-center justify-center"
      >
        <Minus color="white" :size="16" />
      </div>
      <div
        @click="fullScreen"
        class="common-transparent cursor-pointer w-7 h-7 rounded-lg flex items-center justify-center"
      >
        <Square color="white" :size="14" />
      </div>
      <div
        @click="closeApp"
        class="cursor-pointer commmon-shadow hover:bg-red-500 w-7 h-7 rounded-lg flex items-center justify-center"
      >
        <X color="white" :size="16" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, X, Square, Search, Menu } from '@lucide/vue'
import { useUserStore } from '@src/stores/user'
import createWindow from '@src/utils/createWindow'

/** 坐标点 */
interface Point {
  x: number
  y: number
}

const currentWindow = getCurrentWindow()
const userStore = useUserStore()

const switchState = ref(false)
const isFocus = ref<boolean>(false)
const isConnecting = ref<boolean>(false)
const isConnected = ref<boolean>(false)
const options = ref<Record<string, any>[]>([])

// ============ 节点连线 ============
const flowSvgRef = ref<SVGSVGElement | null>(null)
const sourcePortRef = ref<HTMLElement | null>(null)
const targetPortRef = ref<HTMLElement | null>(null)

const tempLine = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(
  null
)
const connections = ref<{ id: number; path: string }[]>([])
let connectionSeq = 0

/** 把元素中心点换算为 SVG 内部坐标 */
const getCenterInSvg = (el: HTMLElement): Point => {
  const svg = flowSvgRef.value
  if (!svg) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  const svgRect = svg.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2 - svgRect.left,
    y: rect.top + rect.height / 2 - svgRect.top
  }
}

/** 生成反 S 型三次贝塞尔路径（首端向上、尾端向下，形成反向 S） */
const bezierArcPath = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string => {
  const dx = Math.max(1, Math.abs(x2 - x1))
  const offset = dx * 0.5
  const arc = Math.min(22, dx * 0.14)
  // 首端控制点向上、尾端控制点向下，形成与点位近平行的反 S 形
  return `M ${x1} ${y1} C ${x1 + offset} ${y1 - arc}, ${x2 - offset} ${
    y2 + arc
  }, ${x2} ${y2}`
}

const tempLinePath = computed((): string => {
  if (!tempLine.value) return ''
  return bezierArcPath(
    tempLine.value.x1,
    tempLine.value.y1,
    tempLine.value.x2,
    tempLine.value.y2
  )
})

const startConnect = (e: MouseEvent): void => {
  if (!sourcePortRef.value || !flowSvgRef.value) return
  const start = getCenterInSvg(sourcePortRef.value)
  const svgRect = flowSvgRef.value.getBoundingClientRect()
  isConnecting.value = true
  tempLine.value = {
    x1: start.x,
    y1: start.y,
    x2: e.clientX - svgRect.left,
    y2: e.clientY - svgRect.top
  }
  document.addEventListener('mousemove', onConnectMove)
  document.addEventListener('mouseup', onConnectEnd)
}

const onConnectMove = (e: MouseEvent): void => {
  if (!isConnecting.value || !tempLine.value || !flowSvgRef.value) return
  const svgRect = flowSvgRef.value.getBoundingClientRect()
  tempLine.value = {
    ...tempLine.value,
    x2: e.clientX - svgRect.left,
    y2: e.clientY - svgRect.top
  }
}

const onConnectEnd = (e: MouseEvent): void => {
  document.removeEventListener('mousemove', onConnectMove)
  document.removeEventListener('mouseup', onConnectEnd)
  if (!isConnecting.value) return
  isConnecting.value = false

  // 判断鼠标是否落在目标端口上
  let hitTarget = false
  if (targetPortRef.value) {
    const rect = targetPortRef.value.getBoundingClientRect()
    if (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    ) {
      hitTarget = true
    }
  }

  if (hitTarget && sourcePortRef.value && targetPortRef.value) {
    const start = getCenterInSvg(sourcePortRef.value)
    const end = getCenterInSvg(targetPortRef.value)
    connections.value = [
      ...connections.value,
      {
        id: connectionSeq++,
        path: bezierArcPath(start.x, start.y, end.x, end.y)
      }
    ]
    isConnected.value = true
  }

  tempLine.value = null
}

// ============ 搜索相关 ============

const search = (): void => {
  isFocus.value = true
}

const onBlur = (): void => {
  isFocus.value = false
}

// ============ 窗口控制 ============

const minimize = async (): Promise<void> => {
  await currentWindow.minimize()
}

const fullScreen = async (): Promise<void> => {
  await currentWindow.toggleMaximize()
  const isMaximized = await currentWindow.isMaximized()
  if (isMaximized) userStore.borderRadius = '0px'
  else userStore.borderRadius = '15px'
  document.documentElement.style.setProperty(
    '--app-border-radius',
    userStore.borderRadius
  )
}

const closeApp = async (): Promise<void> => {
  await currentWindow.close()
}

/** 点击头像区域 */
const handleAvatarClick = async (): Promise<void> => {
  createWindow.createWin({
    label: 'login',
    title: '网易云登录',
    url: 'https://music.163.com/#/login',
    width: 1045,
    height: 600,
    decorations: true
  })
}
</script>

<style scoped lang="scss">
.provider-logo,
.login-node-orb {
  width: 31px;
  height: 31px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0.04em;
  color: #fff;
  background: rgba(var(--fc-accent-rgb), 0.14);
  box-shadow:
    0 0 14px rgba(var(--fc-accent-rgb), 0.13),
    inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.login-platform-tabs {
  height: auto;
  min-height: 46px;
  border-radius: 13px;
  border-color: rgba(255, 255, 255, 0.05);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.042),
    rgba(255, 255, 255, 0.014)
  );
  cursor: pointer;
  letter-spacing: 0;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.12),
    0 0 12px rgba(255, 255, 255, 0.13);
}

.flow-port {
  position: absolute;
  top: 50%;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1px solid rgba(var(--fc-accent-rgb), 0.58);
  background: rgba(9, 11, 16, 0.94);
  box-shadow:
    0 0 0 3px rgba(var(--fc-accent-rgb), 0.07),
    0 0 11px rgba(var(--fc-accent-rgb), 0.2),
    inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  cursor: crosshair;
  z-index: 8;
  opacity: 0.62;
  transform: translateY(-50%);
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease;

  &::after {
    content: '';
    position: absolute;
    inset: 3px;
    border-radius: inherit;
    background: rgba(var(--fc-accent-rgb), 0.82);
    box-shadow: 0 0 8px rgba(var(--fc-accent-rgb), 0.35);
  }
}

.flow-port-active {
  opacity: 1;
  border-color: rgba(var(--fc-accent-rgb), 1);
  box-shadow:
    0 0 0 3px rgba(var(--fc-accent-rgb), 0.18),
    0 0 16px rgba(var(--fc-accent-rgb), 0.55),
    inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  transform: translateY(-50%) scale(1.18);
}

.flow-port-connected {
  opacity: 1;
  border-color: rgba(var(--fc-accent-rgb), 0.9);
}

.flow-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  z-index: 6;
}

.flow-temp-path {
  stroke: rgba(var(--fc-accent-rgb), 0.95);
  stroke-width: 2;
  stroke-dasharray: 6 5;
  stroke-linecap: round;
  filter: drop-shadow(0 0 4px rgba(var(--fc-accent-rgb), 0.45));
  animation: flow-dash 0.5s linear infinite;
}

.flow-path {
  stroke: rgba(var(--fc-accent-rgb), 0.85);
  stroke-width: 2.2;
  stroke-linecap: round;
  filter: drop-shadow(0 0 6px rgba(var(--fc-accent-rgb), 0.4));
}

@keyframes flow-dash {
  to {
    stroke-dashoffset: -11;
  }
}
</style>
