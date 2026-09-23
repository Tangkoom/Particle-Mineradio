<template>
  <ComDialog width="500px">
    <template #trigger>
      <DialogTrigger class="cursor-pointer">
        <div
          class="common-transparent cursor-pointer w-7 h-7 rounded-lg flex items-center justify-center"
        >
          <Settings2 color="#ffffff" :size="16" />
        </div>
      </DialogTrigger>
    </template>
    <template #content>
      <div>
        <div class="text-white text-[14px] text-start py-2">主题</div>
        <div class="flex items-center w-full overflow-x-auto">
          <div
            v-for="theme in themes"
            :key="theme.value"
            @click="updateTheme(theme.value)"
            :class="{
              active: useStore.theme === theme.value
            }"
            class="w-25 h-25 rounded-lg cursor-pointer mr-2 border border-solid border-[#171717] hover:border-[#777]"
          >
            <component :is="theme.component" />
          </div>
        </div>
      </div>
    </template>
  </ComDialog>
</template>

<script setup lang="ts">
import { Settings2 } from '@lucide/vue'
import Lines from '@src/layouts/three-bg/components/lines.vue'
import MusicLine from '@src/layouts/three-bg/components/music-line.vue'
import Weather from '@src/layouts/three-bg/components/weather.vue'
import { useUserStore } from '@src/stores/user'

const useStore = useUserStore()

const themes = reactive<Record<string, any>[]>([
  { value: 0, component: markRaw(Lines) },
  { value: 1, component: markRaw(MusicLine) },
  { value: 2, component: markRaw(Weather) }
])

const updateTheme = (val: number): void => {
  useStore.theme = val
}
</script>

<style scoped lang="scss">
.active {
  border-color: #fff;
}
</style>
