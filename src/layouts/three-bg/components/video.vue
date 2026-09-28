<template>
  <video
    src="@src/assets/video/Black-Dress-Princess-4K.mp4"
    :autoplay="userStore.settings.theme === 3"
    muted
    loop
    playsinline
    class="w-full h-full object-fill z-[-1]"
  ></video>
</template>

<script setup lang="ts">
import { useUserStore } from '@src/stores/user'

const userStore = useUserStore()
</script>

<style scoped lang="scss"></style>
