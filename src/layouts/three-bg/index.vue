<template>
  <div class="w-full h-full pointer-events-none">
    <Lines v-if="current === 0" :controllable="props.controllable" />
    <MusicLine v-else-if="current === 1" :controllable="props.controllable" />
    <Weather v-else-if="current === 2" :controllable="props.controllable" />
  </div>
</template>

<script setup lang="ts">
import Lines from './components/lines.vue'
import MusicLine from './components/music-line.vue'
import Weather from './components/weather.vue'
import { useUserStore } from '@src/stores/user'

const useStore = useUserStore()

const current = computed(() => {
  return useStore.theme
})

const props = withDefaults(
  defineProps<{
    /** 是否允许鼠标控制 canvas（沉浸模式下才开启） */
    controllable?: boolean
  }>(),
  { controllable: false }
)
</script>

<style scoped lang="scss"></style>
