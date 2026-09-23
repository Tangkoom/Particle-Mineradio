<template>
  <div ref="canvasRef" class="w-full h-full"></div>
</template>

<script setup lang="ts">
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import * as GeometryUtils from 'three/addons/utils/GeometryUtils.js'

let renderer: any, scene: any, camera: any, controls: any
let line: any, matLine: any, geometry: any

const props = withDefaults(
  defineProps<{
    /** 是否允许鼠标控制 canvas（沉浸模式下才开启） */
    controllable?: boolean
  }>(),
  { controllable: false }
)

const canvasRef =
  useTemplateRef<InstanceType<typeof HTMLDivElement>>('canvasRef')

let resizeObserver: ResizeObserver | null = null

/** 同步交互开关：关闭时禁用 OrbitControls 并让 canvas 不接收指针事件 */
const syncControllable = (enabled: boolean): void => {
  if (controls) controls.enabled = enabled
  if (renderer?.domElement) {
    renderer.domElement.style.pointerEvents = enabled ? 'auto' : 'none'
  }
}

const init = (): void => {
  const container = canvasRef.value
  if (!container) return
  const width = container.clientWidth || window.innerWidth
  const height = container.clientHeight || window.innerHeight

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  // 限制 pixelRatio 上限为 2，高 DPI 屏幕下避免渲染过多像素
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height)
  renderer.setClearColor(0x000000, 0)
  renderer.setAnimationLoop(animate)
  // 把渲染 canvas 挂到 canvasRef 容器内，而不是 body
  renderer.domElement.style.display = 'block'
  // 默认不接收指针事件，只有 controllable（沉浸模式）时才恢复
  renderer.domElement.style.pointerEvents = 'none'
  container.appendChild(renderer.domElement)

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(40, width / height, 1, 1000)
  camera.position.set(-40, 0, 60)

  // 鼠标控制方向：左键拖拽环绕旋转，滚轮缩放（禁用右键平移）
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.minDistance = 10
  controls.maxDistance = 500
  // 初始交互状态由父级传入的 controllable 决定
  syncControllable(props.controllable)
  controls.update()

  // Position and THREE.Color Data

  const positions = []
  const colors = []

  const points = GeometryUtils.hilbert3D(
    new THREE.Vector3(0, 0, 0),
    20.0,
    1,
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7
  )

  const spline = new THREE.CatmullRomCurve3(points)
  const divisions = Math.round(12 * points.length)
  const point = new THREE.Vector3()
  const color = new THREE.Color()

  for (let i = 0, l = divisions; i < l; i++) {
    const t = i / l

    spline.getPoint(t, point)
    positions.push(point.x, point.y, point.z)

    color.setHSL(t, 1.0, 0.5, THREE.SRGBColorSpace)
    colors.push(color.r, color.g, color.b)
  }

  // Line2 ( LineGeometry, LineMaterial )

  geometry = new LineGeometry()
  geometry.setPositions(positions)
  geometry.setColors(colors)

  matLine = new LineMaterial({
    color: 0xffffff,
    linewidth: 5, // 像素单位（worldUnits 关闭时）
    vertexColors: true,
    dashed: false,
    alphaToCoverage: true
  })
  // LineMaterial 必须设置 resolution，否则线宽计算不正确
  matLine.resolution.set(width, height)

  line = new Line2(geometry, matLine)
  line.computeLineDistances()
  line.scale.set(1, 1, 1)
  scene.add(line)

  // 容器尺寸变化时自适应（窗口缩放 / 布局变化都会触发）
  resizeObserver = new ResizeObserver(onResize)
  resizeObserver.observe(container)
}

const onResize = (): void => {
  const container = canvasRef.value
  if (!container || !renderer) return
  const width = container.clientWidth
  const height = container.clientHeight
  if (!width || !height) return

  camera.aspect = width / height
  camera.updateProjectionMatrix()

  renderer.setSize(width, height)
  matLine?.resolution.set(width, height)
}

const animate = (): void => {
  // 仅在交互开启时更新控制器，避免每帧无谓的 damping 计算
  if (controls.enabled) controls.update()
  renderer.render(scene, camera)
}

watch(
  () => props.controllable,
  (enabled) => syncControllable(enabled)
)

onMounted(() => {
  init()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  controls?.dispose()
  geometry?.dispose()
  matLine?.dispose()
  renderer?.setAnimationLoop(null)
  renderer?.dispose()
  if (renderer?.domElement?.parentNode === canvasRef.value) {
    canvasRef.value?.removeChild(renderer.domElement)
  }
})
</script>

<style scoped lang="scss"></style>
