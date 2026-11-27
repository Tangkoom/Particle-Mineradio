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
        ref="inputRef"
        class="w-full outline-none h-full placeholder-[rgba(255,255,255,0.22)] text-white"
        :placeholder="t('请输入要搜索的歌词、歌手、专辑')"
        @focus="onFocus"
        @blur="onBlur"
        @keydown.esc="onEscape"
      />
    </AutocompleteAnchor>
    <AutocompleteContent
      id="common-transparent"
      class="absolute z-999 w-full mt-3 bg-white overflow-hidden rounded-lg"
    >
      <AutocompleteViewport class="p-1.25 max-h-80 overflow-y-auto overscroll-contain">
        <div
          v-if="loading"
          class="text-mauve8 text-xs font-medium text-center py-2"
        >
          搜索中…
        </div>

        <div
          v-else-if="error"
          class="text-red-500 text-xs font-medium text-center py-2 px-3"
        >
          {{ error }}
        </div>

        <AutocompleteEmpty
          v-else-if="!options.length"
          class="text-mauve8 text-xs font-medium text-center py-2"
        >
          没有找到相关歌曲
        </AutocompleteEmpty>

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
              class="text-xs leading-none text-grass11 rounded-[3px] flex items-center gap-2 h-6.25 pr-8.75 pl-6.25 relative select-none data-disabled:text-mauve8 data-disabled:pointer-events-none data-highlighted:outline-none data-highlighted:bg-grass9 data-highlighted:text-grass1"
              @select="onSelectSong(option)"
            >
              <span class="truncate">
                {{ option.name }}
              </span>
              <span class="text-[10px] text-mauve9 truncate">
                {{ option.song.artist }}
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
import { searchSongs, type NeteaseSong } from '@src/utils/netease'
import { usePlayerStore } from '@src/stores/player'
import { useI18n } from 'vue-i18n'

const { t } = useI18n({ useScope: 'global' })

/** 搜索结果选项 */
interface SongOption {
  name: string
  song: NeteaseSong
}

const playerStore = usePlayerStore()

const inputRef = ref<any>(null)
const keyword = ref<string>('')
const isFocus = ref<boolean>(false)
const loading = ref<boolean>(false)
const error = ref<string>('')

const options = ref<{ name: string; children: SongOption[] }[]>([])

let debounceTimer: ReturnType<typeof setTimeout> | undefined
let requestId = 0

const onFocus = (): void => {
  isFocus.value = true
}

const onBlur = (): void => {
  // 延迟收起，避免点击选项前被遮挡
  setTimeout(() => {
    isFocus.value = false
  }, 160)
}

const onEscape = (): void => {
  isFocus.value = false
  inputRef.value?.$el?.blur?.()
}

/** 清空结果并取消正在等待的防抖请求 */
const resetResults = (): void => {
  options.value = []
  error.value = ''
  loading.value = false
}

const runSearch = async (value: string): Promise<void> => {
  const current = ++requestId
  loading.value = true
  error.value = ''
  try {
    const songs = await searchSongs(value)
    if (current !== requestId) return
    options.value = songs.length
      ? [
          {
            name: '歌曲',
            children: songs.map((song) => ({ name: song.name, song }))
          }
        ]
      : []
  } catch (err) {
    if (current !== requestId) return
    options.value = []
    error.value = err instanceof Error ? err.message : '搜索失败，请稍后重试'
  } finally {
    if (current === requestId) loading.value = false
  }
}

watch(keyword, (value) => {
  if (debounceTimer) clearTimeout(debounceTimer)

  const query = value.trim()
  if (!query) {
    requestId++
    resetResults()
    return
  }

  loading.value = true
  error.value = ''
  debounceTimer = setTimeout(() => {
    void runSearch(query)
  }, 300)
})

/** 选中搜索结果 => 播放 */
const onSelectSong = (option: SongOption): void => {
  void playerStore.playSong(option.song)
  isFocus.value = false
  inputRef.value?.$el?.blur?.()
}
</script>

<style scoped lang="scss"></style>
