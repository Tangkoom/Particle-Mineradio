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
      <!-- 渲染窗口：所有可见项放在这个容器里，整体 translateY 平移，
           避免给每个 item 单独改 top 触发几十次 layout -->
      <div
        :style="{
          transform: windowTransform,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          willChange: 'transform'
        }"
      >
        <div
          v-for="entry in visibleEntries"
          :key="entry.id"
          :style="{
            height: `${ITEM_CONTENT}px`,
            marginBottom: `${GAP}px`
          }"
          class="item mt-3.5 flex items-center gap-2.5 p-2 rounded-[10px] bg-[rgba(255,255,255,0.025)] border border-solid border-[rgba(255,255,255,0.04)] cursor-pointer transform transition-all duration-200"
          :class="{
            'bg-[rgba(255,255,255,0.2)]! border-[rgba(255,255,255,0.4)]!':
              playerStore.current?.id === entry.id
          }"
          @click="onPlaySong(entry._index)"
        >
          <img
            :src="entry.coverUrl"
            :alt="entry.name"
            class="w-9.5 h-9.5 rounded-md object-cover bg-[rgba(255,255,255,0.05)]"
            loading="lazy"
          />
          <div class="min-w-0 flex-1">
            <div class="text-[12px] text-[rgba(255,255,255,0.9)] truncate">
              {{ entry.name }}
            </div>
            <div class="text-[10.5px] text-[rgba(255,255,255,0.4)] truncate">
              {{ entry.artist }}
            </div>
          </div>
          <div
            class="text-[10px] text-[rgba(255,255,255,0.35)] tabular-nums pr-1"
          >
            {{ formatPlayTime(entry.duration / 1000) }}
          </div>
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
  songs: NeteaseSong[] | null
}>()

const emits = defineEmits<{
  (e: 'at-bottom', value: boolean): void
}>()

const playerStore = usePlayerStore()

const musicList = ref<NeteaseSong[]>([])
const loading = ref(false)

/** 每项内容高度：img 38 + padding 16 + border 2 */
const ITEM_CONTENT = 56
/** 项与项之间的间距 */
const GAP = 14
/** 单项总步进 = 内容 + 间距，用于 spacer 高度与 translateY 计算 */
const ITEM_HEIGHT = ITEM_CONTENT + GAP
/** 上下额外渲染的缓冲项数，覆盖快速滚动一帧的位移 */
const BUFFER = 6

const scrollRef = ref<HTMLElement | null>(null)
const renderStart = ref(0)
const renderCount = ref(20)

const totalHeight = computed(() => musicList.value.length * ITEM_HEIGHT)

const windowTransform = computed(
  () => `translateY(${renderStart.value * ITEM_HEIGHT}px)`
)

interface RenderEntry extends NeteaseSong {
  _index: number
}

const visibleEntries = computed<RenderEntry[]>(() => {
  const start = renderStart.value
  const end = Math.min(musicList.value.length, start + renderCount.value)
  const arr: RenderEntry[] = []
  for (let i = start; i < end; i++) {
    const song = musicList.value[i]
    if (!song) continue
    arr.push({ ...song, _index: i })
  }
  return arr
})

let rafId: number | null = null

const applyScroll = (): void => {
  rafId = null
  const el = scrollRef.value
  if (!el) return
  const visible = Math.max(1, Math.ceil(el.clientHeight / ITEM_HEIGHT))
  // 期望渲染窗口起点：让可视区位于窗口中部，上下都有缓冲
  const desiredStart = Math.max(
    0,
    Math.floor(el.scrollTop / ITEM_HEIGHT) - BUFFER
  )
  const desiredCount = visible + BUFFER * 2
  // 仅在区间变化时更新 renderStart/renderCount，
  // 否则 Vue patch 会重复触发不必要的 vnode diff
  if (
    desiredStart !== renderStart.value ||
    desiredCount !== renderCount.value
  ) {
    renderStart.value = desiredStart
    renderCount.value = desiredCount
  }
  emits('at-bottom', el.scrollTop + el.clientHeight >= el.scrollHeight - 1)
}

const onScroll = (): void => {
  // rAF 节流：一帧内多次 scroll 事件只跑一次重算
  if (rafId !== null) return
  rafId = requestAnimationFrame(applyScroll)
}

const loadSongs = async (): Promise<void> => {
  loading.value = true
  try {
    // 优先使用直接传入的歌曲数组（每日推荐/最近播放），否则按歌单拉取
    if (props.songs && props.songs.length) {
      musicList.value = props.songs
    } else if (props.playlist) {
      musicList.value = await getPlaylistSongs(props.playlist.id)
    } else {
      musicList.value = []
    }
    renderStart.value = 0
    if (scrollRef.value) scrollRef.value.scrollTop = 0
    await nextTick()
    applyScroll()
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
  () => [props.playlist, props.songs],
  () => {
    void loadSongs()
  },
  { immediate: true }
)

onMounted(() => {
  applyScroll()
})

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
})

defineExpose({ scrollRef })
</script>

<style scoped lang="scss">
.item {
  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
}
</style>
