<template>
  <AutocompleteRoot
    v-model="keyword"
    :ignore-filter="true"
    class="relative w-[calc(100%-600px)]"
  >
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
              :key="option.song.id"
              :value="option.name"
              class="text-xs leading-none text-grass11 rounded-[3px] flex items-center h-6.25 pr-8.75 pl-6.25 relative select-none data-disabled:text-mauve8 data-disabled:pointer-events-none data-highlighted:outline-none data-highlighted:bg-grass9 data-highlighted:text-grass1"
              @select="onSelectSong(option)"
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
</template>

<script setup lang="ts">
import { Search } from '@lucide/vue'
import { type NeteaseSong } from '@src/utils/netease'
import { usePlayerStore } from '@src/stores/player'

/** 搜索结果选项 */
interface SongOption {
  name: string
  song: NeteaseSong
}

const playerStore = usePlayerStore()

const keyword = ref<string>('')
const isFocus = ref<boolean>(false)

const options = ref<{ name: string; children: SongOption[] }[]>([])

const search = (): void => {
  isFocus.value = true
}

const onBlur = (): void => {
  // 延迟收起，避免点击选项前被遮挡
  setTimeout(() => {
    isFocus.value = false
  }, 160)
}

/** 选中搜索结果 => 播放 */
const onSelectSong = (option: SongOption): void => {
  void playerStore.playSong(option.song)
}
</script>

<style scoped lang="scss"></style>
