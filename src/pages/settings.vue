<template>
  <div class="w-full h-full">
    <div
      class="titlebar h-12 w-full flex items-center justify-end px-2"
      data-tauri-drag-region
      @dblclick.prevent.stop
    >
      <div
        @click="closeApp"
        class="cursor-pointer commmon-shadow hover:bg-red-500 w-7 h-7 rounded-lg flex items-center justify-center"
      >
        <X color="white" :size="16" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { getCurrentWindow } from '@tauri-apps/api/window'
import { X } from '@lucide/vue'

const currentWindow = getCurrentWindow()

const closeApp = async (): Promise<void> => {
  await currentWindow.close()
}
</script>
