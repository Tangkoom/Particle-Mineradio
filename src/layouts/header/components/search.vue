<template>
  <AutocompleteRoot
    v-model="keyword"
    :ignore-filter="true"
    class="relative w-[calc(100%-600px)]"
  >
    <AutocompleteAnchor
      id="common-transparent"
      class="window-controls relative rounded-4xl min-w-85 w-full inline-flex items-center justify-between px-3.75 text-xs h-8.75 gap-1.25 border border-white/10"
      :class="{
        'z-999': isFocus
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
      class="absolute left-0 right-0 top-full z-999 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#141519]/95 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
    >
      <AutocompleteViewport class="max-h-80 overflow-y-auto overscroll-contain p-1.5">
        <div
          v-if="loading"
          class="px-3 py-3 text-center text-xs font-medium text-white/45"
        >
          搜索中…
        </div>

        <div
          v-else-if="error"
          class="px-3 py-3 text-center text-xs font-medium text-red-400"
        >
          {{ error }}
        </div>

        <AutocompleteEmpty
          v-else-if="!options.length"
          class="px-3 py-3 text-center text-xs font-medium text-white/45"
        >
          没有找到相关歌曲
        </AutocompleteEmpty>

        <template v-for="group in options" :key="group.name">
          <AutocompleteGroup>
            <AutocompleteLabel
              class="px-10 pb-1 pt-2 text-[11px] font-medium tracking-wide text-white/40"
            >
              {{ group.name }}
            </AutocompleteLabel>

            <AutocompleteItem
              v-for="option in group.children"
              :key="option.song.id"
              :value="option.name"
              class="flex cursor-pointer select-none items-center gap-3 rounded-xl py-2.5 pl-10 pr-3 text-[13px] leading-none text-white/85 outline-none transition-colors data-disabled:pointer-events-none data-disabled:text-white/25 data-highlighted:bg-white/10 data-highlighted:text-white"
              @select="onSelectSong(option)"
            >
              <span class="min-w-0 flex-1 truncate">
                {{ option.name }}
              </span>
              <span class="max-w-[45%] shrink-0 truncate text-[11px] text-white/40">
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
