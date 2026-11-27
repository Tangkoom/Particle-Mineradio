/**
 * 主窗口与托盘面板之间的桥。
 *
 * - 托盘面板通过 `tray:request` 主动拉取一次状态；
 * - 主窗口用 `tray:state` 把播放器快照推给面板；
 * - 面板用 `tray:command` 把播放 / 切歌 / 音量等操作发给主窗口。
 *
 * 播放器仍然只在主窗口里存在，托盘面板不引用任何 store，保持轻量。
 */
import { invoke } from '@tauri-apps/api/core'
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event'

import { usePlayerStore } from '@src/stores/player'

export type TrayPlayOrder = 'repeat' | 'repeat1' | 'shuffle'

export interface TrayState {
  name: string
  artist: string
  cover: string
  isPlaying: boolean
  loading: boolean
  currentTime: number
  duration: number
  playOrder: TrayPlayOrder
  volume: number
  muted: boolean
  hasSong: boolean
}

export interface TrayCommand {
  action:
    | 'toggle'
    | 'next'
    | 'prev'
    | 'order'
    | 'mute'
    | 'volume'
    | 'seek'
  value?: number
}

let started = false

function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window
}

export async function setupTrayBridge(): Promise<void> {
  if (started || !isTauri()) return
  started = true

  const player = usePlayerStore()

  const snapshot = (): TrayState => ({
    name: player.current?.name ?? '',
    artist: player.current?.artist ?? '',
    cover: player.current?.coverUrl ?? '',
    isPlaying: player.isPlaying,
    loading: player.loading,
    currentTime: player.currentTime,
    duration: player.duration,
    playOrder: player.playOrder,
    volume: player.volume,
    muted: player.muted,
    hasSong: Boolean(player.current)
  })

  const push = (): void => {
    void emitTo('tray', 'tray:state', snapshot()).catch(() => undefined)
  }

  let lastTooltip = ''
  const updateTooltip = (): void => {
    const text = player.current
      ? `${player.current.name} - ${player.current.artist}`.slice(0, 120)
      : 'Particle-Mineradio'

    if (text === lastTooltip) return
    lastTooltip = text
    void invoke('tray_tooltip', { tooltip: text }).catch(() => undefined)
  }

  const run = (command: TrayCommand): void => {
    switch (command.action) {
      case 'toggle':
        player.togglePlay()
        break
      case 'next':
        void player.playNext()
        break
      case 'prev':
        void player.playPrev()
        break
      case 'order':
        player.cyclePlayOrder()
        break
      case 'mute':
        player.toggleMute()
        break
      case 'volume':
        if (typeof command.value === 'number') player.setVolume(command.value)
        break
      case 'seek':
        if (typeof command.value === 'number') player.seek(command.value)
        break
    }
  }

  let unlistenRequest: UnlistenFn | undefined
  let unlistenCommand: UnlistenFn | undefined

  try {
    unlistenRequest = await listen('tray:request', () => {
      push()
      updateTooltip()
    })

    unlistenCommand = await listen<TrayCommand>('tray:command', (event) => {
      run(event.payload)
      push()
      updateTooltip()
    })

    player.$subscribe(() => {
      push()
      updateTooltip()
    })

    push()
    updateTooltip()
  } catch (error) {
    started = false
    unlistenRequest?.()
    unlistenCommand?.()
    console.warn('[tray] 托盘桥接初始化失败', error)
  }
}
