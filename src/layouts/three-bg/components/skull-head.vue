<template>
  <div ref="containerRef" class="skull-yui7w"></div>
</template>

<script lang="ts">
/** 一帧的音频电平，所有值归一化到 0..1 */
export interface SkullAudioLevels {
  /** 低频（驱动缩放 / 闪光 / 开颌） */
  bass: number
  /** 中频 */
  mid: number
  /** 高频 */
  treble: number
  /** 节拍脉冲，建议命中瞬间接近 1 后快速衰减 */
  beat: number
}

/**
 * 真实点云模型（52416 点，每点 20 字节：x,y,z,kind,seed）。
 * 文件位于 src/assets/，通过 Vite ?url 导入拿到正确的打包后地址
 * （public 路径猜测在 dev/build 下都不可靠，?url 由 Vite 统一处理）。
 * 注意：放在普通 <script> 模块作用域，供 withDefaults 默认值引用（setup 内局部变量不允许）。
 */
import skullPointsUrl from '@src/assets/skull-decimation-points.bin?url'

const resolveDefaultSkullAssetUrl = (): string => skullPointsUrl
</script>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import * as THREE from 'three'

/* ------------------------------ 参数 ------------------------------ */

const props = withDefaults(
  defineProps<{
    /** 骷髅点云二进制资源地址（需要可被 fetch） */
    assetUrl?: string
    /** 不接真实音频时，用内置模拟律动自动演示 */
    auto?: boolean
    /** 低频电平 0..1（auto=false 时生效） */
    bass?: number
    /** 中频电平 0..1（auto=false 时生效） */
    mid?: number
    /** 高频电平 0..1（auto=false 时生效） */
    treble?: number
    /** 节拍脉冲 0..1（auto=false 时生效） */
    beat?: number
    /** 整体亮度/浓度，映射原版 fx.intensity（0..1） */
    intensity?: number
    /** 粒子点大小倍率 */
    pointScale?: number
    /** 边缘辉光强度 */
    bloomStrength?: number
    /** 骨色对比度 */
    colorBoost?: number
    /** 染色色（对应原版 visualTintColor，默认 #9db8cf） */
    tintColor?: string
    /**
     * 染色强度，对应原版非 custom 模式的 tint 混合量。
     * 原版无封面色板时默认 0.14（冷色微染），有封面色板时约 0.30；设 0 为纯暖骨色。
     */
    tintStrength?: number
    /** 自定义染色模式（对应原版 fx.visualTintMode === 'custom'）：中性骨色为底，近满强度染色 */
    customTint?: boolean
    /** 沉浸模式：模型方向跟随鼠标 + 滚轮缩放；退出后自动恢复初始朝向与缩放 */
    controllable?: boolean
    /** 容器背景，'transparent' 或任意 CSS 颜色 */
    background?: string
    /** 渲染像素比上限，原版 RENDER_DPR_CAP = 1.0（uPointSize 与 uPixel 挂钩，改大会改变观感） */
    pixelRatioCap?: number
    /** 是否抗锯齿，原版 renderer 为 antialias:false */
    antialias?: boolean
  }>(),
  {
    assetUrl: resolveDefaultSkullAssetUrl(),
    auto: true,
    bass: 0,
    mid: 0,
    treble: 0,
    beat: 0,
    intensity: 0.85,
    pointScale: 1.0,
    bloomStrength: 0.62,
    colorBoost: 1.1,
    tintColor: '#9db8cf',
    tintStrength: 0.14,
    customTint: false,
    controllable: false,
    background: 'transparent',
    pixelRatioCap: 1,
    antialias: false
  }
)

const emit = defineEmits<{
  /** 点云层就绪（资源或兜底几何构建完成） */
  (e: 'ready'): void
  /** 资源加载失败（已自动降级到兜底几何） */
  (e: 'error', err: Error): void
}>()

/* ------------------------------ 原版常量 ------------------------------ */

const SKULL_MODEL_BASE_ROTATION_X = -0.26
const SKULL_MODEL_BASE_ROTATION_Y = 0.0
const SKULL_MODEL_SCALE = 2.34
const SKULL_MODEL_BASE_POSITION = { x: 0, y: 0.22, z: 0.1 }
const SKULL_WHEEL_ZOOM_MIN = -0.95
const SKULL_WHEEL_ZOOM_MAX = 1.28

/** 主地址失败后的兜底候选（去掉查询串再试一次），全部失败才用程序化粗模 */
const assetUrlCandidates = (primary: string): string[] => {
  const list = [primary, primary.split('?')[0]]
  return list.filter((v, i) => !!v && list.indexOf(v) === i)
}

/* ------------------------------ DOM / 状态 ------------------------------ */

const containerRef = ref<HTMLDivElement | null>(null)
/** 是否正在使用程序化兜底粗模（真实点云 52416 点全部候选都拉取失败时） */
const usingFallback = ref(false)
/** 最后一次资源加载错误信息（用于徽标展示） */

let renderer!: THREE.WebGLRenderer
let scene!: THREE.Scene
let camera!: THREE.PerspectiveCamera
let dotTexture!: THREE.CanvasTexture
let skullGroup: THREE.Points | null = null
let skullMaterial: THREE.ShaderMaterial | null = null
let resizeObserver: ResizeObserver | null = null

let rafId = 0
let lastFrameAt = 0
let elapsed = 0
let disposed = false
let lastControllable = false

/** 点云资源缓存（同 URL 只拉一次） */
interface SkullAssetResult {
  data: Float32Array | null
  error: string
}
const assetCache = new Map<string, Promise<SkullAssetResult>>()
let assetToken = 0

