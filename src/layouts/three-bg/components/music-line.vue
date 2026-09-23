<template>
  <div ref="containerRef" class="w-full h-full pointer-events-none"></div>
</template>

<script setup lang="ts">
import * as THREE from 'three'
import { usePlayerStore } from '@src/stores/player'
import { getLyric, type NeteaseLyricLine } from '@src/utils/netease'

/**
 * 音频可视化 + 3D 歌词
 *
 * - 频谱环：64 根柱状条围绕原点环形排列，由 AnalyserNode 的 FFT 频域数据驱动高度
 * - 3D 歌词：每行文字用 canvas 渲染成 CanvasTexture 贴到 PlaneGeometry，
 *   按当前播放时间高亮当前行，其余行沿 z 轴向后渐隐
 *
 * 注意：AudioContext / AnalyserNode / MediaElementSource 由 player store 统一持有，
 * 本组件只读取频谱数据，不创建/销毁音频 graph，避免组件卸载导致播放无声。
 */

const containerRef = useTemplateRef<HTMLElement>('containerRef')

// 组件本地的分析器引用（来自 store 单例）与频域数据缓冲
let analyser: AnalyserNode | null = null
let freqData: Uint8Array | null = null

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let barGroup: THREE.Group
let lyricGroup: THREE.Group
let bars: THREE.Mesh[] = []
let lyricMeshes: THREE.Mesh[] = []
let lyricLines: NeteaseLyricLine[] = []
let lastSongId: number | null = null
let rafId: number | null = null
let resizeObserver: ResizeObserver | null = null
/** 滚轮手动滚动歌词偏移（正=向下滚、内容上滚 / 歌词上移） */
let lyricScrollOffset = 0
/** 滚轮空闲多久后开始回弹（毫秒） */
let lyricReturnTimer: number | null = null
/** 是否正在回弹中（true 期间滚轮事件直接重置回弹状态） */
let lyricReturning = false
const LYRIC_RETURN_DELAY = 2500
const LYRIC_RETURN_SPEED = 3 // 每秒接近 0 的速度倍率，越大越快
/** 上一帧 currentTime，用于静音/频谱全 0 时基于播放进度驱动伪频谱 */
let lastCurrentTime = 0
/** 伪频谱相位（静音 fallback 时使用） */
let pseudoPhase = 0
/** 上一帧是否检测到频谱全 0 */
let allZeroLastFrame = false
/** 上一帧时间戳（performance.now()），用于真实帧间隔计算 */
let lastFrameTime = 0
/** 上一帧真实帧间隔（秒） */
let lastFrameDt = 0.016
/** 容器缓存的可视矩形，避免滚轮事件每帧 getBoundingClientRect 触发 layout */
let containerRect: DOMRect | null = null
/** 缓存的歌词当前行索引，避免每帧线性遍历 */
let cachedLyricIdx = -1
/** 缓存的 currentTime，用于判断歌词索引是否需要重算 */
let cachedCurrentTime = 0

const props = withDefaults(
  defineProps<{
    /** 是否允许鼠标控制 canvas（沉浸模式下才开启） */
    controllable?: boolean
  }>(),
  { controllable: false }
)

const playerStore = usePlayerStore()

const BAR_COUNT = 64
const BAR_RADIUS = 8
const BAR_WIDTH = 0.18
const BAR_MAX_HEIGHT = 6
const LYRIC_SPACING = 1.6
const LYRIC_VISIBLE_RANGE = 8

/** 从 store 同步分析器单例并维护本地频域缓冲（store 负责创建/resume/回退） */
const ensureAnalyser = (): void => {
  const node = playerStore.getAnalyser()
  if (analyser !== node) {
    // CORS 回退时 node 变 null，本地旧引用（已关闭的 context）必须同步丢弃
    analyser = node
    freqData = node ? new Uint8Array(node.frequencyBinCount) : null
  }
}

