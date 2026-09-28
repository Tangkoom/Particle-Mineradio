<template>
  <div
    class="titlebar relative z-10 h-12 w-full flex items-center justify-between px-2"
    data-tauri-drag-region
  >
    <Login />
    <ComSearch />
    <div class="window-controls w-45 h-full flex items-center justify-around">
      <div
        class="common-transparent cursor-pointer w-7 h-7 rounded-lg flex items-center justify-center"
      >
        <Settings2 color="white" :size="16" @click="openSetting" />
      </div>
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
    <Setting v-model="showDialog" />
  </div>
</template>

<script setup lang="ts">
import Login from './components/login.vue'
import ComSearch from './components/search.vue'
import Setting from './components/settings.vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import { Minus, X, Square, Settings2 } from '@lucide/vue'
import { useUserStore } from '@src/stores/user'
import { ensureBridge } from '@src/utils/netease'

const currentWindow = getCurrentWindow()
const userStore = useUserStore()

const showDialog = ref<boolean>(false)

const openSetting = (): void => {
  showDialog.value = true
}

// ============ 窗口控制 ============

const minimize = async (): Promise<void> => {
  await currentWindow.minimize()
}

const fullScreen = async (): Promise<void> => {
  await currentWindow.toggleMaximize()
}

const closeApp = async (): Promise<void> => {
  if (userStore.settings.exitAction === 0) {
    // 最小化关闭：隐藏到托盘
    await currentWindow.hide()
  } else {
    // 退出应用：关闭所有进程及托盘
    await invoke('exit_app')
  }
}

// 启动时若本地保留过登录资料，校验隐藏桥接窗口中的 Cookie 是否仍有效
onMounted(() => {
  if (userStore.isLoggedIn) {
    ensureBridge().catch(() => {
      userStore.clearProfile()
    })
  }
})
</script>

<style scoped lang="scss"></style>
