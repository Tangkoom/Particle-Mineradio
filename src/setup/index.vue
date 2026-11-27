<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Check, FolderOpen, LoaderCircle, X } from '@lucide/vue'

type Mode = 'install' | 'uninstall'
type Phase = 'ready' | 'running' | 'success' | 'done' | 'error'

interface ProgressPayload {
  percent: number
  stage: string
}

const mode = ref<Mode>('install')
const phase = ref<Phase>('ready')
const dir = ref('')
const percent = ref(0)
const stage = ref('')
const error = ref('')
const launchAfter = ref(true)
const files = ref<string[]>([])
const listRef = ref<HTMLElement | null>(null)

const isUninstall = computed(() => mode.value === 'uninstall')
const busy = computed(
  () => phase.value === 'running' || phase.value === 'success'
)
const collapsed = computed(() => busy.value)

const shortPath = computed(() => {
  const value = dir.value
  if (value.length <= 46) return value
  return `…${value.slice(-45)}`
})

const title = computed(() =>
  isUninstall.value ? '卸载 Particle-Mineradio' : '安装 Particle-Mineradio'
)

const subtitle = computed(() =>
  isUninstall.value
    ? '将移除 Particle-Mineradio 及其快捷方式，本地播放数据会保留。'
    : '选择安装位置，安装完成后可从桌面或开始菜单启动。'
)

const appLabel = computed(() =>
  isUninstall.value
    ? 'Particle-Mineradio · 卸载程序'
    : 'Particle-Mineradio · 安装程序'
)

const actionLabel = computed(() => {
  if (phase.value === 'done') return '完成'
  if (phase.value === 'error') return '重试'
  return isUninstall.value ? '卸载' : '开始安装'
})

const doneText = computed(() =>
  isUninstall.value ? '卸载完成' : '安装完成'
)

const doneHint = computed(() =>
  isUninstall.value
    ? 'Particle-Mineradio 已从本机移除。'
    : `已安装到 ${shortPath.value}`
)

const errorText = (reason: unknown): string => {
  if (reason instanceof Error) return reason.message
  return String(reason)
}

const start = async (): Promise<void> => {
  if (busy.value) return

  if (phase.value === 'done') {
    await finish()
    return
  }

  if (!isUninstall.value && !dir.value.trim()) {
    error.value = '请选择安装位置'
    phase.value = 'error'
    return
  }

  error.value = ''
  files.value = []
  percent.value = 0
  stage.value = '准备中…'
  phase.value = 'running'

  try {
    if (isUninstall.value) {
      await invoke('uninstall', { dir: dir.value })
    } else {
      await invoke('install', { dir: dir.value })
    }

    percent.value = 100
    stage.value = doneText.value
    phase.value = 'success'
    window.setTimeout(() => {
      if (phase.value === 'success') phase.value = 'done'
    }, 780)
  } catch (reason) {
    error.value = errorText(reason)
    phase.value = 'error'
  }
}

const finish = async (): Promise<void> => {
  if (isUninstall.value) {
    await closeWindow()
    return
  }

  try {
    if (launchAfter.value) {
      await invoke('launch_app', { dir: dir.value })
    }
  } catch (reason) {
    console.warn('[setup] 启动程序失败', reason)
  }

  await invoke('quit').catch(() => undefined)
}

const chooseDir = async (): Promise<void> => {
  try {
    const picked = await invoke<string | null>('pick_directory')
    if (picked) dir.value = picked
  } catch (reason) {
    error.value = errorText(reason)
  }
}

const toggleLaunch = (): void => {
  launchAfter.value = !launchAfter.value
}

const closeWindow = async (): Promise<void> => {
  try {
    await getCurrentWindow().close()
  } catch {
    window.close()
  }
}

let unlistenProgress: UnlistenFn | undefined
let unlistenFile: UnlistenFn | undefined

onMounted(async () => {
  if (!('__TAURI_INTERNALS__' in window)) return

  try {
    unlistenProgress = await listen<ProgressPayload>('setup-progress', (event) => {
      percent.value = event.payload.percent
      stage.value = event.payload.stage
    })

    unlistenFile = await listen<string>('setup-file', (event) => {
      files.value.push(event.payload)
      if (files.value.length > 300) {
        files.value.splice(0, files.value.length - 300)
      }
      void nextTick(() => {
        if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
      })
    })

    mode.value =
      (await invoke<string>('setup_mode')) === 'uninstall' ? 'uninstall' : 'install'

    dir.value = await invoke<string>(
      isUninstall.value ? 'install_dir' : 'suggested_dir'
    )
  } catch (reason) {
    error.value = errorText(reason)
  }
})

onUnmounted(() => {
  unlistenProgress?.()
  unlistenFile?.()
})
</script>