/* ------------------------------ 运行时缓动状态 ------------------------------ */

const state = {
  opacity: 0,
  ampPulse: 0,
  beatFlash: 0,
  jawOpen: 0,
  wheelZoom: 0,
  wheelZoomTarget: 0,
  pointerX: 0,
  pointerY: 0,
  portrait: false
}

/** props 变更缓存：在 frame 循环里每帧比较，替代 watch（零响应式追踪开销） */
const lastProps = {
  tintColor: props.tintColor,
  tintStrength: props.tintStrength,
  customTint: props.customTint,
  pointScale: props.pointScale,
  bloomStrength: props.bloomStrength,
  colorBoost: props.colorBoost,
  background: props.background,
  assetUrl: props.assetUrl
}

/* ------------------------------ 工具函数 ------------------------------ */

const clampRange = (v: number, min: number, max: number): number => {
  return v < min ? min : v > max ? max : v
}

const normalizeHexColor = (input: string, fallback = '#9db8cf'): string => {
  const v = (input || '').trim()
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) return v
  return fallback
}

/* ------------------------------ 点精灵纹理 ------------------------------ */

const makeDotTexture = (): THREE.CanvasTexture => {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 64
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 31)
  g.addColorStop(0.0, 'rgba(255,255,255,0.96)')
  g.addColorStop(0.42, 'rgba(255,255,255,0.78)')
  g.addColorStop(0.72, 'rgba(255,255,255,0.22)')
  g.addColorStop(1.0, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(cv)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  return tex
}

/* ------------------------------ 点云资源加载 ------------------------------ */

/** 拉取单个地址（成功或失败都会缓存，失败信息用于徽标） */
const fetchSkullAsset = (url: string): Promise<SkullAssetResult> => {
  const cached = assetCache.get(url)
  if (cached) return cached
  const task: Promise<SkullAssetResult> =
    typeof fetch !== 'function'
      ? Promise.resolve({ data: null, error: '当前环境不支持 fetch' })
      : fetch(url, { cache: 'reload' })
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return res.arrayBuffer()
          })
          .then((buf) => {
            if (!buf || buf.byteLength < 20 || buf.byteLength % 20 !== 0) {
              throw new Error('点云文件格式非法（长度不是 20 字节的整数倍）')
            }
            return { data: new Float32Array(buf), error: '' }
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err)
            console.warn(`[SkullYui7w] 点云加载失败 ${url}:`, message)
            return { data: null, error: message }
          })
  assetCache.set(url, task)
  return task
}

/** 依次尝试多个候选地址，任一成功即返回；全部失败返回最后一个错误 */
const loadSkullAsset = async (primary: string): Promise<SkullAssetResult> => {
  let last: SkullAssetResult = { data: null, error: '未尝试任何地址' }
  for (const url of assetUrlCandidates(primary)) {
    last = await fetchSkullAsset(url)
    if (last.data) return { data: last.data, error: '' }
  }
  return last
}

/** 由 .bin 点云构建 BufferGeometry：每点 5 个 float = x,y,z,kind,seed */
const buildGeometryFromAsset = (points: Float32Array): THREE.BufferGeometry => {
  const count = Math.floor(points.length / 5)
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  const kinds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = points[i * 5]
    positions[i * 3 + 1] = points[i * 5 + 1]
    positions[i * 3 + 2] = points[i * 5 + 2]
    kinds[i] = points[i * 5 + 3]
    seeds[i] = points[i * 5 + 4]
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1))
  geo.setAttribute('kind', new THREE.BufferAttribute(kinds, 1))
  return geo
}

/* ---------------------- 兜底：程序化骷髅几何（原版移植） ---------------------- */

