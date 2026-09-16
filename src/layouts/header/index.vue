<template>
  <div
    class="titlebar h-12 w-full flex items-center justify-between px-2"
    data-tauri-drag-region
  >
    <div class="w-35"></div>
    <div
      id="common-transparent"
      class="w-38 h-12 flex items-center px-2 rounded-4xl fixed top-2 left-2"
    >
      <AvatarRoot
        class="bg-blackA3 inline-flex h-9 w-9 select-none items-center justify-center overflow-hidden rounded-full align-middle"
      >
        <AvatarImage
          class="h-full w-full rounded-[inherit] object-cover"
          src="https://images.unsplash.com/photo-1511485977113-f34c92461ad9?ixlib=rb-1.2.1&w=128&h=128&dpr=2&q=80"
          alt="Pedro Duarte"
        />
      </AvatarRoot>
      <div
        class="text-white text-[12px] pl-1 truncate w-[calc(100%-40px)]"
        @click="loginURL"
      >
        七颗冰糖多少钱
      </div>
    </div>
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
import { Minus, X, Square, Search } from '@lucide/vue'
import { useUserStore } from '@src/stores/user'
import createWindow from '@src/utils/createWindow'

const currentWindow = getCurrentWindow()
const userStore = useUserStore()

const isFocus = ref<boolean>(false)
const options = ref<Record<string, any>[]>([])

const search = (): void => {
  isFocus.value = true
}

const onBlur = (): void => {
  isFocus.value = false
}

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

const loginURL = (): void => {
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

<style scoped lang="scss"></style>
