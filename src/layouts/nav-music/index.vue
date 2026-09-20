<template>
  <div
    id="playlist-panel"
    class="w-75 h-full p-2 box-border transform transition-all duration-300 rounded-2xl"
    @click.stop
  >
    <div class="playlist-panel-sticky rounded-2xl p-[8px_12px]">
      <div class="font-bold text-white text-[14px]">歌单 / 列表</div>
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
    <div class="w-full h-[calc(100%-92.5px)]">
      <div
        v-for="item in musicList"
        :key="item.id"
        class="item mt-3.5 flex items-center gap-2.5 p-2 rounded-[10px] bg-[rgba(255,255,255,0.025)] border border-solid border-[rgba(255,255,255,0.04)] cursor-pointer transform transition-all duration-200"
        @click="activeClick(item.value)"
      >
        <img src="" alt="" class="w-9.5 h-9.5 rounded-md" />
        <div>
          <div class="text-[12px] text-[rgba(255,255,255,0.9)] truncate">
            {{ item.name }}
          </div>
          <div class="text-[10.5px] text-[rgba(255,255,255,0.4)]">
            {{ item.artist }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const currentActive = ref<number>(1)
const musicList = ref<Record<string, any>[]>([
  { id: 1, name: '终会与你同行', artist: '白挺' },
  { id: 2, name: '等不到你', artist: '汪苏泷' }
])
const tabList = ref<Record<string, any>[]>([
  { name: '当前队列', value: 1 },
  { name: '我的歌单', value: 2 },
  { name: '我的播客', value: 3 }
])

const activeClick = (value: number): void => {
  currentActive.value = value
}

defineExpose({ currentActive })
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