const buildFallbackGeometry = (): THREE.BufferGeometry => {
  const pos: number[] = []
  const seed: number[] = []
  const kind: number[] = []

  const pushPoint = (x: number, y: number, z: number, k?: number): void => {
    pos.push(x, y, z)
    seed.push(Math.random() * 1000)
    kind.push(k == null ? 0 : k)
  }
  const pushCurve = (
    count: number,
    fn: (t: number) => { x: number; y: number; z: number },
    k: number,
    jitter = 0.012
  ): void => {
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0
      const p = fn(t)
      pushPoint(
        p.x + (Math.random() - 0.5) * jitter,
        p.y + (Math.random() - 0.5) * jitter,
        p.z + (Math.random() - 0.5) * jitter,
        k
      )
    }
  }
  const rotate2 = (
    x: number,
    y: number,
    a: number
  ): { x: number; y: number } => {
    const c = Math.cos(a)
    const s = Math.sin(a)
    return { x: x * c - y * s, y: x * s + y * c }
  }
  const eyeCut = (x: number, y: number, z: number, side: number): boolean => {
    if (z < 0.16) return false
    const p = rotate2(x - side * 0.38, y - 0.02, side * 0.1)
    const almond =
      Math.pow(Math.abs(p.x) / 0.34, 1.7) +
      Math.pow(Math.abs(p.y) / 0.215, 1.34)
    const slantGate =
      p.y < 0.22 - Math.abs(p.x) * 0.12 && p.y > -0.24 + Math.abs(p.x) * 0.1
    return almond < 1.0 && slantGate
  }
  const noseCut = (x: number, y: number, z: number): boolean => {
    if (z < 0.2 || y > -0.12 || y < -0.62) return false
    const t = clampRange((-0.12 - y) / 0.5, 0, 1)
    const half = 0.05 + t * 0.185
    return Math.abs(x) < half && z > 0.38 + t * 0.18
  }
  const mouthGap = (x: number, y: number, z: number): boolean =>
    z > 0.18 && y < -0.66 && y > -1.03 && Math.abs(x) < 0.3

  const addEllipsoidSurface = (
    count: number,
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    yMin: number,
    yMax: number,
    k: number,
    frontBias: boolean
  ): void => {
    let made = 0
    let guard = 0
    while (made < count && guard < count * 8) {
      guard++
      const theta = frontBias
        ? -Math.PI * 0.07 + Math.random() * Math.PI * 1.14
        : Math.random() * Math.PI * 2
      const phi = Math.acos(1 - Math.random() * 2)
      const sx = Math.sin(phi) * Math.cos(theta)
      const sy = Math.cos(phi)
      const sz = Math.sin(phi) * Math.sin(theta)
      const x = cx + sx * rx * (0.96 + Math.max(0, -sy) * 0.12)
      const y = cy + sy * ry
      const z = cz + sz * rz
      if (y < yMin || y > yMax) continue
      if (
        eyeCut(x, y, z, -1) ||
        eyeCut(x, y, z, 1) ||
        noseCut(x, y, z) ||
        mouthGap(x, y, z)
      )
        continue
      const cheekCarve =
        z > 0.18 &&
        y < -0.18 &&
        y > -0.66 &&
        Math.abs(x) > 0.26 &&
        Math.abs(x) < 0.58 &&
        Math.random() < 0.36
      if (cheekCarve) continue
      pushPoint(x, y, z, k + Math.random() * 0.08)
      made++
    }
  }

  addEllipsoidSurface(
    3150,
    0,
    0.46,
    0,
    0.93,
    0.88,
    0.58,
    -0.16,
    1.35,
    0.055,
    true
  )
  addEllipsoidSurface(
    2100,
    0,
    -0.34,
    0.1,
    0.7,
    0.66,
    0.46,
    -0.95,
    0.14,
    0.1,
    true
  )
  for (let j = 0; j < 1450; j++) {
    const a = Math.random() * Math.PI * 2
    const v = Math.random()
    const y = -1.16 + v * 0.48
    const taper = clampRange((y + 1.16) / 0.48, 0, 1)
    const rx = 0.32 + taper * 0.31
    const rz = 0.22 + taper * 0.18
    const x = Math.cos(a) * rx
    const z = 0.22 + Math.sin(a) * rz
    if (mouthGap(x, y, z)) continue
    if (y > -0.94 && Math.abs(x) < 0.22 && z > 0.18) continue
    pushPoint(x, y, z, 0.15 + Math.random() * 0.1)
  }

  ;[-1, 1].forEach((side) => {
    const cx = side * 0.38
    pushCurve(
      520,
      (t) => {
        const a = t * Math.PI * 2
        const px = Math.cos(a) * (0.345 + Math.sin(a * 2.0) * 0.012)
        const py = Math.sin(a) * (0.205 + Math.cos(a * 2.0) * 0.01)
        const r = rotate2(px, py, -side * 0.1)
        return {
          x: cx + r.x,
          y: 0.02 + r.y - Math.max(0, Math.cos(a)) * 0.018,
          z: 0.72 + Math.sin(a * 2.0) * 0.03
        }
      },
      0.96,
      0.01
    )
    pushCurve(
      330,
      (t) => {
        const x = side * (0.13 + t * 0.58)
        const y = 0.245 - t * 0.085 + Math.sin(t * Math.PI) * 0.055
        return { x, y, z: 0.66 + Math.sin(t * Math.PI) * 0.055 }
      },
      0.98,
      0.01
    )
    pushCurve(
      300,
      (t) => ({
        x: side * (0.3 + t * 0.47),
        y: -0.18 - t * 0.25 + Math.sin(t * Math.PI) * 0.07,
        z: 0.69 - t * 0.095
      }),
      0.84,
      0.012
    )
    pushCurve(
      330,
      (t) => ({
        x: side * (0.62 - t * 0.2),
        y: -0.28 - t * 0.55 + Math.sin(t * Math.PI) * 0.065,
        z: 0.5 + Math.sin(t * Math.PI) * 0.07
      }),
      0.72,
      0.014
    )
  })

  pushCurve(
    360,
    (t) => {
      const x = -0.72 + t * 1.44
      return {
        x,
        y: 0.235 - Math.abs(x) * 0.055 + Math.sin(t * Math.PI) * 0.035,
        z: 0.62 + Math.sin(t * Math.PI) * 0.04
      }
    },
    0.86,
    0.012
  )
  ;[-1, 1].forEach((side) => {
    pushCurve(
      260,
      (t) => ({
        x: side * (0.035 + t * 0.205),
        y: -0.15 - t * 0.43,
        z: 0.79 - t * 0.035
      }),
      0.98,
      0.007
    )
  })
  pushCurve(
    240,
    (t) => {
      const x = -0.25 + t * 0.5
      return { x, y: -0.62 + Math.sin(t * Math.PI) * 0.03, z: 0.7 }
    },
    0.86,
    0.008
  )
  pushCurve(
    420,
    (t) => {
      const a = Math.PI + t * Math.PI
      return {
        x: Math.cos(a) * 0.5,
        y: -0.98 + Math.sin(a) * 0.205,
        z: 0.46 + Math.sin(t * Math.PI) * 0.075
      }
    },
    0.82,
    0.014
  )
  pushCurve(
    360,
    (t) => {
      const x = -0.39 + t * 0.78
      return { x, y: -0.7 + Math.sin(t * Math.PI) * 0.018, z: 0.73 }
    },
    0.96,
    0.006
  )
  pushCurve(
    320,
    (t) => {
      const x = -0.36 + t * 0.72
      return { x, y: -1.005 - Math.sin(t * Math.PI) * 0.018, z: 0.7 }
    },
    0.78,
    0.008
  )
  for (let tooth = -4; tooth <= 4; tooth++) {
    const tx = tooth * 0.082
    const height = tooth === 0 ? 0.3 : 0.25 + (4 - Math.abs(tooth)) * 0.012
    pushCurve(
      58,
      (t) => ({
        x: tx + Math.sin(t * Math.PI) * 0.006,
        y: -0.715 - t * height,
        z: 0.735 - t * 0.02
      }),
      0.94,
      0.004
    )
  }
  pushCurve(
    520,
    (t) => {
      const a = Math.PI * 0.12 + t * Math.PI * 0.76
      return {
        x: Math.cos(a) * 0.98,
        y: 0.42 + Math.sin(a) * 0.92,
        z: 0.48 + Math.sin(t * Math.PI) * 0.1
      }
    },
    0.7,
    0.012
  )
  pushCurve(
    360,
    (t) => {
      const a = t * Math.PI * 2
      return {
        x: Math.cos(a) * 0.52,
        y: -1.19 + Math.sin(a) * 0.082,
        z: 0.24 + Math.sin(a * 2.0) * 0.028
      }
    },
    0.72,
    0.01
  )

  const geo = new THREE.BufferGeometry()
  geo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(pos), 3)
  )
  geo.setAttribute('seed', new THREE.BufferAttribute(new Float32Array(seed), 1))
  geo.setAttribute('kind', new THREE.BufferAttribute(new Float32Array(kind), 1))
  return geo
}