/** 用 canvas 把文字渲染成纹理，贴到 PlaneGeometry 上得到 3D 文字 */
const makeTextMesh = (text: string): THREE.Mesh => {
  const canvas = document.createElement('canvas')
  const fontSize = 64
  const ctx = canvas.getContext('2d')!
  ctx.font = `600 ${fontSize}px harmonyos, sans-serif`
  const metrics = ctx.measureText(text || '...')
  const w = Math.max(64, Math.ceil(metrics.width) + 40)
  const h = fontSize + 30
  canvas.width = w
  canvas.height = h
  // canvas 尺寸变化后 ctx 状态被重置，需要重新设置
  ctx.font = `600 ${fontSize}px harmonyos, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(text || '...', 20, h / 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  tex.minFilter = THREE.LinearFilter
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide
  })
  const geo = new THREE.PlaneGeometry(w / 80, h / 80)
  return new THREE.Mesh(geo, mat)
}

const initScene = (): void => {
  const container = containerRef.value
  if (!container) return
  const w = container.clientWidth
  const h = container.clientHeight

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  renderer.setClearColor(0x000000, 0)
  container.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x000000, 20, 55)

  camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 200)
  camera.position.set(0, 4, 22)
  camera.lookAt(0, 2, 0)

  // 频谱柱：几何 origin 在底部，scale.y 时柱子从 y=0 向上长
  barGroup = new THREE.Group()
  scene.add(barGroup)
  const barGeo = new THREE.BoxGeometry(BAR_WIDTH, 1, BAR_WIDTH)
  barGeo.translate(0, 0.5, 0)
  for (let i = 0; i < BAR_COUNT; i++) {
    const angle = (i / BAR_COUNT) * Math.PI * 2
    const color = new THREE.Color().setHSL(i / BAR_COUNT, 0.85, 0.55)
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9
    })
    const mesh = new THREE.Mesh(barGeo, mat)
    mesh.position.set(
      Math.cos(angle) * BAR_RADIUS,
      0,
      Math.sin(angle) * BAR_RADIUS
    )
    mesh.scale.y = 0.1
    barGroup.add(mesh)
    bars.push(mesh)
  }

  // 歌词组：悬浮在频谱环上方
  lyricGroup = new THREE.Group()
  lyricGroup.position.set(0, 4, 0)
  scene.add(lyricGroup)

  // 滚轮手动滚动歌词（不抢沉浸式 canvas 的指针事件，
  // 容器 div 本身 pointer-events:none，这里直接挂在 window 上，
  // 仅在鼠标位于本组件可视区域时拦截处理）
  window.addEventListener('wheel', onWheel, { passive: false })
  // 缓存容器矩形，滚轮事件中直接使用避免每帧 getBoundingClientRect
  containerRect = container.getBoundingClientRect()

  resizeObserver = new ResizeObserver(onResize)
  resizeObserver.observe(container)
}

/** 滚轮上下滚动查看歌词：累计 deltaY 到 lyricScrollOffset */
const onWheel = (e: WheelEvent): void => {
  // 非沉浸式（歌词隐藏）时不响应滚轮
  if (!props.controllable) return
  // 只在鼠标位于本组件容器范围内时拦截（使用缓存的矩形避免强制 layout）
  const rect = containerRect
  if (!rect) return
  const inX = e.clientX >= rect.left && e.clientX <= rect.right
  const inY = e.clientY >= rect.top && e.clientY <= rect.bottom
  if (!inX || !inY) return
  e.preventDefault()
  // 用户开始滚动 → 取消正在进行的回弹
  lyricReturning = false
  if (lyricReturnTimer !== null) {
    clearTimeout(lyricReturnTimer)
    lyricReturnTimer = null
  }
  // 滚轮向下（deltaY+）= 内容上滚、上方更早行进入视野：
  // layoutLyrics 中 mesh.y = -offset * SPACING，offset 增 → y 减（往下），
  // 所以滚轮向下时 offset 要减小（取反 step）让 mesh.y 增大（往上移）
  const step = -e.deltaY * 0.01
  lyricScrollOffset += step
  // 边界：最多上下滚动 30 行
  const maxOff = 30 * LYRIC_SPACING
  if (lyricScrollOffset > maxOff) lyricScrollOffset = maxOff
  if (lyricScrollOffset < -maxOff) lyricScrollOffset = -maxOff
  // 启动空闲回弹计时器
  lyricReturnTimer = window.setTimeout(() => {
    lyricReturning = true
    lyricReturnTimer = null
  }, LYRIC_RETURN_DELAY)
}

/** 根据当前行 + 滚轮偏移重排歌词 mesh 位置 */
const layoutLyrics = (idx: number): void => {
  for (let i = 0; i < lyricMeshes.length; i++) {
    const mesh = lyricMeshes[i]
    // 滚轮向下（deltaY+）= 内容上滚、上方更早行进入视野：
    // lyricScrollOffset 减 → offset 减 → mesh y 减（向下移）
    const offset = i - idx + lyricScrollOffset / LYRIC_SPACING
    const absOff = Math.abs(offset)
    mesh.visible = absOff <= LYRIC_VISIBLE_RANGE
    if (!mesh.visible) continue
    mesh.position.set(0, -offset * LYRIC_SPACING, -offset * 1.2)
    const mat = mesh.material as THREE.MeshBasicMaterial
    if (Math.abs(offset) < 0.5) {
      mat.opacity = 1
      mesh.scale.set(1.1, 1.1, 1.1)
    } else {
      mat.opacity = Math.max(0.05, 0.5 - absOff * 0.06)
      mesh.scale.set(0.85, 0.85, 0.85)
    }
  }
}

const onResize = (): void => {
  const container = containerRef.value
  if (!container || !renderer) return
  const w = container.clientWidth
  const h = container.clientHeight
  if (!w || !h) return
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  // 尺寸变化时刷新缓存的容器矩形
  containerRect = container.getBoundingClientRect()
}

/** 拉取当前歌曲歌词并生成 mesh */
const loadLyrics = async (songId: number): Promise<void> => {
  try {
    lyricLines = await getLyric(songId)
  } catch {
    lyricLines = []
  }
  // 换歌后重置缓存的歌词索引
  cachedLyricIdx = -1
  cachedCurrentTime = 0
  // 清空旧 mesh
  for (const m of lyricMeshes) {
    lyricGroup.remove(m)
    m.geometry.dispose()
    const mat = m.material as THREE.MeshBasicMaterial
    mat.map?.dispose()
    mat.dispose()
  }
  lyricMeshes = []
  // 限制最多渲染 120 行，避免过多 plane
  const limit = Math.min(lyricLines.length, 40)
  for (let i = 0; i < limit; i++) {
    const mesh = makeTextMesh(lyricLines[i].text)
    lyricMeshes.push(mesh)
    lyricGroup.add(mesh)
  }
  layoutLyrics(-1)
}

/** 根据当前行 + 滚轮偏移重排歌词 mesh 位置（已合并到 initScene 后面） */

const animate = (): void => {
  rafId = requestAnimationFrame(animate)

  // 计算真实帧间隔（秒），用于滚轮回弹 / 伪频谱推进
  const now = performance.now()
  lastFrameDt = Math.min(0.1, (now - lastFrameTime) / 1000)
  lastFrameTime = now

  // 滚轮空闲回弹：指数衰减让 lyricScrollOffset 平滑回到 0
  if (lyricReturning) {
    const k = Math.min(1, LYRIC_RETURN_SPEED * lastFrameDt)
    lyricScrollOffset *= 1 - k
    // 绝对值小到一定程度直接置零，避免无限衰减
    if (Math.abs(lyricScrollOffset) < 0.01) {
      lyricScrollOffset = 0
      lyricReturning = false
    }
  }

  // ===== 频谱柱驱动 =====
  const dt = Math.min(0.1, playerStore.currentTime - lastCurrentTime)
  lastCurrentTime = playerStore.currentTime
  const isPlaying = playerStore.isPlaying
  let realAllZero = false

  // 仅在播放中或 analyser 尚未初始化时同步分析器，避免每帧重复调用
  if (isPlaying || !analyser) {
    ensureAnalyser()
  }

  if (analyser && freqData) {
    // TS5.7+ DOM lib 期望 Uint8Array<ArrayBuffer>，TS5.6 核心 Uint8Array 非泛型
    analyser.getByteFrequencyData(freqData as never)
    const binCount = freqData.length
    let sum = 0
    for (let i = 0; i < binCount; i++) sum += freqData[i]
    realAllZero = sum === 0

    if (!realAllZero) {
      allZeroLastFrame = false
      for (let i = 0; i < BAR_COUNT; i++) {
        const v = freqData[i % binCount] / 255
        const targetH = Math.max(0.1, v * BAR_MAX_HEIGHT)
        const cur = bars[i].scale.y
        bars[i].scale.y = cur + (targetH - cur) * 0.25
      }
    }
  }

  // fallback：静音 / 频谱全 0 / analyser 不可用 → 用伪频谱驱动
  // 仍随播放进度推进，让柱子保持跳动（仅在 isPlaying 时推进相位）
  const needPseudo =
    !analyser || !freqData || realAllZero || allZeroLastFrame || !isPlaying
  if (needPseudo) {
    if (isPlaying) pseudoPhase += dt * 4
    allZeroLastFrame = true
    for (let i = 0; i < BAR_COUNT; i++) {
      const t = pseudoPhase + i * 0.25
      // 多个正弦叠加 + 轻微噪声，让跳动有律动感
      const pseudoV =
        0.3 + 0.35 * Math.abs(Math.sin(t)) + 0.15 * Math.abs(Math.sin(t * 1.7))
      const targetH = Math.max(0.1, pseudoV * BAR_MAX_HEIGHT)
      const cur = bars[i].scale.y
      bars[i].scale.y = cur + (targetH - cur) * 0.18
    }
  }

  // ===== 歌词：仅沉浸式显示，按当前播放时间定位行 =====
  lyricGroup.visible = props.controllable
  if (props.controllable && lyricLines.length && lyricMeshes.length) {
    const t = playerStore.currentTime
    if (t !== cachedCurrentTime) {
      cachedCurrentTime = t
      // 二分查找最后一个 time <= t 的行
      let lo = 0
      let hi = lyricLines.length - 1
      let idx = -1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (lyricLines[mid].time <= t) {
          idx = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }
      cachedLyricIdx = idx
    }
    layoutLyrics(cachedLyricIdx)
  }

  // 场景缓慢自旋（暂停时不旋转，减少无谓的 matrix 计算）
  if (isPlaying) {
    barGroup.rotation.y += 0.002
  }

  renderer?.render(scene, camera)
}

// 播放状态变化：尝试 resume AudioContext（用户手势已发生）
watch(
  () => playerStore.isPlaying,
  (playing) => {
    if (playing) ensureAnalyser()
  }
)

// 当前歌曲变化：拉取歌词
watch(
  () => playerStore.current?.id,
  (id) => {
    if (id && id !== lastSongId) {
      lastSongId = id
      void loadLyrics(id)
    }
  }
)

onMounted(() => {
  initScene()
  // 首次挂载时若已在播放，立即接入分析器
  if (playerStore.isPlaying) ensureAnalyser()
  // 首次挂载时若已有当前歌曲，立即拉歌词
  const cur = playerStore.current
  if (cur?.id) {
    lastSongId = cur.id
    void loadLyrics(cur.id)
  }
  rafId = requestAnimationFrame(animate)
})

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
  rafId = null
  if (lyricReturnTimer !== null) {
    clearTimeout(lyricReturnTimer)
    lyricReturnTimer = null
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('wheel', onWheel)
  // 只清本地引用；音频 graph 归 store 持有，不能断开（否则播放无声）
  analyser = null
  freqData = null
  for (const m of lyricMeshes) {
    m.geometry.dispose()
    const mat = m.material as THREE.MeshBasicMaterial
    mat.map?.dispose()
    mat.dispose()
  }
  lyricMeshes = []
  bars = []
  renderer?.dispose()
  if (renderer?.domElement.parentNode === containerRef.value) {
    containerRef.value?.removeChild(renderer.domElement)
  }
  renderer = null
})
</script>

<style scoped lang="scss"></style>
