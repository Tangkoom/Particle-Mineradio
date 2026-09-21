<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window'

const appWindow = getCurrentWindow()

const updateBorderRadius = async (): Promise<void> => {
  const isMaximized = await appWindow.isMaximized()
  document.documentElement.style.setProperty(
    '--app-border-radius',
    isMaximized ? '0px' : '15px'
  )
}

let unlisten: (() => void) | undefined

onMounted(async () => {
  await updateBorderRadius()
  unlisten = await appWindow.onResized(() => {
    void updateBorderRadius()
  })
})

onUnmounted(() => {
  unlisten?.()
})
</script>

<template>
  <router-view />
</template>

<style>
body,
html,
#app {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

#app {
  border-radius: var(--app-border-radius, 15px);
  background-color: #000;
  font-family: 'harmonyos';
}

:root {
  --primary: #171717;
}
</style>