/* ------------------------------ 着色器（原版 1:1） ------------------------------ */

const SKULL_VERTEX_SHADER = /* glsl */ `
precision highp float;
attribute float seed,kind;
uniform float uTime,uPixel,uPointScale,uBloomStrength,uColorBoost;
uniform float uBass,uMid,uTreble,uBeat,uJawOpen,uSkullFlash;
varying float vKind,vLight,vRim,vAmp,vDensity,vFlash;
void main(){
  vec3 pos = position;
  float jawGroup = step(1.0, kind);
  float boneKind = fract(kind);
  vKind = boneKind;
  vec3 n = normalize(vec3(position.x * 0.82, position.y * 0.68, position.z * 1.22 + 0.16));
  float toothBand = smoothstep(0.48, 0.70, position.z) * (1.0 - smoothstep(0.27, 0.48, abs(position.x))) * (1.0 - smoothstep(0.18, 0.46, abs(position.y + 0.72)));
  float toothNoise = fract(sin(seed * 21.731 + floor((position.x + 0.52) * 21.0) * 5.137) * 43758.5453);
  pos.y += toothBand * (toothNoise - 0.5) * 0.020;
  pos.z += toothBand * (fract(sin(seed * 17.923 + position.y * 31.0) * 24634.6345) - 0.5) * 0.012;
  float jawSidePull = jawGroup * smoothstep(-0.42, -1.06, position.y) * smoothstep(0.24, 0.62, abs(position.x)) * (1.0 - smoothstep(0.78, 1.04, abs(position.x))) * smoothstep(0.16, 0.70, position.z);
  pos.x *= 1.0 - jawSidePull * 0.10;
  float jawMask = jawGroup;
  float jawSideAnchor = smoothstep(0.36, 0.66, abs(position.x)) * (1.0 - smoothstep(0.78, 0.98, abs(position.x))) * smoothstep(-0.34, -0.74, position.y) * (1.0 - smoothstep(0.62, 0.86, position.z));
  float jawMotion = jawMask * (1.0 - jawSideAnchor * 0.32);
  vec2 jawHinge = vec2(-0.45, 0.18);
  float jawAngle = uJawOpen * 0.52 * jawMotion;
  float jc = cos(jawAngle);
  float js = sin(jawAngle);
  vec2 jr = pos.yz - jawHinge;
  vec2 openedJaw = vec2(jr.x * jc - jr.y * js, jr.x * js + jr.y * jc) + jawHinge;
  pos.yz = mix(pos.yz, openedJaw, jawMotion);
  float jawDrop = jawMotion * smoothstep(-0.32, -0.88, position.y) * (0.58 + smoothstep(0.18, 0.62, abs(position.x)) * 0.04);
  float openDrive = clamp(uJawOpen, 0.0, 1.25);
  pos.y -= jawDrop * (0.038 + openDrive * 0.100);
  pos.z += jawDrop * (0.003 + openDrive * 0.014);
  float ampDrive = smoothstep(0.20, 0.82, uBass * 0.44 + uMid * 0.22 + uBeat * 0.72);
  float ampPhase = 0.50 + 0.50 * sin(uTime * (1.05 + uMid * 0.30) + seed * 6.2831);
  vFlash = clamp(uSkullFlash * (0.68 + ampPhase * 0.32), 0.0, 1.0);
  vAmp = clamp(ampDrive * 0.045 + vFlash * 0.92 + uTreble * 0.012, 0.0, 1.0);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = max(0.55, -mv.z);
  vec3 vn = normalize(normalMatrix * n);
  vec3 keyDir = normalize(vec3(-0.48, 0.64, 0.60));
  vec3 lowDir = normalize(vec3(-0.10, -0.78, 0.34));
  vec3 fillDir = normalize(vec3(0.36, -0.04, 0.64));
  vec3 rimDir = normalize(vec3(0.88, 0.18, -0.44));
  float key = pow(max(dot(vn, keyDir), 0.0), 1.18);
  float low = pow(max(dot(vn, lowDir), 0.0), 1.34) * 0.10;
  float fill = max(dot(vn, fillDir), 0.0) * 0.055;
  float gothicShadow = smoothstep(-0.10, 0.36, dot(vn, normalize(vec3(0.44, -0.06, -0.58))));
  float dentalLift = smoothstep(0.48, 0.72, position.z) * (1.0 - smoothstep(0.30, 0.54, abs(position.x))) * (1.0 - smoothstep(0.18, 0.48, abs(position.y + 0.70))) * (0.62 + toothNoise * 0.20);
  vRim = pow(max(dot(vn, rimDir), 0.0), 2.50) * (0.24 + uBloomStrength * 0.08 + vFlash * 0.62);
  float dust = fract(sin(seed * 13.871 + position.x * 19.7 + position.y * 7.1) * 43758.5453);
  vDensity = clamp(0.30 + key * 0.70 + vRim * 0.24 - gothicShadow * 0.24 + dust * 0.025 + vFlash * 0.08, 0.16, 1.20);
  vLight = clamp(0.115 + key * 1.02 + low + fill + dentalLift * 0.20 + boneKind * 0.070 + vAmp * 0.56 - gothicShadow * 0.08, 0.035, 1.72);
  float scaleCtl = clamp(uPointScale, 0.48, 2.35);
  float size = (0.035 + boneKind * 0.026) * (0.84 + vDensity * 0.22 + vLight * 0.13 + uBloomStrength * 0.030 + vFlash * 0.18);
  gl_PointSize = clamp(size * uPixel * scaleCtl * 128.0 / dist, 0.95, 7.60);
  gl_Position = projectionMatrix * mv;
}`

