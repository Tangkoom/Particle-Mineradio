<template>
  <div
    v-if="loading"
    class="flex items-center justify-center gap-2 mt-3.5 text-[12px] text-[rgba(255,255,255,0.55)]"
  >
    <LoaderCircle :size="14" class="animate-spin" />
    加载中…
  </div>
  <div
    v-else-if="!musicList.length"
    class="mt-3.5 text-center text-[12px] text-[rgba(255,255,255,0.4)]"
  >
    该歌单暂无可播放歌曲
  </div>
  <div
    v-else
    ref="scrollRef"
    class="music-list-scroll h-full overflow-y-auto overscroll-contain"
    @scroll.passive="onScroll"
  >
    <!-- 撑起总高度，让滚动条反映真实列表长度 -->
    <div :style="{ height: `${totalHeight}px`, position: 'relative' }">
      <div
        v-for="entry in visibleEntries"
        :key="entry.item.id"
        :style="{
          position: 'absolute',
          top: `${entry.top}px`,
          width: '100%'
        }"
        class="item mt-3.5 flex items-center gap-2.5 p-2 rounded-[10px] bg-[rgba(255,255,255,0.025)] border border-solid border-[rgba(255,255,255,0.04)] cursor-pointer transform transition-all duration-200"
        :class="{
          'bg-[rgba(255,255,255,0.2)]! border-[rgba(255,255,255,0.4)]!':
            playerStore.current?.id === entry.item.id
        }"
        @click="onPlaySong(entry.index)"
      >
        <img
          :src="entry.item.coverUrl"
          :alt="entry.item.name"
          class="w-9.5 h-9.5 rounded-md object-cover bg-[rgba(255,255,255,0.05)]"
          loading="lazy"
        />
        <div class="min-w-0 flex-1">
          <div class="text-[12px] text-[rgba(255,255,255,0.9)] truncate">
            {{ entry.item.name }}
          </div>
          <div class="text-[10.5px] text-[rgba(255,255,255,0.4)] truncate">
            {{ entry.item.artist }}
          </div>
        </div>
        <div
          class="text-[10px] text-[rgba(255,255,255,0.35)] tabular-nums pr-1"
        >
          {{ formatPlayTime(entry.item.duration / 1000) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'
import { usePlayerStore, formatPlayTime } from '@src/stores/player'
import {
  getPlaylistSongs,
  type NeteasePlaylist,
  type NeteaseSong
} from '@src/utils/netease'

const props = defineProps<{
  playlist: NeteasePlaylist | null
}>()

const emits = defineEmits<{
  (e: 'at-bottom', value: boolean): void
}>()

const playerStore = usePlayerStore()

const musicList = ref<NeteaseSong[]>([])
const loading = ref(false)

/** 单项总步进 = 自然高度 56 + 间距 14；不设固定 height，让背景只覆盖内容本身 */
const ITEM_HEIGHT = 70
/** 上下额外渲染的缓冲项数，避免快速滚动出现空白 */
const BUFFER = 4

const scrollRef = ref<HTMLElement | null>(null)
const startIndex = ref(0)
const visibleCount = ref(20)

const totalHeight = computed(() => musicList.value.length * ITEM_HEIGHT)

interface VisibleEntry {
  item: NeteaseSong
  index: number
  top: number
}

const visibleEntries = computed<VisibleEntry[]>(() => {
  const start = Math.max(0, startIndex.value - BUFFER)
  const end = Math.min(
    musicList.value.length,
    startIndex.value + visibleCount.value + BUFFER
  )
  const entries: VisibleEntry[] = []
  for (let i = start; i < end; i++) {
    entries.push({
      item: musicList.value[i],
      index: i,
      top: i * ITEM_HEIGHT
    })
  }
  return entries
})

const onScroll = (): void => {
  const el = scrollRef.value
  if (!el) return
  startIndex.value = Math.floor(el.scrollTop / ITEM_HEIGHT)
  visibleCount.value = Math.max(1, Math.ceil(el.clientHeight / ITEM_HEIGHT))
  emits('at-bottom', el.scrollTop + el.clientHeight >= el.scrollHeight - 1)
}

const loadSongs = async (playlist: NeteasePlaylist): Promise<void> => {
  loading.value = true
  try {
    musicList.value = await getPlaylistSongs(playlist.id)
    startIndex.value = 0
    if (scrollRef.value) scrollRef.value.scrollTop = 0
    await nextTick()
    onScroll()
  } catch (error) {
    musicList.value = []
    playerStore.error = error instanceof Error ? error.message : '加载歌单失败'
  } finally {
    loading.value = false
  }
}

/** 点击歌曲：在当前歌单曲目队列中播放 */
const onPlaySong = (index: number): void => {
  if (!musicList.value.length) return
  void playerStore.playPlaylist(musicList.value, index)
}

watch(
  () => props.playlist,
  (val) => {
    if (val) void loadSongs(val)
    else musicList.value = []
  },
  { immediate: true }
)

onMounted(() => {
  onScroll()
})

defineExpose({ scrollRef })
</script>

<style scoped lang="scss">
.music-list-scroll {
  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.item {
  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
}
</style>
