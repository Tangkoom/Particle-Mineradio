<script setup lang="ts">
import { useUserStore } from './stores/user'

const userStore = useUserStore()

watchEffect(() => {
  document.documentElement.style.setProperty(
    '--app-border-radius',
    userStore.borderRadius
  )
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
  border-radius: var(--app-border-radius);
  background-color: #000;
  font-family: 'harmonyos';
}

:root {
  --primary: #171717;
}
</style>