const SKULL_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform vec3 uColorA,uColorB,uShadow,uLight;
uniform float uOpacity,uBloomStrength,uColorBoost;
varying float vKind,vLight,vRim,vAmp,vDensity,vFlash;
void main(){
  vec4 tex = texture2D(uMap, gl_PointCoord);
  if(tex.a < 0.070) discard;
  float contrast = clamp(uColorBoost, 0.50, 2.00);
  float lit = clamp(pow(vLight, mix(1.18, 0.74, (contrast - 0.50) / 1.50)), 0.0, 1.28);
  vec3 bone = mix(uColorA, uColorB, clamp((vKind - 0.34) * 2.0 + lit * 0.18, 0.0, 1.0));
  vec3 col = mix(uShadow, bone, clamp(lit, 0.0, 1.0));
  col = mix(col, uLight, clamp(vRim * (0.14 + uBloomStrength * 0.035 + vFlash * 0.40), 0.0, 0.54));
  col = mix(col, uLight, clamp(vAmp * (0.09 + uBloomStrength * 0.025) + vFlash * 0.56, 0.0, 0.68));
  float alpha = tex.a * uOpacity * clamp(0.20 + lit * 0.44 + vDensity * 0.40 + vRim * 0.10 + vFlash * 0.46, 0.12, 1.56);
  gl_FragColor = vec4(col, alpha);
}`

/* ------------------------------ 骨色 / 染色 ------------------------------ */

const baseColors = {
  boneA: new THREE.Color('#b8ae98'),
  boneB: new THREE.Color('#fff4d8'),
  shadow: new THREE.Color('#100d0d'),
  light: new THREE.Color('#ffe3a0'),
  neutralBoneA: new THREE.Color('#9fb7c8'),
  neutralBoneB: new THREE.Color('#eef9ff'),
  neutralShadow: new THREE.Color('#070b12'),
  neutralLight: new THREE.Color('#d6f3ff')
}
const tintScratch = {
  tint: new THREE.Color(),
  soft: new THREE.Color(),
  bright: new THREE.Color(),
  dark: new THREE.Color(),
  boneA: new THREE.Color(),
  boneB: new THREE.Color(),
  shadow: new THREE.Color(),
  light: new THREE.Color()
}

const syncSkullColors = (): void => {
  if (!skullMaterial) return
  const u = skullMaterial.uniforms
  // 对应原版 effectiveSkullVisualTint：custom 是独立模式，与强度无关
  const custom = props.customTint
  const strength = clampRange(props.tintStrength || 0, 0, custom ? 0.99 : 0.78)
  tintScratch.tint.set(normalizeHexColor(props.tintColor))
  tintScratch.soft
    .copy(tintScratch.tint)
    .lerp(new THREE.Color('#e8f5ff'), custom ? 0.05 : 0.28)
  tintScratch.bright
    .copy(tintScratch.tint)
    .lerp(new THREE.Color(custom ? '#f6fbff' : '#fff7d6'), custom ? 0.14 : 0.46)
  tintScratch.dark
    .copy(tintScratch.tint)
    .lerp(new THREE.Color('#05070c'), custom ? 0.74 : 0.72)
  tintScratch.boneA
    .copy(custom ? baseColors.neutralBoneA : baseColors.boneA)
    .lerp(tintScratch.soft, strength * (custom ? 0.99 : 0.64))
  tintScratch.boneB
    .copy(custom ? baseColors.neutralBoneB : baseColors.boneB)
    .lerp(tintScratch.bright, strength * (custom ? 0.94 : 0.46))
  tintScratch.shadow
    .copy(custom ? baseColors.neutralShadow : baseColors.shadow)
    .lerp(tintScratch.dark, strength * (custom ? 0.72 : 0.42))
  tintScratch.light
    .copy(custom ? baseColors.neutralLight : baseColors.light)
    .lerp(tintScratch.bright, strength * (custom ? 0.98 : 0.76))
  ;(u.uColorA.value as THREE.Color).copy(tintScratch.boneA)
  ;(u.uColorB.value as THREE.Color).copy(tintScratch.boneB)
  ;(u.uShadow.value as THREE.Color).copy(tintScratch.shadow)
  ;(u.uLight.value as THREE.Color).copy(tintScratch.light)
}

/* ------------------------------ 粒子层构建 ------------------------------ */

const createSkullMaterial = (): THREE.ShaderMaterial => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: dotTexture },
      uTime: { value: 0 },
      uPixel: { value: renderer.getPixelRatio() },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uBeat: { value: 0 },
      uJawOpen: { value: 0 },
      uSkullFlash: { value: 0 },
      uPointScale: { value: props.pointScale },
      uBloomStrength: { value: props.bloomStrength },
      uColorBoost: { value: props.colorBoost },
      uOpacity: { value: 0 },
      uColorA: { value: new THREE.Color('#b8ae98') },
      uColorB: { value: new THREE.Color('#fff4d8') },
      uShadow: { value: new THREE.Color('#100d0d') },
      uLight: { value: new THREE.Color('#ffe3a0') }
    },
    vertexShader: SKULL_VERTEX_SHADER,
    fragmentShader: SKULL_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending
  })
}

const disposeSkullLayer = (): void => {
  if (!skullGroup) return
  scene.remove(skullGroup)
  skullGroup.geometry.dispose()
  skullMaterial?.dispose()
  skullGroup = null
  skullMaterial = null
}

const rebuildSkullLayer = async (url: string): Promise<void> => {
  const token = ++assetToken
  let geo: THREE.BufferGeometry
  let source: 'asset' | 'fallback'
  const result = await loadSkullAsset(url)
  if (disposed || token !== assetToken) return
  if (result.data) {
    geo = buildGeometryFromAsset(result.data)
    source = 'asset'
    usingFallback.value = false
  } else {
    // 全部候选都失败：退回程序化粗模并给出可见提示 + error 事件
    geo = buildFallbackGeometry()
    source = 'fallback'
    usingFallback.value = true
    emit(
      'error',
      new Error(`骷髅点云加载失败（${result.error}），已使用程序化兜底模型`)
    )
  }
  disposeSkullLayer()
  skullMaterial = createSkullMaterial()
  syncSkullColors()
  skullGroup = new THREE.Points(geo, skullMaterial)
  skullGroup.frustumCulled = false
  skullGroup.userData.source = source
  skullGroup.position.set(
    SKULL_MODEL_BASE_POSITION.x,
    SKULL_MODEL_BASE_POSITION.y,
    SKULL_MODEL_BASE_POSITION.z
  )
  skullGroup.scale.setScalar(SKULL_MODEL_SCALE)
  skullGroup.rotation.x = SKULL_MODEL_BASE_ROTATION_X
  skullGroup.rotation.y = SKULL_MODEL_BASE_ROTATION_Y
  skullGroup.renderOrder = 32
  scene.add(skullGroup)
  state.opacity = 0
  emit('ready')
}

/* ------------------------------ 相机 ------------------------------ */

const setCameraTarget = (
  targetPos: THREE.Vector3,
  targetLook: THREE.Vector3
): void => {
  const zoom = state.wheelZoom
  if (state.portrait) {
    targetPos.set(0, -2.38, 4.92 + zoom)
    targetLook.set(0, -0.28, 0.02)
  } else {
    targetPos.set(0, -2.52, 4.98 + zoom)
    targetLook.set(0, -0.2, 0.02)
  }
}
const camTargetPos = new THREE.Vector3()
const camTargetLook = new THREE.Vector3()

/* ------------------------------ 呼吸 / 自动演示 ------------------------------ */

const breathOffset = (t: number): { x: number; y: number; z: number } => {
  return {
    x: Math.sin(t * 0.33 + 1.7) * 0.028 + Math.sin(t * 0.61 + 0.4) * 0.01,
    y: Math.sin(t * 0.38 + 0.2) * 0.036 + Math.sin(t * 0.83 + 2.1) * 0.012,
    z: Math.sin(t * 0.24 + 2.6) * 0.026
  }
}

/** 无外部音频时的模拟律动：低频起伏 + 周期性节拍 */
const synthLevels = (t: number): Required<SkullAudioLevels> => {
  const beatPhase = (t % 1.05) / 1.05
  const beat = Math.exp(-beatPhase * 5.2) * 0.85
  const bass = clampRange(0.42 + Math.sin(t * 1.3) * 0.16 + beat * 0.32, 0, 1)
  const mid = clampRange(0.26 + Math.sin(t * 0.9 + 1.1) * 0.1, 0, 1)
  const treble = clampRange(0.16 + Math.sin(t * 2.1) * 0.06 + beat * 0.12, 0, 1)
  return { bass, mid, treble, beat }
}

/* ------------------------------ 每帧更新（移植 updateSkullParticleLayer） ------------------------------ */

/** 命令式喂音频通道（调用一次后优先于 bass/mid/treble/beat props） */
const imperativeLevels = reactive<SkullAudioLevels>({
  bass: 0,
  mid: 0,
  treble: 0,
  beat: 0
})
let imperativeUsed = false

const updateSkull = (dt: number): void => {
  if (!skullGroup || !skullMaterial) return
  const u = skullMaterial.uniforms

  const lv = props.auto
    ? synthLevels(elapsed)
    : imperativeUsed
      ? {
          bass: clampRange(imperativeLevels.bass, 0, 1),
          mid: clampRange(imperativeLevels.mid, 0, 1),
          treble: clampRange(imperativeLevels.treble, 0, 1),
          beat: clampRange(imperativeLevels.beat, 0, 1)
        }
      : {
          bass: clampRange(props.bass, 0, 1),
          mid: clampRange(props.mid, 0, 1),
          treble: clampRange(props.treble, 0, 1),
          beat: clampRange(props.beat, 0, 1)
        }

  // 淡入
  state.opacity += (1 - state.opacity) * Math.min(1, dt * 3.2)
  skullGroup.visible = state.opacity >= 0.006
  u.uOpacity.value =
    state.opacity * clampRange(0.78 + props.intensity * 0.18, 0.56, 1.0)

  // 音频电平
  u.uTime.value = elapsed
  u.uBass.value = lv.bass
  u.uMid.value = lv.mid
  u.uTreble.value = lv.treble
  u.uBeat.value = lv.beat

  // 节拍闪光
  const beatTransient = clampRange(Math.max(0, lv.beat - 0.16) / 0.84, 0, 1.35)
  const flashTarget = clampRange(
    Math.pow(beatTransient, 1.34) * 1.08 +
      Math.max(0, lv.bass - 0.6) * 0.18 * beatTransient,
    0,
    1
  )
  state.beatFlash +=
    (flashTarget - state.beatFlash) *
    Math.min(1, dt * (flashTarget > state.beatFlash ? 24 : 6.2))
  u.uSkullFlash.value = state.beatFlash

  // 下颌开合
  const jawTarget = clampRange(
    0.6 +
      (0.5 + 0.5 * Math.sin(elapsed * 0.5)) * 0.05 +
      lv.bass * 0.06 +
      state.beatFlash * 0.09,
    0.52,
    0.88
  )
  state.jawOpen +=
    (jawTarget - state.jawOpen) *
    Math.min(1, dt * (jawTarget > state.jawOpen ? 7.8 : 3.4))
  u.uJawOpen.value = state.jawOpen

  // 律动缩放
  const ampTarget = clampRange(
    lv.bass * 0.006 + lv.mid * 0.004 + state.beatFlash * 0.07,
    0,
    0.09
  )
  state.ampPulse +=
    (ampTarget - state.ampPulse) *
    Math.min(1, dt * (ampTarget > state.ampPulse ? 11 : 4))
  state.wheelZoom +=
    (state.wheelZoomTarget - state.wheelZoom) * Math.min(1, dt * 8)

  const drift = breathOffset(elapsed)
  const targetScale =
    SKULL_MODEL_SCALE *
    (1 + state.ampPulse) *
    clampRange(1 - state.wheelZoom * 0.055, 0.92, 1.08)
  const targetX = SKULL_MODEL_BASE_POSITION.x + drift.x
  const targetY = SKULL_MODEL_BASE_POSITION.y + drift.y
  const targetZ = SKULL_MODEL_BASE_POSITION.z + drift.z
  skullGroup.position.x +=
    (targetX - skullGroup.position.x) * Math.min(1, dt * 4.2)
  skullGroup.position.y +=
    (targetY - skullGroup.position.y) * Math.min(1, dt * 4.8)
  skullGroup.position.z +=
    (targetZ - skullGroup.position.z) * Math.min(1, dt * 4.2)
  skullGroup.scale.x +=
    (targetScale - skullGroup.scale.x) * Math.min(1, dt * 4.6)
  skullGroup.scale.y = skullGroup.scale.x
  skullGroup.scale.z = skullGroup.scale.x

  // 指针视差旋转（仅沉浸式跟随鼠标）
  const parX = props.controllable ? state.pointerX : 0
  const parY = props.controllable ? state.pointerY : 0
  const targetRotY = SKULL_MODEL_BASE_ROTATION_Y + parX * 0.5
  const targetRotX = SKULL_MODEL_BASE_ROTATION_X + -parY * 0.35
  const rotEase = Math.min(1, dt * 7.4)
  skullGroup.rotation.y += (targetRotY - skullGroup.rotation.y) * rotEase
  skullGroup.rotation.x += (targetRotX - skullGroup.rotation.x) * rotEase
  skullGroup.rotation.z += (0 - skullGroup.rotation.z) * Math.min(1, dt * 6)

  // 相机缓动
  setCameraTarget(camTargetPos, camTargetLook)
  camera.position.lerp(camTargetPos, Math.min(1, dt * 4.8))
  camera.lookAt(camTargetLook)
}

/* ------------------------------ 渲染循环 ------------------------------ */

/** 同步交互开关：非沉浸式 canvas 不接收指针事件，沉浸式恢复接收 */
const syncControllable = (enabled: boolean): void => {
  if (renderer?.domElement) {
    renderer.domElement.style.pointerEvents = enabled ? 'auto' : 'none'
  }
}

/**
 * props 变更同步：每帧与 lastProps 缓存比较，变化时才执行对应副作用。
 * 替代 watch——渲染循环本来每帧都在跑，几次引用比较的开销远低于响应式依赖追踪。
 */
const syncPropChanges = (): void => {
  // controllable：进入沉浸式开启交互；退出时恢复初始朝向与缩放（由缓动平滑过渡）
  if (props.controllable !== lastControllable) {
    lastControllable = props.controllable
    syncControllable(props.controllable)
    if (!props.controllable) {
      state.pointerX = 0
      state.pointerY = 0
      state.wheelZoomTarget = 0
    }
  }
  if (
    props.tintColor !== lastProps.tintColor ||
    props.tintStrength !== lastProps.tintStrength ||
    props.customTint !== lastProps.customTint
  ) {
    lastProps.tintColor = props.tintColor
    lastProps.tintStrength = props.tintStrength
    lastProps.customTint = props.customTint
    syncSkullColors()
  }
  if (skullMaterial) {
    if (props.pointScale !== lastProps.pointScale) {
      lastProps.pointScale = props.pointScale
      skullMaterial.uniforms.uPointScale.value = props.pointScale
    }
    if (props.bloomStrength !== lastProps.bloomStrength) {
      lastProps.bloomStrength = props.bloomStrength
      skullMaterial.uniforms.uBloomStrength.value = props.bloomStrength
    }
    if (props.colorBoost !== lastProps.colorBoost) {
      lastProps.colorBoost = props.colorBoost
      skullMaterial.uniforms.uColorBoost.value = props.colorBoost
    }
  }
  if (props.background !== lastProps.background) {
    lastProps.background = props.background
    applyBackground()
  }
  if (props.assetUrl !== lastProps.assetUrl) {
    lastProps.assetUrl = props.assetUrl
    void rebuildSkullLayer(props.assetUrl)
  }
}

const frame = (now: number): void => {
  if (disposed) return
  rafId = requestAnimationFrame(frame)
  const dt = lastFrameAt
    ? clampRange((now - lastFrameAt) / 1000, 0.001, 0.05)
    : 0.016
  lastFrameAt = now
  elapsed += dt
  syncPropChanges()
  updateSkull(dt)
  renderer.render(scene, camera)
}

/* ------------------------------ 尺寸 / 交互 ------------------------------ */

const handleResize = (): void => {
  const el = containerRef.value
  if (!el) return
  const w = el.clientWidth || 1
  const h = el.clientHeight || 1
  state.portrait = h > w * 1.08
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, props.pixelRatioCap)
  )
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  if (skullMaterial)
    skullMaterial.uniforms.uPixel.value = renderer.getPixelRatio()
}

const onPointerMove = (e: PointerEvent): void => {
  const el = containerRef.value
  if (!el || !props.controllable) return
  const rect = el.getBoundingClientRect()
  state.pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1
  state.pointerY = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
}

const onPointerLeave = (): void => {
  state.pointerX = 0
  state.pointerY = 0
}

const onWheel = (e: WheelEvent): void => {
  if (!props.controllable) return
  e.preventDefault()
  state.wheelZoomTarget = clampRange(
    state.wheelZoomTarget + e.deltaY * 0.00155,
    SKULL_WHEEL_ZOOM_MIN,
    SKULL_WHEEL_ZOOM_MAX
  )
}

/* ------------------------------ 生命周期 ------------------------------ */

const applyBackground = (): void => {
  if (!renderer) return
  if (props.background === 'transparent') {
    renderer.setClearColor(0x000000, 0)
  } else {
    renderer.setClearColor(new THREE.Color(props.background), 1)
  }
}

onMounted(() => {
  const el = containerRef.value!

  // 与源码一致：antialias:false、alpha、高性能、透明清屏、DPR 上限 1
  renderer = new THREE.WebGLRenderer({
    antialias: props.antialias,
    alpha: true,
    powerPreference: 'high-performance'
  })
  renderer.setClearColor(0x000000, 0)
  el.appendChild(renderer.domElement)
  renderer.domElement.style.background = 'transparent'
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.pointerEvents = 'none'
  applyBackground()

  scene = new THREE.Scene()
  scene.background = null
  // 竖屏判定必须在首次取机位之前（源码 portrait = innerHeight > innerWidth * 1.08）
  state.portrait = el.clientHeight > el.clientWidth * 1.08
  camera = new THREE.PerspectiveCamera(
    45,
    el.clientWidth / el.clientHeight,
    0.1,
    100
  )
  setCameraTarget(camTargetPos, camTargetLook)
  camera.position.copy(camTargetPos)
  camera.lookAt(camTargetLook)

  dotTexture = makeDotTexture()

  // 同步尺寸 / 像素比（此时相机已就绪）
  handleResize()

  resizeObserver = new ResizeObserver(handleResize)
  resizeObserver.observe(el)
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerleave', onPointerLeave)
  el.addEventListener('wheel', onWheel, { passive: false })

  // 初始化交互开关（若父级挂载时已是沉浸式则直接启用）
  lastControllable = props.controllable
  syncControllable(props.controllable)

  void rebuildSkullLayer(props.assetUrl)
  lastFrameAt = 0
  rafId = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  const el = containerRef.value
  el?.removeEventListener('pointermove', onPointerMove)
  el?.removeEventListener('pointerleave', onPointerLeave)
  el?.removeEventListener('wheel', onWheel)
  disposeSkullLayer()
  dotTexture?.dispose()
  renderer?.dispose()
  renderer?.domElement?.remove()
})

/* ------------------------------ 对外方法 ------------------------------ */

/** 重置视角与滚轮缩放（原版 resetSkullPresetView 的简化版） */
const resetView = (smooth = true): void => {
  state.wheelZoomTarget = 0
  if (!smooth) state.wheelZoom = 0
  state.pointerX = 0
  state.pointerY = 0
}

/** 命令式喂音频（需要配合 :auto="false" 使用） */
const setAudioLevels = (levels: Partial<SkullAudioLevels>): void => {
  imperativeUsed = true
  if (levels.bass !== undefined) imperativeLevels.bass = levels.bass
  if (levels.mid !== undefined) imperativeLevels.mid = levels.mid
  if (levels.treble !== undefined) imperativeLevels.treble = levels.treble
  if (levels.beat !== undefined) imperativeLevels.beat = levels.beat
}

defineExpose({ resetView, setAudioLevels })
</script>

<style scoped>
.skull-yui7w {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: v-bind(
    'props.background === "transparent" ? "transparent" : props.background'
  );
  touch-action: pan-y;
}
</style>
