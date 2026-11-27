<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

import { useUserStore } from './stores/user'
import { setupTrayBridge } from './tray/bridge'

type ResizeDirection =
  | 'East'
  | 'North'
  | 'NorthEast'
  | 'NorthWest'
  | 'South'
  | 'SouthEast'
  | 'SouthWest'
  | 'West'

const appWindow = getCurrentWindow()
const userStore = useUserStore()
const cardRef = ref<HTMLElement | null>(null)

// 卡片边缘向内这 6px 算缩放热区，和 matrixtech-client-pc 的做法一致。
const RESIZE_EDGE = 6

const cursors: Record<ResizeDirection, string> = {
  North: 'ns-resize',
  South: 'ns-resize',
  West: 'ew-resize',
  East: 'ew-resize',
  NorthWest: 'nwse-resize',
  SouthEast: 'nwse-resize',
  NorthEast: 'nesw-resize',
  SouthWest: 'nwse-resize'
}

let maximized = false

/**
 * 窗口本身是透明的，四周留出一圈透明边距用来画卡片阴影；
 * 最大化时去掉留白和圆角，避免屏幕边缘出现黑边。
 */
const syncMaximized = async (): Promise<void> => {
  maximized = await appWindow.isMaximized()
  document.documentElement.classList.toggle('is-maximized', maximized)
}

const hitEdge = (event: PointerEvent): ResizeDirection | null => {
  if (maximized) return null
  const card = cardRef.value?.getBoundingClientRect()
  if (!card) return null

  const { clientX: x, clientY: y } = event
  const horizontal =
    x < card.left + RESIZE_EDGE ? 'West' : x > card.right - RESIZE_EDGE ? 'East' : ''
  const vertical =
    y < card.top + RESIZE_EDGE ? 'North' : y > card.bottom - RESIZE_EDGE ? 'South' : ''

  if (!horizontal && !vertical) return null
  return `${vertical}${horizontal}` as ResizeDirection
}

const onPointerMove = (event: PointerEvent): void => {
  const direction = hitEdge(event)
  document.documentElement.style.cursor = direction ? cursors[direction] : ''
}

const onPointerDown = (event: PointerEvent): void => {
  if (event.button !== 0) return
  const direction = hitEdge(event)
  if (!direction) return
  event.preventDefault()
  event.stopPropagation()
  void appWindow.startResizeDragging(direction).catch(() => undefined)
}

const onPointerLeave = (): void => {
  document.documentElement.style.cursor = ''
}

let unlisten: (() => void) | undefined

onMounted(async () => {
  await syncMaximized()
  unlisten = await appWindow.onResized(() => {
    void syncMaximized()
  })
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('pointerleave', onPointerLeave)

  void setupTrayBridge()

  // 让 Rust 侧的原生关闭（Alt+F4 / 任务栏）也遵守「关闭时动作」设置。
  void invoke('set_exit_action', {
    action: userStore.settings.exitAction
  }).catch(() => undefined)
})

watch(
  () => userStore.settings.exitAction,
  (action) => {
    void invoke('set_exit_action', { action }).catch(() => undefined)
  }
)

onUnmounted(() => {
  unlisten?.()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('pointerleave', onPointerLeave)
})
</script>

<template>
  <div class="window-shell">
    <div ref="cardRef" class="window-card">
      <router-view />
    </div>
  </div>
</template>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

#app {
  --radius: 14px;
  /* 阴影画在这圈透明留白里，窗口边缘不会被裁成硬边 */
  --shadow-gap: 12px;
  font-family: 'harmonyos';
}

.window-shell {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: var(--shadow-gap);
}

.window-card {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: var(--radius);
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.07);
  box-shadow:
    0 4px 8px rgba(0, 0, 0, 0.45),
    0 1px 3px rgba(0, 0, 0, 0.3);
}

html.is-maximized .window-shell {
  padding: 0;
}

html.is-maximized .window-card {
  border-radius: 0;
  border: 0;
  box-shadow: none;
}

:root {
  --primary: #171717;
}
</style>
