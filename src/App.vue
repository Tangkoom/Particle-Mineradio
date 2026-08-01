<script setup lang="ts"></script>

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
  border-radius: 15px;
  overflow: hidden;
}

#app {
  background-color: #000;
  font-family: 'harmonyos';
}

:root {
  --primary: #171717;
}
</style>
