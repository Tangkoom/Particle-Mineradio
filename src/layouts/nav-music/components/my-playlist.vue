<template>
  <div
    ref="scrollRef"
    class="music-list-scroll h-full overflow-y-auto overscroll-contain"
    @scroll.passive="onScroll"
  >
    <div
      v-for="item in useStore.playlists"
      :key="item.id"
      class="item mt-3.5 flex items-center gap-2.5 p-2 rounded-[10px] bg-[rgba(255,255,255,0.025)] border border-solid border-[rgba(255,255,255,0.04)] cursor-pointer transform transition-all duration-200"
      @click.stop="openMusicList(item)"
    >
      <div
        class="playlist-card group cursor-pointer rounded-xl box-border transition-all duration-200"
        :class="{
          'playlist-card-loading': loadingPlaylistId === item.id
        }"
        :title="item.name"
        @click.stop="onPlayPlaylist(item)"
      >
        <div
          class="relative w-9.5 h-9.5 aspect-square rounded-md overflow-hidden bg-[#1a1f29]"
        >
          <img
            v-if="item.coverImgUrl"
            :src="item.coverImgUrl"
            alt=""
            :class="{
              'playlist-card-loading': loadingPlaylistId === item.id
            }"
            class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <AudioLines color="rgba(255,255,255,0.3)" :size="22" />
          </div>
          <div
            class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <LoaderCircle
              v-if="loadingPlaylistId === item.id"
              color="white"
              :size="22"
              class="animate-spin"
            />
            <Play v-else color="white" :size="22" :fill="'white'" />
          </div>
        </div>
      </div>
      <div>
        <div class="text-[12px] text-[rgba(255,255,255,0.9)] truncate">
          {{ item.name }}
        </div>
        <div class="text-[10.5px] text-[rgba(255,255,255,0.4)]">
          {{ item.trackCount }} 首
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from '@src/stores/user'
import { usePlayerStore } from '@src/stores/player'
import { getPlaylistSongs, type NeteasePlaylist } from '@src/utils/netease'
import { AudioLines, Play, LoaderCircle } from '@lucide/vue'

const emits = defineEmits<{
  (e: 'open-music-list', playlist: NeteasePlaylist): void
  (e: 'at-bottom', value: boolean): void
}>()

const useStore = useUserStore()
const playerStore = usePlayerStore()

const scrollRef = ref<HTMLElement | null>(null)
const loadingPlaylistId = ref<number | null>(null)

const onScroll = (): void => {
  const el = scrollRef.value
  if (!el) return
  emits('at-bottom', el.scrollTop + el.clientHeight >= el.scrollHeight - 1)
}

/** 点击封面：直接播放整个歌单 */
const onPlayPlaylist = async (playlist: NeteasePlaylist): Promise<void> => {
  if (loadingPlaylistId.value !== null) return
  loadingPlaylistId.value = playlist.id
  try {
    const songs = await getPlaylistSongs(playlist.id)
    if (!songs.length) {
      playerStore.error = `歌单「${playlist.name}」暂无可播放歌曲`
      return
    }
    await playerStore.playPlaylist(songs, 0)
  } catch (error) {
    playerStore.error = error instanceof Error ? error.message : '加载歌单失败'
  } finally {
    loadingPlaylistId.value = null
  }
}

/** 点击歌单条目：通知父级切换到音乐列表视图 */
const openMusicList = (playlist: NeteasePlaylist): void => {
  emits('open-music-list', playlist)
}

onMounted(() => {
  onScroll()
})
</script>

<style scoped lang="scss">
.item {
  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
}
</style>