<template>
  <div class="box-border h-full w-full select-none p-10">
    <div
      class="flex h-full w-full flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[#0e0f13] shadow-[0_12px_28px_rgba(0,0,0,0.6)]"
    >
      <!-- 自绘标题栏 -->
      <header
        data-tauri-drag-region
        class="flex h-11 shrink-0 items-center justify-between border-b border-white/10 px-4"
      >
        <div data-tauri-drag-region class="flex items-center gap-2">
          <img
            src="/icon.png"
            alt=""
            draggable="false"
            class="h-4 w-4 rounded-[4px]"
          />
          <span class="text-[11px] font-medium tracking-wide text-white/45">
            {{ appLabel }}
          </span>
        </div>
        <button
          type="button"
          title="关闭"
          class="grid h-6 w-6 place-items-center rounded-md text-white/35 transition hover:bg-white/10 hover:text-white/80"
          @click="closeWindow"
        >
          <X :size="14" />
        </button>
      </header>

      <main class="flex min-h-0 flex-1 flex-col items-center justify-center px-7 py-4">
        <!-- 准备 / 错误 -->
        <template v-if="phase === 'ready' || phase === 'error'">
          <img
            src="/icon.png"
            alt=""
            draggable="false"
            class="h-14 w-14 rounded-2xl shadow-[0_12px_36px_rgba(0,245,212,0.16)]"
          />
          <h1 class="mt-3.5 text-[19px] font-semibold tracking-tight text-white">
            {{ title }}
          </h1>
          <p class="mt-1 max-w-[400px] text-center text-[11.5px] leading-5 text-white/40">
            {{ subtitle }}
          </p>

          <div
            class="mt-4 flex h-9 w-full max-w-[360px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] pl-2.5 pr-1"
          >
            <FolderOpen :size="14" class="shrink-0 text-white/30" />
            <input
              v-model="dir"
              :readonly="isUninstall"
              spellcheck="false"
              class="h-full min-w-0 flex-1 bg-transparent text-[11.5px] text-white/80 outline-none placeholder:text-white/25"
              placeholder="选择安装位置"
            />
            <button
              v-if="!isUninstall"
              type="button"
              class="h-7 shrink-0 rounded-lg bg-white/[0.08] px-2.5 text-[11px] text-white/55 transition hover:bg-white/[0.13] hover:text-white/85"
              @click="chooseDir"
            >
              浏览
            </button>
          </div>

          <p
            v-if="error"
            class="mt-2 max-w-[360px] truncate text-[11px] text-[#ff7b72]"
            :title="error"
          >
            {{ error }}
          </p>
        </template>

        <!-- 安装 / 卸载进行中 -->
        <template v-else-if="phase === 'running'">
          <div class="flex w-full max-w-[360px] flex-col items-center">
            <h1 class="text-[14px] font-medium text-white/85">
              {{ isUninstall ? '正在卸载…' : '正在安装…' }}
            </h1>

            <div class="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                class="h-full rounded-full bg-gradient-to-r from-[#00f5d4] to-[#9dfff1] transition-[width] duration-200"
                :style="{ width: `${percent}%` }"
              />
            </div>

            <div class="mt-2 flex w-full items-center justify-between text-[10.5px] text-white/35">
              <span class="flex min-w-0 items-center gap-1.5">
                <LoaderCircle :size="12" class="shrink-0 animate-spin" />
                <span class="truncate">{{ stage || '处理中…' }}</span>
              </span>
              <span class="ml-3 tabular-nums">{{ percent }}%</span>
            </div>

            <div
              v-if="isUninstall"
              ref="listRef"
              class="mt-3 h-[86px] w-full overflow-y-auto rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 font-mono text-[9.5px] leading-4 text-white/30"
            >
              <div v-for="file in files" :key="file" class="truncate">
                {{ file }}
              </div>
              <div v-if="!files.length" class="text-white/20">
                等待文件列表…
              </div>
            </div>

            <p v-else class="mt-3 text-[10.5px] text-white/25">
              正在复制文件，请勿关闭窗口
            </p>
          </div>
        </template>

        <!-- 完成 -->
        <template v-else>
          <div
            class="grid h-12 w-12 place-items-center rounded-full bg-[#00f5d4]/10 text-[#00f5d4] ring-1 ring-[#00f5d4]/25"
          >
            <Check :size="24" :stroke-width="2.5" />
          </div>
          <h1 class="mt-3 text-[17px] font-semibold text-white">
            {{ doneText }}
          </h1>
          <p class="mt-1 max-w-[340px] truncate text-center text-[11px] text-white/35">
            {{ doneHint }}
          </p>

          <button
            v-if="!isUninstall"
            type="button"
            class="mt-4 flex items-center gap-2 text-[11.5px] text-white/55 transition hover:text-white/80"
            @click="toggleLaunch"
          >
            <span
              class="grid h-4 w-4 place-items-center rounded-[5px] border transition"
              :class="
                launchAfter
                  ? 'border-[#00f5d4] bg-[#00f5d4] text-black'
                  : 'border-white/20 bg-white/[0.04] text-transparent'
              "
            >
              <Check :size="10" :stroke-width="3" />
            </span>
            立即运行 Particle-Mineradio
          </button>
        </template>
      </main>

      <footer class="flex h-16 shrink-0 items-center justify-center border-t border-white/10 px-7">
        <button
          type="button"
          class="flex h-10 items-center justify-center overflow-hidden rounded-full text-[12px] font-medium transition-[width,background-color,color,transform] duration-300 disabled:cursor-default disabled:opacity-80"
          :class="[
            isUninstall
              ? 'bg-[#ff5b5b] text-white hover:bg-[#ff6d6d]'
              : 'bg-white text-black hover:bg-white/90',
            collapsed ? 'w-10' : 'w-[300px]'
          ]"
          :disabled="busy || (isUninstall && !dir)"
          @click="start"
        >
          <template v-if="phase === 'running'">
            <LoaderCircle :size="17" class="animate-spin" />
          </template>
          <template v-else-if="phase === 'success'">
            <Check :size="17" :stroke-width="3" />
          </template>
          <template v-else>
            {{ actionLabel }}
          </template>
        </button>
      </footer>
    </div>
  </div>
</template>

<style>
html,
body,
#app {
  height: 100%;
  width: 100%;
  margin: 0;
  overflow: hidden;
  background: transparent;
}

body {
  color: #fff;
  font-family: 'harmonyos', 'Microsoft YaHei UI', 'Segoe UI', sans-serif;
  user-select: none;
}
</style>
