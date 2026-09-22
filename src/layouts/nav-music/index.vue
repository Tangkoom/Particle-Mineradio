<template>
  <div
    id="playlist-panel"
    class="w-75 h-full p-2 box-border transform transition-all duration-300 rounded-2xl"
    @click.stop
  >
    <div class="playlist-panel-sticky rounded-2xl p-[8px_12px]">
      <div class="flex items-center font-bold text-white text-[14px]">
        歌单 / 列表
      </div>
      <div class="text-[10px] text-[rgba(255,255,255,.32)] mt-1">
        QUEUE · 鼠标点击其他地方自动隐藏
      </div>
      <div class="flex items-center gap-2 mt-2">
        <div
          v-for="item in tabList"
          :key="item.value"
          :class="{
            active: currentActive === item.value
          }"
          class="text-center p-[4px_10px] rounded-4xl border border-solid border-[rgba(255,255,255,.1)] bg-[rgba(255,255,255,.03)] text-[rgba(255,255,255,.55)] cursor-pointer text-[11px]"
          @click="activeClick(item.value)"
        >
          {{ item.name }}
        </div>
      </div>
    </div>
    <div class="w-full h-[calc(100%-92.5px)] relative overflow-hidden">
      <MusicList
        v-if="currentActive === 1"
        :playlist="selectedPlaylist"
        :songs="selectedSongs"
        @at-bottom="(v) => (isAtBottom = v)"
      />
      <MyPlaylist
        v-else-if="currentActive === 2"
        @open-music-list="onOpenMusicList"
        @at-bottom="(v) => (isAtBottom = v)"
      />
      <div
        class="absolute bottom-0 z-10 w-full h-6 bg-linear-to-b from-transparent to-black transition-opacity duration-200 pointer-events-none"
        :class="{ 'opacity-0': isAtBottom }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import MyPlaylist from './components/my-playlist.vue'
import MusicList from './components/music-list.vue'
import { type NeteasePlaylist, type NeteaseSong } from '@src/utils/netease'

const currentActive = ref<number>(1)
const tabList = ref<Record<string, any>[]>([
  { name: '当前队列', value: 1 },
  { name: '我的歌单', value: 2 },
  { name: '我的播客', value: 3 }
])

const selectedPlaylist = ref<NeteasePlaylist | null>(null)
const selectedSongs = ref<NeteaseSong[] | null>(null)

const isAtBottom = ref<boolean>(false)

const activeClick = (id: number): void => {
  currentActive.value = id
}

/** 点击歌单条目：保存选中歌单并切换到音乐列表视图 */
const onOpenMusicList = (playlist: NeteasePlaylist): void => {
  selectedPlaylist.value = playlist
  selectedSongs.value = null
  currentActive.value = 1
  // 切换视图后回到顶部，避免沿用上一次滚动位置
  isAtBottom.value = false
}

/** 直接传入歌曲数组（每日推荐/最近播放）并切换到音乐列表视图 */
const openSongsView = (songs: NeteaseSong[]): void => {
  selectedSongs.value = songs
  selectedPlaylist.value = null
  currentActive.value = 1
  isAtBottom.value = false
}

defineExpose({ currentActive, openSongsView })
</script>

<style scoped lang="scss">
#playlist-panel {
  --playlist-panel-open-ms: var(--mineradio-playlist-panel-open-ms, 280ms);
  --playlist-panel-close-ms: var(--mineradio-playlist-panel-close-ms, 180ms);
  --playlist-panel-motion-ms: var(--playlist-panel-open-ms);
  --playlist-sticky-blur: 38px;
  --playlist-toolbar-blur: 28px;
  --playlist-sticky-a1: 0.94;
  --playlist-sticky-a2: 0.9;
  --playlist-sticky-a3: 0.78;
  --playlist-toolbar-a1: 0.88;
  --playlist-toolbar-a2: 0.82;
  --playlist-toolbar-a3: 0.68;
  background: rgba(12, 12, 18, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(40px) saturate(1.4);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
  overscroll-behavior: contain;
  will-change: transform, opacity;
  contain: layout paint;
  .playlist-panel-sticky {
    background:
      linear-gradient(
        180deg,
        rgba(12, 14, 18, var(--playlist-sticky-a1, 0.94)),
        rgba(9, 11, 15, var(--playlist-sticky-a2, 0.9)) 70%,
        rgba(9, 11, 15, var(--playlist-sticky-a3, 0.78))
      ),
      linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.085),
        rgba(255, 255, 255, 0.028) 42%,
        rgba(var(--fc-accent-rgb), 0.048)
      );
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-top-color: rgba(255, 255, 255, 0.17);
    backdrop-filter: blur(var(--playlist-sticky-blur, 38px)) saturate(1.34)
      brightness(1.06);
    -webkit-backdrop-filter: blur(var(--playlist-sticky-blur, 38px))
      saturate(1.34) brightness(1.06);
    box-shadow:
      0 18px 46px rgba(0, 0, 0, 0.44),
      inset 0 1px 0 rgba(255, 255, 255, 0.11),
      inset 0 -1px 0 rgba(255, 255, 255, 0.045);
    isolation: isolate;
    &::after {
      content: '';
      position: absolute;
      left: 14px;
      right: 14px;
      bottom: 0;
      height: 1px;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.24),
        rgba(var(--fc-accent-rgb), 0.22),
        transparent
      );
      pointer-events: none;
    }
  }
}

.active {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.34);
  color: #eafffb;
}

.item {
  will-change: transform, opacity;
  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
}
</style>
